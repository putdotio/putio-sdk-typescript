import { createClients, createPromiseClient, createLiveHarness } from "../support/harness.js";
import { readOptionalSecret } from "../support/secrets.ts";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const publicClient = await createPromiseClient();
const paymentOwnerToken = readOptionalSecret("PUTIO_TOKEN_PAYMENT_OWNER");
const ownerClient = paymentOwnerToken
  ? await createPromiseClient({
      accessToken: paymentOwnerToken,
    })
  : authClient;

const live = createLiveHarness("payment live");
const { assert, assertErrorTag, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

let subAccountClientPromise: Promise<typeof authClient> | null = null;

const getSubAccountClient = async () => {
  const token = readOptionalSecret("PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT");

  if (!token) {
    throw new Error(
      "Missing required payment sub-account fixture: PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT must be a first-party token for a family sub-account.",
    );
  }

  subAccountClientPromise ??= createPromiseClient({
    accessToken: token,
  });

  const client = await subAccountClientPromise;
  const account = await client.account.getInfo({});

  if (!account.is_sub_account) {
    throw new Error("PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT must belong to a family sub-account");
  }

  return client;
};

const getOwnerPaymentInfo = async () => {
  const [account, payment] = await Promise.all([
    ownerClient.account.getInfo({}),
    ownerClient.payment.getInfo(),
  ]);

  assert(!account.is_sub_account, "payment owner fixture must not be a family sub-account");
  assert(payment.plan?.type === "onetime", "expected prepaid onetime payment info on test account");

  return payment;
};

const assertPaymentSubAccountRestriction = (error: unknown, operation: string) =>
  (() => {
    try {
      return assertOperationError(error, {
        domain: "payment",
        errorType: "PAYMENT_SUB_ACCOUNT_NOT_ALLOWED",
        operation,
        statusCode: 403,
      });
    } catch {
      return assertErrorTag(error, {
        status: 403,
        tag: "PutioAuthError",
      });
    }
  })();

await run("payment info shape", async () => {
  const info = await getOwnerPaymentInfo();
  assert(typeof info.has_pending_payment === "boolean", "expected has_pending_payment boolean");
  return {
    expiration_date: info.expiration_date,
    plan_code: info.plan?.code,
  };
});

await run("payment options are public", async () => {
  const options = await publicClient.payment.listOptions();
  assert(options.length > 0, "expected public payment options");
  assert(
    options.some((option) => option.name === "credit-card"),
    "expected credit-card option",
  );
  return {
    option_names: options.map((option) => option.name),
  };
});

await run("payment plans require restricted scope", async () => {
  try {
    await oauthClient.payment.listPlans();
    throw new Error("expected listPlans to fail with invalid_scope");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "listPlans",
      errorType: "invalid_scope",
      statusCode: 401,
    });
  }
});

await run("payment info requires restricted scope", async () => {
  try {
    await oauthClient.payment.getInfo();
    throw new Error("expected getInfo to fail with invalid_scope");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "getInfo",
      errorType: "invalid_scope",
      statusCode: 401,
    });
  }
});

await run("payment plans shape", async () => {
  const plans = await ownerClient.payment.listPlans();
  assert(plans.length > 0, "expected at least one payment plan group");
  assert(
    plans.some((group) => group.sub_plans.some((plan) => plan.type === "subscription")),
    "expected at least one subscription plan",
  );
  return {
    groups: plans.length,
    first_group: plans[0]?.plan_group_code,
  };
});

await run("payment history shape", async () => {
  const payments = await ownerClient.payment.listHistory({
    unreported_only: false,
  });
  assert(Array.isArray(payments), "expected payment history array");
  if (payments[0]) {
    assert(Array.isArray(payments[0].refunds), "expected payment refunds array");
    assert(typeof payments[0].amount_currency === "string", "expected payment currency");
  }
  return {
    count: payments.length,
    first_id: payments[0]?.id ?? null,
  };
});

await run("payment invites shape", async () => {
  const invites = await ownerClient.payment.listInvites();
  assert(Array.isArray(invites), "expected invites array");
  return {
    count: invites.length,
  };
});

await run("payment invites require restricted scope", async () => {
  try {
    await oauthClient.payment.listInvites();
    throw new Error("expected listInvites to fail with invalid_scope");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "listInvites",
      errorType: "invalid_scope",
      statusCode: 401,
    });
  }
});

await run("payment fastspring confirm requires restricted scope", async () => {
  try {
    await oauthClient.payment.confirmFastspringOrder("codex-bogus-reference");
    throw new Error("expected confirmFastspringOrder to fail with invalid_scope");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "confirmFastspringOrder",
      errorType: "invalid_scope",
      statusCode: 401,
    });
  }
});

await run("payment fastspring confirm bogus reference currently yields generic 500", async () => {
  try {
    await ownerClient.payment.confirmFastspringOrder("codex-bogus-reference");
    throw new Error("expected bogus fastspring reference to fail");
  } catch (error) {
    return assertErrorTag(error, {
      status: 403,
      tag: "PutioAuthError",
    });
  }
});

await run("payment preview for one-time target", async () => {
  await getOwnerPaymentInfo();

  const preview = await ownerClient.payment.changePlan.preview({
    payment_type: "credit-card",
    plan_path: "1TB_365_once",
  });
  assert(preview.target_plan.plan_type === "onetime", "expected onetime preview target");
  assert(preview.target_plan.plan_code === "1TB_365_once", "expected requested plan path");
  return {
    plan_code: preview.target_plan.plan_code,
    simulated_expiration: preview.target_plan.simulated_expiration,
  };
});

