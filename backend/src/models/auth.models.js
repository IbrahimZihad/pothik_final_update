'use strict';

const { DataTypes } = require('sequelize');

/**
 * Auth, RBAC, provider onboarding, audit.
 */
module.exports = function defineAuthModels(sequelize) {
  const common = {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const Role = sequelize.define(
    'Role',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      description: { type: DataTypes.STRING(255) },
    },
    { ...common, tableName: 'roles' }
  );

  const Permission = sequelize.define(
    'Permission',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      module: { type: DataTypes.STRING(40), allowNull: false },
      description: { type: DataTypes.STRING(255) },
    },
    { ...common, tableName: 'permissions' }
  );

  const RolePermission = sequelize.define(
    'RolePermission',
    {
      role_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
      permission_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    },
    { ...common, tableName: 'role_permissions' }
  );

  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
      phone: { type: DataTypes.STRING(30) },
      password_hash: { type: DataTypes.STRING(100), allowNull: false },
      status: {
        type: DataTypes.ENUM('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'PENDING_VERIFICATION',
      },
      email_verified_at: { type: DataTypes.DATE },
      avatar_url: { type: DataTypes.STRING(500) },
      locale: { type: DataTypes.ENUM('en', 'bn'), allowNull: false, defaultValue: 'en' },
      travel_preferences: { type: DataTypes.JSON },
      last_login_at: { type: DataTypes.DATE },
    },
    { ...common, tableName: 'users', paranoid: true, deletedAt: 'deleted_at' }
  );

  const UserRole = sequelize.define(
    'UserRole',
    {
      user_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
      role_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    },
    { ...common, tableName: 'user_roles' }
  );

  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      family_id: { type: DataTypes.UUID, allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE },
      replaced_by_id: { type: DataTypes.BIGINT.UNSIGNED },
      user_agent: { type: DataTypes.STRING(255) },
      ip: { type: DataTypes.STRING(64) },
    },
    { ...common, tableName: 'refresh_tokens' }
  );

  const VerificationToken = sequelize.define(
    'VerificationToken',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      purpose: { type: DataTypes.ENUM('EMAIL_VERIFY', 'PASSWORD_RESET'), allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      used_at: { type: DataTypes.DATE },
    },
    { ...common, tableName: 'verification_tokens' }
  );

  const ProviderProfile = sequelize.define(
    'ProviderProfile',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      type: { type: DataTypes.ENUM('HOTEL', 'TRANSPORT', 'GUIDE'), allowNull: false },
      business_name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT },
      phone: { type: DataTypes.STRING(30) },
      address: { type: DataTypes.STRING(255) },
      logo_url: { type: DataTypes.STRING(500) },
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      rejection_reason: { type: DataTypes.STRING(500) },
      commission_rate: { type: DataTypes.DECIMAL(5, 2) },
      approved_at: { type: DataTypes.DATE },
      approved_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
    },
    { ...common, tableName: 'provider_profiles' }
  );

  const ProviderDocument = sequelize.define(
    'ProviderDocument',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      type: { type: DataTypes.STRING(60), allowNull: false },
      file_url: { type: DataTypes.STRING(500), allowNull: false },
      status: {
        type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      notes: { type: DataTypes.STRING(500) },
      reviewed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
      reviewed_at: { type: DataTypes.DATE },
    },
    { ...common, tableName: 'provider_documents' }
  );

  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      actor_user_id: { type: DataTypes.BIGINT.UNSIGNED },
      action: { type: DataTypes.STRING(80), allowNull: false },
      entity_type: { type: DataTypes.STRING(60) },
      entity_id: { type: DataTypes.STRING(60) },
      metadata: { type: DataTypes.JSON },
      ip: { type: DataTypes.STRING(64) },
      request_id: { type: DataTypes.STRING(64) },
    },
    { ...common, tableName: 'audit_logs' }
  );

  const PlatformSetting = sequelize.define(
    'PlatformSetting',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      value: { type: DataTypes.JSON, allowNull: true },
      description: { type: DataTypes.STRING(255) },
    },
    { ...common, tableName: 'platform_settings' }
  );

  return {
    Role,
    Permission,
    RolePermission,
    User,
    UserRole,
    RefreshToken,
    VerificationToken,
    ProviderProfile,
    ProviderDocument,
    AuditLog,
    PlatformSetting,
  };
};
