'use strict';

const { DataTypes } = require('sequelize');

const BOOKING_STATUSES = [
  'PENDING',
  'AWAITING_CONFIRMATION',
  'QUOTED',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
];

/**
 * Bookings, payments, commissions, payouts, coupons, loyalty, custom trips.
 */
module.exports = function defineCommerceModels(sequelize) {
  const common = {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const Booking = sequelize.define(
    'Booking',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      reference: { type: DataTypes.STRING(24), allowNull: false, unique: true },
      customer_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      type: {
        type: DataTypes.ENUM('PACKAGE', 'CUSTOM_TRIP', 'HOTEL', 'TRANSPORT', 'GUIDE'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...BOOKING_STATUSES),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      start_date: { type: DataTypes.DATEONLY, allowNull: false },
      end_date: { type: DataTypes.DATEONLY, allowNull: false },
      adults: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      children: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      contact_name: { type: DataTypes.STRING(120) },
      contact_phone: { type: DataTypes.STRING(30) },
      contact_email: { type: DataTypes.STRING(190) },
      special_requests: { type: DataTypes.TEXT },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BDT' },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discount_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      tax_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      due_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      coupon_id: { type: DataTypes.BIGINT.UNSIGNED },
      custom_trip_id: { type: DataTypes.BIGINT.UNSIGNED },
      cancellation_policy: { type: DataTypes.TEXT },
      cancellation_reason: { type: DataTypes.STRING(500) },
      confirmed_at: { type: DataTypes.DATE },
      cancelled_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },
      expires_at: { type: DataTypes.DATE },
    },
    {
      ...common,
      tableName: 'bookings',
      indexes: [
        { fields: ['customer_user_id'] },
        { fields: ['status'] },
        { fields: ['type'] },
        { fields: ['start_date'] },
      ],
    }
  );

  const BookingItem = sequelize.define(
    'BookingItem',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      item_type: {
        type: DataTypes.ENUM('PACKAGE', 'HOTEL_ROOM', 'VEHICLE', 'GUIDE', 'SERVICE'),
        allowNull: false,
      },
      ref_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED },
      title: { type: DataTypes.STRING(200), allowNull: false },
      start_date: { type: DataTypes.DATEONLY },
      end_date: { type: DataTypes.DATEONLY },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      total_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      commission_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      commission_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      provider_payable: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      meta: { type: DataTypes.JSON },
    },
    {
      ...common,
      tableName: 'booking_items',
      indexes: [{ fields: ['booking_id'] }, { fields: ['provider_profile_id'] }],
    }
  );

  const BookingPassenger = sequelize.define(
    'BookingPassenger',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      full_name: { type: DataTypes.STRING(120), allowNull: false },
      age: { type: DataTypes.INTEGER.UNSIGNED },
      gender: { type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER') },
      nid: { type: DataTypes.STRING(40) },
      passport_no: { type: DataTypes.STRING(40) },
    },
    { ...common, tableName: 'booking_passengers', indexes: [{ fields: ['booking_id'] }] }
  );

  const BookingStatusHistory = sequelize.define(
    'BookingStatusHistory',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      from_status: { type: DataTypes.STRING(30) },
      to_status: { type: DataTypes.STRING(30), allowNull: false },
      changed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
      reason: { type: DataTypes.STRING(500) },
    },
    { ...common, tableName: 'booking_status_history', indexes: [{ fields: ['booking_id'] }] }
  );

  const Payment = sequelize.define(
    'Payment',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      provider: { type: DataTypes.STRING(40), allowNull: false },
      provider_txn_id: { type: DataTypes.STRING(120) },
      idempotency_key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BDT' },
      method: { type: DataTypes.STRING(40) },
      status: {
        type: DataTypes.ENUM('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'),
        allowNull: false,
        defaultValue: 'INITIATED',
      },
      gateway_payload: { type: DataTypes.JSON },
      failure_reason: { type: DataTypes.STRING(500) },
      paid_at: { type: DataTypes.DATE },
      verified_at: { type: DataTypes.DATE },
    },
    {
      ...common,
      tableName: 'payments',
      indexes: [{ fields: ['booking_id'] }, { fields: ['status'] }],
    }
  );

  const Refund = sequelize.define(
    'Refund',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      payment_id: { type: DataTypes.BIGINT.UNSIGNED },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      reason: { type: DataTypes.STRING(500) },
      status: {
        type: DataTypes.ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'),
        allowNull: false,
        defaultValue: 'REQUESTED',
      },
      requested_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
      processed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
      processed_at: { type: DataTypes.DATE },
      provider_refund_id: { type: DataTypes.STRING(120) },
      notes: { type: DataTypes.STRING(500) },
    },
    { ...common, tableName: 'refunds', indexes: [{ fields: ['booking_id'] }, { fields: ['status'] }] }
  );

  const Commission = sequelize.define(
    'Commission',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      booking_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED },
      gross_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM('PENDING', 'EARNED', 'PAID', 'REVERSED'),
        allowNull: false,
        defaultValue: 'EARNED',
      },
      earned_at: { type: DataTypes.DATE },
    },
    {
      ...common,
      tableName: 'commissions',
      indexes: [{ fields: ['provider_profile_id'] }, { fields: ['status'] }],
    }
  );

  const ProviderPayout = sequelize.define(
    'ProviderPayout',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM('REQUESTED', 'APPROVED', 'PAID', 'REJECTED'),
        allowNull: false,
        defaultValue: 'REQUESTED',
      },
      method: { type: DataTypes.STRING(40) },
      reference: { type: DataTypes.STRING(120) },
      notes: { type: DataTypes.STRING(500) },
      requested_at: { type: DataTypes.DATE },
      processed_at: { type: DataTypes.DATE },
      processed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED },
    },
    { ...common, tableName: 'provider_payouts', indexes: [{ fields: ['provider_profile_id'] }, { fields: ['status'] }] }
  );

  const Coupon = sequelize.define(
    'Coupon',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255) },
      type: { type: DataTypes.ENUM('PERCENT', 'FIXED'), allowNull: false },
      value: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      min_spend: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      max_discount: { type: DataTypes.DECIMAL(12, 2) },
      usage_limit: { type: DataTypes.INTEGER.UNSIGNED },
      per_user_limit: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
      used_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      starts_at: { type: DataTypes.DATE },
      ends_at: { type: DataTypes.DATE },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { ...common, tableName: 'coupons' }
  );

  const CouponRedemption = sequelize.define(
    'CouponRedemption',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      coupon_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    { ...common, tableName: 'coupon_redemptions' }
  );

  const LoyaltyTransaction = sequelize.define(
    'LoyaltyTransaction',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      points: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM('EARN', 'REDEEM', 'ADJUST', 'EXPIRE'),
        allowNull: false,
      },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED },
      balance_after: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      description: { type: DataTypes.STRING(255) },
    },
    { ...common, tableName: 'loyalty_transactions', indexes: [{ fields: ['user_id'] }] }
  );

  const CustomTrip = sequelize.define(
    'CustomTrip',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      title: { type: DataTypes.STRING(200) },
      status: {
        type: DataTypes.ENUM('DRAFT', 'QUOTED', 'CONFIRMED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      start_date: { type: DataTypes.DATEONLY },
      end_date: { type: DataTypes.DATEONLY },
      adults: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
      children: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      requirements: { type: DataTypes.TEXT },
      estimated_total: { type: DataTypes.DECIMAL(12, 2) },
      quotation: { type: DataTypes.JSON },
    },
    { ...common, tableName: 'custom_trips', indexes: [{ fields: ['user_id'] }] }
  );

  const CustomTripItem = sequelize.define(
    'CustomTripItem',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      custom_trip_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      item_type: {
        type: DataTypes.ENUM('DESTINATION', 'HOTEL_ROOM', 'VEHICLE', 'GUIDE', 'PACKAGE', 'SERVICE'),
        allowNull: false,
      },
      ref_id: { type: DataTypes.BIGINT.UNSIGNED },
      title: { type: DataTypes.STRING(200) },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
      meta: { type: DataTypes.JSON },
    },
    { ...common, tableName: 'custom_trip_items', indexes: [{ fields: ['custom_trip_id'] }] }
  );

  return {
    BOOKING_STATUSES,
    Booking,
    BookingItem,
    BookingPassenger,
    BookingStatusHistory,
    Payment,
    Refund,
    Commission,
    ProviderPayout,
    Coupon,
    CouponRedemption,
    LoyaltyTransaction,
    CustomTrip,
    CustomTripItem,
  };
};
