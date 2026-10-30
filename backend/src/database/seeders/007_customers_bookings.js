'use strict';

const { models } = require('../../models');
const { dateOffset, ensureUser } = require('../seedUtils');

const day = dateOffset;

async function createSeedBooking({ reference, customerId, type, status, start, end, adults, children, items, discount = 0, contact, payments = [], history = [], cancellationReason = null, paidAmount = null, couponId = null }) {
  const existing = await models.Booking.findOne({ where: { reference } });
  if (existing) return existing;

  const subtotal = items.reduce((acc, item) => acc + Number(item.total_price), 0);
  const total = subtotal - discount;
  const paid = paidAmount === null ? (status === 'CONFIRMED' || status === 'COMPLETED' ? total : 0) : paidAmount;

  const booking = await models.Booking.create({
    reference,
    customer_user_id: customerId,
    type,
    status,
    start_date: start,
    end_date: end,
    adults,
    children,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_email: contact.email,
    currency: 'BDT',
    subtotal: subtotal.toFixed(2),
    discount_total: discount.toFixed(2),
    tax_total: '0.00',
    total_amount: total.toFixed(2),
    paid_amount: paid.toFixed(2),
    due_amount: (total - paid).toFixed(2),
    confirmed_at: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(status) ? new Date() : null,
    cancelled_at: status === 'CANCELLED' ? new Date() : null,
    completed_at: status === 'COMPLETED' ? new Date() : null,
    cancellation_reason: cancellationReason,
    coupon_id: couponId,
  });

  for (const item of items) {
    const created = await models.BookingItem.create({
      booking_id: booking.id,
      item_type: item.item_type,
      ref_id: item.ref_id,
      provider_profile_id: item.provider_profile_id || null,
      title: item.title,
      start_date: item.start_date || start,
      end_date: item.end_date || end,
      quantity: item.quantity,
      unit_price: Number(item.unit_price).toFixed(2),
      total_price: Number(item.total_price).toFixed(2),
      commission_rate: Number(item.commission_rate || 0).toFixed(2),
      commission_amount: Number(item.commission_amount || 0).toFixed(2),
      provider_payable: (Number(item.total_price) - Number(item.commission_amount || 0)).toFixed(2),
      status: status === 'COMPLETED' ? 'COMPLETED' : status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
      meta: item.meta || null,
    });
    if (['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(status) && item.provider_profile_id) {
      await models.Commission.findOrCreate({
        where: { booking_item_id: created.id },
        defaults: {
          booking_item_id: created.id,
          provider_profile_id: item.provider_profile_id,
          gross_amount: Number(item.total_price).toFixed(2),
          rate: Number(item.commission_rate || 0).toFixed(2),
          amount: Number(item.commission_amount || 0).toFixed(2),
          status: 'EARNED',
          earned_at: new Date(),
        },
      });
    }
  }

  for (const passenger of [
    { full_name: contact.name, age: 32, gender: 'FEMALE' },
    ...Array.from({ length: Math.max(adults - 1, 0) }, (_, i) => ({ full_name: `Guest ${i + 2}`, age: 30, gender: 'MALE' })),
  ]) {
    await models.BookingPassenger.create({ booking_id: booking.id, ...passenger });
  }

  for (const entry of history) {
    await models.BookingStatusHistory.create({
      booking_id: booking.id,
      from_status: entry[0],
      to_status: entry[1],
      reason: entry[2] || null,
    });
  }

  for (const payment of payments) {
    await models.Payment.findOrCreate({
      where: { idempotency_key: payment.idempotency_key },
      defaults: {
        booking_id: booking.id,
        provider: 'demo',
        provider_txn_id: `demo-${reference}-${payment.idempotency_key}`,
        idempotency_key: payment.idempotency_key,
        amount: Number(payment.amount).toFixed(2),
        currency: 'BDT',
        method: payment.method || 'card',
        status: 'SUCCEEDED',
        paid_at: new Date(),
        verified_at: new Date(),
      },
    });
  }

  return booking;
}

module.exports = {
  async up() {
    const customer = await ensureUser({
      name: 'Ayesha Rahman',
      email: 'customer@pothik.test',
      phone: '01611112222',
      role: 'CUSTOMER',
    });
    const customer2 = await ensureUser({
      name: 'Tanvir Ahmed',
      email: 'customer2@pothik.test',
      phone: '01633334444',
      role: 'CUSTOMER',
      status: 'PENDING_VERIFICATION',
    });

    const [coupon] = await models.Coupon.findOrCreate({
      where: { code: 'POTHIK10' },
      defaults: {
        code: 'POTHIK10',
        description: '10% off your first trip, up to BDT 2,000',
        type: 'PERCENT',
        value: 10,
        min_spend: 5000,
        max_discount: 2000,
        usage_limit: 1000,
        per_user_limit: 1,
        is_active: true,
      },
    });
    await models.Coupon.findOrCreate({
      where: { code: 'SUNDARBAN500' },
      defaults: {
        code: 'SUNDARBAN500',
        description: 'BDT 500 off Sundarbans cruises',
        type: 'FIXED',
        value: 500,
        min_spend: 8000,
        per_user_limit: 2,
        is_active: true,
      },
    });

    const coxPackage = await models.Package.findOne({ where: { slug: 'coxs-bazar-escape-3d2n' } });
    const sajekPackage = await models.Package.findOne({ where: { slug: 'sajek-bandarban-hill-4d3n' } });
    const coxDestination = await models.Destination.findOne({ where: { slug: 'coxs-bazar' } });
    const hotel = await models.Hotel.findOne({ where: { slug: 'sea-crown-hotel-resort' } });
    const deluxeRoom = hotel ? await models.HotelRoom.findOne({ where: { hotel_id: hotel.id, name: 'Deluxe Sea View' } }) : null;
    const guide = await models.Guide.findOne();
    const microbus = await models.Vehicle.findOne({ where: { name: 'Microbus (9 seats)' } });

    const hotelProvider = hotel ? await models.ProviderProfile.findByPk(hotel.provider_profile_id) : null;
    const transportProvider = microbus ? await models.ProviderProfile.findByPk(microbus.provider_profile_id) : null;
    const guideProvider = guide ? await models.ProviderProfile.findByPk(guide.provider_profile_id) : null;

    const contact = { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' };

    // 0) completed hotel stay - cleared provider earnings for the payout workflow
    if (deluxeRoom && hotelProvider) {
      const staySubtotal = Number(deluxeRoom.base_price) * 2;
      await createSeedBooking({
        reference: 'PTK-SEED-1000',
        customerId: customer.id,
        type: 'HOTEL',
        status: 'COMPLETED',
        start: day(-40),
        end: day(-38),
        adults: 2,
        children: 0,
        contact,
        items: [
          {
            item_type: 'HOTEL_ROOM',
            ref_id: deluxeRoom.id,
            provider_profile_id: hotelProvider.id,
            title: `${hotel.name} - ${deluxeRoom.name} (2 nights)`,
            quantity: 1,
            unit_price: staySubtotal,
            total_price: staySubtotal,
            commission_rate: 12,
            commission_amount: staySubtotal * 0.12,
            meta: { nights: 2, rooms: 1 },
          },
        ],
        payments: [{ idempotency_key: 'seed-pay-1000', amount: staySubtotal, method: 'card' }],
        history: [
          ['PENDING', 'AWAITING_PAYMENT', 'Quotation generated'],
          ['AWAITING_PAYMENT', 'CONFIRMED', 'Payment verified'],
          ['CONFIRMED', 'IN_PROGRESS', 'Stay started'],
          ['IN_PROGRESS', 'COMPLETED', 'Stay completed'],
        ],
      });
    }

    // 1) completed package trip with review
    const completed = await createSeedBooking({
      reference: 'PTK-SEED-1001',
      customerId: customer.id,
      type: 'PACKAGE',
      status: 'COMPLETED',
      start: day(-26),
      end: day(-24),
      adults: 2,
      children: 1,
      discount: 0,
      contact,
      items: coxPackage
        ? [
            {
              item_type: 'PACKAGE',
              ref_id: coxPackage.id,
              title: coxPackage.title,
              quantity: 2,
              unit_price: Number(coxPackage.base_price_per_person),
              total_price: Number(coxPackage.base_price_per_person) * 2 + Number(coxPackage.child_price_per_person || 0),
              commission_rate: 10,
              commission_amount: (Number(coxPackage.base_price_per_person) * 2 + Number(coxPackage.child_price_per_person || 0)) * 0.1,
            },
          ]
        : [],
      payments: [{ idempotency_key: 'seed-pay-1001', amount: coxPackage ? Number(coxPackage.base_price_per_person) * 2 + 8000 : 33000, method: 'card' }],
      history: [
        ['PENDING', 'AWAITING_PAYMENT', 'Quotation generated'],
        ['AWAITING_PAYMENT', 'CONFIRMED', 'Payment verified'],
        ['CONFIRMED', 'IN_PROGRESS', 'Trip started'],
        ['IN_PROGRESS', 'COMPLETED', 'Trip completed'],
      ],
    });

    if (completed) {
      const existingPoints = await models.LoyaltyTransaction.findOne({ where: { user_id: customer.id, booking_id: completed.id } });
      if (!existingPoints) {
        await models.LoyaltyTransaction.create({
          user_id: customer.id,
          points: 330,
          type: 'EARN',
          booking_id: completed.id,
          balance_after: 330,
          description: `Earned on ${completed.reference}`,
        });
      }

      if (coxPackage) {
        await models.Review.findOrCreate({
          where: { booking_id: completed.id, user_id: customer.id, target_type: 'PACKAGE', target_id: coxPackage.id },
          defaults: {
            booking_id: completed.id,
            user_id: customer.id,
            target_type: 'PACKAGE',
            target_id: coxPackage.id,
            rating: 5,
            title: 'Perfect beach weekend',
            comment:
              'Everything was organised: the bus, the sea-view room and the Himchari guide. Our guide adjusted the plan for our child without any fuss.',
            status: 'APPROVED',
            moderated_at: new Date(),
            is_verified: true,
          },
        });
      }
      if (coxDestination) {
        await models.Review.findOrCreate({
          where: { booking_id: completed.id, user_id: customer.id, target_type: 'DESTINATION', target_id: coxDestination.id },
          defaults: {
            booking_id: completed.id,
            user_id: customer.id,
            target_type: 'DESTINATION',
            target_id: coxDestination.id,
            rating: 5,
            title: 'Sunrise worth waking up for',
            comment: 'Go early, walk south past Laboni and you get the beach almost to yourself.',
            status: 'APPROVED',
            moderated_at: new Date(),
            is_verified: true,
          },
        });
      }
    }

    // 2) confirmed mixed booking (hotel + guide + transport)
    const hotelSubtotal = deluxeRoom ? Number(deluxeRoom.base_price) * 2 * 2 : 22000;
    const guideSubtotal = guide ? Number(guide.daily_rate) * 1 : 3500;
    const transportSubtotal = microbus ? Number(microbus.price_per_day) * 2 : 16000;
    await createSeedBooking({
      reference: 'PTK-SEED-1002',
      customerId: customer.id,
      type: 'CUSTOM_TRIP',
      status: 'CONFIRMED',
      start: day(10),
      end: day(12),
      adults: 2,
      children: 0,
      contact,
      discount: 500,
      items: [
        ...(deluxeRoom
          ? [
              {
                item_type: 'HOTEL_ROOM',
                ref_id: deluxeRoom.id,
                provider_profile_id: hotelProvider?.id,
                title: `${hotel.name} - ${deluxeRoom.name} (2 nights, 2 rooms)`,
                quantity: 2,
                unit_price: Number(deluxeRoom.base_price) * 2,
                total_price: hotelSubtotal,
                commission_rate: 12,
                commission_amount: hotelSubtotal * 0.12,
                meta: { nights: 2, rooms: 2 },
              },
            ]
          : []),
        ...(guide
          ? [
              {
                item_type: 'GUIDE',
                ref_id: guide.id,
                provider_profile_id: guideProvider?.id,
                title: 'Local guide - 1 day',
                quantity: 1,
                unit_price: guideSubtotal,
                total_price: guideSubtotal,
                commission_rate: 10,
                commission_amount: guideSubtotal * 0.1,
                start_date: day(11),
                end_date: day(11),
              },
            ]
          : []),
        ...(microbus
          ? [
              {
                item_type: 'VEHICLE',
                ref_id: microbus.id,
                provider_profile_id: transportProvider?.id,
                title: `${microbus.name} - 2 days`,
                quantity: 1,
                unit_price: transportSubtotal,
                total_price: transportSubtotal,
                commission_rate: 10,
                commission_amount: transportSubtotal * 0.1,
                meta: { days: 2 },
              },
            ]
          : []),
      ],
      paidAmount: 20000,
      couponId: coupon.id,
      payments: [{ idempotency_key: 'seed-pay-1002', amount: 20000, method: 'bkash' }],
      history: [
        ['PENDING', 'AWAITING_PAYMENT', 'Quotation generated'],
        ['AWAITING_PAYMENT', 'CONFIRMED', 'Partial payment received'],
      ],
    });

    // 3) awaiting payment package booking
    await createSeedBooking({
      reference: 'PTK-SEED-1003',
      customerId: customer.id,
      type: 'PACKAGE',
      status: 'AWAITING_PAYMENT',
      start: day(21),
      end: day(24),
      adults: 2,
      children: 0,
      contact,
      discount: 0,
      items: sajekPackage
        ? [
            {
              item_type: 'PACKAGE',
              ref_id: sajekPackage.id,
              title: sajekPackage.title,
              quantity: 2,
              unit_price: Number(sajekPackage.base_price_per_person),
              total_price: Number(sajekPackage.base_price_per_person) * 2,
              commission_rate: 10,
              commission_amount: Number(sajekPackage.base_price_per_person) * 2 * 0.1,
            },
          ]
        : [],
      paidAmount: 0,
      history: [
        ['PENDING', 'AWAITING_PAYMENT', 'Quotation generated'],
      ],
    });

    // 4) cancelled booking with refund request
    const cancelled = await createSeedBooking({
      reference: 'PTK-SEED-1004',
      customerId: customer2.id,
      type: 'TRANSPORT',
      status: 'CANCELLED',
      start: day(5),
      end: day(6),
      adults: 6,
      children: 0,
      contact: { name: 'Tanvir Ahmed', phone: '01633334444', email: 'customer2@pothik.test' },
      discount: 0,
      cancellationReason: 'Family emergency',
      items: microbus
        ? [
            {
              item_type: 'VEHICLE',
              ref_id: microbus.id,
              provider_profile_id: transportProvider?.id,
              title: `${microbus.name} - 1 day`,
              quantity: 1,
              unit_price: Number(microbus.price_per_day),
              total_price: Number(microbus.price_per_day),
              commission_rate: 10,
              commission_amount: Number(microbus.price_per_day) * 0.1,
            },
          ]
        : [],
      paidAmount: 8000,
      payments: [{ idempotency_key: 'seed-pay-1004', amount: 8000, method: 'bkash' }],
      history: [
        ['PENDING', 'AWAITING_PAYMENT', 'Quotation generated'],
        ['AWAITING_PAYMENT', 'CONFIRMED', 'Payment verified'],
        ['CONFIRMED', 'CANCELLED', 'Family emergency'],
        ['CANCELLED', 'REFUND_PENDING', 'Refund requested by customer'],
      ],
    });

    if (cancelled) {
      const payment = await models.Payment.findOne({ where: { booking_id: cancelled.id } });
      const [refund, refundCreated] = await models.Refund.findOrCreate({
        where: { booking_id: cancelled.id, amount: '8000.00' },
        defaults: {
          booking_id: cancelled.id,
          payment_id: payment?.id || null,
          amount: '8000.00',
          reason: 'Family emergency',
          status: 'REQUESTED',
          requested_by_user_id: customer2.id,
        },
      });
      // Keep the booking status in step with the refund row when the demo
      // database already contains a decided refund from an earlier run.
      const bookingStatusByRefund = { PROCESSED: 'REFUNDED', REJECTED: 'CANCELLED', REQUESTED: 'REFUND_PENDING', APPROVED: 'REFUND_PENDING' };
      const targetStatus = bookingStatusByRefund[refundCreated ? 'REQUESTED' : refund.status];
      if (targetStatus && cancelled.status !== targetStatus) {
        await models.Booking.update({ status: targetStatus }, { where: { id: cancelled.id } });
      }
    }

    // 5) reserved inventory for the confirmed trip so the demo cannot double-book
    if (deluxeRoom) {
      for (const date of [day(10), day(11)]) {
        const row = await models.RoomAvailability.findOne({ where: { room_id: deluxeRoom.id, date } });
        if (row) await row.update({ reserved_units: 2 });
      }
    }
    if (microbus) {
      for (const date of [day(10), day(11)]) {
        const row = await models.VehicleAvailability.findOne({ where: { vehicle_id: microbus.id, date } });
        if (row) await row.update({ status: 'BOOKED' });
      }
    }
    if (guide) {
      const row = await models.GuideAvailability.findOne({ where: { guide_id: guide.id, date: day(11) } });
      if (row) await row.update({ status: 'BOOKED' });
    }

    // notifications
    await models.Notification.findOrCreate({
      where: { user_id: customer.id, type: 'BOOKING_CONFIRMED', title: 'Your Cox’s Bazar trip is confirmed' },
      defaults: {
        user_id: customer.id,
        type: 'BOOKING_CONFIRMED',
        title: 'Your Cox’s Bazar trip is confirmed',
        body: 'Pickup details and your voucher are available in My Bookings.',
        data: { reference: 'PTK-SEED-1001' },
        channel: 'BOTH',
        sent_at: new Date(),
      },
    });
    await models.Notification.findOrCreate({
      where: { user_id: customer.id, type: 'PAYMENT_REMINDER', title: 'Complete payment for PTK-SEED-1003' },
      defaults: {
        user_id: customer.id,
        type: 'PAYMENT_REMINDER',
        title: 'Complete payment for PTK-SEED-1003',
        body: 'Your Sajek trip is reserved but not paid. Pay now to confirm your seats.',
        data: { reference: 'PTK-SEED-1003' },
        channel: 'IN_APP',
        sent_at: new Date(),
      },
    });
    if (hotelProvider) {
      await models.Notification.findOrCreate({
        where: { user_id: hotelProvider.user_id, type: 'RESERVATION_RECEIVED', title: 'New reservation received' },
        defaults: {
          user_id: hotelProvider.user_id,
          type: 'RESERVATION_RECEIVED',
          title: 'New reservation received',
          body: 'A customer booked 2 Deluxe Sea View rooms for 2 nights.',
          data: { reference: 'PTK-SEED-1002' },
          channel: 'BOTH',
          sent_at: new Date(),
        },
      });
    }

    console.log('  demo customers, bookings, payments, reviews and notifications seeded');
  },
};
