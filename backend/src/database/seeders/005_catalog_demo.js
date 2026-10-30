'use strict';

const { models } = require('../../models');
const { dateOffset } = require('../seedUtils');

const DESTINATIONS = [
  {
    name: "Cox's Bazar",
    name_bn: 'কক্সবাজার',
    slug: 'coxs-bazar',
    district: "Cox's Bazar",
    category: 'beach',
    summary: 'The world’s longest natural sea beach, golden sand and unforgettable sunsets.',
    description:
      "Cox's Bazar stretches over 120 kilometres of unbroken sandy beach along the Bay of Bengal. " +
      'It is the heart of Bangladeshi seaside tourism: calm mornings, fishing boats, dried-fish villages, ' +
      'and a promenade full of seafood restaurants. Nearby Himchari and Inani offer quieter coves and hills.',
    cover_image: '/images/destinations/coxs-bazar.svg',
    best_season: 'November - March',
    estimated_duration_hours: 48,
    entry_fee: 0,
    featured: true,
    spots: [
      ['Laboni Beach', 'The main beach point, closest to town and liveliest in the evening.', 0],
      ['Himchari National Park', 'Waterfalls, hill trails and a panoramic coastline viewpoint.', 50],
      ['Inani Beach', 'Coral stones and clear water, ideal for a quiet day trip.', 0],
      ['Saint Martin’s Jetty', 'Boats leave from here for the coral island of Saint Martin.', 0],
    ],
  },
  {
    name: 'Sajek Valley',
    name_bn: 'সাজেক ভ্যালি',
    slug: 'sajek-valley',
    district: 'Rangamati',
    category: 'hill',
    summary: 'Cloud-kissed hilltop valley on the border of Rangamati and Tripura.',
    description:
      'Sajek sits roughly 1,800 feet above sea level, surrounded by the Lusai hills. Tourists come for ' +
      'sunrise over a sea of clouds, tribal village walks, and the winding jeep road from Khagrachhari.',
    cover_image: '/images/destinations/sajek.svg',
    best_season: 'June - October (clouds), November - February (clear skies)',
    estimated_duration_hours: 36,
    entry_fee: 50,
    featured: true,
    spots: [
      ['Konglak Hill', 'The classic Sajek sunrise viewpoint above the clouds.', 20],
      ['Ruilui Para', 'Community-run village stay with local cuisine.', 0],
      ['Helipad Ground', 'Open ridge with sweeping valley views.', 0],
    ],
  },
  {
    name: 'Bandarban',
    name_bn: 'বান্দরবান',
    slug: 'bandarban',
    district: 'Bandarban',
    category: 'hill',
    summary: 'Bangladesh’s highest peaks, bamboo bridges and Marma and Mro villages.',
    description:
      'Bandarban is the roof of Bangladesh. Nilgiri, Boga Lake, Nafakhum waterfall and the Sangu river ' +
      'draw travellers who want trekking, cloud views and indigenous culture rather than beach resorts.',
    cover_image: '/images/destinations/bandarban.svg',
    best_season: 'November - March',
    estimated_duration_hours: 60,
    entry_fee: 0,
    featured: true,
    spots: [
      ['Nilgiri Hill Resort', 'Army-run hilltop resort with cloud-level views.', 100],
      ['Nafakhum Waterfall', 'A demanding trek to one of the widest falls in the country.', 0],
      ['Boga Lake', 'High-altitude natural lake surrounded by hills.', 0],
      ['Golden Temple', 'Buddhist monastery overlooking Bandarban town.', 0],
    ],
  },
  {
    name: 'Rangamati',
    name_bn: 'রাঙ্গামাটি',
    slug: 'rangamati',
    district: 'Rangamati',
    category: 'hill',
    summary: 'Kaptai Lake, hanging bridges and hill tribe markets.',
    description:
      'Rangamati is built around Kaptai Lake. Boat rides pass submerged valleys and floating markets, ' +
      'while the Rajban Bihar monastery and tribal textile shops anchor the town centre.',
    cover_image: '/images/destinations/rangamati.svg',
    best_season: 'October - March',
    estimated_duration_hours: 30,
    entry_fee: 0,
    featured: false,
    spots: [
      ['Kaptai Lake', 'Full-day boat trips to island markets and waterfalls.', 0],
      ['Hanging Bridge', 'Iconic pedestrian bridge over the lake channel.', 0],
      ['Rajban Bihar', 'Buddhist monastery and meditation centre.', 0],
      ['Polwel Park', 'Lakeside park with views over the reservoir.', 20],
    ],
  },
  {
    name: 'Sylhet',
    name_bn: 'সিলেট',
    slug: 'sylhet',
    district: 'Sylhet',
    category: 'eco',
    summary: 'Tea estates, Sufi shrines and the wetlands of Ratargul and Tanguar Haor.',
    description:
      'Sylhet pairs green tea gardens with spiritual heritage. Day trips reach Ratargul swamp forest, ' +
      'Bisnakandi’s stone streams, Jaflong and the shrine of Hazrat Shahjalal.',
    cover_image: '/images/destinations/sylhet.svg',
    best_season: 'July - October (water), November - February (tea gardens)',
    estimated_duration_hours: 42,
    entry_fee: 0,
    featured: true,
    spots: [
      ['Ratargul Swamp Forest', 'Freshwater swamp forest best explored by boat in monsoon.', 50],
      ['Bisnakandi', 'Rocky stream where the Meghalaya hills meet Bangladesh.', 0],
      ['Jaflong', 'River market and stone collection area at the Indian border.', 0],
      ['Hazrat Shahjalal Mazar', 'Major Sufi shrine in the heart of the city.', 0],
    ],
  },
  {
    name: 'Sundarbans',
    name_bn: 'সুন্দরবন',
    slug: 'sundarbans',
    district: 'Khulna',
    category: 'forest',
    summary: 'The world’s largest mangrove forest, home of the Royal Bengal tiger.',
    description:
      'A UNESCO World Heritage site, the Sundarbans is a labyrinth of tidal rivers and mangrove islands. ' +
      'Cruises from Khulna and Mongla visit watchtowers, deer-filled meadows and fishing villages.',
    cover_image: '/images/destinations/sundarbans.svg',
    best_season: 'November - February',
    estimated_duration_hours: 48,
    entry_fee: 0,
    featured: true,
    spots: [
      ['Kotka Beach', 'Sandy island inside the mangrove with wildlife watchtowers.', 0],
      ['Hiron Point', 'Remote watchtower at the edge of the Bay of Bengal.', 0],
      ['Karamjal', 'Eco centre with deer, crocodile and interpretation trails.', 0],
    ],
  },
  {
    name: "Saint Martin's Island",
    name_bn: 'সেন্ট মার্টিন',
    slug: 'saint-martin',
    district: "Cox's Bazar",
    category: 'island',
    summary: 'Bangladesh’s only coral island, turquoise water and coconut groves.',
    description:
      'A small coral island south of Teknaf, Saint Martin’s is reached by a 2-3 hour boat ride. ' +
      'Clear water, coral reefs and a sleepy village make it the classic island escape.',
    cover_image: '/images/destinations/saint-martin.svg',
    best_season: 'November - March',
    estimated_duration_hours: 30,
    entry_fee: 0,
    featured: true,
    spots: [
      ['Chera Dwip', 'Separate islet reachable on foot at low tide.', 0],
      ['West Beach', 'Sunset point with coral close to shore.', 0],
      ['Sea Turtle Hatchery', 'Community conservation project for olive ridley turtles.', 0],
    ],
  },
  {
    name: 'Kuakata',
    name_bn: 'কুয়াকাটা',
    slug: 'kuakata',
    district: 'Patuakhali',
    category: 'beach',
    summary: 'The beach where you can watch both sunrise and sunset over the sea.',
    description:
      'Kuakata faces south with water on three sides, so both sunrise and sunset can be seen from the ' +
      'same shoreline. Rakhine communities, fishing harbours and the Gangamati mangrove forest surround it.',
    cover_image: '/images/destinations/kuakata.svg',
    best_season: 'November - March',
    estimated_duration_hours: 30,
    entry_fee: 0,
    featured: false,
    spots: [
      ['Kuakata Beach', 'Wide sand strip for sunrise and sunset viewing.', 0],
      ['Gangamati Forest', 'Mangrove forest and watchtower near the beach.', 0],
      ['Lembur Char', 'Boat trips to a river island with fishing communities.', 0],
    ],
  },
  {
    name: 'Sreemangal',
    name_bn: 'শ্রীমঙ্গল',
    slug: 'sreemangal',
    district: 'Moulvibazar',
    category: 'eco',
    summary: 'Tea capital of Bangladesh, Lawachara rainforest and seven-layer tea.',
    description:
      'Sreemangal is the tea capital of Bangladesh. Lawachara National Park protects hoolock gibbons, ' +
      'and the Nilkantha tea cabin serves the famous seven-layer tea.',
    cover_image: '/images/destinations/sreemangal.svg',
    best_season: 'May - October (green), November - February (comfortable)',
    estimated_duration_hours: 30,
    entry_fee: 0,
    featured: true,
    spots: [
      ['Lawachara National Park', 'Guided rainforest walk with hoolock gibbons.', 50],
      ['Nilkantha Tea Cabin', 'Seven-layer tea on a hilltop tea estate.', 0],
      ['Madhabpur Lake', 'Tea garden lake with a hill backdrop.', 0],
      ['Baikka Beel', 'Wetland sanctuary for migratory birds.', 0],
    ],
  },
];

