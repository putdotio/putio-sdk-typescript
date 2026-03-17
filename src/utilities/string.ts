export const dotsToSpaces = (input: string): string => input.split(".").join(" ");

export const truncate = (
  input: string,
  options: {
    readonly length: number;
    readonly ellipsis?: string;
  },
): string => {
  const { ellipsis = "...", length } = options;

  if (input.length <= length) {
    return input;
  }

  return `${input.slice(0, length)}${ellipsis}`;
};

export const truncateMiddle = (
  input: string,
  options: {
    readonly frontLength: number;
    readonly backLength: number;
    readonly ellipsis?: string;
  },
): string => {
  const { backLength, ellipsis = "...", frontLength } = options;
  const preservedLength = frontLength + backLength;

  if (input.length <= preservedLength) {
    return input;
  }

  return `${input.slice(0, frontLength)}${ellipsis}${input.slice(input.length - backLength)}`;
};
