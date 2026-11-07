export class ApiError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.headers = headers;
  }
}

export const errorBody = (code, message) => ({ error: { code, message } });
