import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { OkResponseSchema, requestJson, type PutioSdkContext } from "../core/http.js";

export const PaymentPlanTypeSchema = Schema.Literal("onetime", "subscription");
export const PaymentOptionPlanTypeSchema = Schema.Literal("onetime", "subscription", "trial");
export const PaymentProviderNameSchema = Schema.Literal(
  "Paddle",
  "Fastspring",
  "OpenNode",
  "AcceptNano",
);
export const PaymentTypeSchema = Schema.Literal("credit-card", "cryptocurrency", "nano");
export const UserSubscriptionStatusSchema = Schema.Literal(
  "ACTIVE",
  "CANCELED",
  "PAST_DUE",
  "TRIALING",
);

export const PaymentSubscriptionInfoSchema = Schema.Struct({
  id: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  need_payment_information_update: Schema.optional(Schema.Boolean),
  next_billing_date: Schema.optional(Schema.NullOr(Schema.String)),
  next_retry_date: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(Schema.NullOr(UserSubscriptionStatusSchema)),
  update_url: Schema.optional(Schema.NullOr(Schema.String)),
});

export const PaymentInfoPlanSchema = Schema.Struct({
  code: Schema.optional(Schema.String),
  group_code: Schema.optional(Schema.String),
  period_days: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive()))),
  storage_space: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  subscription: Schema.optional(PaymentSubscriptionInfoSchema),
  type: Schema.optional(Schema.NullOr(PaymentPlanTypeSchema)),
});

const PaymentLastPaymentSchema = Schema.Struct({
  method: Schema.String,
  provider: Schema.String,
});

export const PaymentInfoSchema = Schema.Struct({
  expiration_date: Schema.optional(Schema.String),
  extend_30: Schema.NullOr(Schema.String),
  extend_365: Schema.NullOr(Schema.String),
  has_pending_payment: Schema.Boolean,
  last_payment: Schema.optional(PaymentLastPaymentSchema),
  pending_bitpay: Schema.NullOr(Schema.String),
  plan: Schema.optional(PaymentInfoPlanSchema),
  status: Schema.Literal("OK"),
});

const PaymentPlanCommonPropertiesSchema = Schema.Struct({
  family_invites: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  seed_ratio: Schema.Number.pipe(Schema.nonNegative()),
  seed_time: Schema.Number.pipe(Schema.nonNegative()),
  storage_space: Schema.Number.pipe(Schema.nonNegative()),
  torrent_slot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});

const PaymentSubPlanSchema = Schema.Struct({
  code: Schema.String,
  daily_price: Schema.NullOr(Schema.String),
  fastspring_url: Schema.NullOr(Schema.String),
  is_trial_subscription: Schema.Boolean,
  period_days: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive())),
  price: Schema.NullOr(Schema.String),
  subscription_trial_period: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  type: PaymentPlanTypeSchema,
});

export const PaymentPlanGroupSchema = Schema.Struct({
  common_properties: PaymentPlanCommonPropertiesSchema,
  plan_group_code: Schema.String,
  sub_plans: Schema.Array(PaymentSubPlanSchema),
});

const PaymentPlansEnvelopeSchema = Schema.Struct({
  plans: Schema.Array(PaymentPlanGroupSchema),
  status: Schema.Literal("OK"),
});

export const PaymentOptionSchema = Schema.Struct({
  discount_percent: Schema.Number.pipe(Schema.nonNegative()),
  name: PaymentTypeSchema,
  suitable_plan_types: Schema.Array(PaymentOptionPlanTypeSchema),
});

const PaymentOptionsEnvelopeSchema = Schema.Struct({
  options: Schema.Array(PaymentOptionSchema),
  status: Schema.Literal("OK"),
});

const PaymentHistoryPlanSchema = Schema.Struct({
  name: Schema.String,
  period_days: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  price: Schema.NullOr(Schema.String),
  type: Schema.NullOr(PaymentPlanTypeSchema),
});

const PaymentRefundSchema = Schema.Struct({
  amount_actual: Schema.String,
});

