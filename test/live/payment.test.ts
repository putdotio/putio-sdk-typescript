import { test } from "vite-plus/test";

import { createPutioSdkPromiseClient, type PutioSdkPromiseClient } from "../../dist/index.js";
import {
  assert,
  assertErrorTag,
  assertOperationError,
  assertPresent,
  createLiveTokenClients,
  rejectsWith,
  rejectsWithErrorTag,
  rejectsWithOperationError,
} from "./support/harness.js";
import { readOptionalSecret } from "./support/secrets.js";

const { authClient, oauthClient } = createLiveTokenClients();
const publicClient = createPutioSdkPromiseClient();
const paymentOwnerToken = readOptionalSecret("PUTIO_TOKEN_PAYMENT_OWNER");
const paymentSubAccountToken = readOptionalSecret("PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT");

const ownerClient = paymentOwnerToken
  ? createPutioSdkPromiseClient({ accessToken: paymentOwnerToken })
  : undefined;

const accountClient = ownerClient ?? authClient;

const subAccountClient = paymentSubAccountToken
  ? createPutioSdkPromiseClient({ accessToken: paymentSubAccountToken })
  : authClient;

const ownerTest = test.skipIf(!ownerClient);

const requireOwnerClient = (): PutioSdkPromiseClient =>
  assertPresent(ownerClient, "PUTIO_TOKEN_PAYMENT_OWNER is required");

const getSubAccountClient = async (): Promise<PutioSdkPromiseClient> => {
  const account = await subAccountClient.account.getInfo({});

  assert(
    account.is_sub_account,
    "payment sub-account fixture must be a family sub-account: set PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT",
  );

  return subAccountClient;
};

const requirePrepaidOwner = async (): Promise<PutioSdkPromiseClient> => {
  const client = requireOwnerClient();

  const [account, payment] = await Promise.all([
    client.account.getInfo({}),
    client.payment.getInfo(),
  ]);

  assert(!account.is_sub_account, "payment owner fixture must not be a family sub-account");
  assert(payment.plan?.type === "onetime", "expected prepaid onetime payment info on test account");

  return client;
};

const assertSubAccountRestriction = (cause: unknown, operation: string): void => {
  try {
    assertOperationError(cause, {
      domain: "payment",
      errorType: "PAYMENT_SUB_ACCOUNT_NOT_ALLOWED",
      operation,
      statusCode: 403,
    });
  } catch {
    assertErrorTag(cause, { status: 403, tag: "PutioAuthError" });
  }
};

const rejectsAsSubAccount = (promise: Promise<unknown>, operation: string): Promise<void> =>
  rejectsWith(promise, (cause) => assertSubAccountRestriction(cause, operation));

const rejectsInvalidScope = (promise: Promise<unknown>, operation: string) =>
  rejectsWithOperationError(promise, {
    domain: "payment",
    errorType: "invalid_scope",
    operation,
    statusCode: 401,
  });

ownerTest(
  "payment owner fixture is a prepaid owner (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    await requirePrepaidOwner();
  },
);

test("payment options are public", async () => {
  const options = await publicClient.payment.listOptions();

  assert(
    options.some((option) => option.name === "credit-card"),
    "expected credit-card option",
  );
});

test("payment plans require restricted scope", async () => {
  await rejectsInvalidScope(oauthClient.payment.listPlans(), "listPlans");
});

test("payment info requires restricted scope", async () => {
  await rejectsInvalidScope(oauthClient.payment.getInfo(), "getInfo");
});

test("payment plans include a subscription plan", async () => {
  const plans = await accountClient.payment.listPlans();

  assert(
    plans.some((group) => group.sub_plans.some((plan) => plan.type === "subscription")),
    "expected at least one subscription plan",
  );
});

test("payment history decodes", async () => {
  await accountClient.payment.listHistory({ unreported_only: false });
});

test("payment invites decode", async () => {
  await accountClient.payment.listInvites();
});

test("payment invites require restricted scope", async () => {
  await rejectsInvalidScope(oauthClient.payment.listInvites(), "listInvites");
});

test("payment fastspring confirm requires restricted scope", async () => {
  await rejectsInvalidScope(
    oauthClient.payment.confirmFastspringOrder("putio-typescript-sdk-bogus-reference"),
    "confirmFastspringOrder",
  );
});

test("payment fastspring confirm bogus reference yields PutioAuthError 403", async () => {
  await rejectsWithErrorTag(
    accountClient.payment.confirmFastspringOrder("putio-typescript-sdk-bogus-reference"),
    { status: 403, tag: "PutioAuthError" },
  );
});

