'use strict';

const { z } = require('zod');
const { paginationQuery, idParam, slugParam, dateString, email } = require('../../shared/validators/common');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const contactPhone = z.string().trim().min(5).max(30);

// ---------------------------------------------------------------- public

const hotelListQuery = paginationQuery.extend({
  destination: z.string().trim().max(200).optional(),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(['rating', 'price_asc', 'price_desc', 'name']).optional(),
});

const hotelAvailabilityQuery = z.object({
  checkIn: dateString,
  checkOut: dateString,
  rooms: z.coerce.number().int().min(1).max(20).optional(),
});

const vehicleListQuery = paginationQuery.extend({
  category: z.string().trim().max(40).optional(),
  minCapacity: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(['rating', 'price_asc', 'price_desc', 'capacity']).optional(),
});

const guideListQuery = paginationQuery.extend({
  language: z.string().trim().max(40).optional(),
  location: z.string().trim().max(80).optional(),
  expertise: z.string().trim().max(60).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['rating', 'rate_asc', 'rate_desc', 'experience']).optional(),
});

const providerAvailabilityQuery = z.object({
  startDate: dateString,
  endDate: dateString,
});

// -------------------------------------------------------------- provider

const profileBody = z.object({
  businessName: z.string().trim().min(2).max(160).optional(),
  description: z.string().max(5000).optional(),
  phone: contactPhone.optional(),
  address: z.string().trim().max(255).optional(),
  logo: z.string().trim().max(500).optional(),
});

const documentBody = z.object({
  type: z.string().trim().min(2).max(60),
});

const hotelBody = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().max(200).optional(),
  destinationId: z.coerce.number().int().positive().optional(),
  description: z.string().max(20000).optional(),
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  address: z.string().trim().max(255).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  phone: contactPhone.optional(),
  email: email.optional(),
  checkInTime: z.string().regex(TIME_PATTERN, 'Use HH:MM format').optional(),
  checkOutTime: z.string().regex(TIME_PATTERN, 'Use HH:MM format').optional(),
  image: z.string().trim().max(500).optional(),
  gallery: z.array(z.string().max(500)).max(12).optional(),
  facilities: z.array(z.string().max(80)).max(30).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED']).optional(),
});

const roomBase = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(5000).optional(),
  roomType: z.enum(['SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'FAMILY', 'DORMITORY']).optional(),
  capacityAdults: z.coerce.number().int().min(1).max(20).optional(),
  capacityChildren: z.coerce.number().int().min(0).max(10).optional(),
  basePrice: z.coerce.number().positive().max(10000000),
  extraBedPrice: z.coerce.number().nonnegative().max(1000000).optional(),
  totalUnits: z.coerce.number().int().min(1).max(500),
  minStayNights: z.coerce.number().int().min(1).max(60).optional(),
  maxStayNights: z.coerce.number().int().min(1).max(365).optional(),
  image: z.string().trim().max(500).optional(),
  amenities: z.array(z.string().max(60)).max(30).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const stayRangeCheck = (value) =>
  !value.maxStayNights || !value.minStayNights || value.maxStayNights >= value.minStayNights;

const roomBody = roomBase.refine(stayRangeCheck, {
  message: 'maxStayNights must be greater than or equal to minStayNights',
  path: ['maxStayNights'],
});

const roomUpdateBody = roomBase.partial().refine(stayRangeCheck, {
  message: 'maxStayNights must be greater than or equal to minStayNights',
  path: ['maxStayNights'],
});

const roomAvailabilityQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

const roomAvailabilityBody = z.object({
  dates: z
    .array(
      z.object({
        date: dateString,
        totalUnits: z.coerce.number().int().min(0).max(500).optional(),
        isBlocked: z.boolean().optional(),
        priceOverride: z.coerce.number().positive().nullable().optional(),
      })
    )
    .min(1)
    .max(90),
});

const vehicleBody = z.object({
  name: z.string().trim().min(2).max(160),
  model: z.string().trim().max(120).optional(),
  registrationNo: z.string().trim().min(3).max(60),
  categoryId: z.coerce.number().int().positive().optional(),
  categoryCode: z.string().trim().max(40).optional(),
  capacity: z.coerce.number().int().min(1).max(100),
  pricePerDay: z.coerce.number().positive().max(10000000).optional(),
  pricePerKm: z.coerce.number().nonnegative().max(100000).optional(),
  image: z.string().trim().max(500).optional(),
  features: z.array(z.string().max(60)).max(30).optional(),
  driverIncluded: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'PENDING_REVIEW']).optional(),
});

const driverBody = z.object({
  name: z.string().trim().min(2).max(120),
  phone: contactPhone.optional(),
  licenseNo: z.string().trim().max(60).optional(),
  licenseExpiry: dateString.optional(),
  photo: z.string().trim().max(500).optional(),
  vehicleId: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
});

const availabilityToggleBody = z.object({
  dates: z
    .array(
      z.object({
        date: dateString,
        status: z.enum(['AVAILABLE', 'BLOCKED']),
      })
    )
    .min(1)
    .max(90),
});

const guideBody = z.object({
  bio: z.string().max(10000).optional(),
  languages: z.array(z.string().max(40)).max(12).optional(),
  expertise: z.array(z.string().max(60)).max(20).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(70).optional(),
  dailyRate: z.coerce.number().positive().max(1000000),
  hourlyRate: z.coerce.number().positive().max(1000000).optional(),
  serviceLocations: z.array(z.string().max(80)).max(30).optional(),
  photo: z.string().trim().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']).optional(),
});

module.exports = {
  idParam,
  slugParam,
  hotelListQuery,
  hotelAvailabilityQuery,
  vehicleListQuery,
  guideListQuery,
  providerAvailabilityQuery,
  profileBody,
  documentBody,
  hotelBody,
  roomBody,
  roomUpdateBody,
  roomAvailabilityQuery,
  roomAvailabilityBody,
  vehicleBody,
  driverBody,
  availabilityToggleBody,
  guideBody,
};