export const PaymentHistoryItemSchema = Schema.Struct({
  amount: Schema.String,
  amount_actual: Schema.optional(Schema.String),
  amount_currency: Schema.String,
  actual_currency_code: Schema.optional(Schema.String),
  coupon_code: Schema.NullOr(Schema.String),
  date: Schema.String,
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  invoice: Schema.NullOr(Schema.String),
  plan: PaymentHistoryPlanSchema,
  refunded: Schema.Boolean,
  refunds: Schema.Array(PaymentRefundSchema),
  return_status: Schema.String,
  type: Schema.String,
});

const PaymentHistoryEnvelopeSchema = Schema.Struct({
  payments: Schema.Array(PaymentHistoryItemSchema),
  status: Schema.Literal("OK"),
});

export const PaymentInviteSchema = Schema.Struct({
  is_converted: Schema.Boolean,
  url: Schema.String,
  used_by: Schema.NullOr(Schema.String),
});

const PaymentInvitesEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  vouchers: Schema.Array(PaymentInviteSchema),
});

const PaymentChangePlanCurrentPlanSchema = Schema.Struct({
  plan_type: Schema.NullOr(PaymentPlanTypeSchema),
  subscription_payment_provider: Schema.NullOr(PaymentProviderNameSchema),
});

const PaymentChangePlanTargetPlanSchema = Schema.Struct({
  hd_avail: Schema.Number.pipe(Schema.nonNegative()),
  is_trial_subscription: Schema.Boolean,
  new_code: Schema.String,
  period_days: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive())),
  plan_code: Schema.String,
  plan_name: Schema.String,
  plan_type: PaymentPlanTypeSchema,
  price: Schema.String,
  simulated_expiration: Schema.NullOr(Schema.String),
  subscription_trial_period: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

const PaymentChangePlanProviderPaddlePreviewSchema = Schema.Struct({
  charge_amount: Schema.NullOr(Schema.String),
  currency: Schema.String,
  next_billing_date: Schema.NullOr(Schema.String),
});

const PaymentChangePlanProviderFastspringPreviewSchema = Schema.Struct({
  charge_amount: Schema.NullOr(Schema.String),
  currency: Schema.String,
  prorated_amount: Schema.NullOr(Schema.String),
  refund_amount: Schema.NullOr(Schema.String),
});

const PaymentChangePlanDiscountSchema = Schema.Struct({
  discount: Schema.Number.pipe(Schema.nonNegative()),
  type: Schema.Literal("percentage", "amount"),
});

export const PaymentChangePlanPreviewSchema = Schema.Struct({
  Fastspring: PaymentChangePlanProviderFastspringPreviewSchema,
  Paddle: PaymentChangePlanProviderPaddlePreviewSchema,
  amount: Schema.NullOr(Schema.String),
  charge_amount: Schema.Boolean,
  credit: Schema.NullOr(Schema.String),
  currency: Schema.String,
  current_plan: PaymentChangePlanCurrentPlanSchema,
  discount: Schema.optional(PaymentChangePlanDiscountSchema),
  is_product_change: Schema.NullOr(Schema.Boolean),
  new_remaining_days: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  prorated: Schema.NullOr(Schema.String),
  status: Schema.Literal("OK"),
  target_plan: PaymentChangePlanTargetPlanSchema,
});

const PaddlePaymentProviderSchema = Schema.Struct({
  plan_id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  provider: Schema.Literal("Paddle"),
  type: Schema.Literal("credit-card"),
  vendor_id: Schema.Number.pipe(Schema.int(), Schema.positive()),
});

const FastspringPaymentProviderSchema = Schema.Struct({
  provider: Schema.Literal("Fastspring"),
  type: Schema.Literal("credit-card"),
  url: Schema.String,
});

const OpenNodePaymentProviderSchema = Schema.Struct({
  discount_percent: Schema.Number.pipe(Schema.nonNegative()),
  provider: Schema.Literal("OpenNode"),
  type: Schema.Literal("cryptocurrency"),
});

const AcceptNanoPaymentProviderSchema = Schema.Struct({
  amount: Schema.String,
  api_host: Schema.String,
  currency: Schema.Literal("USD"),
  discount_percent: Schema.Number.pipe(Schema.nonNegative()),
  provider: Schema.Literal("AcceptNano"),
  state: Schema.String,
  type: Schema.Literal("nano"),
});

