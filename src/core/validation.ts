import { Schema } from "effect";

export const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0));
export const NonEmptyStringSchema = Schema.String.check(Schema.isMinLength(1));

export const makeCursorSelectionSchema = <
  const TIdsField extends string,
  const TExcludeIdsField extends string,
>(
  idsField: TIdsField,
  excludeIdsField: TExcludeIdsField,
) =>
  Schema.Struct({
    cursor: Schema.optional(NonEmptyStringSchema),
    [excludeIdsField]: Schema.optional(Schema.Array(PositiveIntegerSchema)),
    [idsField]: Schema.optional(Schema.Array(PositiveIntegerSchema).check(Schema.isMinLength(1))),
  }).check(
    Schema.makeFilter((input) => input.cursor !== undefined || input[idsField] !== undefined, {
      expected: "a non-empty cursor or file ID selection",
    }),
  );
