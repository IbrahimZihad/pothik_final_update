'use strict';

const { models } = require('../../models');

const CATEGORIES = [
  { name: 'Beach', name_bn: 'সমুদ্র সৈকত', slug: 'beach', icon: 'waves' },
  { name: 'Hill & Valley', name_bn: 'পাহাড় ও উপত্যকা', slug: 'hill', icon: 'mountain' },
  { name: 'Island', name_bn: 'দ্বীপ', slug: 'island', icon: 'island' },
  { name: 'Forest & Wildlife', name_bn: 'বন ও বন্যপ্রাণী', slug: 'forest', icon: 'trees' },
  { name: 'Haor & Wetland', name_bn: 'হাওর ও জলাভূমি', slug: 'haor', icon: 'water' },
  { name: 'Heritage', name_bn: 'ঐতিহ্য', slug: 'heritage', icon: 'landmark' },
  { name: 'City & Culture', name_bn: 'শহর ও সংস্কৃতি', slug: 'city', icon: 'building' },
  { name: 'Eco & Tea Garden', name_bn: 'ইকো ও চা বাগান', slug: 'eco', icon: 'leaf' },
];

const VEHICLE_CATEGORIES = [
  { code: 'MOTORCYCLE', name: 'Motorcycle', name_bn: 'মোটরসাইকেল', default_capacity: 2, icon: 'bike' },
  { code: 'CAR', name: 'Private Car', name_bn: 'প্রাইভেট কার', default_capacity: 4, icon: 'car' },
  { code: 'MICROBUS', name: 'Microbus', name_bn: 'মাইক্রোবাস', default_capacity: 9, icon: 'bus' },
  { code: 'MINIBUS', name: 'Minibus', name_bn: 'মিনিবাস', default_capacity: 25, icon: 'bus' },
  { code: 'BUS', name: 'Bus', name_bn: 'বাস', default_capacity: 45, icon: 'bus' },
  { code: 'JEEP', name: 'Jeep', name_bn: 'জিপ', default_capacity: 6, icon: 'truck' },
  { code: 'BOAT', name: 'Boat', name_bn: 'নৌকা', default_capacity: 15, icon: 'ship' },
  { code: 'OTHER', name: 'Other', name_bn: 'অন্যান্য', default_capacity: 4, icon: 'vehicle' },
];

module.exports = {
  async up() {
    for (const category of CATEGORIES) {
      await models.DestinationCategory.findOrCreate({ where: { slug: category.slug }, defaults: category });
    }
    for (const category of VEHICLE_CATEGORIES) {
      await models.VehicleCategory.findOrCreate({ where: { code: category.code }, defaults: category });
    }
    console.log(`  destination categories: ${CATEGORIES.length}, vehicle categories: ${VEHICLE_CATEGORIES.length}`);
  },
};

module.exports.CATEGORIES = CATEGORIES;
module.exports.VEHICLE_CATEGORIES = VEHICLE_CATEGORIES;
