'use strict';

const { sequelize } = require('../database/sequelize');
const defineAuthModels = require('./auth.models');
const defineCatalogModels = require('./catalog.models');
const defineSupplierModels = require('./supplier.models');
const defineCommerceModels = require('./commerce.models');
const defineEngagementModels = require('./engagement.models');

const models = {
  ...defineAuthModels(sequelize),
  ...defineCatalogModels(sequelize),
  ...defineSupplierModels(sequelize),
  ...defineCommerceModels(sequelize),
  ...defineEngagementModels(sequelize),
};

const {
  Role,
  Permission,
  RolePermission,
  User,
  UserRole,
  RefreshToken,
  ProviderProfile,
  ProviderDocument,
  AuditLog,
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
  Hotel,
  HotelRoom,
  RoomAvailability,
  VehicleCategory,
  Vehicle,
  Driver,
  VehicleAvailability,
  Guide,
  GuideAvailability,
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
  Review,
  Notification,
  Message,
} = models;

// RBAC
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles',
});
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'user_id',
  otherKey: 'role_id',
  as: 'roles',
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'role_id',
  otherKey: 'user_id',
  as: 'users',
});
UserRole.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
UserRole.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Role.hasMany(UserRole, { foreignKey: 'role_id', as: 'userRoles' });
Role.hasMany(RolePermission, { foreignKey: 'role_id', as: 'rolePermissions' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });

// Accounts / providers
User.hasOne(ProviderProfile, { foreignKey: 'user_id', as: 'providerProfile' });
ProviderProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ProviderProfile.hasMany(ProviderDocument, { foreignKey: 'provider_profile_id', as: 'documents' });
ProviderDocument.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AuditLog.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });

// Geography / catalog
Division.hasMany(District, { foreignKey: 'division_id', as: 'districts' });
District.belongsTo(Division, { foreignKey: 'division_id', as: 'division' });
District.hasMany(Upazila, { foreignKey: 'district_id', as: 'upazilas' });
Upazila.belongsTo(District, { foreignKey: 'district_id', as: 'district' });
District.hasMany(Destination, { foreignKey: 'district_id', as: 'destinations' });
Destination.belongsTo(District, { foreignKey: 'district_id', as: 'district' });
DestinationCategory.hasMany(Destination, { foreignKey: 'category_id', as: 'destinations' });
Destination.belongsTo(DestinationCategory, { foreignKey: 'category_id', as: 'category' });
Destination.hasMany(TouristSpot, { foreignKey: 'destination_id', as: 'touristSpots' });
TouristSpot.belongsTo(Destination, { foreignKey: 'destination_id', as: 'destination' });

Package.belongsToMany(Destination, {
  through: PackageDestination,
  foreignKey: 'package_id',
  otherKey: 'destination_id',
  as: 'destinations',
});
Destination.belongsToMany(Package, {
  through: PackageDestination,
  foreignKey: 'destination_id',
  otherKey: 'package_id',
  as: 'packages',
});
Package.hasMany(PackageItinerary, { foreignKey: 'package_id', as: 'itineraries' });
PackageItinerary.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Package.hasMany(PackageDeparture, { foreignKey: 'package_id', as: 'departures' });
PackageDeparture.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Package.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'operator' });

// Suppliers
Hotel.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
ProviderProfile.hasMany(Hotel, { foreignKey: 'provider_profile_id', as: 'hotels' });
Hotel.belongsTo(Destination, { foreignKey: 'destination_id', as: 'destination' });
Hotel.hasMany(HotelRoom, { foreignKey: 'hotel_id', as: 'rooms' });
HotelRoom.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
HotelRoom.hasMany(RoomAvailability, { foreignKey: 'room_id', as: 'availability' });
RoomAvailability.belongsTo(HotelRoom, { foreignKey: 'room_id', as: 'room' });

VehicleCategory.hasMany(Vehicle, { foreignKey: 'category_id', as: 'vehicles' });
Vehicle.belongsTo(VehicleCategory, { foreignKey: 'category_id', as: 'category' });
Vehicle.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
ProviderProfile.hasMany(Vehicle, { foreignKey: 'provider_profile_id', as: 'vehicles' });
Vehicle.hasMany(Driver, { foreignKey: 'vehicle_id', as: 'drivers' });
Driver.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
Driver.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
ProviderProfile.hasMany(Driver, { foreignKey: 'provider_profile_id', as: 'drivers' });
Vehicle.hasMany(VehicleAvailability, { foreignKey: 'vehicle_id', as: 'availability' });
VehicleAvailability.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

Guide.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
ProviderProfile.hasOne(Guide, { foreignKey: 'provider_profile_id', as: 'guide' });
Guide.hasMany(GuideAvailability, { foreignKey: 'guide_id', as: 'availability' });
GuideAvailability.belongsTo(Guide, { foreignKey: 'guide_id', as: 'guide' });

// Commerce
Booking.belongsTo(User, { foreignKey: 'customer_user_id', as: 'customer' });
User.hasMany(Booking, { foreignKey: 'customer_user_id', as: 'bookings' });
Booking.hasMany(BookingItem, { foreignKey: 'booking_id', as: 'items' });
BookingItem.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
BookingItem.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
ProviderProfile.hasMany(BookingItem, { foreignKey: 'provider_profile_id', as: 'bookingItems' });
Booking.hasMany(BookingPassenger, { foreignKey: 'booking_id', as: 'passengers' });
BookingPassenger.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(BookingStatusHistory, { foreignKey: 'booking_id', as: 'statusHistory' });
BookingStatusHistory.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(Payment, { foreignKey: 'booking_id', as: 'payments' });
Payment.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Payment.hasMany(Refund, { foreignKey: 'payment_id', as: 'refunds' });
Refund.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });
Refund.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(Refund, { foreignKey: 'booking_id', as: 'refunds' });
Commission.belongsTo(BookingItem, { foreignKey: 'booking_item_id', as: 'bookingItem' });
BookingItem.hasOne(Commission, { foreignKey: 'booking_item_id', as: 'commission' });
Commission.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
ProviderProfile.hasMany(ProviderPayout, { foreignKey: 'provider_profile_id', as: 'payouts' });
ProviderPayout.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'provider' });
Booking.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
Coupon.hasMany(CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' });
CouponRedemption.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
CouponRedemption.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
CouponRedemption.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
LoyaltyTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(LoyaltyTransaction, { foreignKey: 'user_id', as: 'loyaltyTransactions' });
CustomTrip.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(CustomTrip, { foreignKey: 'user_id', as: 'customTrips' });
CustomTrip.hasMany(CustomTripItem, { foreignKey: 'custom_trip_id', as: 'items' });
CustomTripItem.belongsTo(CustomTrip, { foreignKey: 'custom_trip_id', as: 'customTrip' });
Booking.belongsTo(CustomTrip, { foreignKey: 'custom_trip_id', as: 'customTrip' });

// Engagement
Review.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Booking.hasMany(Review, { foreignKey: 'booking_id', as: 'reviews' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Message.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Message.belongsTo(User, { foreignKey: 'sender_user_id', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'recipient_user_id', as: 'recipient' });

module.exports = { models, sequelize };
