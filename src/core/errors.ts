export type AppErrorCode =
  | "CONFIG_ENV_MISSING"
  | "CONFIG_ENV_INVALID"
  | "HTTP_ERROR"
  | "HTTP_NETWORK_ERROR";

export type AppErrorOptions = {
  cause?: unknown;
  details?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.details = options.details;
  }
}

export class ConfigError extends AppError {}

export type HttpErrorOptions = AppErrorOptions & {
  method: string;
  status?: number;
  statusText?: string;
  url: string;
};

export class HttpError extends AppError {
  readonly method: string;
  readonly status: number | undefined;
  readonly statusText: string | undefined;
  readonly url: string;

  constructor(
    code: "HTTP_ERROR" | "HTTP_NETWORK_ERROR",
    message: string,
    options: HttpErrorOptions,
  ) {
    super(code, message, options);
    this.method = options.method;
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