const PACKAGES = [
  {
    slug: 'coxs-bazar-escape-3d2n',
    title: "Cox's Bazar Beach Escape",
    title_bn: 'কক্সবাজার বিচ এস্কেপ',
    summary: 'Three days of sea, seafood and sunsets with beachfront accommodation.',
    description:
      'A relaxed 3-day escape covering Laboni, Himchari and Inani beaches with a beachfront hotel, ' +
      'air-conditioned transport from Dhaka and a local guide for the Himchari trail.',
    cover_image: '/images/destinations/coxs-bazar.svg',
    duration_days: 3,
    nights: 2,
    base_price: 12500,
    child_price: 8000,
    destinations: ["Cox's Bazar"],
    includes: ['Beachfront hotel (2 nights)', 'AC bus Dhaka–Cox’s Bazar return', 'Daily breakfast', 'Himchari and Inani day trip', 'Local guide'],
    excludes: ['Lunch and dinner', 'Entry tickets', 'Personal expenses'],
    highlights: ['Sunrise at Laboni Beach', 'Himchari waterfall trail', 'Inani coral beach'],
    itinerary: [
      ['Departure and beach evening', 'Overnight AC bus from Dhaka, arrive in the morning and check in. Evening walk at Laboni Beach.'],
      ['Himchari and Inani', 'Morning trip to Himchari National Park, afternoon at Inani Beach, sunset at the beach.'],
      ['Free morning and return', 'Breakfast, free time for shopping, afternoon bus back to Dhaka.'],
    ],
  },
  {
    slug: 'sajek-bandarban-hill-4d3n',
    title: 'Sajek & Bandarban Hill Retreat',
    title_bn: 'সাজেক ও বান্দরবান হিল রিট্রিট',
    summary: 'Clouds at Sajek, Nilgiri sunsets and Marma village walks over four days.',
    description:
      'A four-day hill circuit combining Sajek Valley and Bandarban with jeep transfers, hilltop resorts ' +
      'and guided village visits.',
    cover_image: '/images/destinations/sajek.svg',
    duration_days: 4,
    nights: 3,
    base_price: 16800,
    child_price: 11000,
    destinations: ['Sajek Valley', 'Bandarban'],
    includes: ['Hilltop resort stays (3 nights)', 'Jeep transfers', 'All breakfasts and dinners', 'Local guides', 'Permits'],
    excludes: ['Lunch', 'Personal expenses', 'Travel insurance'],
    highlights: ['Sunrise above the clouds', 'Nilgiri Hill Resort', 'Ruilui Para village walk'],
    itinerary: [
      ['Dhaka to Khagrachhari', 'Night bus to Khagrachhari, transfer by jeep to Sajek.'],
      ['Sajek sunrise and Bandarban', 'Sunrise at Konglak Hill, then jeep down to Bandarban via the hill road.'],
      ['Nilgiri and Golden Temple', 'Morning at Nilgiri, afternoon monastery visit, evening at the night market.'],
      ['Return to Dhaka', 'Breakfast and return journey.'],
    ],
  },
  {
    slug: 'sundarbans-cruise-2d1n',
    title: 'Sundarbans Mangrove Cruise',
    title_bn: 'সুন্দরবন ক্রুজ',
    summary: 'Two days cruising the mangrove waterways with wildlife watchtowers.',
    description:
      'A guided two-day cruise from Khulna into the Sundarbans, visiting Kotka and Karamjal with ' +
      'forest department guides and all meals on board.',
    cover_image: '/images/destinations/sundarbans.svg',
    duration_days: 2,
    nights: 1,
    base_price: 9800,
    child_price: 6500,
    destinations: ['Sundarbans'],
    includes: ['Boat cabin accommodation', 'All meals', 'Forest permits', 'Armed forest guard', 'Guide'],
    excludes: ['Transport to Khulna', 'Drinks', 'Tips'],
    highlights: ['Kotka watchtower', 'Deer meadows', 'Mangrove creek cruise'],
    itinerary: [
      ['Khulna to Kotka', 'Board the boat, cruise through mangrove creeks, evening at Kotka.'],
      ['Karamjal and return', 'Morning wildlife watch, visit Karamjal eco centre, return to Khulna.'],
    ],
  },
  {
    slug: 'sylhet-sreemangal-tea-3d2n',
    title: 'Sylhet & Sreemangal Tea Trail',
    title_bn: 'সিলেট ও শ্রীমঙ্গল চা ট্রেইল',
    summary: 'Swamp forest, tea estates and seven-layer tea in three days.',
    description:
      'A three-day green escape covering Ratargul swamp forest, Bisnakandi, Lawachara rainforest and ' +
      'the tea estates of Sreemangal.',
    cover_image: '/images/destinations/sreemangal.svg',
    duration_days: 3,
    nights: 2,
    base_price: 11200,
    child_price: 7200,
    destinations: ['Sylhet', 'Sreemangal'],
    includes: ['Boutique hotel (2 nights)', 'AC transport', 'Breakfast and dinner', 'Boat rides', 'Forest guide'],
    excludes: ['Lunch', 'Entry fees', 'Personal expenses'],
    highlights: ['Ratargul boat ride', 'Lawachara gibbon trail', 'Nilkantha seven-layer tea'],
    itinerary: [
      ['Dhaka to Sylhet', 'Morning train or bus, afternoon Ratargul swamp forest boat ride.'],
      ['Bisnakandi and Sreemangal', 'Morning at Bisnakandi, drive to Sreemangal, evening tea estate walk.'],
      ['Lawachara and return', 'Guided rainforest walk, Nilkantha tea cabin, return to Dhaka.'],
    ],
  },
];

