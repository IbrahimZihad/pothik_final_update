'use strict';

const { helpers } = require('../migrationHelpers');

module.exports = {
  async up({ context: { queryInterface, Sequelize, sequelize } }) {
    const { DataTypes, id, intId, timestamps, money, decimal, fkBig, fkInt, tableOptions } = helpers(Sequelize, sequelize);

    await queryInterface.createTable(
      'hotels',
      {
        id,
        provider_profile_id: fkBig('provider_profiles', { onDelete: 'CASCADE' }),
        destination_id: fkBig('destinations', { allowNull: true, onDelete: 'SET NULL' }),
        name: { type: DataTypes.STRING(180), allowNull: false },
        slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        star_rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
        address: { type: DataTypes.STRING(255), allowNull: true },
        latitude: decimal(10, 7),
        longitude: decimal(10, 7),
        phone: { type: DataTypes.STRING(30), allowNull: true },
        email: { type: DataTypes.STRING(160), allowNull: true },
        checkin_time: { type: DataTypes.STRING(10), allowNull: true, defaultValue: '14:00' },
        checkout_time: { type: DataTypes.STRING(10), allowNull: true, defaultValue: '12:00' },
        image_url: { type: DataTypes.STRING(500), allowNull: true },
        gallery: { type: DataTypes.JSON, allowNull: true },
        facilities: { type: DataTypes.JSON, allowNull: true },
        status: {
          type: DataTypes.ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED'),
          allowNull: false,
          defaultValue: 'PENDING_REVIEW',
        },
        rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
        rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('hotels', ['provider_profile_id'], { name: 'hotels_provider_idx' });
    await queryInterface.addIndex('hotels', ['destination_id'], { name: 'hotels_destination_idx' });
    await queryInterface.addIndex('hotels', ['status'], { name: 'hotels_status_idx' });

    await queryInterface.createTable(
      'hotel_rooms',
      {
        id,
        hotel_id: fkBig('hotels', { onDelete: 'CASCADE' }),
        name: { type: DataTypes.STRING(160), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        room_type: {
          type: DataTypes.ENUM('SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'FAMILY', 'DORMITORY'),
          allowNull: false,
          defaultValue: 'DOUBLE',
        },
        capacity_adults: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2 },
        capacity_children: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        base_price: money(true),
        extra_bed_price: money(false, 0),
        total_units: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        min_stay_nights: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 1 },
        max_stay_nights: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        image_url: { type: DataTypes.STRING(500), allowNull: true },
        amenities: { type: DataTypes.JSON, allowNull: true },
        status: {
          type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('hotel_rooms', ['hotel_id'], { name: 'hotel_rooms_hotel_idx' });

    await queryInterface.createTable(
      'room_availability',
      {
        id,
        room_id: fkBig('hotel_rooms', { onDelete: 'CASCADE' }),
        date: { type: DataTypes.DATEONLY, allowNull: false },
        total_units: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        reserved_units: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        price_override: money(true),
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('room_availability', ['room_id', 'date'], { unique: true, name: 'room_avail_room_date_uq' });

    await queryInterface.createTable(
      'vehicle_categories',
      {
        id: intId,
        code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(80), allowNull: false },
        name_bn: { type: DataTypes.STRING(80), allowNull: true },
        default_capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        icon: { type: DataTypes.STRING(40), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'vehicles',
      {
        id,
        provider_profile_id: fkBig('provider_profiles', { onDelete: 'CASCADE' }),
        category_id: fkInt('vehicle_categories'),
        name: { type: DataTypes.STRING(160), allowNull: false },
        model: { type: DataTypes.STRING(120), allowNull: true },
        registration_no: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        image_url: { type: DataTypes.STRING(500), allowNull: true },
        features: { type: DataTypes.JSON, allowNull: true },
        price_per_day: money(true),
        price_per_km: money(true),
        driver_included: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        status: {
          type: DataTypes.ENUM('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'PENDING_REVIEW'),
          allowNull: false,
          defaultValue: 'PENDING_REVIEW',
        },
        rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
        rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('vehicles', ['provider_profile_id'], { name: 'vehicles_provider_idx' });
    await queryInterface.addIndex('vehicles', ['category_id'], { name: 'vehicles_category_idx' });

    await queryInterface.createTable(
      'drivers',
      {
        id,
        provider_profile_id: fkBig('provider_profiles', { onDelete: 'CASCADE' }),
        vehicle_id: fkBig('vehicles', { allowNull: true, onDelete: 'SET NULL' }),
        name: { type: DataTypes.STRING(120), allowNull: false },
        phone: { type: DataTypes.STRING(30), allowNull: true },
        license_no: { type: DataTypes.STRING(60), allowNull: true },
        license_expiry: { type: DataTypes.DATEONLY, allowNull: true },
        photo_url: { type: DataTypes.STRING(500), allowNull: true },
        status: {
          type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ON_LEAVE'),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('drivers', ['provider_profile_id'], { name: 'drivers_provider_idx' });

    await queryInterface.createTable(
      'vehicle_availability',
      {
        id,
        vehicle_id: fkBig('vehicles', { onDelete: 'CASCADE' }),
        date: { type: DataTypes.DATEONLY, allowNull: false },
        status: {
          type: DataTypes.ENUM('AVAILABLE', 'BLOCKED', 'BOOKED'),
          allowNull: false,
          defaultValue: 'AVAILABLE',
        },
        booking_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('vehicle_availability', ['vehicle_id', 'date'], {
      unique: true,
      name: 'vehicle_avail_vehicle_date_uq',
    });

    await queryInterface.createTable(
      'guides',
      {
        id,
        provider_profile_id: { ...fkBig('provider_profiles', { onDelete: 'CASCADE' }), unique: true },
        bio: { type: DataTypes.TEXT, allowNull: true },
        languages: { type: DataTypes.JSON, allowNull: true },
        expertise: { type: DataTypes.JSON, allowNull: true },
        years_experience: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 0 },
        daily_rate: money(true),
        hourly_rate: money(true),
        service_locations: { type: DataTypes.JSON, allowNull: true },
        photo_url: { type: DataTypes.STRING(500), allowNull: true },
        status: {
          type: DataTypes.ENUM('PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'SUSPENDED'),
          allowNull: false,
          defaultValue: 'PENDING_REVIEW',
        },
        rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
        rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'guide_availability',
      {
        id,
        guide_id: fkBig('guides', { onDelete: 'CASCADE' }),
        date: { type: DataTypes.DATEONLY, allowNull: false },
        status: {
          type: DataTypes.ENUM('AVAILABLE', 'BLOCKED', 'BOOKED'),
          allowNull: false,
          defaultValue: 'AVAILABLE',
        },
        booking_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('guide_availability', ['guide_id', 'date'], {
      unique: true,
      name: 'guide_avail_guide_date_uq',
    });
  },

  async down({ context: { queryInterface } }) {
    const tables = [
      'guide_availability',
      'guides',
      'vehicle_availability',
      'drivers',
      'vehicles',
      'vehicle_categories',
      'room_availability',
      'hotel_rooms',
      'hotels',
    ];
    for (const table of tables) await queryInterface.dropTable(table);
  },
};
