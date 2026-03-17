import { createClients, createPromiseClient, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const publicClient = await createPromiseClient();

const live = createLiveHarness("payment live");
const { assert, assertErrorTag, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

await run("payment info shape", async () => {
  const info = await authClient.payment.getInfo();
  assert(info.plan?.type === "onetime", "expected prepaid onetime payment info on test account");
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
  const plans = await authClient.payment.listPlans();
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
  const payments = await authClient.payment.listHistory({
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
  const invites = await authClient.payment.listInvites();
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
    await authClient.payment.confirmFastspringOrder("codex-bogus-reference");
    throw new Error("expected bogus fastspring reference to fail");
  } catch (error) {
    return assertErrorTag(error, {
      status: 500,
      tag: "PutioApiError",
    });
  }
});

await run("payment preview for one-time target", async () => {
  const preview = await authClient.payment.changePlan.preview({
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
  const preview = await authClient.payment.changePlan.preview({
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
  try {
    await authClient.payment.changePlan.preview({
      coupon_code: "codex_invalid_coupon",
      payment_type: "credit-card",
      plan_path: "1TB_365_once",
    });
    throw new Error("expected invalid coupon to fail");
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
  try {
    await authClient.payment.changePlan.preview({
      payment_type: "credit-card",
      plan_path: "codex_invalid_plan_path",
    });
    throw new Error("expected invalid preview plan to fail");
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
  try {
    await authClient.payment.changePlan.submit({
      payment_type: "credit-card",
      plan_path: "codex_invalid_plan_path",
    });
    throw new Error("expected invalid submit plan to fail");
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
  try {
    await authClient.payment.voucher.getInfo("codex-invalid-voucher");
    throw new Error("expected invalid voucher info to fail");
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
  try {
    await authClient.payment.voucher.redeem("codex-invalid-voucher");
    throw new Error("expected invalid voucher redeem to fail");
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
  try {
    await authClient.payment.stopSubscription();
    throw new Error("expected stopSubscription to fail on prepaid account");
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
    await authClient.payment.report([]);
    throw new Error("expected empty report to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "reportPayments",
      errorType: "PAYMENT_BAD_REQUEST",
      statusCode: 400,
    });
  }
});

await run("payment paddle waiting invalid checkout yields typed 404", async () => {
  try {
    await authClient.payment.methods.addPaddleWaitingPayment({
      checkout_id: "bogus-checkout-id",
      product_id: 1,
    });
    throw new Error("expected invalid waiting payment to fail");
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
  try {
    await authClient.payment.methods.createCoinbaseCharge("");
    throw new Error("expected invalid coinbase plan to fail");
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
  try {
    await authClient.payment.methods.createOpenNodeCharge("");
    throw new Error("expected invalid opennode plan to fail");
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
  try {
    await authClient.payment.methods.createNanoPaymentRequest("");
    throw new Error("expected invalid nano plan to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "payment",
      operation: "createNanoPaymentRequest",
      errorType: "PAYMENT_UNKNOWN_PLAN",
      statusCode: 400,
    });
  }
});

finish();
