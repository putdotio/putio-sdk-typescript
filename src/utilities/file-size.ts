export interface HumanFileSizeOptions {
  readonly decimals?: number;
  readonly unitSeparator?: string;
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export const toHumanFileSize = (
  fileSizeInBytes: string | number,
  options: HumanFileSizeOptions = {},
): string => {
  const { decimals = 1, unitSeparator = " " } = options;
  const parsed =
    typeof fileSizeInBytes === "string" ? Number.parseInt(fileSizeInBytes, 10) : fileSizeInBytes;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return `0${unitSeparator}B`;
  }

  const exponent = Math.min(
    Math.floor(Math.log(parsed) / Math.log(1024)),
    FILE_SIZE_UNITS.length - 1,
  );
  const normalized = parsed / 1024 ** exponent;
  const fractionDigits = normalized % 1 === 0 ? 0 : decimals;

  return `${normalized.toFixed(fractionDigits)}${unitSeparator}${FILE_SIZE_UNITS[exponent]}`;
};
