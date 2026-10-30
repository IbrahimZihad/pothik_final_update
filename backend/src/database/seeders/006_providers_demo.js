'use strict';

const { models } = require('../../models');
const { dateOffset, ensureUser, ensureProviderProfile, ensureDemoDocument } = require('../seedUtils');

const HOTEL = {
  name: 'Sea Crown Hotel & Resort',
  slug: 'sea-crown-hotel-resort',
  description:
    'A beachfront hotel on Marine Drive with sea-view rooms, a rooftop pool and direct access to Laboni Beach.',
  star_rating: 4,
  address: 'Marine Drive Road, Kolatoli, Cox’s Bazar',
  phone: '+8801812345678',
  image_url: '/images/hotels/sea-crown.svg',
  facilities: ['Rooftop pool', 'Free breakfast', 'Airport transfer', 'Sea view', 'Room service', 'Wi-Fi'],
  rooms: [
    {
      name: 'Deluxe Sea View',
      room_type: 'DOUBLE',
      capacity_adults: 2,
      capacity_children: 1,
      base_price: 5500,
      total_units: 8,
      image_url: '/images/hotels/deluxe-sea-view.svg',
      amenities: ['Sea view', 'AC', 'Breakfast', 'Hot water'],
    },
    {
      name: 'Family Suite',
      room_type: 'FAMILY',
      capacity_adults: 4,
      capacity_children: 2,
      base_price: 9500,
      total_units: 3,
      image_url: '/images/hotels/family-suite.svg',
      amenities: ['Sea view', 'AC', 'Breakfast', 'Living area', 'Bathtub'],
    },
    {
      name: 'Standard Double',
      room_type: 'DOUBLE',
      capacity_adults: 2,
      capacity_children: 0,
      base_price: 3200,
      total_units: 10,
      image_url: '/images/hotels/standard-double.svg',
      amenities: ['AC', 'Hot water', 'Wi-Fi'],
    },
  ],
};

