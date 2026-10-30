'use strict';

const { helpers } = require('../migrationHelpers');

module.exports = {
  async up({ context: { queryInterface, Sequelize, sequelize } }) {
    const { DataTypes, id, intId, timestamps, money, decimal, fkBig, fkInt, tableOptions } = helpers(Sequelize, sequelize);
    const now = new Date();

    await queryInterface.createTable(
      'roles',
      {
        id: intId,
        code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(80), allowNull: false },
        description: { type: DataTypes.STRING(255) },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'permissions',
      {
        id: intId,
        code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
        module: { type: DataTypes.STRING(40), allowNull: false },
        description: { type: DataTypes.STRING(255) },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'role_permissions',
      {
        role_id: { ...fkInt('roles', { onDelete: 'CASCADE' }), primaryKey: true },
        permission_id: { ...fkInt('permissions', { onDelete: 'CASCADE' }), primaryKey: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'users',
      {
        id,
        name: { type: DataTypes.STRING(120), allowNull: false },
        email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
        phone: { type: DataTypes.STRING(30), allowNull: true },
        password_hash: { type: DataTypes.STRING(100), allowNull: false },
        status: {
          type: DataTypes.ENUM('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'),
          allowNull: false,
          defaultValue: 'PENDING_VERIFICATION',
        },
        email_verified_at: { type: DataTypes.DATE, allowNull: true },
        avatar_url: { type: DataTypes.STRING(500), allowNull: true },
        locale: { type: DataTypes.ENUM('en', 'bn'), allowNull: false, defaultValue: 'en' },
        travel_preferences: { type: DataTypes.JSON, allowNull: true },
        last_login_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
        deleted_at: { type: DataTypes.DATE, allowNull: true },
      },
      tableOptions
    );
    await queryInterface.addIndex('users', ['status'], { name: 'users_status_idx' });

    await queryInterface.createTable(
      'user_roles',
      {
        user_id: { ...fkBig('users', { onDelete: 'CASCADE' }), primaryKey: true },
        role_id: { ...fkInt('roles', { onDelete: 'CASCADE' }), primaryKey: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'refresh_tokens',
      {
        id,
        user_id: fkBig('users', { onDelete: 'CASCADE' }),
        family_id: { type: DataTypes.UUID, allowNull: false },
        token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        revoked_at: { type: DataTypes.DATE, allowNull: true },
        replaced_by_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        user_agent: { type: DataTypes.STRING(255), allowNull: true },
        ip: { type: DataTypes.STRING(64), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('refresh_tokens', ['user_id'], { name: 'refresh_tokens_user_idx' });

    await queryInterface.createTable(
      'verification_tokens',
      {
        id,
        user_id: fkBig('users', { onDelete: 'CASCADE' }),
        purpose: { type: DataTypes.ENUM('EMAIL_VERIFY', 'PASSWORD_RESET'), allowNull: false },
        token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        used_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'provider_profiles',
      {
        id,
        user_id: { ...fkBig('users', { onDelete: 'CASCADE' }), unique: true },
        type: { type: DataTypes.ENUM('HOTEL', 'TRANSPORT', 'GUIDE'), allowNull: false },
        business_name: { type: DataTypes.STRING(160), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        phone: { type: DataTypes.STRING(30), allowNull: true },
        address: { type: DataTypes.STRING(255), allowNull: true },
        logo_url: { type: DataTypes.STRING(500), allowNull: true },
        status: {
          type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        rejection_reason: { type: DataTypes.STRING(500), allowNull: true },
        commission_rate: decimal(5, 2),
        approved_at: { type: DataTypes.DATE, allowNull: true },
        approved_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('provider_profiles', ['status', 'type'], { name: 'provider_profiles_status_type_idx' });

    await queryInterface.createTable(
      'provider_documents',
      {
        id,
        provider_profile_id: fkBig('provider_profiles', { onDelete: 'CASCADE' }),
        type: { type: DataTypes.STRING(60), allowNull: false },
        file_url: { type: DataTypes.STRING(500), allowNull: false },
        status: {
          type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        notes: { type: DataTypes.STRING(500), allowNull: true },
        reviewed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        reviewed_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'audit_logs',
      {
        id,
        actor_user_id: fkBig('users', { allowNull: true, onDelete: 'SET NULL' }),
        action: { type: DataTypes.STRING(80), allowNull: false },
        entity_type: { type: DataTypes.STRING(60), allowNull: true },
        entity_id: { type: DataTypes.STRING(60), allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
        ip: { type: DataTypes.STRING(64), allowNull: true },
        request_id: { type: DataTypes.STRING(64), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id'], { name: 'audit_logs_entity_idx' });

    await queryInterface.createTable(
      'platform_settings',
      {
        id: intId,
        key: { type: DataTypes.STRING(80), allowNull: false, unique: true },
        value: { type: DataTypes.JSON, allowNull: true },
        description: { type: DataTypes.STRING(255), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );

    // seed the five fixed roles immediately so authorization never runs empty
    await queryInterface.bulkInsert('roles', [
      { code: 'ADMIN', name: 'Administrator', description: 'Full platform administration', created_at: now, updated_at: now },
      { code: 'HOTEL_OWNER', name: 'Hotel Owner', description: 'Manages hotels, rooms and hotel reservations', created_at: now, updated_at: now },
      { code: 'TRANSPORT_PROVIDER', name: 'Transport Provider', description: 'Manages vehicles, drivers and transport bookings', created_at: now, updated_at: now },
      { code: 'TOUR_GUIDE', name: 'Tour Guide', description: 'Manages guide services and assignments', created_at: now, updated_at: now },
      { code: 'CUSTOMER', name: 'Customer', description: 'Books trips and reviews services', created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert('platform_settings', [
      {
        key: 'commission_rates',
        value: JSON.stringify({ default: 10, hotel: 12, transport: 10, guide: 10 }),
        description: 'Commission percentages applied when a booking is paid',
        created_at: now,
        updated_at: now,
      },
      {
        key: 'support_contact',
        value: JSON.stringify({ email: 'support@pothik.com', phone: '+8801700000000' }),
        description: 'Support contact shown across the platform',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down({ context: { queryInterface } }) {
    const tables = [
      'platform_settings',
      'audit_logs',
      'provider_documents',
      'provider_profiles',
      'verification_tokens',
      'refresh_tokens',
      'user_roles',
      'users',
      'role_permissions',
      'permissions',
      'roles',
    ];
    for (const table of tables) await queryInterface.dropTable(table);
  },
};
