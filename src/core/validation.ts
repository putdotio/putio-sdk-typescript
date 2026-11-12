import { Effect, Schema } from "effect";

import { mapDecodeErrorToValidationError, PutioValidationError } from "./errors.js";

export const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0));
export const NonEmptyStringSchema = Schema.String.check(Schema.isMinLength(1));
export const NonNegativeNumberSchema = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

export const failMissingField = (field: string): Effect.Effect<never, PutioValidationError> =>
  Effect.fail(
    new PutioValidationError({
      cause: `Expected put.io to include "${field}" because it was requested`,
    }),
  );

export const decodeAndRun = <S extends Schema.Top, A, E, R>(
  schema: S,
  input: S["Encoded"],
  run: (decoded: S["Type"]) => Effect.Effect<A, E, R>,
) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap(run),
  );

export const decodeAndRunRedacted =
  (domain: string, operation: string) =>
  <S extends Schema.Top, A, E, R>(
    schema: S,
    input: S["Encoded"],
    run: (decoded: S["Type"]) => Effect.Effect<A, E, R>,
  ) =>
    Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
      Effect.mapError(
        () =>
          new PutioValidationError({
            cause: { domain, operation, reason: "Invalid request input" },
          }),
      ),
      Effect.flatMap(run),
    );

type CursorOrIdsSelection = {
  readonly cursor?: string;
  readonly ids?: ReadonlyArray<number>;
};

export const cursorSelectionSchema = <const TFields extends Schema.Struct.Fields>(
  fields: TFields,
) =>
  Schema.Struct({
    cursor: Schema.optional(NonEmptyStringSchema),
    excludeIds: Schema.optional(Schema.Array(PositiveIntegerSchema)),
    ids: Schema.optional(Schema.Array(PositiveIntegerSchema).check(Schema.isMinLength(1))),
    ...fields,
  }).check(
    Schema.makeFilter(
      (input: CursorOrIdsSelection) => input.cursor !== undefined || input.ids !== undefined,
      { expected: "a non-empty cursor or file ID selection" },
    ),
  );
