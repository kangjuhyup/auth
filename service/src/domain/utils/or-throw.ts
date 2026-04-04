export function orThrow<T>(
  value: T | null | undefined,
  error: string | Error = 'Unexpected null value',
  validate?: (value: T) => boolean,
): T {
  if (value === null || value === undefined) {
    throw typeof error === 'string' ? new Error(error) : error;
  }
  if (validate && !validate(value)) {
    throw typeof error === 'string' ? new Error(error) : error;
  }
  return value;
}
