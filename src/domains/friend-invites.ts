import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { requestJson, selectJsonFields, type PutioSdkContext } from "../core/http.js";

export const FriendInviteJoinedUserStatusSchema = Schema.Literal(
  "CONVERTED",
  "IN_TRIAL",
  "TRIAL_ENDED",
  "TRIAL_NOT_STARTED",
  "UNKNOWN",
);

export const FriendInviteJoinedUserSchema = Schema.Struct({
  avatar_url: Schema.String,
  created_at: Schema.String,
  earned_amount: Schema.NullOr(Schema.Number.pipe(Schema.nonNegative())),
  name: Schema.String,
  status: FriendInviteJoinedUserStatusSchema,
});

export const FriendInviteSchema = Schema.Struct({
  code: Schema.String,
  created_at: Schema.String,
  user: Schema.NullOr(FriendInviteJoinedUserSchema),
});

const FriendInvitesListEnvelopeSchema = Schema.Struct({
  invites: Schema.Array(FriendInviteSchema),
  remaining_limit: Schema.Number.pipe(Schema.int()),
  status: Schema.Literal("OK"),
});

const FriendInviteCreateEnvelopeSchema = Schema.Struct({
  code: Schema.String,
  status: Schema.optional(Schema.Literal("OK")),
});

export type FriendInviteJoinedUserStatus = Schema.Schema.Type<
  typeof FriendInviteJoinedUserStatusSchema
>;
export type FriendInviteJoinedUser = Schema.Schema.Type<typeof FriendInviteJoinedUserSchema>;
export type FriendInvite = Schema.Schema.Type<typeof FriendInviteSchema>;

export const ListFriendInvitesErrorSpec = definePutioOperationErrorSpec({
  domain: "friendInvites",
  operation: "list",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const CreateFriendInviteErrorSpec = definePutioOperationErrorSpec({
  domain: "friendInvites",
  operation: "create",
  knownErrors: [
    { errorType: "FRIEND_INVITATION_NOT_ALLOWED", statusCode: 403 as const },
    { errorType: "FRIEND_INVITATION_LIMIT_EXCEEDED", statusCode: 403 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 403 as const },
  ],
});

export type ListFriendInvitesError = PutioOperationFailure<typeof ListFriendInvitesErrorSpec>;
export type CreateFriendInviteError = PutioOperationFailure<typeof CreateFriendInviteErrorSpec>;

export const listFriendInvites = (): Effect.Effect<
  {
    readonly invites: ReadonlyArray<FriendInvite>;
    readonly remaining_limit: number;
  },
  ListFriendInvitesError,
  PutioSdkContext
> =>
  requestJson(FriendInvitesListEnvelopeSchema, {
    method: "GET",
    path: "/v2/account/friend_invites",
  }).pipe(
    selectJsonFields("invites", "remaining_limit"),
    withOperationErrors(ListFriendInvitesErrorSpec),
  );

export const createFriendInvite = (): Effect.Effect<
  {
    readonly code: string;
  },
  CreateFriendInviteError,
  PutioSdkContext
> =>
  requestJson(FriendInviteCreateEnvelopeSchema, {
    method: "POST",
    path: "/v2/account/create_friend_invitation",
  }).pipe(selectJsonFields("code"), withOperationErrors(CreateFriendInviteErrorSpec));
