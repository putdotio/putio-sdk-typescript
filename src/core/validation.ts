import { Effect, Schema } from "effect";

import { mapDecodeErrorToValidationError } from "./errors.js";

export const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0));
export const NonEmptyStringSchema = Schema.String.check(Schema.isMinLength(1));

export const decodeAndRun = <S extends Schema.Top, I, A, E, R>(
  schema: S,
  input: I,
  run: (decoded: S["Type"]) => Effect.Effect<A, E, R>,
) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
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
