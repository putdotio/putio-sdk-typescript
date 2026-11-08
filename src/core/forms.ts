type CsvValue = string | number;

export interface CursorSelectionInput<TValue extends CsvValue = number> {
  readonly cursor?: string;
  readonly excludeIds?: ReadonlyArray<TValue>;
  readonly ids?: ReadonlyArray<TValue>;
}

export const joinCsv = <TValue extends CsvValue>(
  values: ReadonlyArray<TValue> | undefined,
): string | undefined => (values && values.length > 0 ? values.join(",") : undefined);

type CursorSelectionForm<TIdsFieldName extends string> = {
  readonly cursor?: string;
  readonly exclude_ids?: string;
} & Record<TIdsFieldName, string | undefined>;

export function toCursorSelectionForm<TValue extends CsvValue>(
  selection: CursorSelectionInput<TValue>,
): CursorSelectionForm<"file_ids">;
export function toCursorSelectionForm<TValue extends CsvValue, const TIdsFieldName extends string>(
  selection: CursorSelectionInput<TValue>,
  idsFieldName: TIdsFieldName,
): CursorSelectionForm<TIdsFieldName>;
export function toCursorSelectionForm(
  selection: CursorSelectionInput<CsvValue>,
  idsFieldName = "file_ids",
): CursorSelectionForm<string> {
  return {
    cursor: selection.cursor,
    exclude_ids: joinCsv(selection.excludeIds),
    [idsFieldName]: joinCsv(selection.ids),
  };
}
