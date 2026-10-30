'use strict';

const { models } = require('../../models');
const logger = require('../../config/logger');

async function recordAudit({ actorUserId = null, action, entityType = null, entityId = null, metadata = null, ip = null, requestId = null }) {
  try {
    await models.AuditLog.create({
      actor_user_id: actorUserId || null,
      action,
      entity_type: entityType,
      entity_id: entityId === undefined || entityId === null ? null : String(entityId),
      metadata,
      ip: ip || null,
      request_id: requestId ? String(requestId) : null,
    });
  } catch (err) {
    logger.error({ err: err.message, action }, 'audit log write failed');
  }
}

module.exports = { recordAudit };