export const PaymentProviderSchema = Schema.Union(
  AcceptNanoPaymentProviderSchema,
  FastspringPaymentProviderSchema,
  OpenNodePaymentProviderSchema,
  PaddlePaymentProviderSchema,
);

const PaymentChangePlanCheckoutSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  urls: Schema.Array(PaymentProviderSchema),
});

const PaymentChangePlanConfirmationSchema = Schema.Struct({
  confirmation: Schema.Literal(true),
  status: Schema.Literal("OK"),
});

const PaymentSubscriptionUpdateSchema = Schema.Struct({
  amount: Schema.String,
  billing_date: Schema.String,
  currency: Schema.String,
});

const PaymentChangePlanSubscriptionUpdatedSchema = Schema.Struct({
  charged_amount: Schema.String,
  charged_currency: Schema.String,
  next_payment: PaymentSubscriptionUpdateSchema,
  status: Schema.Literal("OK"),
});

const PaymentChangePlanSuccessSchema = OkResponseSchema;

export const PaymentChangePlanSubmitSchema = Schema.Union(
  PaymentChangePlanCheckoutSchema,
  PaymentChangePlanConfirmationSchema,
  PaymentChangePlanSubscriptionUpdatedSchema,
  PaymentChangePlanSuccessSchema,
);

const PaymentFastspringConfirmEnvelopeSchema = Schema.Struct({
  confirmed: Schema.Boolean,
  status: Schema.Literal("OK"),
});

const PaymentVoucherPlanSchema = Schema.Struct({
  expiration_date: Schema.NullOr(Schema.String),
  type: Schema.NullOr(PaymentPlanTypeSchema),
});

const PaymentVoucherTargetPlanSchema = Schema.Struct({
  code: Schema.String,
  group_code: Schema.String,
  hd_avail: Schema.Number.pipe(Schema.nonNegative()),
  name: Schema.String,
  simulated_expiration: Schema.optional(Schema.NullOr(Schema.String)),
  type: PaymentPlanTypeSchema,
});

export const PaymentVoucherInfoSchema = Schema.Struct({
  current_plan: PaymentVoucherPlanSchema,
  new_remaining_days: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: Schema.Literal("OK"),
  target_plan: PaymentVoucherTargetPlanSchema,
});

const PaymentNanoRequestEnvelopeSchema = Schema.Struct({
  nano: Schema.Struct({
    token: Schema.String,
  }),
  status: Schema.Literal("OK"),
});

const PaymentOpenNodeChargeEnvelopeSchema = Schema.Struct({
  opennode: Schema.Struct({
    checkout_url: Schema.String,
  }),
  status: Schema.Literal("OK"),
});

const PaymentCoinbaseChargeEnvelopeSchema = Schema.Struct({
  coinbase: Schema.Struct({
    code: Schema.String,
  }),
  status: Schema.Literal("OK"),
});

export type PaymentInfo = Schema.Schema.Type<typeof PaymentInfoSchema>;
export type PaymentPlanGroup = Schema.Schema.Type<typeof PaymentPlanGroupSchema>;
export type PaymentOption = Schema.Schema.Type<typeof PaymentOptionSchema>;
export type PaymentHistoryItem = Schema.Schema.Type<typeof PaymentHistoryItemSchema>;
export type PaymentInvite = Schema.Schema.Type<typeof PaymentInviteSchema>;
export type PaymentChangePlanPreview = Schema.Schema.Type<typeof PaymentChangePlanPreviewSchema>;
export type PaymentProvider = Schema.Schema.Type<typeof PaymentProviderSchema>;
export type PaymentChangePlanSubmitResponse = Schema.Schema.Type<
  typeof PaymentChangePlanSubmitSchema
>;
export type PaymentVoucherInfo = Schema.Schema.Type<typeof PaymentVoucherInfoSchema>;

export type PaymentHistoryQuery = {
  readonly unreported_only?: boolean;
};

export type PaymentChangePlanPreviewInput = {
  readonly coupon_code?: string;
  readonly payment_type?: Schema.Schema.Type<typeof PaymentTypeSchema>;
  readonly plan_path: string;
};