// One published property per remaining destination so every trip-builder step has inventory.
const DESTINATION_HOTELS = [
  {
    destination: 'sajek-valley',
    name: 'Sajek Cloud Nest Resort',
    slug: 'sajek-cloud-nest-resort',
    description:
      'Hilltop cottages above the clouds with valley-view balconies, an open-air dining deck and bonfire evenings.',
    star_rating: 3,
    address: 'Ruilui Para, Sajek Valley, Baghaichhari, Rangamati',
    phone: '+8801711000101',
    image_url: '/images/destinations/sajek.svg',
    facilities: ['Valley view', 'Breakfast', 'Bonfire', 'Parking', 'Wi-Fi'],
    rating_avg: 4.6,
    rating_count: 18,
    rooms: [
      {
        name: 'Hill View Deluxe',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 4800,
        total_units: 6,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Valley view', 'AC', 'Breakfast', 'Hot water'],
      },
      {
        name: 'Group Cottage',
        room_type: 'FAMILY',
        capacity_adults: 4,
        capacity_children: 2,
        base_price: 8200,
        total_units: 2,
        image_url: '/images/hotels/family-suite.svg',
        amenities: ['Valley view', 'Breakfast', 'Living area'],
      },
    ],
  },
  {
    destination: 'bandarban',
    name: 'Nilgiri Hill Lodge',
    slug: 'nilgiri-hill-lodge',
    description:
      'A quiet lodge on the Nilgiri ridge with panoramic hill views, guided treks and a cosy dining room.',
    star_rating: 3,
    address: 'Nilgiri, Bandarban Sadar, Bandarban',
    phone: '+8801711000102',
    image_url: '/images/destinations/bandarban.svg',
    facilities: ['Mountain view', 'Breakfast', 'Trek desk', 'Parking'],
    rating_avg: 4.4,
    rating_count: 12,
    rooms: [
      {
        name: 'Valley View Double',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 4200,
        total_units: 8,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Mountain view', 'Hot water', 'Breakfast'],
      },
      {
        name: 'Family Room',
        room_type: 'FAMILY',
        capacity_adults: 4,
        capacity_children: 2,
        base_price: 6800,
        total_units: 3,
        image_url: '/images/hotels/family-suite.svg',
        amenities: ['Mountain view', 'Breakfast', 'Living area'],
      },
    ],
  },
  {
    destination: 'rangamati',
    name: 'Kaptai Lake Retreat',
    slug: 'kaptai-lake-retreat',
    description:
      'Lakefront rooms with private balconies, boat transfers to Kaptai and a terrace restaurant serving local cuisine.',
    star_rating: 3,
    address: 'Lake Side Road, Rangamati Sadar, Rangamati',
    phone: '+8801711000103',
    image_url: '/images/destinations/rangamati.svg',
    facilities: ['Lake view', 'Boat transfer', 'Breakfast', 'Wi-Fi'],
    rating_avg: 4.3,
    rating_count: 9,
    rooms: [
      {
        name: 'Lake View Double',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 3900,
        total_units: 6,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Lake view', 'AC', 'Breakfast'],
      },
    ],
  },
  {
    destination: 'sylhet',
    name: 'Surma Heritage Stay',
    slug: 'surma-heritage-stay',
    description:
      'A restored townhouse near Zindabazar with heritage rooms, a courtyard breakfast and easy access to Ratargul and Jaflong.',
    star_rating: 4,
    address: 'Zindabazar, Sylhet',
    phone: '+8801711000104',
    image_url: '/images/destinations/sylhet.svg',
    facilities: ['Heritage building', 'Breakfast', 'Airport pickup', 'Wi-Fi'],
    rating_avg: 4.5,
    rating_count: 21,
    rooms: [
      {
        name: 'Heritage Double',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 3600,
        total_units: 8,
        image_url: '/images/hotels/standard-double.svg',
        amenities: ['AC', 'Breakfast', 'Hot water', 'Wi-Fi'],
      },
      {
        name: 'Heritage Suite',
        room_type: 'SUITE',
        capacity_adults: 3,
        capacity_children: 1,
        base_price: 6200,
        total_units: 3,
        image_url: '/images/hotels/family-suite.svg',
        amenities: ['AC', 'Breakfast', 'Living area', 'Bathtub'],
      },
    ],
  },
  {
    destination: 'sundarbans',
    name: 'Mangrove Tides Eco Resort',
    slug: 'mangrove-tides-eco-resort',
    description:
      'Solar-powered eco cottages on the edge of the Sundarbans with guided boat safaris and locally sourced meals.',
    star_rating: 3,
    address: 'Mongla, Bagerhat',
    phone: '+8801711000105',
    image_url: '/images/destinations/sundarbans.svg',
    facilities: ['Eco cottages', 'Boat safari', 'Meals included', 'Solar power'],
    rating_avg: 4.7,
    rating_count: 14,
    rooms: [
      {
        name: 'Eco Cottage',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 5200,
        total_units: 5,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Forest view', 'Breakfast', 'Fan', 'Hot water'],
      },
    ],
  },
  {
    destination: 'saint-martin',
    name: 'Coral Bay Beach Resort',
    slug: 'coral-bay-beach-resort',
    description:
      'Beachfront cottages a short walk from the jetty, with sea-facing verandas, fresh seafood and snorkelling trips.',
    star_rating: 3,
    address: 'West Beach, Saint Martin’s Island, Teknaf',
    phone: '+8801711000106',
    image_url: '/images/destinations/saint-martin.svg',
    facilities: ['Beachfront', 'Seafood restaurant', 'Snorkelling', 'Wi-Fi'],
    rating_avg: 4.6,
    rating_count: 27,
    rooms: [
      {
        name: 'Sea Breeze Double',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 4600,
        total_units: 6,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Sea view', 'AC', 'Breakfast'],
      },
      {
        name: 'Family Cottage',
        room_type: 'FAMILY',
        capacity_adults: 4,
        capacity_children: 2,
        base_price: 7800,
        total_units: 3,
        image_url: '/images/hotels/family-suite.svg',
        amenities: ['Sea view', 'AC', 'Breakfast', 'Living area'],
      },
    ],
  },
  {
    destination: 'kuakata',
    name: 'Kuakata Sunrise Beach Hotel',
    slug: 'kuakata-sunrise-beach-hotel',
    description:
      'Simple, clean rooms facing the Bay of Bengal, five minutes from the sunrise beach and the fishing harbour.',
    star_rating: 3,
    address: 'Kuakata Beach Road, Kalapara, Patuakhali',
    phone: '+8801711000107',
    image_url: '/images/destinations/kuakata.svg',
    facilities: ['Sea view', 'Breakfast', 'Parking', 'Wi-Fi'],
    rating_avg: 4.3,
    rating_count: 16,
    rooms: [
      {
        name: 'Sea View Double',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 3800,
        total_units: 8,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Sea view', 'AC', 'Breakfast', 'Hot water'],
      },
    ],
  },
  {
    destination: 'sreemangal',
    name: 'Tea Valley Resort',
    slug: 'tea-valley-resort',
    description:
      'Garden rooms inside a working tea estate, with plantation walks, birdwatching trails and a veranda restaurant.',
    star_rating: 4,
    address: 'Radhanagar, Sreemangal, Moulvibazar',
    phone: '+8801711000108',
    image_url: '/images/destinations/sreemangal.svg',
    facilities: ['Tea garden', 'Breakfast', 'Plantation walk', 'Wi-Fi'],
    rating_avg: 4.5,
    rating_count: 19,
    rooms: [
      {
        name: 'Garden View Double',
        room_type: 'DOUBLE',
        capacity_adults: 2,
        capacity_children: 1,
        base_price: 4100,
        total_units: 6,
        image_url: '/images/hotels/deluxe-sea-view.svg',
        amenities: ['Garden view', 'AC', 'Breakfast', 'Hot water'],
      },
    ],
  },
];

