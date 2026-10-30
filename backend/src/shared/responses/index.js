'use strict';

function success(res, { status = 200, message = 'OK', data = null, meta } = {}) {
  const payload = { success: true, message, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(status).json(payload);
}

function created(res, { message = 'Created successfully', data = null, meta } = {}) {
  return success(res, { status: 201, message, data, meta });
}

function noContent(res) {
  return res.status(204).send();
}

function failure(res, { status = 400, message = 'Request failed', code = 'BAD_REQUEST', errors } = {}) {
  const payload = { success: false, message, code };
  if (errors !== undefined) payload.errors = errors;
  return res.status(status).json(payload);
}

module.exports = { success, created, noContent, failure };
