import { todayInNagpur } from './model';

export class ErpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requiredText(value: unknown, label: string, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ErpError(
      400,
      `${label} is required (maximum ${max} characters).`,
    );
  return value.trim();
}

export function dateValue(value: unknown) {
  const day = requiredText(value, 'Date', 10);
  const parsed = new Date(day + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== day ||
    day > todayInNagpur()
  )
    throw new ErpError(
      400,
      'Choose a valid date no later than today in Nagpur.',
    );
  return day;
}

export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new ErpError(400, 'Expected a JSON object.');
  return value as Record<string, unknown>;
}

export function missing(): never {
  throw new ErpError(404, 'Record not found in your workspace.');
}
