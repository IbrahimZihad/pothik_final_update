'use strict';

const { DataTypes } = require('sequelize');

/**
 * Reviews, notifications, messages.
 */
module.exports = function defineEngagementModels(sequelize) {
  const common = {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const Review = sequelize.define(
    'Review',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      target_type: {
        type: DataTypes.ENUM('HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION'),
        allowNull: false,
      },
      target_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
      title: { type: DataTypes.STRING(160) },
      comment: { type: DataTypes.TEXT },
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      moderated_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
      moderated_at: { type: DataTypes.DATE },
      provider_reply: { type: DataTypes.TEXT },
      replied_at: { type: DataTypes.DATE },
      is_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      ...common,
      tableName: 'reviews',
      indexes: [
        { unique: true, fields: ['booking_id', 'user_id', 'target_type', 'target_id'] },
        { fields: ['target_type', 'target_id', 'status'] },
      ],
    }
  );

  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      type: { type: DataTypes.STRING(60), allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body: { type: DataTypes.TEXT },
      data: { type: DataTypes.JSON },
      channel: {
        type: DataTypes.ENUM('IN_APP', 'EMAIL', 'BOTH'),
        allowNull: false,
        defaultValue: 'IN_APP',
      },
      read_at: { type: DataTypes.DATE },
      sent_at: { type: DataTypes.DATE },
    },
    {
      ...common,
      tableName: 'notifications',
      indexes: [{ fields: ['user_id', 'read_at'] }],
    }
  );

  const Message = sequelize.define(
    'Message',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED },
      sender_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      recipient_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      read_at: { type: DataTypes.DATE },
    },
    {
      ...common,
      tableName: 'messages',
      indexes: [{ fields: ['booking_id'] }, { fields: ['recipient_user_id', 'read_at'] }],
    }
  );

  return { Review, Notification, Message };
};
