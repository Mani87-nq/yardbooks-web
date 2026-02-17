/**
 * RFC 7807 Problem Details for HTTP APIs.
 * All API errors should use this format.
 */
import { NextResponse } from 'next/server';

interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

export function apiError(problem: ProblemDetail): NextResponse {
  return NextResponse.json(
    {
      type: problem.type ?? 'about:blank',
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
      instance: problem.instance,
      ...(problem.errors ? { errors: problem.errors } : {}),
    },
    { status: problem.status }
  );
}

// Common error responses
export function unauthorized(detail?: string) {
  return apiError({ title: 'Unauthorized', status: 401, detail: detail ?? 'Authentication required' });
}

export function forbidden(detail?: string) {
  return apiError({ title: 'Forbidden', status: 403, detail: detail ?? 'Insufficient permissions' });
}

export function notFound(detail?: string) {
  return apiError({ title: 'Not Found', status: 404, detail: detail ?? 'Resource not found' });
}

export function badRequest(detail: string, errors?: Record<string, string[]>) {
  return apiError({ title: 'Bad Request', status: 400, detail, errors });
}

export function conflict(detail: string) {
  return apiError({ title: 'Conflict', status: 409, detail });
}

export function internalError(detail?: string) {
  return apiError({
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'development' ? detail : 'An unexpected error occurred',
  });
}
