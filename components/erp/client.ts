export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/erp/${path}`, {
    cache: 'no-store',
    signal,
    ...(payload === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'The request could not be completed.';
    throw new RequestError(response.status, message);
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}
