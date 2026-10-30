'use strict';

const { z } = require('zod');
const { paginationQuery, idParam, dateString } = require('../../shared/validators/common');

const destinationListQuery = paginationQuery.extend({
  districtId: z.coerce.number().int().positive().optional(),
  divisionId: z.coerce.number().int().positive().optional(),
  category: z.string().max(60).optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['popular', 'rating', 'name']).optional(),
});

const packageListQuery = paginationQuery.extend({
  destination: z.string().max(200).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minDays: z.coerce.number().int().positive().optional(),
  maxDays: z.coerce.number().int().positive().optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'duration', 'newest']).optional(),
});

const searchQuery = z.object({
  q: z.string().trim().min(2).max(120),
});

const destinationBody = z.object({
  name: z.string().trim().min(2).max(160),
  nameBn: z.string().trim().max(160).optional(),
  districtId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive().optional(),
  summary: z.string().trim().max(500).optional(),
  description: z.string().max(20000).optional(),
  coverImage: z.string().max(500).optional(),
  gallery: z.array(z.string().max(500)).max(12).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  travelInfo: z.string().max(5000).optional(),
  bestSeason: z.string().max(120).optional(),
  estimatedDurationHours: z.coerce.number().nonnegative().optional(),
  entryFee: z.coerce.number().nonnegative().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  featured: z.boolean().optional(),
});

const itineraryItem = z.object({
  day: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  meals: z.array(z.string().max(40)).optional(),
  accommodation: z.string().max(200).optional(),
});

const departureItem = z.object({
  startDate: dateString,
  endDate: dateString,
  capacity: z.coerce.number().int().positive().max(500),
  price: z.coerce.number().positive().optional(),
});

const packageBody = z.object({
  title: z.string().trim().min(3).max(200),
  titleBn: z.string().trim().max(200).optional(),
  slug: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(500).optional(),
  description: z.string().max(20000).optional(),
  coverImage: z.string().max(500).optional(),
  gallery: z.array(z.string().max(500)).max(12).optional(),
  durationDays: z.coerce.number().int().positive().max(60),
  durationNights: z.coerce.number().int().nonnegative().max(60),
  pricePerPerson: z.coerce.number().positive(),
  childPrice: z.coerce.number().nonnegative().optional(),
  maxCapacity: z.coerce.number().int().positive().max(500).default(20),
  minParticipants: z.coerce.number().int().positive().max(50).optional(),
  includes: z.array(z.string().max(200)).max(30).optional(),
  excludes: z.array(z.string().max(200)).max(30).optional(),
  highlights: z.array(z.string().max(200)).max(30).optional(),
  cancellationPolicy: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  featured: z.boolean().optional(),
  itineraries: z.array(itineraryItem).max(60).optional(),
  destinationIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
  departures: z.array(departureItem).max(60).optional(),
});

module.exports = {
  destinationListQuery,
  packageListQuery,
  searchQuery,
  paginationQuery,
  destinationBody,
  packageBody,
  idParam,
};
