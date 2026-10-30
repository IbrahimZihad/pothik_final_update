'use strict';

const { helpers } = require('../migrationHelpers');

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

module.exports = {
  async up({ context: { queryInterface, Sequelize, sequelize } }) {
    const { DataTypes, id, timestamps, money, fkBig, fkInt, tableOptions } = helpers(Sequelize, sequelize);

    await queryInterface.createTable(
      'custom_trips',
      {
        id,
        user_id: fkBig('users', { onDelete: 'CASCADE' }),
        title: { type: DataTypes.STRING(200), allowNull: true },
        status: {
          type: DataTypes.ENUM('DRAFT', 'QUOTED', 'CONFIRMED', 'CANCELLED'),
          allowNull: false,
          defaultValue: 'DRAFT',
        },
        start_date: { type: DataTypes.DATEONLY, allowNull: true },
        end_date: { type: DataTypes.DATEONLY, allowNull: true },
        adults: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 1 },
        children: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
        requirements: { type: DataTypes.TEXT, allowNull: true },
        estimated_total: money(true),
        quotation: { type: DataTypes.JSON, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('custom_trips', ['user_id'], { name: 'custom_trips_user_idx' });

    await queryInterface.createTable(
      'custom_trip_items',
      {
        id,
        custom_trip_id: fkBig('custom_trips', { onDelete: 'CASCADE' }),
        item_type: {
          type: DataTypes.ENUM('DESTINATION', 'HOTEL_ROOM', 'VEHICLE', 'GUIDE', 'PACKAGE', 'SERVICE'),
          allowNull: false,
        },
        ref_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        title: { type: DataTypes.STRING(200), allowNull: true },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 1 },
        meta: { type: DataTypes.JSON, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('custom_trip_items', ['custom_trip_id'], { name: 'custom_trip_items_trip_idx' });

    await queryInterface.createTable(
      'coupons',
      {
        id,
        code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        description: { type: DataTypes.STRING(255), allowNull: true },
        type: { type: DataTypes.ENUM('PERCENT', 'FIXED'), allowNull: false },
        value: money(true),
        min_spend: money(false, 0),
        max_discount: money(true),
        usage_limit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        per_user_limit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 1 },
        used_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        starts_at: { type: DataTypes.DATE, allowNull: true },
        ends_at: { type: DataTypes.DATE, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'bookings',
      {
        id,
        reference: { type: DataTypes.STRING(24), allowNull: false, unique: true },
        customer_user_id: fkBig('users'),
        type: { type: DataTypes.ENUM('PACKAGE', 'CUSTOM_TRIP', 'HOTEL', 'TRANSPORT', 'GUIDE'), allowNull: false },
        status: { type: DataTypes.ENUM(...BOOKING_STATUSES), allowNull: false, defaultValue: 'PENDING' },
        start_date: { type: DataTypes.DATEONLY, allowNull: false },
        end_date: { type: DataTypes.DATEONLY, allowNull: false },
        adults: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        children: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        contact_name: { type: DataTypes.STRING(120), allowNull: true },
        contact_phone: { type: DataTypes.STRING(30), allowNull: true },
        contact_email: { type: DataTypes.STRING(190), allowNull: true },
        special_requests: { type: DataTypes.TEXT, allowNull: true },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BDT' },
        subtotal: money(false, 0),
        discount_total: money(false, 0),
        tax_total: money(false, 0),
        total_amount: money(false, 0),
        paid_amount: money(false, 0),
        due_amount: money(false, 0),
        coupon_id: fkBig('coupons', { allowNull: true, onDelete: 'SET NULL' }),
        custom_trip_id: fkBig('custom_trips', { allowNull: true, onDelete: 'SET NULL' }),
        cancellation_policy: { type: DataTypes.TEXT, allowNull: true },
        cancellation_reason: { type: DataTypes.STRING(500), allowNull: true },
        confirmed_at: { type: DataTypes.DATE, allowNull: true },
        cancelled_at: { type: DataTypes.DATE, allowNull: true },
        completed_at: { type: DataTypes.DATE, allowNull: true },
        expires_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('bookings', ['customer_user_id'], { name: 'bookings_customer_idx' });
    await queryInterface.addIndex('bookings', ['status'], { name: 'bookings_status_idx' });
    await queryInterface.addIndex('bookings', ['type'], { name: 'bookings_type_idx' });
    await queryInterface.addIndex('bookings', ['start_date'], { name: 'bookings_start_idx' });

    await queryInterface.createTable(
      'booking_items',
      {
        id,
        booking_id: fkBig('bookings', { onDelete: 'CASCADE' }),
        item_type: { type: DataTypes.ENUM('PACKAGE', 'HOTEL_ROOM', 'VEHICLE', 'GUIDE', 'SERVICE'), allowNull: false },
        ref_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        provider_profile_id: fkBig('provider_profiles', { allowNull: true, onDelete: 'SET NULL' }),
        title: { type: DataTypes.STRING(200), allowNull: false },
        start_date: { type: DataTypes.DATEONLY, allowNull: true },
        end_date: { type: DataTypes.DATEONLY, allowNull: true },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        unit_price: money(true),
        total_price: money(true),
        commission_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        commission_amount: money(false, 0),
        provider_payable: money(false, 0),
        status: {
          type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        meta: { type: DataTypes.JSON, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('booking_items', ['booking_id'], { name: 'booking_items_booking_idx' });
    await queryInterface.addIndex('booking_items', ['provider_profile_id'], { name: 'booking_items_provider_idx' });

    await queryInterface.createTable(
      'booking_passengers',
      {
        id,
        booking_id: fkBig('bookings', { onDelete: 'CASCADE' }),
        full_name: { type: DataTypes.STRING(120), allowNull: false },
        age: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        gender: { type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER'), allowNull: true },
        nid: { type: DataTypes.STRING(40), allowNull: true },
        passport_no: { type: DataTypes.STRING(40), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('booking_passengers', ['booking_id'], { name: 'booking_passengers_booking_idx' });

    await queryInterface.createTable(
      'booking_status_history',
      {
        id,
        booking_id: fkBig('bookings', { onDelete: 'CASCADE' }),
        from_status: { type: DataTypes.STRING(30), allowNull: true },
        to_status: { type: DataTypes.STRING(30), allowNull: false },
        changed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        reason: { type: DataTypes.STRING(500), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('booking_status_history', ['booking_id'], { name: 'booking_history_booking_idx' });

    await queryInterface.createTable(
      'payments',
      {
        id,
        booking_id: fkBig('bookings'),
        provider: { type: DataTypes.STRING(40), allowNull: false },
        provider_txn_id: { type: DataTypes.STRING(120), allowNull: true },
        idempotency_key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
        amount: money(true),
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BDT' },
        method: { type: DataTypes.STRING(40), allowNull: true },
        status: {
          type: DataTypes.ENUM('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'),
          allowNull: false,
          defaultValue: 'INITIATED',
        },
        gateway_payload: { type: DataTypes.JSON, allowNull: true },
        failure_reason: { type: DataTypes.STRING(500), allowNull: true },
        paid_at: { type: DataTypes.DATE, allowNull: true },
        verified_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('payments', ['booking_id'], { name: 'payments_booking_idx' });
    await queryInterface.addIndex('payments', ['status'], { name: 'payments_status_idx' });

    await queryInterface.createTable(
      'refunds',
      {
        id,
        booking_id: fkBig('bookings'),
        payment_id: fkBig('payments', { allowNull: true, onDelete: 'SET NULL' }),
        amount: money(true),
        reason: { type: DataTypes.STRING(500), allowNull: true },
        status: {
          type: DataTypes.ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'),
          allowNull: false,
          defaultValue: 'REQUESTED',
        },
        requested_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        processed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        processed_at: { type: DataTypes.DATE, allowNull: true },
        provider_refund_id: { type: DataTypes.STRING(120), allowNull: true },
        notes: { type: DataTypes.STRING(500), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('refunds', ['booking_id'], { name: 'refunds_booking_idx' });
    await queryInterface.addIndex('refunds', ['status'], { name: 'refunds_status_idx' });

    await queryInterface.createTable(
      'commissions',
      {
        id,
        booking_item_id: { ...fkBig('booking_items', { onDelete: 'CASCADE' }), unique: true },
        provider_profile_id: fkBig('provider_profiles', { allowNull: true, onDelete: 'SET NULL' }),
        gross_amount: money(true),
        rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        amount: money(true),
        status: {
          type: DataTypes.ENUM('PENDING', 'EARNED', 'PAID', 'REVERSED'),
          allowNull: false,
          defaultValue: 'EARNED',
        },
        earned_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('commissions', ['provider_profile_id'], { name: 'commissions_provider_idx' });
    await queryInterface.addIndex('commissions', ['status'], { name: 'commissions_status_idx' });

    await queryInterface.createTable(
      'provider_payouts',
      {
        id,
        provider_profile_id: fkBig('provider_profiles'),
        amount: money(true),
        status: {
          type: DataTypes.ENUM('REQUESTED', 'APPROVED', 'PAID', 'REJECTED'),
          allowNull: false,
          defaultValue: 'REQUESTED',
        },
        method: { type: DataTypes.STRING(40), allowNull: true },
        reference: { type: DataTypes.STRING(120), allowNull: true },
        notes: { type: DataTypes.STRING(500), allowNull: true },
        requested_at: { type: DataTypes.DATE, allowNull: true },
        processed_at: { type: DataTypes.DATE, allowNull: true },
        processed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('provider_payouts', ['provider_profile_id'], { name: 'payouts_provider_idx' });
    await queryInterface.addIndex('provider_payouts', ['status'], { name: 'payouts_status_idx' });

    await queryInterface.createTable(
      'coupon_redemptions',
      {
        id,
        coupon_id: fkBig('coupons'),
        user_id: fkBig('users'),
        booking_id: { ...fkBig('bookings', { onDelete: 'CASCADE' }), unique: true },
        discount_amount: money(true),
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('coupon_redemptions', ['coupon_id', 'user_id'], { name: 'coupon_redemptions_coupon_user_idx' });

    await queryInterface.createTable(
      'loyalty_transactions',
      {
        id,
        user_id: fkBig('users', { onDelete: 'CASCADE' }),
        points: { type: DataTypes.INTEGER, allowNull: false },
        type: { type: DataTypes.ENUM('EARN', 'REDEEM', 'ADJUST', 'EXPIRE'), allowNull: false },
        booking_id: fkBig('bookings', { allowNull: true, onDelete: 'SET NULL' }),
        balance_after: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        description: { type: DataTypes.STRING(255), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('loyalty_transactions', ['user_id'], { name: 'loyalty_user_idx' });
  },

  async down({ context: { queryInterface } }) {
    const tables = [
      'loyalty_transactions',
      'coupon_redemptions',
      'provider_payouts',
      'commissions',
      'refunds',
      'payments',
      'booking_status_history',
      'booking_passengers',
      'booking_items',
      'bookings',
      'coupons',
      'custom_trip_items',
      'custom_trips',
    ];
    for (const table of tables) await queryInterface.dropTable(table);
  },
};
