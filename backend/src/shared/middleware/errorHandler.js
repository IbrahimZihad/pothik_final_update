'use strict';

const { ForeignKeyConstraintError, UniqueConstraintError, ValidationError: SequelizeValidationError } = require('sequelize');
const { ZodError } = require('zod');
const multer = require('multer');
const logger = require('../../config/logger');
const { failure } = require('../responses');
const { AppError } = require('../errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return failure(res, {
      status: tooLarge ? 413 : 400,
      message: tooLarge ? 'The uploaded file is too large' : 'The upload could not be processed',
      code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
      errors: [{ field: err.field || 'file', message: err.message }],
    });
  }

  if (err instanceof ZodError) {
    return failure(res, {
      status: 422,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }

  if (err instanceof UniqueConstraintError) {
    return failure(res, {
      status: 409,
      message: 'A record with these details already exists',
      code: 'DUPLICATE_RECORD',
      errors: (err.errors || []).map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err instanceof ForeignKeyConstraintError) {
    return failure(res, {
      status: 409,
      message: 'Related record does not exist or is still in use',
      code: 'RELATED_RECORD_CONFLICT',
    });
  }

  if (err instanceof SequelizeValidationError) {
    return failure(res, {
      status: 422,
      message: 'Database validation failed',
      code: 'VALIDATION_ERROR',
      errors: (err.errors || []).map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err instanceof AppError) {
    return failure(res, {
      status: err.statusCode,
      message: err.message,
      code: err.code,
      errors: err.details,
    });
  }

  logger.error({ err, requestId: req.id, path: req.originalUrl, method: req.method }, 'unhandled error');
  return failure(res, {
    status: 500,
    message: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
    errors: req.id ? [{ field: 'requestId', message: req.id }] : undefined,
  });
}

module.exports = { errorHandler };
