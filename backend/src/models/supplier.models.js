'use strict';

const { DataTypes } = require('sequelize');

/**
 * Hotels, rooms, vehicles, drivers, guides and their availability.
 */
module.exports = function defineSupplierModels(sequelize) {
  const common = {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const Hotel = sequelize.define(
    'Hotel',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      destination_id: { type: DataTypes.BIGINT.UNSIGNED },
      name: { type: DataTypes.STRING(180), allowNull: false },
      slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT },
      star_rating: { type: DataTypes.TINYINT.UNSIGNED },
      address: { type: DataTypes.STRING(255) },
      latitude: { type: DataTypes.DECIMAL(10, 7) },
      longitude: { type: DataTypes.DECIMAL(10, 7) },
      phone: { type: DataTypes.STRING(30) },
      email: { type: DataTypes.STRING(160) },
      checkin_time: { type: DataTypes.STRING(10), defaultValue: '14:00' },
      checkout_time: { type: DataTypes.STRING(10), defaultValue: '12:00' },
      image_url: { type: DataTypes.STRING(500) },
      gallery: { type: DataTypes.JSON },
      facilities: { type: DataTypes.JSON },
      status: {
        type: DataTypes.ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'PENDING_REVIEW',
      },
      rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    {
      ...common,
      tableName: 'hotels',
      indexes: [{ fields: ['provider_profile_id'] }, { fields: ['destination_id'] }, { fields: ['status'] }],
    }
  );

  const HotelRoom = sequelize.define(
    'HotelRoom',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      hotel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT },
      room_type: {
        type: DataTypes.ENUM('SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'FAMILY', 'DORMITORY'),
        allowNull: false,
        defaultValue: 'DOUBLE',
      },
      capacity_adults: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2 },
      capacity_children: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      base_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      extra_bed_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      total_units: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      min_stay_nights: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
      max_stay_nights: { type: DataTypes.INTEGER.UNSIGNED },
      image_url: { type: DataTypes.STRING(500) },
      amenities: { type: DataTypes.JSON },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
    },
    { ...common, tableName: 'hotel_rooms', indexes: [{ fields: ['hotel_id'] }] }
  );

  const RoomAvailability = sequelize.define(
    'RoomAvailability',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      room_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      total_units: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      reserved_units: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      price_override: { type: DataTypes.DECIMAL(12, 2) },
    },
    {
      ...common,
      tableName: 'room_availability',
      indexes: [{ unique: true, fields: ['room_id', 'date'] }],
    }
  );

  const VehicleCategory = sequelize.define(
    'VehicleCategory',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      name_bn: { type: DataTypes.STRING(80) },
      default_capacity: { type: DataTypes.INTEGER.UNSIGNED },
      icon: { type: DataTypes.STRING(40) },
    },
    { ...common, tableName: 'vehicle_categories' }
  );

  const Vehicle = sequelize.define(
    'Vehicle',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      category_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      model: { type: DataTypes.STRING(120) },
      registration_no: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      image_url: { type: DataTypes.STRING(500) },
      features: { type: DataTypes.JSON },
      price_per_day: { type: DataTypes.DECIMAL(12, 2) },
      price_per_km: { type: DataTypes.DECIMAL(12, 2) },
      driver_included: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'PENDING_REVIEW'),
        allowNull: false,
        defaultValue: 'PENDING_REVIEW',
      },
      rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    { ...common, tableName: 'vehicles', indexes: [{ fields: ['provider_profile_id'] }, { fields: ['category_id'] }] }
  );

  const Driver = sequelize.define(
    'Driver',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      vehicle_id: { type: DataTypes.BIGINT.UNSIGNED },
      name: { type: DataTypes.STRING(120), allowNull: false },
      phone: { type: DataTypes.STRING(30) },
      license_no: { type: DataTypes.STRING(60) },
      license_expiry: { type: DataTypes.DATEONLY },
      photo_url: { type: DataTypes.STRING(500) },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ON_LEAVE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
    },
    { ...common, tableName: 'drivers', indexes: [{ fields: ['provider_profile_id'] }] }
  );

  const VehicleAvailability = sequelize.define(
    'VehicleAvailability',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      vehicle_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      status: {
        type: DataTypes.ENUM('AVAILABLE', 'BLOCKED', 'BOOKED'),
        allowNull: false,
        defaultValue: 'AVAILABLE',
      },
      booking_item_id: { type: DataTypes.BIGINT.UNSIGNED },
    },
    {
      ...common,
      tableName: 'vehicle_availability',
      indexes: [{ unique: true, fields: ['vehicle_id', 'date'] }],
    }
  );

  const Guide = sequelize.define(
    'Guide',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      bio: { type: DataTypes.TEXT },
      languages: { type: DataTypes.JSON },
      expertise: { type: DataTypes.JSON },
      years_experience: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      daily_rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      hourly_rate: { type: DataTypes.DECIMAL(12, 2) },
      service_locations: { type: DataTypes.JSON },
      photo_url: { type: DataTypes.STRING(500) },
      status: {
        type: DataTypes.ENUM('PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'PENDING_REVIEW',
      },
      rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    { ...common, tableName: 'guides' }
  );

  const GuideAvailability = sequelize.define(
    'GuideAvailability',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      guide_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      status: {
        type: DataTypes.ENUM('AVAILABLE', 'BLOCKED', 'BOOKED'),
        allowNull: false,
        defaultValue: 'AVAILABLE',
      },
      booking_item_id: { type: DataTypes.BIGINT.UNSIGNED },
    },
    {
      ...common,
      tableName: 'guide_availability',
      indexes: [{ unique: true, fields: ['guide_id', 'date'] }],
    }
  );

  return {
    Hotel,
    HotelRoom,
    RoomAvailability,
    VehicleCategory,
    Vehicle,
    Driver,
    VehicleAvailability,
    Guide,
    GuideAvailability,
  };
};