const BLOGS = [
  {
    slug: 'best-time-to-visit-coxs-bazar',
    title: "The Best Time to Visit Cox's Bazar",
    title_bn: 'কক্সবাজার ভ্রমণের সেরা সময়',
    excerpt: 'Weather, crowds and prices month by month for Bangladesh’s longest beach.',
    content:
      'November to March brings dry, comfortable weather and calm seas, which makes it the peak season. ' +
      'Expect higher hotel rates around Eid and New Year. Monsoon (June to September) is quiet and cheap, ' +
      'but swimming is often unsafe. Ramadan can be a good compromise: fewer crowds, open beaches, ' +
      'and iftar seafood that is worth planning the whole day around.',
    cover_image: '/images/destinations/coxs-bazar.svg',
    author_name: 'POTHIK Editorial',
  },
  {
    slug: 'sajek-travel-guide',
    title: 'Sajek Valley: A Practical Travel Guide',
    title_bn: 'সাজেক ভ্যালি ভ্রমণ গাইড',
    excerpt: 'Permits, jeep routes, where to stay and how to catch the clouds.',
    content:
      'Sajek is reached by jeep from Khagrachhari, and the road is only open to authorised vehicles. ' +
      'Book a resort in advance for weekends, carry cash because ATMs are unreliable, and start before ' +
      'sunrise for the cloud views. Mobile signal is limited, so share your itinerary before you go.',
    cover_image: '/images/destinations/sajek.svg',
    author_name: 'POTHIK Editorial',
  },
  {
    slug: 'sundarbans-responsible-travel',
    title: 'Travelling the Sundarbans Responsibly',
    title_bn: 'সুন্দরবনে দায়িত্বশীল ভ্রমণ',
    excerpt: 'Permits, guides and the rules that keep the mangrove forest alive.',
    content:
      'Every Sundarbans trip needs forest department permits and an armed guard. Choose operators that ' +
      'carry waste back, keep noise low around wildlife, and never feed animals. The mangrove protects ' +
      'millions of people from cyclones - travelling lightly is part of the deal.',
    cover_image: '/images/destinations/sundarbans.svg',
    author_name: 'POTHIK Editorial',
  },
];

