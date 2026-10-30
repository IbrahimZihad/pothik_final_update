'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const config = require('../../config');
const { BusinessRuleError } = require('../errors');

fs.mkdirSync(path.join(config.uploads.dir, 'private'), { recursive: true });

const ALLOWED_MIME = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);

const storage = multer.diskStorage({
  // Verification documents are personal data: they live outside the public
  // /uploads tree and are streamed only through authenticated routes.
  destination: (req, file, cb) => cb(null, path.join(config.uploads.dir, 'private')),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME.get(file.mimetype) || path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new BusinessRuleError('Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF', 'UNSUPPORTED_FILE_TYPE'));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxBytes, files: 6 },
});

module.exports = { upload };
