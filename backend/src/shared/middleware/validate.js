'use strict';

const { ValidationError } = require('../errors');

/**
 * Validates request parts against zod schemas and replaces them with parsed,
 * coerced values. Only declared parts are touched.
 */
function validate(schemas = {}) {
  return function validationGuard(req, res, next) {
    try {
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.keys(parsed).forEach((key) => {
          req.params[key] = parsed[key];
        });
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        req.validatedQuery = parsed;
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      next();
    } catch (err) {
      if (err && err.issues) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new ValidationError('Validation failed', details));
      }
      return next(err);
    }
  };
}

module.exports = { validate };
