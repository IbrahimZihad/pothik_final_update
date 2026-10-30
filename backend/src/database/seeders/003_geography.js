'use strict';

const { models } = require('../../models');

const DIVISIONS = [
  {
    code: 'DHA',
    name: 'Dhaka',
    name_bn: 'ঢাকা',
    districts: [
      ['Dhaka', 'ঢাকা'],
      ['Gazipur', 'গাজীপুর'],
      ['Kishoreganj', 'কিশোরগঞ্জ'],
      ['Manikganj', 'মানিকগঞ্জ'],
      ['Munshiganj', 'মুন্সিগঞ্জ'],
      ['Narayanganj', 'নারায়ণগঞ্জ'],
      ['Narsingdi', 'নরসিংদী'],
      ['Tangail', 'টাঙ্গাইল'],
      ['Faridpur', 'ফরিদপুর'],
      ['Gopalganj', 'গোপালগঞ্জ'],
      ['Madaripur', 'মাদারীপুর'],
      ['Rajbari', 'রাজবাড়ী'],
      ['Shariatpur', 'শরীয়তপুর'],
    ],
  },
  {
    code: 'CHT',
    name: 'Chattogram',
    name_bn: 'চট্টগ্রাম',
    districts: [
      ['Chattogram', 'চট্টগ্রাম'],
      ["Cox's Bazar", 'কক্সবাজার'],
      ['Cumilla', 'কুমিল্লা'],
      ['Brahmanbaria', 'ব্রাহ্মণবাড়িয়া'],
      ['Chandpur', 'চাঁদপুর'],
      ['Feni', 'ফেনী'],
      ['Khagrachhari', 'খাগড়াছড়ি'],
      ['Lakshmipur', 'লক্ষ্মীপুর'],
      ['Noakhali', 'নোয়াখালী'],
      ['Rangamati', 'রাঙ্গামাটি'],
      ['Bandarban', 'বান্দরবান'],
    ],
  },
  {
    code: 'RAJ',
    name: 'Rajshahi',
    name_bn: 'রাজশাহী',
    districts: [
      ['Rajshahi', 'রাজশাহী'],
      ['Bogura', 'বগুড়া'],
      ['Joypurhat', 'জয়পুরহাট'],
      ['Naogaon', 'নওগাঁ'],
      ['Natore', 'নাটোর'],
      ['Chapainawabganj', 'চাঁপাইনবাবগঞ্জ'],
      ['Pabna', 'পাবনা'],
      ['Sirajganj', 'সিরাজগঞ্জ'],
    ],
  },
  {
    code: 'KHU',
    name: 'Khulna',
    name_bn: 'খুলনা',
    districts: [
      ['Khulna', 'খুলনা'],
      ['Bagerhat', 'বাগেরহাট'],
      ['Chuadanga', 'চুয়াডাঙ্গা'],
      ['Jashore', 'যশোর'],
      ['Jhenaidah', 'ঝিনাইদহ'],
      ['Kushtia', 'কুষ্টিয়া'],
      ['Magura', 'মাগুরা'],
      ['Meherpur', 'মেহেরপুর'],
      ['Narail', 'নড়াইল'],
      ['Satkhira', 'সাতক্ষীরা'],
    ],
  },
  {
    code: 'BAR',
    name: 'Barishal',
    name_bn: 'বরিশাল',
    districts: [
      ['Barishal', 'বরিশাল'],
      ['Barguna', 'বরগুনা'],
      ['Bhola', 'ভোলা'],
      ['Jhalokathi', 'ঝালকাঠি'],
      ['Patuakhali', 'পটুয়াখালী'],
      ['Pirojpur', 'পিরোজপুর'],
    ],
  },
  {
    code: 'SYL',
    name: 'Sylhet',
    name_bn: 'সিলেট',
    districts: [
      ['Sylhet', 'সিলেট'],
      ['Habiganj', 'হবিগঞ্জ'],
      ['Moulvibazar', 'মৌলভীবাজার'],
      ['Sunamganj', 'সুনামগঞ্জ'],
    ],
  },
  {
    code: 'RAN',
    name: 'Rangpur',
    name_bn: 'রংপুর',
    districts: [
      ['Rangpur', 'রংপুর'],
      ['Dinajpur', 'দিনাজপুর'],
      ['Gaibandha', 'গাইবান্ধা'],
      ['Kurigram', 'কুড়িগ্রাম'],
      ['Lalmonirhat', 'লালমনিরহাট'],
      ['Nilphamari', 'নীলফামারী'],
      ['Panchagarh', 'পঞ্চগড়'],
      ['Thakurgaon', 'ঠাকুরগাঁও'],
    ],
  },
  {
    code: 'MYM',
    name: 'Mymensingh',
    name_bn: 'ময়মনসিংহ',
    districts: [
      ['Mymensingh', 'ময়মনসিংহ'],
      ['Jamalpur', 'জামালপুর'],
      ['Netrokona', 'নেত্রকোনা'],
      ['Sherpur', 'শেরপুর'],
    ],
  },
];