const VEHICLES = [
  {
    name: 'AC Tourist Bus',
    category: 'BUS',
    model: 'Hino AK1J',
    registration_no: 'DHAKA-HA-11-2233',
    capacity: 45,
    price_per_day: 18000,
    image_url: '/images/vehicles/bus.svg',
    features: ['AC', 'Reclining seats', 'TV', 'Luggage space'],
  },
  {
    name: 'Microbus (9 seats)',
    category: 'MICROBUS',
    model: 'Toyota HiAce',
    registration_no: 'CHATTA-MA-11-4455',
    capacity: 9,
    price_per_day: 8000,
    price_per_km: 35,
    image_url: '/images/vehicles/microbus.svg',
    features: ['AC', 'Push-back seats', 'USB charging'],
  },
  {
    name: 'Hill Jeep (4x4)',
    category: 'JEEP',
    model: 'Land Rover Defender',
    registration_no: 'KHAGRA-GA-11-7788',
    capacity: 6,
    price_per_day: 6500,
    price_per_km: 45,
    image_url: '/images/vehicles/jeep.svg',
    features: ['4x4', 'Roof rack', 'Hill certified'],
  },
];

async function seedRooms(hotelRow, roomDefs) {
  const roomRows = [];
  for (const room of roomDefs) {
    const [roomRow] = await models.HotelRoom.findOrCreate({
      where: { hotel_id: hotelRow.id, name: room.name },
      defaults: {
        hotel_id: hotelRow.id,
        name: room.name,
        room_type: room.room_type,
        capacity_adults: room.capacity_adults,
        capacity_children: room.capacity_children,
        base_price: room.base_price,
        total_units: room.total_units,
        image_url: room.image_url,
        amenities: room.amenities,
        status: 'ACTIVE',
      },
    });
    roomRows.push(roomRow);
    for (let day = 0; day <= 120; day += 1) {
      const date = dateOffset(day);
      await models.RoomAvailability.findOrCreate({
        where: { room_id: roomRow.id, date },
        defaults: { room_id: roomRow.id, date, total_units: room.total_units, reserved_units: 0, is_blocked: false },
      });
    }
  }
  return roomRows;
}

