'use strict';

const { DataTypes } = require('sequelize');

/**
 * Geography, destinations, packages, blog.
 */
module.exports = function defineCatalogModels(sequelize) {
  const common = {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const Division = sequelize.define(
    'Division',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name_bn: { type: DataTypes.STRING(80), allowNull: false },
      code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    },
    { ...common, tableName: 'divisions' }
  );

  const District = sequelize.define(
    'District',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      division_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(80), allowNull: false },
      name_bn: { type: DataTypes.STRING(80), allowNull: false },
      code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    },
    { ...common, tableName: 'districts' }
  );

  const Upazila = sequelize.define(
    'Upazila',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      district_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(80), allowNull: false },
      name_bn: { type: DataTypes.STRING(80), allowNull: false },
    },
    {
      ...common,
      tableName: 'upazilas',
      indexes: [{ unique: true, fields: ['district_id', 'name'] }],
    }
  );

  const DestinationCategory = sequelize.define(
    'DestinationCategory',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      name_bn: { type: DataTypes.STRING(80), allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      icon: { type: DataTypes.STRING(40) },
    },
    { ...common, tableName: 'destination_categories' }
  );

  const Destination = sequelize.define(
    'Destination',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      district_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      category_id: { type: DataTypes.INTEGER.UNSIGNED },
      name: { type: DataTypes.STRING(160), allowNull: false },
      name_bn: { type: DataTypes.STRING(160) },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      summary: { type: DataTypes.STRING(500) },
      description: { type: DataTypes.TEXT },
      cover_image: { type: DataTypes.STRING(500) },
      gallery: { type: DataTypes.JSON },
      latitude: { type: DataTypes.DECIMAL(10, 7) },
      longitude: { type: DataTypes.DECIMAL(10, 7) },
      travel_info: { type: DataTypes.TEXT },
      best_season: { type: DataTypes.STRING(120) },
      estimated_duration_hours: { type: DataTypes.DECIMAL(5, 1) },
      entry_fee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'PUBLISHED',
      },
      is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    {
      ...common,
      tableName: 'destinations',
      indexes: [
        { fields: ['district_id'] },
        { fields: ['category_id'] },
        { fields: ['status', 'is_featured'] },
        { fields: ['name'] },
      ],
    }
  );

  const TouristSpot = sequelize.define(
    'TouristSpot',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      destination_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      name_bn: { type: DataTypes.STRING(160) },
      description: { type: DataTypes.TEXT },
      image_url: { type: DataTypes.STRING(500) },
      entry_fee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      duration_hours: { type: DataTypes.DECIMAL(5, 1) },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
    },
    { ...common, tableName: 'tourist_spots', indexes: [{ fields: ['destination_id'] }] }
  );

  const Package = sequelize.define(
    'Package',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      provider_profile_id: { type: DataTypes.BIGINT.UNSIGNED },
      slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      title_bn: { type: DataTypes.STRING(200) },
      summary: { type: DataTypes.STRING(500) },
      description: { type: DataTypes.TEXT },
      cover_image: { type: DataTypes.STRING(500) },
      gallery: { type: DataTypes.JSON },
      duration_days: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      duration_nights: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      base_price_per_person: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      child_price_per_person: { type: DataTypes.DECIMAL(12, 2) },
      min_participants: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
      max_capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 20 },
      includes: { type: DataTypes.JSON },
      excludes: { type: DataTypes.JSON },
      highlights: { type: DataTypes.JSON },
      cancellation_policy: { type: DataTypes.TEXT },
      status: {
        type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
      rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    {
      ...common,
      tableName: 'packages',
      indexes: [
        { fields: ['status'] },
        { fields: ['is_featured'] },
        { fields: ['base_price_per_person'] },
      ],
    }
  );

  const PackageDestination = sequelize.define(
    'PackageDestination',
    {
      package_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
      destination_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
    },
    { ...common, tableName: 'package_destinations' }
  );

  const PackageItinerary = sequelize.define(
    'PackageItinerary',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      package_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      day_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT },
      meals_included: { type: DataTypes.JSON },
      accommodation: { type: DataTypes.STRING(200) },
    },
    {
      ...common,
      tableName: 'package_itineraries',
      indexes: [{ unique: true, fields: ['package_id', 'day_number'] }],
    }
  );

  const PackageDeparture = sequelize.define(
    'PackageDeparture',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      package_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      start_date: { type: DataTypes.DATEONLY, allowNull: false },
      end_date: { type: DataTypes.DATEONLY, allowNull: false },
      capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      booked_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      price_override: { type: DataTypes.DECIMAL(12, 2) },
      status: {
        type: DataTypes.ENUM('SCHEDULED', 'CANCELLED', 'COMPLETED'),
        allowNull: false,
        defaultValue: 'SCHEDULED',
      },
    },
    {
      ...common,
      tableName: 'package_departures',
      indexes: [{ unique: true, fields: ['package_id', 'start_date'] }],
    }
  );

  const Blog = sequelize.define(
    'Blog',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(220), allowNull: false },
      title_bn: { type: DataTypes.STRING(220) },
      excerpt: { type: DataTypes.STRING(500) },
      content: { type: DataTypes.TEXT },
      cover_image: { type: DataTypes.STRING(500) },
      author_name: { type: DataTypes.STRING(120) },
      status: {
        type: DataTypes.ENUM('DRAFT', 'PUBLISHED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      published_at: { type: DataTypes.DATE },
    },
    { ...common, tableName: 'blogs', indexes: [{ fields: ['status', 'published_at'] }] }
  );

  return {
    Division,
    District,
    Upazila,
    DestinationCategory,
    Destination,
    TouristSpot,
    Package,
    PackageDestination,
    PackageItinerary,
    PackageDeparture,
    Blog,
  };
};
