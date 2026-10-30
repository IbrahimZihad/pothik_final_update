'use strict';

const { ROLE_PERMISSIONS, ROLE_LABELS, PERMISSIONS } = require('../../shared/constants/roles');
const { models } = require('../../models');

module.exports = {
  async up() {
    const roleRows = {};
    for (const [code, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const [role] = await models.Role.findOrCreate({
        where: { code },
        defaults: { code, name: ROLE_LABELS[code] || code, description: `${ROLE_LABELS[code] || code} role` },
      });
      roleRows[code] = role;
    }

    const permissionRows = {};
    for (const code of Object.values(PERMISSIONS)) {
      const [module] = code.split(':');
      const [permission] = await models.Permission.findOrCreate({
        where: { code },
        defaults: { code, module, description: code.replace(':', ' ') },
      });
      permissionRows[code] = permission;
    }

    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
      const role = roleRows[roleCode];
      for (const code of permissionCodes) {
        const permission = permissionRows[code];
        if (!permission) continue;
        await models.RolePermission.findOrCreate({
          where: { role_id: role.id, permission_id: permission.id },
          defaults: { role_id: role.id, permission_id: permission.id },
        });
      }
    }

    console.log(`  roles: ${Object.keys(roleRows).length}, permissions: ${Object.keys(permissionRows).length}`);
  },
};