export type PaymentChangePlanSubmitInput = {
  readonly confirmation_code?: string;
  readonly coupon_code?: string;
  readonly payment_type?: Schema.Schema.Type<typeof PaymentTypeSchema>;
  readonly plan_path: string;
};

export type PaymentPaddleWaitingPaymentInput = {
  readonly checkout_id: string;
  readonly product_id: number | string;
};

const RestrictedPaymentError = { errorType: "invalid_scope", statusCode: 401 as const };

const CommonPaymentActionErrors = [
  { errorType: "PAYMENT_SUB_ACCOUNT_NOT_ALLOWED", statusCode: 403 as const },
  RestrictedPaymentError,
] as const;

export const GetPaymentInfoErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "getInfo",
  knownErrors: [RestrictedPaymentError],
});

export const ListPaymentPlansErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "listPlans",
  knownErrors: [RestrictedPaymentError],
});

export const ListPaymentOptionsErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "listOptions",
  knownErrors: [{ statusCode: 400 as const }],
});

export const ListPaymentHistoryErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "listHistory",
  knownErrors: [RestrictedPaymentError],
});

export const ListPaymentInvitesErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "listInvites",
  knownErrors: [RestrictedPaymentError],
});

export const PreviewPaymentChangePlanErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "previewChangePlan",
  knownErrors: [
    { errorType: "PAYMENT_PLAN_NOT_FOUND", statusCode: 404 as const },
    { errorType: "PAYMENT_INSUFFICIENT_DISK_SPACE", statusCode: 400 as const },
    { errorType: "PAYMENT_UPDATE_INFORMATION", statusCode: 400 as const },
    { errorType: "PAYMENT_FAMILY_ERROR", statusCode: 400 as const },
    { errorType: "PAYMENT_PLAN_CHANGE_NOT_ALLOWED", statusCode: 400 as const },
    { errorType: "PAYMENT_COUPON_CODE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "PAYMENT_COUPON_CODE_NO_LONGER_AVAILABLE", statusCode: 410 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 400 as const },
    { statusCode: 404 as const },
    { statusCode: 410 as const },
  ],
});

export const SubmitPaymentChangePlanErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "submitChangePlan",
  knownErrors: [
    { errorType: "PADDLE_ERROR", statusCode: 400 as const },
    { errorType: "CONFIRMATION_NOT_FOUND", statusCode: 404 as const },
    { errorType: "INVALID_CONFIRMATION", statusCode: 400 as const },
    { errorType: "PAYMENT_COUPON_CODE_NO_LONGER_AVAILABLE", statusCode: 410 as const },
    { errorType: "PAYMENT_COUPON_CODE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "PAYMENT_FAMILY_ERROR", statusCode: 400 as const },
    { errorType: "PAYMENT_FASTSPRING_INACTIVE_SUBSCRIPTION", statusCode: 400 as const },
    { errorType: "PAYMENT_FASTSPRING_PRORATION_NOT_SUPPORTED", statusCode: 400 as const },
    { errorType: "PAYMENT_INSUFFICIENT_DISK_SPACE", statusCode: 400 as const },
    { errorType: "PAYMENT_NOT_ENOUGH_DAYS", statusCode: 400 as const },
    { errorType: "PAYMENT_PLAN_CHANGE_NOT_ALLOWED", statusCode: 400 as const },
    { errorType: "PAYMENT_PLAN_NOT_FOUND", statusCode: 404 as const },
    { errorType: "PAYMENT_PROVIDER_ERROR", statusCode: 400 as const },
    { errorType: "PAYMENT_TRIAL_ERROR", statusCode: 403 as const },
    { errorType: "PAYMENT_UNKNOWN_PLAN", statusCode: 400 as const },
    { errorType: "PAYMENT_UNKNOWN_PROVIDER", statusCode: 400 as const },
    { errorType: "PAYMENT_UPDATE_INFORMATION", statusCode: 400 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 400 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
    { statusCode: 410 as const },
  ],
});

export const ConfirmFastspringOrderErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "confirmFastspringOrder",
  knownErrors: [RestrictedPaymentError],
});

export const StopSubscriptionErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "stopSubscription",
  knownErrors: [
    { errorType: "PAYMENT_SUBSCRIPTION_NOT_FOUND", statusCode: 404 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 404 as const },
  ],
});

export const GetPaymentVoucherInfoErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "getVoucherInfo",
  knownErrors: [
    { errorType: "PAYMENT_COUPON_CODE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "PAYMENT_COUPON_CODE_NO_LONGER_AVAILABLE", statusCode: 410 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 404 as const },
    { statusCode: 410 as const },
  ],
});

export const RedeemPaymentVoucherErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "redeemVoucher",
  knownErrors: [
    { errorType: "PAYMENT_COUPON_CODE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "PAYMENT_COUPON_CODE_ALREADY_USED", statusCode: 404 as const },
    { errorType: "PAYMENT_VOUCHER_CODE_NOT_REDEEMED", statusCode: 400 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});

export const ReportPaymentsErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "reportPayments",
  knownErrors: [
    { errorType: "PAYMENT_BAD_REQUEST", statusCode: 400 as const },
    RestrictedPaymentError,
    { statusCode: 400 as const },
  ],
});

export const CreatePaddleWaitingPaymentErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "createPaddleWaitingPayment",
  knownErrors: [
    { errorType: "PAYMENT_PADDLE_WAITING", statusCode: 404 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 404 as const },
  ],
});

export const CreateCoinbaseChargeErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "createCoinbaseCharge",
  knownErrors: [
    { errorType: "PAYMENT_UNKNOWN_PLAN", statusCode: 400 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 400 as const },
  ],
});

export const CreateOpenNodeChargeErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "createOpenNodeCharge",
  knownErrors: [
    { errorType: "PAYMENT_UNKNOWN_PLAN", statusCode: 400 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 400 as const },
  ],
});

export const CreateNanoPaymentRequestErrorSpec = definePutioOperationErrorSpec({
  domain: "payment",
  operation: "createNanoPaymentRequest",
  knownErrors: [
    { errorType: "PAYMENT_UNKNOWN_PLAN", statusCode: 400 as const },
    ...CommonPaymentActionErrors,
    { statusCode: 400 as const },
  ],
});

export type GetPaymentInfoError = PutioOperationFailure<typeof GetPaymentInfoErrorSpec>;
export type ListPaymentPlansError = PutioOperationFailure<typeof ListPaymentPlansErrorSpec>;
export type ListPaymentOptionsError = PutioOperationFailure<typeof ListPaymentOptionsErrorSpec>;
export type ListPaymentHistoryError = PutioOperationFailure<typeof ListPaymentHistoryErrorSpec>;
export type ListPaymentInvitesError = PutioOperationFailure<typeof ListPaymentInvitesErrorSpec>;
export type PreviewPaymentChangePlanError = PutioOperationFailure<
  typeof PreviewPaymentChangePlanErrorSpec
>;
export type SubmitPaymentChangePlanError = PutioOperationFailure<
  typeof SubmitPaymentChangePlanErrorSpec
>;
export type ConfirmFastspringOrderError = PutioOperationFailure<
  typeof ConfirmFastspringOrderErrorSpec
>;
export type StopSubscriptionError = PutioOperationFailure<typeof StopSubscriptionErrorSpec>;
export type GetPaymentVoucherInfoError = PutioOperationFailure<
  typeof GetPaymentVoucherInfoErrorSpec
>;
export type RedeemPaymentVoucherError = PutioOperationFailure<typeof RedeemPaymentVoucherErrorSpec>;
export type ReportPaymentsError = PutioOperationFailure<typeof ReportPaymentsErrorSpec>;
export type CreatePaddleWaitingPaymentError = PutioOperationFailure<
  typeof CreatePaddleWaitingPaymentErrorSpec
>;
export type CreateCoinbaseChargeError = PutioOperationFailure<typeof CreateCoinbaseChargeErrorSpec>;
export type CreateOpenNodeChargeError = PutioOperationFailure<typeof CreateOpenNodeChargeErrorSpec>;
export type CreateNanoPaymentRequestError = PutioOperationFailure<
  typeof CreateNanoPaymentRequestErrorSpec
>;