await run("payment preview for subscription target", async () => {
  await getOwnerPaymentInfo();

  const preview = await ownerClient.payment.changePlan.preview({
    payment_type: "credit-card",
    plan_path: "1TB_365_subscription",
  });
  assert(preview.target_plan.plan_type === "subscription", "expected subscription preview target");
  assert(preview.Paddle.currency === "USD", "expected Paddle preview currency");
  return {
    plan_code: preview.target_plan.plan_code,
    prorated: preview.prorated,
  };
});

await run("payment preview invalid coupon yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.changePlan.preview({
      coupon_code: "codex_invalid_coupon",
      payment_type: "credit-card",
      plan_path: "1TB_365_once",
    });
    throw new Error("expected previewChangePlan to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "previewChangePlan",
      errorType: "PAYMENT_COUPON_CODE_NOT_FOUND",
      statusCode: 404,
    });
  }
});

await run("payment preview invalid plan yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.changePlan.preview({
      payment_type: "credit-card",
      plan_path: "codex_invalid_plan_path",
    });
    throw new Error("expected previewChangePlan to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "previewChangePlan",
      errorType: "PAYMENT_PLAN_NOT_FOUND",
      statusCode: 404,
    });
  }
});

await run("payment submit invalid plan yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.changePlan.submit({
      payment_type: "credit-card",
      plan_path: "codex_invalid_plan_path",
    });
    throw new Error("expected submitChangePlan to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "submitChangePlan",
      errorType: "PAYMENT_PLAN_NOT_FOUND",
      statusCode: 404,
    });
  }
});

await run("payment voucher info invalid code yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.voucher.getInfo("codex-invalid-voucher");
    throw new Error("expected getVoucherInfo to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "getVoucherInfo",
      errorType: "PAYMENT_COUPON_CODE_NOT_FOUND",
      statusCode: 404,
    });
  }
});

await run("payment redeem invalid code yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.voucher.redeem("codex-invalid-voucher");
    throw new Error("expected redeemVoucher to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "redeemVoucher",
      errorType: "PAYMENT_COUPON_CODE_NOT_FOUND",
      statusCode: 404,
    });
  }
});

await run("payment stop subscription on prepaid account yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.stopSubscription();
    throw new Error("expected stopSubscription to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "stopSubscription",
      errorType: "PAYMENT_SUBSCRIPTION_NOT_FOUND",
      statusCode: 404,
    });
  }
});

await run("payment report with empty ids yields typed 400", async () => {
  try {
    await ownerClient.payment.report([]);
    throw new Error("expected empty report to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "reportPayments",
      statusCode: 400,
    });
  }
});

await run("payment paddle waiting invalid checkout yields typed 404", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.methods.addPaddleWaitingPayment({
      checkout_id: "bogus-checkout-id",
      product_id: 1,
    });
    throw new Error("expected createPaddleWaitingPayment to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "createPaddleWaitingPayment",
      errorType: "PAYMENT_PADDLE_WAITING",
      statusCode: 404,
    });
  }
});

await run("payment coinbase invalid plan yields typed 400", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.methods.createCoinbaseCharge("");
    throw new Error("expected createCoinbaseCharge to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "createCoinbaseCharge",
      errorType: "PAYMENT_UNKNOWN_PLAN",
      statusCode: 400,
    });
  }
});

await run("payment opennode invalid plan yields typed 400", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.methods.createOpenNodeCharge("");
    throw new Error("expected createOpenNodeCharge to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "createOpenNodeCharge",
      errorType: "PAYMENT_UNKNOWN_PLAN",
      statusCode: 400,
    });
  }
});

await run("payment nano invalid plan yields typed 400", async () => {
  await getOwnerPaymentInfo();

  try {
    await ownerClient.payment.methods.createNanoPaymentRequest("");
    throw new Error("expected createNanoPaymentRequest to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "createNanoPaymentRequest",
      errorType: "PAYMENT_UNKNOWN_PLAN",
      statusCode: 400,
    });
  }
});

await run("payment sub-account preview is rejected", async () => {
  const subAccountClient = await getSubAccountClient();

  try {
    await subAccountClient.payment.changePlan.preview({
      payment_type: "credit-card",
      plan_path: "1TB_365_once",
    });
    throw new Error("expected previewChangePlan to reject sub-account fixture");
  } catch (error) {
    return assertPaymentSubAccountRestriction(error, "previewChangePlan");
  }
});

await run("payment sub-account submit is rejected", async () => {
  const subAccountClient = await getSubAccountClient();

  try {
    await subAccountClient.payment.changePlan.submit({
      payment_type: "credit-card",
      plan_path: "1TB_365_once",
    });
    throw new Error("expected submitChangePlan to reject sub-account fixture");
  } catch (error) {
    return assertPaymentSubAccountRestriction(error, "submitChangePlan");
  }
});

await run("payment sub-account stop subscription is rejected", async () => {
  const subAccountClient = await getSubAccountClient();

  try {
    await subAccountClient.payment.stopSubscription();
    throw new Error("expected stopSubscription to reject sub-account fixture");
  } catch (error) {
    return assertPaymentSubAccountRestriction(error, "stopSubscription");
  }
});

await run("payment sub-account voucher redeem is rejected", async () => {
  const subAccountClient = await getSubAccountClient();

  try {
    await subAccountClient.payment.voucher.redeem("codex-invalid-voucher");
    throw new Error("expected redeemVoucher to reject sub-account fixture");
  } catch (error) {
    return assertPaymentSubAccountRestriction(error, "redeemVoucher");
  }
});

finish();
