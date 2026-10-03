'use strict';
/** Typed HTTP error + async route wrapper so thrown errors reach the error handler. */

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (details) this.details = details;
  }
  static badRequest(message = 'Invalid request.', details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Resource already exists.') {
    return new ApiError(409, message);
  }
  static tooManyRequests(message = 'Too many attempts. Try again later.') {
    return new ApiError(429, message);
  }
}

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = { ApiError, asyncHandler };
