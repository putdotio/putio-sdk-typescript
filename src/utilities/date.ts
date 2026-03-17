const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "always",
});

const ensureDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }

    return new Date(value.endsWith("Z") ? value : `${value}Z`);
  }

  return new Date();
};

const toRelativeUnit = (secondsDelta: number) => {
  const absoluteSeconds = Math.abs(secondsDelta);

  if (absoluteSeconds >= 60 * 60 * 24 * 365) {
    return { unit: "year" as const, value: Math.round(secondsDelta / (60 * 60 * 24 * 365)) };
  }

  if (absoluteSeconds >= 60 * 60 * 24 * 30) {
    return { unit: "month" as const, value: Math.round(secondsDelta / (60 * 60 * 24 * 30)) };
  }

  if (absoluteSeconds >= 60 * 60 * 24) {
    return { unit: "day" as const, value: Math.round(secondsDelta / (60 * 60 * 24)) };
  }

  if (absoluteSeconds >= 60 * 60) {
    return { unit: "hour" as const, value: Math.round(secondsDelta / (60 * 60)) };
  }

  if (absoluteSeconds >= 60) {
    return { unit: "minute" as const, value: Math.round(secondsDelta / 60) };
  }

  return { unit: "second" as const, value: Math.round(secondsDelta) };
};

export const ensureUTC = (date: unknown = null): string => ensureDate(date).toISOString();

export const toTimeAgo = (date: unknown = null): string => {
  if (!date) {
    return "N/A";
  }

  const target = ensureDate(date);
  const secondsDelta = Math.round((target.getTime() - Date.now()) / 1000);
  const { unit, value } = toRelativeUnit(secondsDelta);
  return RELATIVE_TIME_FORMATTER.format(value, unit);
};

export const formatDate = (
  date: unknown = null,
  format: "LL" | Intl.DateTimeFormatOptions = "LL",
): string => {
  if (!date) {
    return "N/A";
  }

  const normalizedDate = ensureDate(date);

  if (format === "LL") {
    return LONG_DATE_FORMATTER.format(normalizedDate);
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...format,
  }).format(normalizedDate);
};

export const daysDiff = (date1: unknown, date2: unknown): number => {
  const day1 = ensureDate(date1);
  const day2 = ensureDate(date2);

  const utcDay1 = Date.UTC(day1.getUTCFullYear(), day1.getUTCMonth(), day1.getUTCDate());
  const utcDay2 = Date.UTC(day2.getUTCFullYear(), day2.getUTCMonth(), day2.getUTCDate());

  return Math.abs(Math.round((utcDay2 - utcDay1) / (1000 * 60 * 60 * 24)));
};

export const daysDiffFromNow = (date: unknown = null): number => {
  if (!date) {
    return 0;
  }

  return daysDiff(date, new Date());
};

export const getUnixTimestamp = (date: unknown): number =>
  Math.floor(ensureDate(date).getTime() / 1000);