module.exports = {
  async up() {
    // --- approved hotel owner -------------------------------------------------
    const hotelOwner = await ensureUser({
      name: 'Rahman Hospitality',
      email: 'hotel.owner@pothik.test',
      phone: '01711112222',
      role: 'HOTEL_OWNER',
    });
    const hotelProvider = await ensureProviderProfile({
      userId: hotelOwner.id,
      type: 'HOTEL',
      businessName: 'Rahman Hospitality',
      description: 'Beach, hill and haor hospitality group operating across Bangladesh since 2012.',
      phone: '01711112222',
      address: 'Kolatoli, Cox’s Bazar',
    });

    const coxsBazar = await models.Destination.findOne({ where: { slug: 'coxs-bazar' } });
    const [hotel] = await models.Hotel.findOrCreate({
      where: { slug: HOTEL.slug },
      defaults: {
        provider_profile_id: hotelProvider.id,
        destination_id: coxsBazar?.id || null,
        name: HOTEL.name,
        slug: HOTEL.slug,
        description: HOTEL.description,
        star_rating: HOTEL.star_rating,
        address: HOTEL.address,
        phone: HOTEL.phone,
        email: 'reservations@seacrown.pothik.test',
        image_url: HOTEL.image_url,
        gallery: [HOTEL.image_url],
        facilities: HOTEL.facilities,
        status: 'PUBLISHED',
        rating_avg: 4.5,
        rating_count: 24,
      },
    });

    const rooms = await seedRooms(hotel, HOTEL.rooms);

    for (const property of DESTINATION_HOTELS) {
      const destination = await models.Destination.findOne({ where: { slug: property.destination } });
      const [destinationHotel] = await models.Hotel.findOrCreate({
        where: { slug: property.slug },
        defaults: {
          provider_profile_id: hotelProvider.id,
          destination_id: destination?.id || null,
          name: property.name,
          slug: property.slug,
          description: property.description,
          star_rating: property.star_rating,
          address: property.address,
          phone: property.phone,
          email: `reservations@${property.slug}.pothik.test`,
          image_url: property.image_url,
          gallery: [property.image_url],
          facilities: property.facilities,
          status: 'PUBLISHED',
          rating_avg: property.rating_avg,
          rating_count: property.rating_count,
        },
      });
      rooms.push(...(await seedRooms(destinationHotel, property.rooms)));
    }

    // --- approved transport provider -----------------------------------------
    const transportUser = await ensureUser({
      name: 'Chittagong Roadways',
      email: 'transport@pothik.test',
      phone: '01733334444',
      role: 'TRANSPORT_PROVIDER',
    });
    const transportProvider = await ensureProviderProfile({
      userId: transportUser.id,
      type: 'TRANSPORT',
      businessName: 'Chittagong Roadways',
      description: 'Bus, microbus and 4x4 rentals across Chattogram division and the hill districts.',
      phone: '01733334444',
      address: 'Agrabad, Chattogram',
    });

    const vehicleCategories = await models.VehicleCategory.findAll();
    const categoryByCode = Object.fromEntries(vehicleCategories.map((c) => [c.code, c]));
    for (const vehicle of VEHICLES) {
      const [vehicleRow] = await models.Vehicle.findOrCreate({
        where: { registration_no: vehicle.registration_no },
        defaults: {
          provider_profile_id: transportProvider.id,
          category_id: categoryByCode[vehicle.category]?.id,
          name: vehicle.name,
          model: vehicle.model,
          registration_no: vehicle.registration_no,
          capacity: vehicle.capacity,
          price_per_day: vehicle.price_per_day,
          price_per_km: vehicle.price_per_km || null,
          image_url: vehicle.image_url,
          features: vehicle.features,
          driver_included: true,
          status: 'ACTIVE',
          rating_avg: 4.4,
          rating_count: 11,
        },
      });
      for (let day = 0; day <= 120; day += 1) {
        const date = dateOffset(day);
        await models.VehicleAvailability.findOrCreate({
          where: { vehicle_id: vehicleRow.id, date },
          defaults: { vehicle_id: vehicleRow.id, date, status: 'AVAILABLE' },
        });
      }
    }

    await models.Driver.findOrCreate({
      where: { license_no: 'DK-1122334455' },
      defaults: {
        provider_profile_id: transportProvider.id,
        name: 'Md. Selim Uddin',
        phone: '01755556666',
        license_no: 'DK-1122334455',
        license_expiry: dateOffset(600),
        status: 'ACTIVE',
      },
    });
    await models.Driver.findOrCreate({
      where: { license_no: 'DK-9988776655' },
      defaults: {
        provider_profile_id: transportProvider.id,
        name: 'Jasim Hossain',
        phone: '01777778888',
        license_no: 'DK-9988776655',
        license_expiry: dateOffset(400),
        status: 'ACTIVE',
      },
    });

    // --- approved tour guide -------------------------------------------------
    const guideUser = await ensureUser({
      name: 'Nusrat Jahan',
      email: 'guide@pothik.test',
      phone: '01799990000',
      role: 'TOUR_GUIDE',
    });
    const guideProvider = await ensureProviderProfile({
      userId: guideUser.id,
      type: 'GUIDE',
      businessName: 'Nusrat Jahan - Sylhet Guide',
      description: 'Licensed guide specialising in Sylhet, Sreemangal and haor trips.',
      phone: '01799990000',
      address: 'Zindabazar, Sylhet',
    });
    const [guide] = await models.Guide.findOrCreate({
      where: { provider_profile_id: guideProvider.id },
      defaults: {
        provider_profile_id: guideProvider.id,
        bio:
          'I have guided travellers across Sylhet division for eight years, from Ratargul swamp forest ' +
          'to the tea estates of Sreemangal and the haors of Sunamganj.',
        languages: ['Bangla', 'English', 'Hindi'],
        expertise: ['Tea gardens', 'Haor', 'Heritage', 'Photography'],
        years_experience: 8,
        daily_rate: 3500,
        hourly_rate: 600,
        service_locations: ['Sylhet', 'Sreemangal', 'Sunamganj', 'Moulvibazar'],
        photo_url: '/images/guides/nusrat.svg',
        status: 'ACTIVE',
        rating_avg: 4.8,
        rating_count: 19,
      },
    });
    for (let day = 0; day <= 120; day += 1) {
      const date = dateOffset(day);
      await models.GuideAvailability.findOrCreate({
        where: { guide_id: guide.id, date },
        defaults: { guide_id: guide.id, date, status: 'AVAILABLE' },
      });
    }

    // --- pending providers (for admin approval workflow demo) ----------------
    const pendingHotelUser = await ensureUser({
      name: 'Sundarban Eco Lodge',
      email: 'pending.hotel@pothik.test',
      phone: '01712121212',
      role: 'HOTEL_OWNER',
      status: 'ACTIVE',
    });
    const pendingProfile = await ensureProviderProfile({
      userId: pendingHotelUser.id,
      type: 'HOTEL',
      businessName: 'Sundarban Eco Lodge',
      description: 'Eco lodge near Mongla, awaiting verification.',
      phone: '01712121212',
      address: 'Mongla, Bagerhat',
      status: 'PENDING',
    });
    ensureDemoDocument();
    await models.ProviderDocument.findOrCreate({
      where: { provider_profile_id: pendingProfile.id, type: 'TRADE_LICENSE' },
      defaults: {
        provider_profile_id: pendingProfile.id,
        type: 'TRADE_LICENSE',
        file_url: '/uploads/demo/trade-license.pdf',
        status: 'PENDING',
      },
    });

    const pendingGuideUser = await ensureUser({
      name: 'Arif Chowdhury',
      email: 'pending.guide@pothik.test',
      phone: '01713131313',
      role: 'TOUR_GUIDE',
      status: 'ACTIVE',
    });
    await ensureProviderProfile({
      userId: pendingGuideUser.id,
      type: 'GUIDE',
      businessName: 'Arif Chowdhury - Sundarbans Guide',
      description: 'Mangrove and wildlife guide awaiting approval.',
      phone: '01713131313',
      address: 'Khulna',
      status: 'PENDING',
    });

    console.log(
      `  providers: hotels=${DESTINATION_HOTELS.length + 1}(rooms=${rooms.length}), transport(vehicles=${VEHICLES.length}), guide, pending=2`
    );
  },
};
