'use strict';

const { z } = require('zod');
const { paginationQuery, dateString, phone, email } = require('../../shared/validators/common');
const { BOOKING_STATUSES } = require('../../models/commerce.models');

const bookingStatus = z.enum(BOOKING_STATUSES);

const roomSelection = z.object({
  roomId: z.coerce.number().int().positive(),
  units: z.coerce.number().int().min(1).max(10),
});

const compositionSchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  adults: z.coerce.number().int().min(1).max(50),
  children: z.coerce.number().int().min(0).max(30).optional().default(0),
  package: z
    .object({
      packageId: z.coerce.number().int().positive(),
      departureId: z.coerce.number().int().positive().optional(),
    })
    .optional(),
  hotel: z
    .object({
      hotelId: z.coerce.number().int().positive(),
      checkIn: dateString,
      checkOut: dateString,
      rooms: z.array(roomSelection).min(1).max(10),
    })
    .optional(),
  transport: z
    .object({
      vehicleId: z.coerce.number().int().positive(),
      startDate: dateString,
      endDate: dateString,
      distanceKm: z.coerce.number().positive().max(5000).optional(),
    })
    .optional(),
  guide: z
    .object({
      guideId: z.coerce.number().int().positive(),
      startDate: dateString,
      endDate: dateString,
      hours: z.coerce.number().positive().max(24).optional(),
    })
    .optional(),
  destinations: z
    .array(
      z.object({
        destinationId: z.coerce.number().int().positive(),
        touristSpotIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
      })
    )
    .max(15)
    .optional(),
  addons: z
    .array(
      z.object({
        code: z.string().trim().min(2).max(40),
        quantity: z.coerce.number().int().min(1).max(20),
      })
    )
    .max(10)
    .optional(),
  specialRequests: z.string().max(2000).optional(),
});

const passengerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  nid: z.string().trim().max(40).optional(),
  passportNo: z.string().trim().max(40).optional(),
});

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone,
  email,
});

const createBookingBody = z
  .object({
    type: z.enum(['PACKAGE', 'HOTEL', 'TRANSPORT', 'GUIDE', 'CUSTOM_TRIP']),
    customTripId: z.coerce.number().int().positive().optional(),
    composition: compositionSchema.optional(),
    contact: contactSchema,
    passengers: z.array(passengerSchema).max(50).optional(),
    couponCode: z.string().trim().max(40).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.customTripId && value.composition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['composition'],
        message: 'Send either a saved trip or an inline composition, not both',
      });
    }
    if (value.customTripId && value.type !== 'CUSTOM_TRIP') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'Saved trips must be booked as CUSTOM_TRIP',
      });
    }
    if (!value.customTripId && !value.composition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['composition'],
        message: 'A trip composition is required',
      });
    }
  });

const bookingListQuery = paginationQuery.extend({ status: bookingStatus.optional() });

const providerBookingListQuery = paginationQuery.extend({ status: bookingStatus.optional() });

const referenceParam = z.object({ reference: z.string().trim().min(6).max(40) });

const cancelBody = z.object({ reason: z.string().trim().max(500).optional() });
const rejectBody = z.object({ reason: z.string().trim().min(2).max(500).optional() });

module.exports = {
  createBookingBody,
  bookingListQuery,
  providerBookingListQuery,
  referenceParam,
  cancelBody,
  rejectBody,
  compositionSchema,
};
