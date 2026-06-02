import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { defaultErrorCodeForStatus, HttpError } from '../utils/httpError.js';

function shouldExposeDetails(error: unknown, statusCode: number): boolean {
  if (!(error instanceof HttpError)) return false;
  if (statusCode >= 500 && env.NODE_ENV === 'production') return false;
  return error.details !== undefined;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const safeStatusCode = statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
  const code = error instanceof HttpError ? error.code : defaultErrorCodeForStatus(safeStatusCode);
  const message = error instanceof Error ? error.message : 'Unexpected server error';

  res.status(safeStatusCode).json({
    success: false,
    error: {
      code,
      message: safeStatusCode >= 500 && env.NODE_ENV === 'production' ? 'Unexpected server error.' : message,
      details: shouldExposeDetails(error, safeStatusCode) ? (error as HttpError).details : undefined,
      stack: env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }
  });
};
