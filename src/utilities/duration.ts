const normalizeNumber = (value: unknown): number => (typeof value === "number" ? value : 0);

const formatPadded = (value: number): string => String(value).padStart(2, "0");

export const secondsToDuration = (seconds: unknown): string => {
  const normalizedSeconds = Math.floor(normalizeNumber(seconds));

  if (normalizedSeconds <= 0) {
    return "00:00";
  }

  const days = Math.floor(normalizedSeconds / 86_400);
  const hours = Math.floor((normalizedSeconds % 86_400) / 3_600);
  const minutes = Math.floor((normalizedSeconds % 3_600) / 60);
  const remainingSeconds = normalizedSeconds % 60;

  if (days > 0) {
    return [days, hours, minutes, remainingSeconds].map(formatPadded).join(":");
  }

  if (normalizedSeconds >= 3_600) {
    return [Math.floor(normalizedSeconds / 3_600), minutes, remainingSeconds]
      .map(formatPadded)
      .join(":");
  }

  return [minutes, remainingSeconds].map(formatPadded).join(":");
};

export const secondsToReadableDuration = (seconds: unknown): string => {
  const normalizedSeconds = Math.floor(normalizeNumber(seconds));

  if (normalizedSeconds <= 0) {
    return "N/A";
  }

  if (normalizedSeconds < 60) {
    return `${normalizedSeconds} s`;
  }

  if (normalizedSeconds >= 86_400) {
    const days = Math.floor(normalizedSeconds / 86_400);
    const roundedHours = Math.round((normalizedSeconds - days * 86_400) / 3_600);

    if (roundedHours === 24) {
      return `${days + 1}d`;
    }

    return roundedHours > 0 ? `${days}d ${roundedHours}h` : `${days}d`;
  }

  if (normalizedSeconds >= 3_600) {
    const hours = Math.floor(normalizedSeconds / 3_600);
    const roundedMinutes = Math.round((normalizedSeconds - hours * 3_600) / 60);
    return roundedMinutes > 0 ? `${hours}h ${roundedMinutes}m` : `${hours}h`;
  }

  const roundedMinutes = Math.round(normalizedSeconds / 60);
  const remainingSeconds = normalizedSeconds - roundedMinutes * 60;
  return remainingSeconds > 0 ? `${roundedMinutes}m ${remainingSeconds}s` : `${roundedMinutes}m`;
};
