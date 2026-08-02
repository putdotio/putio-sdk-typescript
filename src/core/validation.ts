import { Effect, Schema } from "effect";

import { mapDecodeErrorToValidationError } from "./errors.js";

export const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0));
export const NonEmptyStringSchema = Schema.String.check(Schema.isMinLength(1));

export const decodeAndRun = <S extends Schema.Top, A, E, R>(
  schema: S,
  input: unknown,
  run: (decoded: S["Type"]) => Effect.Effect<A, E, R>,
) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap(run),
  );

export const makeCursorSelectionSchema = <
  const TIdsField extends string,
  const TExcludeIdsField extends string,
  const TFields extends Schema.Struct.Fields,
>(
  idsField: TIdsField,
  excludeIdsField: TExcludeIdsField,
  fields: TFields,
) =>
  Schema.Struct({
    cursor: Schema.optional(NonEmptyStringSchema),
    [excludeIdsField]: Schema.optional(Schema.Array(PositiveIntegerSchema)),
    [idsField]: Schema.optional(Schema.Array(PositiveIntegerSchema).check(Schema.isMinLength(1))),
    ...fields,
  }).check(
    Schema.makeFilter((input) => input.cursor !== undefined || input[idsField] !== undefined, {
      expected: "a non-empty cursor or file ID selection",
    }),
  );
