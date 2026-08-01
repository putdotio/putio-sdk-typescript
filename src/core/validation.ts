import { Schema } from "effect";

export const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0));
export const NonEmptyStringSchema = Schema.String.check(Schema.isMinLength(1));