export type ClassifiedPaymentChangePlanSubmitResponse =
  | {
      readonly data: Schema.Schema.Type<typeof PaymentChangePlanCheckoutSchema>;
      readonly type: "checkout";
    }
  | {
      readonly data: Schema.Schema.Type<typeof PaymentChangePlanConfirmationSchema>;
      readonly type: "confirmation_required";
    }
  | {
      readonly data: Schema.Schema.Type<typeof PaymentChangePlanSubscriptionUpdatedSchema>;
      readonly type: "subscription_updated";
    }
  | {
      readonly data: Schema.Schema.Type<typeof PaymentChangePlanSuccessSchema>;
      readonly type: "success";
    };

export const classifyPaymentChangePlanResponse = (
  response: PaymentChangePlanSubmitResponse,
): ClassifiedPaymentChangePlanSubmitResponse => {
  if ("urls" in response) {
    return {
      data: response,
      type: "checkout",
    };
  }

  if ("confirmation" in response) {
    return {
      data: response,
      type: "confirmation_required",
    };
  }

  if ("next_payment" in response) {
    return {
      data: response,
      type: "subscription_updated",
    };
  }

  return {
    data: response,
    type: "success",
  };
};

export const getPaymentInfo = (): Effect.Effect<
  PaymentInfo,
  GetPaymentInfoError,
  PutioSdkContext
> =>
  requestJson(PaymentInfoSchema, {
    method: "GET",
    path: "/v2/payment/info",
  }).pipe((effect) => withOperationErrors(effect, GetPaymentInfoErrorSpec));

export const listPaymentPlans = (): Effect.Effect<
  ReadonlyArray<PaymentPlanGroup>,
  ListPaymentPlansError,
  PutioSdkContext
> =>
  requestJson(PaymentPlansEnvelopeSchema, {
    method: "GET",
    path: "/v2/payment/plans",
  }).pipe(
    Effect.map(({ plans }) => plans),
    (effect) => withOperationErrors(effect, ListPaymentPlansErrorSpec),
  );

export const listPaymentOptions = (): Effect.Effect<
  ReadonlyArray<Schema.Schema.Type<typeof PaymentOptionSchema>>,
  ListPaymentOptionsError,
  PutioSdkContext
> =>
  requestJson(PaymentOptionsEnvelopeSchema, {
    auth: { type: "none" },
    method: "GET",
    path: "/v2/payment/options",
  }).pipe(
    Effect.map(({ options }) => options),
    (effect) => withOperationErrors(effect, ListPaymentOptionsErrorSpec),
  );

export const listPaymentHistory = (
  query?: PaymentHistoryQuery,
): Effect.Effect<ReadonlyArray<PaymentHistoryItem>, ListPaymentHistoryError, PutioSdkContext> =>
  requestJson(PaymentHistoryEnvelopeSchema, {
    method: "GET",
    path: "/v2/payment/history",
    query,
  }).pipe(
    Effect.map(({ payments }) => payments),
    (effect) => withOperationErrors(effect, ListPaymentHistoryErrorSpec),
  );

export const listPaymentInvites = (): Effect.Effect<
  ReadonlyArray<Schema.Schema.Type<typeof PaymentInviteSchema>>,
  ListPaymentInvitesError,
  PutioSdkContext
> =>
  requestJson(PaymentInvitesEnvelopeSchema, {
    method: "GET",
    path: "/v2/payment/invites",
  }).pipe(
    Effect.map(({ vouchers }) => vouchers),
    (effect) => withOperationErrors(effect, ListPaymentInvitesErrorSpec),
  );

export const previewPaymentChangePlan = (
  input: PaymentChangePlanPreviewInput,
): Effect.Effect<PaymentChangePlanPreview, PreviewPaymentChangePlanError, PutioSdkContext> =>
  requestJson(PaymentChangePlanPreviewSchema, {
    method: "GET",
    path: `/v2/payment/change_plan/${encodeURIComponent(input.plan_path)}`,
    query: {
      coupon_code: input.coupon_code,
      payment_type: input.payment_type,
    },
  }).pipe((effect) => withOperationErrors(effect, PreviewPaymentChangePlanErrorSpec));

