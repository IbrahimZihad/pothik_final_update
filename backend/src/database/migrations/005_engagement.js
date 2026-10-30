'use strict';

const { helpers } = require('../migrationHelpers');

module.exports = {
  async up({ context: { queryInterface, Sequelize, sequelize } }) {
    const { DataTypes, id, timestamps, fkBig, tableOptions } = helpers(Sequelize, sequelize);

    await queryInterface.createTable(
      'reviews',
      {
        id,
        booking_id: fkBig('bookings', { onDelete: 'CASCADE' }),
        user_id: fkBig('users', { onDelete: 'CASCADE' }),
        target_type: { type: DataTypes.ENUM('HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION'), allowNull: false },
        target_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
        title: { type: DataTypes.STRING(160), allowNull: true },
        comment: { type: DataTypes.TEXT, allowNull: true },
        status: {
          type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        moderated_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        moderated_at: { type: DataTypes.DATE, allowNull: true },
        provider_reply: { type: DataTypes.TEXT, allowNull: true },
        replied_at: { type: DataTypes.DATE, allowNull: true },
        is_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('reviews', ['booking_id', 'user_id', 'target_type', 'target_id'], {
      unique: true,
      name: 'reviews_booking_target_uq',
    });
    await queryInterface.addIndex('reviews', ['target_type', 'target_id', 'status'], { name: 'reviews_target_idx' });

    await queryInterface.createTable(
      'notifications',
      {
        id,
        user_id: fkBig('users', { onDelete: 'CASCADE' }),
        type: { type: DataTypes.STRING(60), allowNull: false },
        title: { type: DataTypes.STRING(200), allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: true },
        data: { type: DataTypes.JSON, allowNull: true },
        channel: {
          type: DataTypes.ENUM('IN_APP', 'EMAIL', 'BOTH'),
          allowNull: false,
          defaultValue: 'IN_APP',
        },
        read_at: { type: DataTypes.DATE, allowNull: true },
        sent_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('notifications', ['user_id', 'read_at'], { name: 'notifications_user_read_idx' });

    await queryInterface.createTable(
      'messages',
      {
        id,
        booking_id: fkBig('bookings', { allowNull: true, onDelete: 'SET NULL' }),
        sender_user_id: fkBig('users', { onDelete: 'CASCADE' }),
        recipient_user_id: fkBig('users', { onDelete: 'CASCADE' }),
        body: { type: DataTypes.TEXT, allowNull: false },
        read_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('messages', ['booking_id'], { name: 'messages_booking_idx' });
    await queryInterface.addIndex('messages', ['recipient_user_id', 'read_at'], { name: 'messages_recipient_idx' });
  },

  async down({ context: { queryInterface } }) {
    for (const table of ['messages', 'notifications', 'reviews']) await queryInterface.dropTable(table);
  },
};
