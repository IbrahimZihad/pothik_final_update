'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { NotFoundError } = require('../errors');

const PRIVATE_UPLOAD_DIR = path.join(config.uploads.dir, 'private');

/**
 * Verification documents are stored outside the public /uploads tree. This
 * resolves a stored `/uploads/private/<name>` reference and refuses anything
 * that escapes the directory or no longer exists.
 */
function resolvePrivateUpload(fileUrl) {
  const name = path.basename(fileUrl || '');
  const absolute = name ? path.join(PRIVATE_UPLOAD_DIR, name) : null;
  if (!absolute || !fs.existsSync(absolute)) throw new NotFoundError('Document file');
  return absolute;
}

module.exports = { PRIVATE_UPLOAD_DIR, resolvePrivateUpload };
