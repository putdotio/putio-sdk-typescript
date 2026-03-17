type CsvValue = string | number;

export interface CursorSelectionInput<TValue extends CsvValue = number> {
  readonly cursor?: string;
  readonly excludeIds?: ReadonlyArray<TValue>;
  readonly ids?: ReadonlyArray<TValue>;
}

export const joinCsv = <TValue extends CsvValue>(
  values: ReadonlyArray<TValue> | undefined,
): string | undefined => (values && values.length > 0 ? values.join(",") : undefined);

export const toCursorSelectionForm = <
  TValue extends CsvValue,
  const TIdsFieldName extends string = "file_ids",
>(
  selection: CursorSelectionInput<TValue>,
  idsFieldName?: TIdsFieldName,
): {
  readonly cursor?: string;
  readonly exclude_ids?: string;
} & Record<TIdsFieldName, string | undefined> => {
  const resolvedIdsFieldName = (idsFieldName ?? "file_ids") as TIdsFieldName;

  return {
    cursor: selection.cursor,
    exclude_ids: joinCsv(selection.excludeIds),
    [resolvedIdsFieldName]: joinCsv(selection.ids),
  } as {
    readonly cursor?: string;
    readonly exclude_ids?: string;
  } & Record<TIdsFieldName, string | undefined>;
};
