export function parseSafeInt(
  value: string | null | undefined,
  defaultValue: number,
  min?: number,
  max?: number,
): number {
  if (value === null || value === undefined) return defaultValue;
  if (/[<>"'&|\\(){}[\];]/.test(value)) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  let result = parsed;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

export function parseSafeEnum<T extends string>(
  value: string | null | undefined,
  allowed: T[],
  defaultVal: T,
): T {
  if (!value) return defaultVal;
  return allowed.includes(value as T) ? (value as T) : defaultVal;
}

export function parseSafeSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[<>"'&|\\(){}[\];%#]/g, "")
    .trim()
    .slice(0, 100);
}