export const submitPaymentChangePlan = (
  input: PaymentChangePlanSubmitInput,
): Effect.Effect<PaymentChangePlanSubmitResponse, SubmitPaymentChangePlanError, PutioSdkContext> =>
  requestJson(PaymentChangePlanSubmitSchema, {
    body: {
      type: "form",
      value: {
        confirmation_code: input.confirmation_code,
        payment_type: input.payment_type,
      },
    },
    method: "POST",
    path: `/v2/payment/change_plan/${encodeURIComponent(input.plan_path)}`,
    query: {
      coupon_code: input.coupon_code,
    },
  }).pipe((effect) => withOperationErrors(effect, SubmitPaymentChangePlanErrorSpec));

export const confirmFastspringOrder = (
  reference: string,
): Effect.Effect<boolean, ConfirmFastspringOrderError, PutioSdkContext> =>
  requestJson(PaymentFastspringConfirmEnvelopeSchema, {
    method: "GET",
    path: `/v2/payment/fs-confirm/${encodeURIComponent(reference)}`,
  }).pipe(
    Effect.map(({ confirmed }) => confirmed),
    (effect) => withOperationErrors(effect, ConfirmFastspringOrderErrorSpec),
  );

export const stopPaymentSubscription = (): Effect.Effect<
  void,
  StopSubscriptionError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/payment/stop_subscription",
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, StopSubscriptionErrorSpec));

export const getPaymentVoucherInfo = (
  code: string,
): Effect.Effect<PaymentVoucherInfo, GetPaymentVoucherInfoError, PutioSdkContext> =>
  requestJson(PaymentVoucherInfoSchema, {
    method: "GET",
    path: `/v2/payment/redeem_voucher/${encodeURIComponent(code)}`,
  }).pipe((effect) => withOperationErrors(effect, GetPaymentVoucherInfoErrorSpec));

export const redeemPaymentVoucher = (
  code: string,
): Effect.Effect<void, RedeemPaymentVoucherError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/payment/redeem_voucher/${encodeURIComponent(code)}`,
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, RedeemPaymentVoucherErrorSpec));

export const reportPayments = (
  paymentIds: ReadonlyArray<number>,
): Effect.Effect<void, ReportPaymentsError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        payment_ids: paymentIds.join(","),
      },
    },
    method: "POST",
    path: "/v2/payment/report",
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, ReportPaymentsErrorSpec));

export const createPaddleWaitingPayment = (
  input: PaymentPaddleWaitingPaymentInput,
): Effect.Effect<void, CreatePaddleWaitingPaymentError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: input,
    },
    method: "POST",
    path: "/v2/payment/paddle_waiting_payment",
  }).pipe(Effect.asVoid, (effect) =>
    withOperationErrors(effect, CreatePaddleWaitingPaymentErrorSpec),
  );

export const createCoinbaseCharge = (
  planPath: string,
): Effect.Effect<string, CreateCoinbaseChargeError, PutioSdkContext> =>
  requestJson(PaymentCoinbaseChargeEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        plan_fs_path: planPath,
      },
    },
    method: "POST",
    path: "/v2/payment/methods/coinbase/charge",
  }).pipe(
    Effect.map(({ coinbase }) => coinbase.code),
    (effect) => withOperationErrors(effect, CreateCoinbaseChargeErrorSpec),
  );

export const createOpenNodeCharge = (
  planPath: string,
): Effect.Effect<string, CreateOpenNodeChargeError, PutioSdkContext> =>
  requestJson(PaymentOpenNodeChargeEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        plan_fs_path: planPath,
      },
    },
    method: "POST",
    path: "/v2/payment/methods/opennode/charge",
  }).pipe(
    Effect.map(({ opennode }) => opennode.checkout_url),
    (effect) => withOperationErrors(effect, CreateOpenNodeChargeErrorSpec),
  );

export const createNanoPaymentRequest = (
  planCode: string,
): Effect.Effect<string, CreateNanoPaymentRequestError, PutioSdkContext> =>
  requestJson(PaymentNanoRequestEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        plan_code: planCode,
      },
    },
    method: "POST",
    path: "/v2/payment/methods/nano/request",
  }).pipe(
    Effect.map(({ nano }) => nano.token),
    (effect) => withOperationErrors(effect, CreateNanoPaymentRequestErrorSpec),
  );
