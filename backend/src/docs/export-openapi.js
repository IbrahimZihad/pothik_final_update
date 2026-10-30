'use strict';

/**
 * Writes the OpenAPI document to docs/openapi.json.
 *
 *   npm run openapi
 *
 * The spec is built from the same module that serves /openapi.json, so the
 * static file can never drift from the running server.
 */
const fs = require('fs');
const path = require('path');

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

const spec = require('./openapi');

const target = path.join(__dirname, '..', '..', '..', 'docs', 'openapi.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const operations = Object.values(spec.paths).reduce((total, pathItem) => total + Object.keys(pathItem).length, 0);
console.log(`OpenAPI ${spec.openapi} written to ${path.relative(process.cwd(), target)} (${Object.keys(spec.paths).length} paths, ${operations} operations)`);