module.exports = {
  async up() {
    const categories = await models.DestinationCategory.findAll();
    const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
    const districts = await models.District.findAll();
    const districtByName = Object.fromEntries(districts.map((d) => [d.name, d]));

    const destinationBySlug = {};
    for (const item of DESTINATIONS) {
      const district = districtByName[item.district];
      if (!district) throw new Error(`Missing district: ${item.district}`);
      const [destination] = await models.Destination.findOrCreate({
        where: { slug: item.slug },
        defaults: {
          district_id: district.id,
          category_id: categoryBySlug[item.category]?.id || null,
          name: item.name,
          name_bn: item.name_bn,
          slug: item.slug,
          summary: item.summary,
          description: item.description,
          cover_image: item.cover_image,
          gallery: [item.cover_image],
          best_season: item.best_season,
          estimated_duration_hours: item.estimated_duration_hours,
          entry_fee: item.entry_fee,
          status: 'PUBLISHED',
          is_featured: item.featured,
          rating_avg: 4.6,
          rating_count: 12,
        },
      });
      destinationBySlug[item.slug] = destination;
      for (const [spotName, spotDescription, fee] of item.spots) {
        await models.TouristSpot.findOrCreate({
          where: { destination_id: destination.id, name: spotName },
          defaults: {
            destination_id: destination.id,
            name: spotName,
            description: spotDescription,
            entry_fee: fee,
            status: 'ACTIVE',
          },
        });
      }
    }

    for (const pkg of PACKAGES) {
      const [packageRow] = await models.Package.findOrCreate({
        where: { slug: pkg.slug },
        defaults: {
          slug: pkg.slug,
          title: pkg.title,
          title_bn: pkg.title_bn,
          summary: pkg.summary,
          description: pkg.description,
          cover_image: pkg.cover_image,
          gallery: [pkg.cover_image],
          duration_days: pkg.duration_days,
          duration_nights: pkg.nights,
          base_price_per_person: pkg.base_price,
          child_price_per_person: pkg.child_price,
          min_participants: 2,
          max_capacity: 24,
          includes: pkg.includes,
          excludes: pkg.excludes,
          highlights: pkg.highlights,
          cancellation_policy: 'Free cancellation until 7 days before departure. 50% refund within 7 days.',
          status: 'PUBLISHED',
          is_featured: true,
          rating_avg: 4.7,
          rating_count: 8,
        },
      });

      for (const [index, [title, description]] of pkg.itinerary.entries()) {
        await models.PackageItinerary.findOrCreate({
          where: { package_id: packageRow.id, day_number: index + 1 },
          defaults: { package_id: packageRow.id, day_number: index + 1, title, description },
        });
      }

      for (const destinationName of pkg.destinations) {
        const destination = Object.values(destinationBySlug).find(
          (d) => d.name === destinationName || d.name === destinationName.replace(' Valley', '')
        );
        if (destination) {
          await models.PackageDestination.findOrCreate({
            where: { package_id: packageRow.id, destination_id: destination.id },
            defaults: { package_id: packageRow.id, destination_id: destination.id },
          });
        }
      }

      for (let offset = 7; offset <= 90; offset += 14) {
        const start = dateOffset(offset);
        const end = dateOffset(offset + pkg.duration_days - 1);
        await models.PackageDeparture.findOrCreate({
          where: { package_id: packageRow.id, start_date: start },
          defaults: {
            package_id: packageRow.id,
            start_date: start,
            end_date: end,
            capacity: pkg.max_capacity || 24,
            booked_count: 0,
            status: 'SCHEDULED',
          },
        });
      }
    }

    for (const blog of BLOGS) {
      await models.Blog.findOrCreate({
        where: { slug: blog.slug },
        defaults: {
          ...blog,
          status: 'PUBLISHED',
          published_at: new Date(),
        },
      });
    }

    console.log(
      `  destinations: ${DESTINATIONS.length}, packages: ${PACKAGES.length}, blogs: ${BLOGS.length}`
    );
  },
};

module.exports.DESTINATIONS = DESTINATIONS;
module.exports.PACKAGES = PACKAGES;
