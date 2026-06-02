export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR';

export function defaultErrorCodeForStatus(statusCode: number): ApiErrorCode {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHENTICATED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 413) return 'PAYLOAD_TOO_LARGE';
  if (statusCode === 422) return 'UNPROCESSABLE_ENTITY';
  if (statusCode === 429) return 'RATE_LIMITED';
  return 'INTERNAL_SERVER_ERROR';
}

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly code: ApiErrorCode;

  constructor(statusCode: number, message: string, details?: unknown, code?: ApiErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code ?? defaultErrorCodeForStatus(statusCode);
  }
}
