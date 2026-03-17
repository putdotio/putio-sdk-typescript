import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import {
  OkResponseSchema,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";

const NonNegativeIntegerSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative());
const NonNegativeIntegerFromStringSchema = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.nonNegative(),
);

export const FamilyInviteSchema = Schema.Struct({
  code: Schema.String,
  created_at: Schema.String,
  user_id: Schema.NullOr(Schema.Number.pipe(Schema.int())),
});

export const FamilyMemberSchema = Schema.Struct({
  avatar_url: Schema.String,
  created_at: Schema.String,
  disk_used: Schema.Union(NonNegativeIntegerSchema, NonNegativeIntegerFromStringSchema),
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  is_owner: Schema.Boolean,
  name: Schema.String,
});

const FamilyInvitesEnvelopeSchema = Schema.Struct({
  invites: Schema.Array(FamilyInviteSchema),
  limit: NonNegativeIntegerSchema,
  remaining_limit: NonNegativeIntegerSchema,
  status: Schema.Literal("OK"),
});

const FamilyMembersEnvelopeSchema = Schema.Struct({
  members: Schema.Array(FamilyMemberSchema),
  status: Schema.Literal("OK"),
});

const FamilyCreateInviteEnvelopeSchema = Schema.Struct({
  code: Schema.String,
  status: Schema.Literal("OK"),
});

export type FamilyInvite = Schema.Schema.Type<typeof FamilyInviteSchema>;
export type FamilyMember = Schema.Schema.Type<typeof FamilyMemberSchema>;
export type FamilyInvitesResponse = {
  readonly invites: ReadonlyArray<FamilyInvite>;
  readonly limit: number;
  readonly remaining_limit: number;
};

const RestrictedFamilyError = { errorType: "invalid_scope", statusCode: 401 as const };

export const ListFamilyInvitesErrorSpec = definePutioOperationErrorSpec({
  domain: "family",
  operation: "listInvites",
  knownErrors: [RestrictedFamilyError],
});

export const ListFamilyMembersErrorSpec = definePutioOperationErrorSpec({
  domain: "family",
  operation: "listMembers",
  knownErrors: [RestrictedFamilyError],
});

export const CreateFamilyInviteErrorSpec = definePutioOperationErrorSpec({
  domain: "family",
  operation: "createInvite",
  knownErrors: [
    { errorType: "FAMILY_SUB_ACCOUNT_NOT_ALLOWED", statusCode: 403 as const },
    { errorType: "FAMILY_SUB_ACCOUNT_LIMIT_EXCEEDED", statusCode: 403 as const },
    { errorType: "FAMILY_UNUSED_INVITE_LIMIT_EXCEEDED", statusCode: 403 as const },
    RestrictedFamilyError,
    { statusCode: 403 as const },
  ],
});

export const RemoveFamilyMemberErrorSpec = definePutioOperationErrorSpec({
  domain: "family",
  operation: "removeMember",
  knownErrors: [RestrictedFamilyError, { statusCode: 404 as const }],
});

export const JoinFamilyErrorSpec = definePutioOperationErrorSpec({
  domain: "family",
  operation: "join",
  knownErrors: [
    { errorType: "FAMILY_INVITE_ACTIVE_USER", statusCode: 403 as const },
    { errorType: "FAMILY_INVITE_ANOTHER_FAMILY", statusCode: 403 as const },
    { errorType: "FAMILY_INVITE_INVALID_CODE", statusCode: 403 as const },
    { errorType: "FAMILY_INVITE_OWNER_NOT_FOUND", statusCode: 403 as const },
    { errorType: "FAMILY_INVITE_OWNER_NOT_ACTIVE", statusCode: 403 as const },
    { errorType: "FAMILY_INVITE_OWNER_NO_LIMIT", statusCode: 403 as const },
    { errorType: "FAMILY_LIMIT_EXCEEDED", statusCode: 403 as const },
    RestrictedFamilyError,
    { statusCode: 403 as const },
  ],
});

export type ListFamilyInvitesError = PutioOperationFailure<typeof ListFamilyInvitesErrorSpec>;
export type ListFamilyMembersError = PutioOperationFailure<typeof ListFamilyMembersErrorSpec>;
export type CreateFamilyInviteError = PutioOperationFailure<typeof CreateFamilyInviteErrorSpec>;
export type RemoveFamilyMemberError = PutioOperationFailure<typeof RemoveFamilyMemberErrorSpec>;
export type JoinFamilyError = PutioOperationFailure<typeof JoinFamilyErrorSpec>;

export const listFamilyInvites = (): Effect.Effect<
  FamilyInvitesResponse,
  ListFamilyInvitesError,
  PutioSdkContext
> =>
  requestJson(FamilyInvitesEnvelopeSchema, {
    method: "GET",
    path: "/v2/family/invites",
  }).pipe(
    selectJsonFields("invites", "limit", "remaining_limit"),
    withOperationErrors(ListFamilyInvitesErrorSpec),
  );

export const listFamilyMembers = (): Effect.Effect<
  ReadonlyArray<FamilyMember>,
  ListFamilyMembersError,
  PutioSdkContext
> =>
  requestJson(FamilyMembersEnvelopeSchema, {
    method: "GET",
    path: "/v2/family/members",
  }).pipe(selectJsonField("members"), withOperationErrors(ListFamilyMembersErrorSpec));

export const createFamilyInvite = (): Effect.Effect<
  { readonly code: string },
  CreateFamilyInviteError,
  PutioSdkContext
> =>
  requestJson(FamilyCreateInviteEnvelopeSchema, {
    method: "POST",
    path: "/v2/family/sub_account",
  }).pipe(selectJsonFields("code"), withOperationErrors(CreateFamilyInviteErrorSpec));

export const removeFamilyMember = (
  username: string,
): Effect.Effect<void, RemoveFamilyMemberError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "DELETE",
    path: `/v2/family/sub_account/${encodeURIComponent(username)}`,
  }).pipe(Effect.asVoid, withOperationErrors(RemoveFamilyMemberErrorSpec));

export const joinFamily = (
  inviteCode: string,
): Effect.Effect<void, JoinFamilyError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/family/join/${encodeURIComponent(inviteCode)}`,
  }).pipe(Effect.asVoid, withOperationErrors(JoinFamilyErrorSpec));
