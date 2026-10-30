'use strict';

const { helpers } = require('../migrationHelpers');

module.exports = {
  async up({ context: { queryInterface, Sequelize, sequelize } }) {
    const { DataTypes, id, intId, timestamps, money, decimal, fkBig, fkInt, tableOptions } = helpers(Sequelize, sequelize);

    await queryInterface.createTable(
      'divisions',
      {
        id: intId,
        name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
        name_bn: { type: DataTypes.STRING(80), allowNull: false },
        code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'districts',
      {
        id: intId,
        division_id: fkInt('divisions'),
        name: { type: DataTypes.STRING(80), allowNull: false },
        name_bn: { type: DataTypes.STRING(80), allowNull: false },
        code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('districts', ['division_id'], { name: 'districts_division_idx' });

    await queryInterface.createTable(
      'upazilas',
      {
        id: intId,
        district_id: fkInt('districts', { onDelete: 'CASCADE' }),
        name: { type: DataTypes.STRING(80), allowNull: false },
        name_bn: { type: DataTypes.STRING(80), allowNull: false },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('upazilas', ['district_id', 'name'], { unique: true, name: 'upazilas_district_name_uq' });

    await queryInterface.createTable(
      'destination_categories',
      {
        id: intId,
        name: { type: DataTypes.STRING(80), allowNull: false },
        name_bn: { type: DataTypes.STRING(80), allowNull: false },
        slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
        icon: { type: DataTypes.STRING(40), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'destinations',
      {
        id,
        district_id: fkInt('districts'),
        category_id: { ...fkInt('destination_categories', { allowNull: true, onDelete: 'SET NULL' }) },
        name: { type: DataTypes.STRING(160), allowNull: false },
        name_bn: { type: DataTypes.STRING(160), allowNull: true },
        slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
        summary: { type: DataTypes.STRING(500), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        cover_image: { type: DataTypes.STRING(500), allowNull: true },
        gallery: { type: DataTypes.JSON, allowNull: true },
        latitude: decimal(10, 7),
        longitude: decimal(10, 7),
        travel_info: { type: DataTypes.TEXT, allowNull: true },
        best_season: { type: DataTypes.STRING(120), allowNull: true },
        estimated_duration_hours: decimal(5, 1),
        entry_fee: money(false, 0),
        status: {
          type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
          allowNull: false,
          defaultValue: 'PUBLISHED',
        },
        is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
        rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('destinations', ['district_id'], { name: 'destinations_district_idx' });
    await queryInterface.addIndex('destinations', ['category_id'], { name: 'destinations_category_idx' });
    await queryInterface.addIndex('destinations', ['status', 'is_featured'], { name: 'destinations_status_featured_idx' });
    await queryInterface.addIndex('destinations', ['name'], { name: 'destinations_name_idx' });

    await queryInterface.createTable(
      'tourist_spots',
      {
        id,
        destination_id: fkBig('destinations', { onDelete: 'CASCADE' }),
        name: { type: DataTypes.STRING(160), allowNull: false },
        name_bn: { type: DataTypes.STRING(160), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        image_url: { type: DataTypes.STRING(500), allowNull: true },
        entry_fee: money(false, 0),
        duration_hours: decimal(5, 1),
        status: {
          type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('tourist_spots', ['destination_id'], { name: 'tourist_spots_destination_idx' });

    await queryInterface.createTable(
      'packages',
      {
        id,
        provider_profile_id: fkBig('provider_profiles', { allowNull: true, onDelete: 'SET NULL' }),
        slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
        title: { type: DataTypes.STRING(200), allowNull: false },
        title_bn: { type: DataTypes.STRING(200), allowNull: true },
        summary: { type: DataTypes.STRING(500), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        cover_image: { type: DataTypes.STRING(500), allowNull: true },
        gallery: { type: DataTypes.JSON, allowNull: true },
        duration_days: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        duration_nights: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        base_price_per_person: money(true),
        child_price_per_person: money(true),
        min_participants: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, defaultValue: 1 },
        max_capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 20 },
        includes: { type: DataTypes.JSON, allowNull: true },
        excludes: { type: DataTypes.JSON, allowNull: true },
        highlights: { type: DataTypes.JSON, allowNull: true },
        cancellation_policy: { type: DataTypes.TEXT, allowNull: true },
        status: {
          type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
          allowNull: false,
          defaultValue: 'DRAFT',
        },
        is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        rating_avg: { type: DataTypes.DECIMAL(3, 2), allowNull: false, defaultValue: 0 },
        rating_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('packages', ['status'], { name: 'packages_status_idx' });
    await queryInterface.addIndex('packages', ['is_featured'], { name: 'packages_featured_idx' });
    await queryInterface.addIndex('packages', ['base_price_per_person'], { name: 'packages_price_idx' });

    await queryInterface.createTable(
      'package_destinations',
      {
        package_id: { ...fkBig('packages', { onDelete: 'CASCADE' }), primaryKey: true },
        destination_id: { ...fkBig('destinations', { onDelete: 'CASCADE' }), primaryKey: true },
        ...timestamps,
      },
      tableOptions
    );

    await queryInterface.createTable(
      'package_itineraries',
      {
        id,
        package_id: fkBig('packages', { onDelete: 'CASCADE' }),
        day_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        title: { type: DataTypes.STRING(200), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        meals_included: { type: DataTypes.JSON, allowNull: true },
        accommodation: { type: DataTypes.STRING(200), allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('package_itineraries', ['package_id', 'day_number'], {
      unique: true,
      name: 'package_itineraries_day_uq',
    });

    await queryInterface.createTable(
      'package_departures',
      {
        id,
        package_id: fkBig('packages', { onDelete: 'CASCADE' }),
        start_date: { type: DataTypes.DATEONLY, allowNull: false },
        end_date: { type: DataTypes.DATEONLY, allowNull: false },
        capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        booked_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        price_override: money(true),
        status: {
          type: DataTypes.ENUM('SCHEDULED', 'CANCELLED', 'COMPLETED'),
          allowNull: false,
          defaultValue: 'SCHEDULED',
        },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('package_departures', ['package_id', 'start_date'], {
      unique: true,
      name: 'package_departures_start_uq',
    });

    await queryInterface.createTable(
      'blogs',
      {
        id,
        slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
        title: { type: DataTypes.STRING(220), allowNull: false },
        title_bn: { type: DataTypes.STRING(220), allowNull: true },
        excerpt: { type: DataTypes.STRING(500), allowNull: true },
        content: { type: DataTypes.TEXT, allowNull: true },
        cover_image: { type: DataTypes.STRING(500), allowNull: true },
        author_name: { type: DataTypes.STRING(120), allowNull: true },
        status: {
          type: DataTypes.ENUM('DRAFT', 'PUBLISHED'),
          allowNull: false,
          defaultValue: 'DRAFT',
        },
        published_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      tableOptions
    );
    await queryInterface.addIndex('blogs', ['status', 'published_at'], { name: 'blogs_status_published_idx' });
  },

  async down({ context: { queryInterface } }) {
    const tables = [
      'blogs',
      'package_departures',
      'package_itineraries',
      'package_destinations',
      'packages',
      'tourist_spots',
      'destinations',
      'destination_categories',
      'upazilas',
      'districts',
      'divisions',
    ];
    for (const table of tables) await queryInterface.dropTable(table);
  },
};
