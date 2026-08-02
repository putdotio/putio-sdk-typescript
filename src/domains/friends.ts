import { Effect, Schema } from "effect";
import {
  definePutioOperationErrorSpec,
  mapDecodeErrorToValidationError,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { NonEmptyStringSchema } from "../core/validation.js";
import { FileBroadSchema, type FileBroad } from "./files.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";
export const FriendBaseSchema = Schema.Struct({
  avatar_url: Schema.String,
  id: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  name: Schema.String,
});
export const FriendSchema = FriendBaseSchema.pipe(
  Schema.fieldsAssign({
    has_received_files: Schema.Boolean,
    has_shared_files: Schema.Boolean,
  }),
);
export const UserSearchResultSchema = FriendBaseSchema.pipe(
  Schema.fieldsAssign({
    invited: Schema.Boolean,
  }),
);
const FriendsListEnvelopeSchema = Schema.Struct({
  friends: Schema.Array(FriendSchema),
  status: Schema.Literal("OK"),
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
const FriendRequestsEnvelopeSchema = Schema.Struct({
  friends: Schema.Array(FriendBaseSchema),
  status: Schema.Literal("OK"),
});
const FriendRequestsCountEnvelopeSchema = Schema.Struct({
  count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("OK"),
});
const FriendSearchEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  users: Schema.Array(UserSearchResultSchema),
});
const FriendSharedFolderEnvelopeSchema = Schema.Struct({
  file: Schema.NullOr(FileBroadSchema),
  status: Schema.Literal("OK"),
});
export type FriendBase = Schema.Schema.Type<typeof FriendBaseSchema>;
export type Friend = Schema.Schema.Type<typeof FriendSchema>;
export type UserSearchResult = Schema.Schema.Type<typeof UserSearchResultSchema>;
export const ListFriendsErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "list",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const SearchFriendsErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "search",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const ListWaitingRequestsErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "listWaitingRequests",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const CountWaitingRequestsErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "countWaitingRequests",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const ListSentRequestsErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "listSentRequests",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const SendFriendRequestErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "sendRequest",
  knownErrors: [
    { errorType: "USER_NOT_FOUND", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export const RemoveFriendErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "remove",
  knownErrors: [
    { errorType: "USER_NOT_FOUND", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export const ApproveFriendRequestErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "approve",
  knownErrors: [
    { errorType: "USER_NOT_FOUND", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export const DenyFriendRequestErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "deny",
  knownErrors: [
    { errorType: "USER_NOT_FOUND", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export const FriendSharedFolderErrorSpec = definePutioOperationErrorSpec({
  domain: "friends",
  operation: "sharedFolder",
  knownErrors: [
    { errorType: "NotFound", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export type ListFriendsError = PutioOperationFailure<typeof ListFriendsErrorSpec>;
export type SearchFriendsError = PutioOperationFailure<typeof SearchFriendsErrorSpec>;
export type ListWaitingRequestsError = PutioOperationFailure<typeof ListWaitingRequestsErrorSpec>;
export type CountWaitingRequestsError = PutioOperationFailure<typeof CountWaitingRequestsErrorSpec>;
export type ListSentRequestsError = PutioOperationFailure<typeof ListSentRequestsErrorSpec>;
export type SendFriendRequestError = PutioOperationFailure<typeof SendFriendRequestErrorSpec>;
export type RemoveFriendError = PutioOperationFailure<typeof RemoveFriendErrorSpec>;
export type ApproveFriendRequestError = PutioOperationFailure<typeof ApproveFriendRequestErrorSpec>;
export type DenyFriendRequestError = PutioOperationFailure<typeof DenyFriendRequestErrorSpec>;
export type FriendSharedFolderError = PutioOperationFailure<typeof FriendSharedFolderErrorSpec>;
const decodeUsername = (username: string) =>
  Schema.decodeUnknownEffect(NonEmptyStringSchema, { onExcessProperty: "error" })(username).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
  );
export const listFriends = (): Effect.Effect<
  {
    readonly friends: ReadonlyArray<Friend>;
    readonly total: number;
  },
  ListFriendsError,
  PutioSdkContext
> =>
  requestJson(FriendsListEnvelopeSchema, {
    method: "GET",
    path: "/v2/friends/list",
  }).pipe(selectJsonFields("friends", "total"), withOperationErrors(ListFriendsErrorSpec));
export const searchFriends = (
  username: string,
): Effect.Effect<ReadonlyArray<UserSearchResult>, SearchFriendsError, PutioSdkContext> =>
  decodeUsername(username).pipe(
    Effect.flatMap((decodedUsername) =>
      requestJson(FriendSearchEnvelopeSchema, {
        method: "GET",
        path: `/v2/friends/user-search/${encodePathSegment(decodedUsername)}`,
      }),
    ),
    selectJsonField("users"),
    withOperationErrors(SearchFriendsErrorSpec),
  );
export const listWaitingRequests = (): Effect.Effect<
  ReadonlyArray<FriendBase>,
  ListWaitingRequestsError,
  PutioSdkContext
> =>
  requestJson(FriendRequestsEnvelopeSchema, {
    method: "GET",
    path: "/v2/friends/waiting-requests",
  }).pipe(selectJsonField("friends"), withOperationErrors(ListWaitingRequestsErrorSpec));
export const countWaitingRequests = (): Effect.Effect<
  number,
  CountWaitingRequestsError,
  PutioSdkContext
> =>
  requestJson(FriendRequestsCountEnvelopeSchema, {
    method: "GET",
    path: "/v2/friends/waiting-requests-count",
  }).pipe(selectJsonField("count"), withOperationErrors(CountWaitingRequestsErrorSpec));
export const listSentRequests = (): Effect.Effect<
  ReadonlyArray<FriendBase>,
  ListSentRequestsError,
  PutioSdkContext
> =>
  requestJson(FriendRequestsEnvelopeSchema, {
    method: "GET",
    path: "/v2/friends/sent-requests",
  }).pipe(selectJsonField("friends"), withOperationErrors(ListSentRequestsErrorSpec));
export const sendFriendRequest = (
  username: string,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  SendFriendRequestError,
  PutioSdkContext
> =>
  decodeUsername(username).pipe(
    Effect.flatMap((decodedUsername) =>
      requestJson(OkResponseSchema, {
        method: "POST",
        path: `/v2/friends/${encodePathSegment(decodedUsername)}/request`,
      }),
    ),
    withOperationErrors(SendFriendRequestErrorSpec),
  );
export const removeFriend = (
  username: string,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, RemoveFriendError, PutioSdkContext> =>
  decodeUsername(username).pipe(
    Effect.flatMap((decodedUsername) =>
      requestJson(OkResponseSchema, {
        method: "POST",
        path: `/v2/friends/${encodePathSegment(decodedUsername)}/unfriend`,
      }),
    ),
    withOperationErrors(RemoveFriendErrorSpec),
  );
export const approveFriendRequest = (
  username: string,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ApproveFriendRequestError,
  PutioSdkContext
> =>
  decodeUsername(username).pipe(
    Effect.flatMap((decodedUsername) =>
      requestJson(OkResponseSchema, {
        method: "POST",
        path: `/v2/friends/${encodePathSegment(decodedUsername)}/approve`,
      }),
    ),
    withOperationErrors(ApproveFriendRequestErrorSpec),
  );
export const denyFriendRequest = (
  username: string,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  DenyFriendRequestError,
  PutioSdkContext
> =>
  decodeUsername(username).pipe(
    Effect.flatMap((decodedUsername) =>
      requestJson(OkResponseSchema, {
        method: "POST",
        path: `/v2/friends/${encodePathSegment(decodedUsername)}/deny`,
      }),
    ),
    withOperationErrors(DenyFriendRequestErrorSpec),
  );
export const getFriendSharedFolder = (
  username: string,
): Effect.Effect<FileBroad | null, FriendSharedFolderError, PutioSdkContext> =>
  decodeUsername(username).pipe(
    Effect.flatMap((decodedUsername) =>
      requestJson(FriendSharedFolderEnvelopeSchema, {
        method: "GET",
        path: `/v2/friends/${encodePathSegment(decodedUsername)}/files`,
      }),
    ),
    selectJsonField("file"),
    withOperationErrors(FriendSharedFolderErrorSpec),
  );
