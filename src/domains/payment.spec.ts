import { PutioOperationError } from "../core/errors.js";
import { describe, expect, it } from "vite-plus/test";

import * as payment from "./payment.js";
import {
  expectFailure,
  getAuthorizationHeader,
  getFormBody,
  jsonResponse,
  runSdkEffect,
  runSdkExit,
} from "../../test/support/sdk-test.js";

const paymentInfo = {
  extend_30: null,
  extend_365: null,
  has_pending_payment: false,
  pending_bitpay: null,
  status: "OK" as const,
};

const paymentPlan = {
  common_properties: {
    family_invites: 2,
    seed_ratio: 1,
    seed_time: 60,
    storage_space: 100,
    torrent_slot: 10,
  },
  plan_group_code: "pro",
  sub_plans: [
    {
      code: "pro-monthly",
      daily_price: "0.33",
      fastspring_url: null,
      is_trial_subscription: false,
      period_days: 30,
      price: "9.99",
      subscription_trial_period: null,
      type: "subscription" as const,
    },
  ],
};

describe("payment domain", () => {
  it("classifies all change-plan response variants", () => {
    expect(
      payment.classifyPaymentChangePlanResponse({
        status: "OK",
        urls: [
          {
            provider: "Fastspring",
            type: "credit-card",
            url: "https://checkout.put.io",
          },
        ],
      }),
    ).toMatchObject({ type: "checkout" });

    expect(
      payment.classifyPaymentChangePlanResponse({
        confirmation: true,
        status: "OK",
      }),
    ).toMatchObject({ type: "confirmation_required" });

    expect(
      payment.classifyPaymentChangePlanResponse({
        charged_amount: "10.00",
        charged_currency: "USD",
        next_payment: {
          amount: "10.00",
          billing_date: "2026-04-17",
          currency: "USD",
        },
        status: "OK",
      }),
    ).toMatchObject({ type: "subscription_updated" });

    expect(
      payment.classifyPaymentChangePlanResponse({
        status: "OK",
      }),
    ).toMatchObject({ type: "success" });
  });

  it("covers payment info, lists, and preview flows", async () => {
    expect(
      await runSdkEffect(payment.getPaymentInfo(), () => jsonResponse(paymentInfo), {
        accessToken: "token-123",
      }),
    ).toEqual(paymentInfo);

    expect(
      await runSdkEffect(
        payment.getPaymentInfo(),
        () =>
          jsonResponse({
            ...paymentInfo,
            last_payment: {},
          }),
        {
          accessToken: "token-123",
        },
      ),
    ).toEqual({
      ...paymentInfo,
      last_payment: {},
    });

    expect(
      await runSdkEffect(
        payment.listPaymentPlans(),
        () => jsonResponse({ plans: [paymentPlan], status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(payment.listPaymentOptions(), (request) => {
        expect(getAuthorizationHeader(request)).toBeUndefined();

        return jsonResponse({
          options: [
            {
              discount_percent: 0,
              name: "credit-card",
              suitable_plan_types: ["subscription"],
            },
          ],
          status: "OK",
        });
      }),
    ).toEqual([
      {
        discount_percent: 0,
        name: "credit-card",
        suitable_plan_types: ["subscription"],
      },
    ]);

    expect(
      await runSdkEffect(
        payment.listPaymentHistory({
          unreported_only: true,
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/payment/history?unreported_only=true");

          return jsonResponse({
            payments: [
              {
                amount: "9.99",
                amount_currency: "USD",
                coupon_code: null,
                date: "2026-03-17",
                id: 1,
                invoice: null,
                plan: {
                  name: "Pro",
                  period_days: 30,
                  price: "9.99",
                  type: "subscription",
                },
                refunded: false,
                refunds: [],
                return_status: "accepted",
                type: "subscription",
              },
            ],
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        payment.listPaymentInvites(),
        () =>
          jsonResponse({
            status: "OK",
            vouchers: [{ is_converted: false, url: "https://put.io/voucher", used_by: null }],
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        payment.previewPaymentChangePlan({
          coupon_code: "SAVE20",
          payment_type: "credit-card",
          plan_path: "pro/monthly",
        }),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/payment/change_plan/pro%2Fmonthly?coupon_code=SAVE20&payment_type=credit-card",
          );

          return jsonResponse({
            Fastspring: {
              charge_amount: "7.99",
              currency: "USD",
              prorated_amount: null,
              refund_amount: null,
            },
            Paddle: {
              charge_amount: "7.99",
              currency: "USD",
              next_billing_date: "2026-04-17",
            },
            "Paddle Billing": {
              next_billing_date: "2026-04-17",
            },
            amount: "7.99",
            charge_amount: true,
            credit: null,
            currency: "USD",
            current_plan: {
              plan_type: "subscription",
              subscription_payment_provider: "Paddle",
            },
            is_product_change: true,
            new_remaining_days: 28,
            prorated: null,
            status: "OK",
            target_plan: {
              hd_avail: 200,
              is_trial_subscription: false,
              new_code: "pro-yearly",
              period_days: 365,
              plan_code: "pro-yearly",
              plan_name: "Pro Yearly",
              plan_type: "subscription",
              price: "99.99",
              simulated_expiration: null,
              subscription_trial_period: null,
            },
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ currency: "USD", charge_amount: true });
  });

  it("covers payment change submission and follow-up mutation endpoints", async () => {
    const checkout = await runSdkEffect(
      payment.submitPaymentChangePlan({
        confirmation_code: "confirm",
        coupon_code: "SAVE20",
        payment_type: "credit-card",
        plan_path: "pro/monthly",
      }),
      (request) => {
        expect(request.url).toBe(
          "https://api.put.io/v2/payment/change_plan/pro%2Fmonthly?coupon_code=SAVE20",
        );
        const body = getFormBody(request);
        expect(body.get("confirmation_code")).toBe("confirm");
        expect(body.get("payment_type")).toBe("credit-card");

        return jsonResponse({
          status: "OK",
          urls: [
            {
              provider: "Fastspring",
              type: "credit-card",
              url: "https://checkout.put.io",
            },
            {
              price_id: "pri_123",
              provider: "Paddle Billing",
              type: "credit-card",
            },
          ],
        });
      },
      { accessToken: "token-123" },
    );

    expect(payment.classifyPaymentChangePlanResponse(checkout)).toMatchObject({
      type: "checkout",
    });

    expect(
      await runSdkEffect(
        payment.confirmFastspringOrder("ref-1"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/payment/fs-confirm/ref-1");
          return jsonResponse({ confirmed: true, status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe(true);

    await runSdkEffect(payment.stopPaymentSubscription(), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });

    expect(
      await runSdkEffect(
        payment.getPaymentVoucherInfo("voucher-1"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/payment/redeem_voucher/voucher-1");

          return jsonResponse({
            current_plan: {
              expiration_date: null,
              type: "subscription",
            },
            new_remaining_days: 10,
            status: "OK",
            target_plan: {
              code: "pro",
              group_code: "pro",
              hd_avail: 100,
              name: "Pro",
              simulated_expiration: null,
              type: "subscription",
            },
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ new_remaining_days: 10 });

    await runSdkEffect(
      payment.redeemPaymentVoucher("voucher-1"),
      () => jsonResponse({ status: "OK" }),
      { accessToken: "token-123" },
    );

    await runSdkEffect(
      payment.reportPayments([1, 2]),
      (request) => {
        expect(getFormBody(request).get("payment_ids")).toBe("1,2");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    await runSdkEffect(
      payment.createPaddleWaitingPayment({
        checkout_id: "checkout-1",
        product_id: 5,
      }),
      (request) => {
        const body = getFormBody(request);
        expect(body.get("checkout_id")).toBe("checkout-1");
        expect(body.get("product_id")).toBe("5");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    expect(
      await runSdkEffect(
        payment.getPaddleBillingInvoiceUrl(123),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/payment/methods/paddle_billing/invoice/123",
          );
          return jsonResponse({ url: "https://paddle.test/invoice.pdf" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("https://paddle.test/invoice.pdf");

    expect(
      await runSdkEffect(
        payment.createPaddleBillingUpdatePaymentMethodTransaction(456),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/payment/methods/paddle_billing/update_payment_method/456",
          );
          return jsonResponse({ transaction_id: "txn_123" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("txn_123");

    expect(
      await runSdkEffect(
        payment.createCoinbaseCharge("plan/path"),
        (request) => {
          expect(getFormBody(request).get("plan_fs_path")).toBe("plan/path");
          return jsonResponse({ coinbase: { code: "cb-code" }, status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("cb-code");

    expect(
      await runSdkEffect(
        payment.createOpenNodeCharge("plan/path"),
        (request) => {
          expect(getFormBody(request).get("plan_fs_path")).toBe("plan/path");
          return jsonResponse({
            opennode: { checkout_url: "https://checkout.opennode.com" },
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("https://checkout.opennode.com");
  });

  it("maps payment operation failures", async () => {
    const failure = await runSdkExit(
      payment.submitPaymentChangePlan({
        plan_path: "pro/monthly",
      }),
      () =>
        jsonResponse(
          {
            error_message: "Coupon already used",
            error_type: "PAYMENT_COUPON_CODE_NO_LONGER_AVAILABLE",
            status_code: 410,
          },
          { status: 410 },
        ),
      { accessToken: "token-123" },
    );

    const error = expectFailure(failure);
    expect(error).toBeInstanceOf(PutioOperationError);
    expect(error).toMatchObject({
      _tag: "PutioOperationError",
      domain: "payment",
      operation: "submitChangePlan",
      status: 410,
    });

    const paddleBillingSubmitFailure = await runSdkExit(
      payment.submitPaymentChangePlan({
        coupon_code: "BAD",
        plan_path: "pro/monthly",
      }),
      () =>
        jsonResponse(
          {
            error_message: "Coupon is invalid.",
            error_type: "PADDLE_BILLING_INVALID_COUPON",
            status_code: 400,
          },
          { status: 400 },
        ),
      { accessToken: "token-123" },
    );

    const paddleBillingSubmitError = expectFailure(paddleBillingSubmitFailure);
    expect(paddleBillingSubmitError).toBeInstanceOf(PutioOperationError);
    expect(paddleBillingSubmitError).toMatchObject({
      _tag: "PutioOperationError",
      domain: "payment",
      operation: "submitChangePlan",
      reason: {
        errorType: "PADDLE_BILLING_INVALID_COUPON",
        kind: "error_type",
      },
      status: 400,
    });

    const invoiceFailure = await runSdkExit(
      payment.getPaddleBillingInvoiceUrl(123),
      () =>
        jsonResponse(
          {
            error_message: "Cannot find Paddle Billing payment.",
            error_type: "PADDLE_BILLING_PAYMENT_NOT_FOUND",
            status_code: 404,
          },
          { status: 404 },
        ),
      { accessToken: "token-123" },
    );

    const invoiceError = expectFailure(invoiceFailure);
    expect(invoiceError).toBeInstanceOf(PutioOperationError);
    expect(invoiceError).toMatchObject({
      _tag: "PutioOperationError",
      domain: "payment",
      operation: "getPaddleBillingInvoiceUrl",
      status: 404,
    });

    const updateFailure = await runSdkExit(
      payment.createPaddleBillingUpdatePaymentMethodTransaction(456),
      () =>
        jsonResponse(
          {
            error_message: "Paddle Billing subscription is canceled.",
            error_type: "PADDLE_BILLING_SUBSCRIPTION_CANCELED",
            status_code: 404,
          },
          { status: 404 },
        ),
      { accessToken: "token-123" },
    );

    const updateError = expectFailure(updateFailure);
    expect(updateError).toBeInstanceOf(PutioOperationError);
    expect(updateError).toMatchObject({
      _tag: "PutioOperationError",
      domain: "payment",
      operation: "createPaddleBillingUpdatePaymentMethodTransaction",
      status: 404,
    });
  });
});