const UPAZILAS = {
  "Cox's Bazar": [
    ["Cox's Bazar Sadar", 'কক্সবাজার সদর'],
    ['Ukhia', 'উখিয়া'],
    ['Teknaf', 'টেকনাফ'],
    ['Ramu', 'রামু'],
    ['Chakaria', 'চকরিয়া'],
  ],
  Bandarban: [
    ['Bandarban Sadar', 'বান্দরবান সদর'],
    ['Alikadam', 'আলীকদম'],
    ['Ruma', 'রুমা'],
    ['Thanchi', 'থানচি'],
    ['Lama', 'লামা'],
  ],
  Rangamati: [
    ['Rangamati Sadar', 'রাঙ্গামাটি সদর'],
    ['Kaptai', 'কাপ্তাই'],
    ['Langadu', 'লংগদু'],
    ['Baghaichhari', 'বাঘাইছড়ি'],
  ],
  Khagrachhari: [
    ['Khagrachhari Sadar', 'খাগড়াছড়ি সদর'],
    ['Dighinala', 'দীঘিনালা'],
    ['Panchhari', 'পানছড়ি'],
  ],
  Khulna: [
    ['Koyra', 'কয়রা'],
    ['Dacope', 'দাকোপ'],
    ['Dumuria', 'ডুমুরিয়া'],
  ],
  Bagerhat: [
    ['Mongla', 'মোংলা'],
    ['Morrelganj', 'মোড়েলগঞ্জ'],
    ['Sarankhola', 'শরণখোলা'],
  ],
  Patuakhali: [
    ['Kalapara', 'কলাপাড়া'],
    ['Galachipa', 'গলাচিপা'],
    ['Patuakhali Sadar', 'পটুয়াখালী সদর'],
  ],
  Sylhet: [
    ['Sylhet Sadar', 'সিলেট সদর'],
    ['Companiganj', 'কোম্পানীগঞ্জ'],
    ['Gowainghat', 'গোয়াইনঘাট'],
    ['Jaintiapur', 'জৈন্তাপুর'],
  ],
  Moulvibazar: [
    ['Moulvibazar Sadar', 'মৌলভীবাজার সদর'],
    ['Sreemangal', 'শ্রীমঙ্গল'],
    ['Kamalganj', 'কমলগঞ্জ'],
  ],
  Sunamganj: [
    ['Sunamganj Sadar', 'সুনামগঞ্জ সদর'],
    ['Tahirpur', 'তাহিরপুর'],
    ['Dharampasha', 'ধর্মপাশা'],
  ],
  Dhaka: [
    ['Savar', 'সাভার'],
    ['Dhamrai', 'ধামরাই'],
    ['Keraniganj', 'কেরানীগঞ্জ'],
  ],
};

module.exports = {
  async up() {
    let districtCount = 0;
    let index = 1;
    const districtByName = {};

    for (const division of DIVISIONS) {
      const [divisionRow] = await models.Division.findOrCreate({
        where: { code: division.code },
        defaults: { name: division.name, name_bn: division.name_bn, code: division.code },
      });

      for (const [name, name_bn] of division.districts) {
        const code = `D${String(index).padStart(2, '0')}`;
        index += 1;
        const [districtRow] = await models.District.findOrCreate({
          where: { code },
          defaults: { division_id: divisionRow.id, name, name_bn, code },
        });
        districtByName[name] = districtRow;
        districtCount += 1;
      }
    }

    let upazilaCount = 0;
    for (const [districtName, upazilas] of Object.entries(UPAZILAS)) {
      const district = districtByName[districtName];
      if (!district) continue;
      for (const [name, name_bn] of upazilas) {
        await models.Upazila.findOrCreate({
          where: { district_id: district.id, name },
          defaults: { district_id: district.id, name, name_bn },
        });
        upazilaCount += 1;
      }
    }

    console.log(`  divisions: ${DIVISIONS.length}, districts: ${districtCount}, upazilas: ${upazilaCount}`);
  },
};

module.exports.DIVISIONS = DIVISIONS;