ownerTest("payment preview for one-time target (needs PUTIO_TOKEN_PAYMENT_OWNER)", async () => {
  const client = await requirePrepaidOwner();

  const preview = await client.payment.changePlan.preview({
    payment_type: "credit-card",
    plan_path: "1TB_365_once",
  });

  assert(preview.target_plan.plan_type === "onetime", "expected onetime preview target");
  assert(preview.target_plan.plan_code === "1TB_365_once", "expected requested plan path");
});

ownerTest("payment preview for subscription target (needs PUTIO_TOKEN_PAYMENT_OWNER)", async () => {
  const client = await requirePrepaidOwner();

  const preview = await client.payment.changePlan.preview({
    payment_type: "credit-card",
    plan_path: "1TB_365_subscription",
  });

  assert(preview.target_plan.plan_type === "subscription", "expected subscription preview target");
  assert(preview.Paddle.currency === "USD", "expected Paddle preview currency");
});

ownerTest(
  "payment preview invalid coupon yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.changePlan.preview({
        coupon_code: "putio-typescript-sdk-invalid-coupon",
        payment_type: "credit-card",
        plan_path: "1TB_365_once",
      }),
      {
        domain: "payment",
        operation: "previewChangePlan",
        errorType: "PAYMENT_COUPON_CODE_NOT_FOUND",
        statusCode: 404,
      },
    );
  },
);

ownerTest(
  "payment preview invalid plan yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.changePlan.preview({
        payment_type: "credit-card",
        plan_path: "putio-typescript-sdk-invalid-plan-path",
      }),
      {
        domain: "payment",
        operation: "previewChangePlan",
        errorType: "PAYMENT_PLAN_NOT_FOUND",
        statusCode: 404,
      },
    );
  },
);

ownerTest(
  "payment submit invalid plan yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.changePlan.submit({
        payment_type: "credit-card",
        plan_path: "putio-typescript-sdk-invalid-plan-path",
      }),
      {
        domain: "payment",
        operation: "submitChangePlan",
        errorType: "PAYMENT_PLAN_NOT_FOUND",
        statusCode: 404,
      },
    );
  },
);

ownerTest(
  "payment voucher info invalid code yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.voucher.getInfo("putio-typescript-sdk-invalid-voucher"),
      {
        domain: "payment",
        operation: "getVoucherInfo",
        errorType: "PAYMENT_COUPON_CODE_NOT_FOUND",
        statusCode: 404,
      },
    );
  },
);

ownerTest(
  "payment redeem invalid code yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.voucher.redeem("putio-typescript-sdk-invalid-voucher"),
      {
        domain: "payment",
        operation: "redeemVoucher",
        errorType: "PAYMENT_COUPON_CODE_NOT_FOUND",
        statusCode: 404,
      },
    );
  },
);

ownerTest(
  "payment stop subscription on prepaid account yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(client.payment.stopSubscription(), {
      domain: "payment",
      operation: "stopSubscription",
      errorType: "PAYMENT_SUBSCRIPTION_NOT_FOUND",
      statusCode: 404,
    });
  },
);

ownerTest(
  "payment paddle waiting invalid checkout yields typed 404 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.methods.addPaddleWaitingPayment({
        checkout_id: "bogus-checkout-id",
        product_id: 1,
      }),
      {
        domain: "payment",
        operation: "createPaddleWaitingPayment",
        errorType: "PAYMENT_PADDLE_WAITING",
        statusCode: 404,
      },
    );
  },
);

ownerTest(
  "payment opennode unknown plan yields typed 400 (needs PUTIO_TOKEN_PAYMENT_OWNER)",
  async () => {
    const client = await requirePrepaidOwner();
    await rejectsWithOperationError(
      client.payment.methods.createOpenNodeCharge("putio-typescript-sdk-invalid-plan"),
      {
        domain: "payment",
        operation: "createOpenNodeCharge",
        errorType: "PAYMENT_UNKNOWN_PLAN",
        statusCode: 400,
      },
    );
  },
);

test("payment sub-account preview is rejected", async () => {
  const client = await getSubAccountClient();

  await rejectsAsSubAccount(
    client.payment.changePlan.preview({ payment_type: "credit-card", plan_path: "1TB_365_once" }),
    "previewChangePlan",
  );
});

test("payment sub-account submit is rejected", async () => {
  const client = await getSubAccountClient();

  await rejectsAsSubAccount(
    client.payment.changePlan.submit({ payment_type: "credit-card", plan_path: "1TB_365_once" }),
    "submitChangePlan",
  );
});

test("payment sub-account stop subscription is rejected", async () => {
  const client = await getSubAccountClient();

  await rejectsAsSubAccount(client.payment.stopSubscription(), "stopSubscription");
});

test("payment sub-account voucher redeem is rejected", async () => {
  const client = await getSubAccountClient();

  await rejectsAsSubAccount(
    client.payment.voucher.redeem("putio-typescript-sdk-invalid-voucher"),
    "redeemVoucher",
  );
});
