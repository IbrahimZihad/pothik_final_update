'use strict';

/* Exercises moderation, provider approval, coupon/blog management, audit
   logging and the three dashboard endpoints. */

const request = require('supertest');
const app = require('../src/app');
const { models, sequelize } = require('../src/models');

let failures = 0;
function check(name, condition, extra) {
  if (condition) console.log(`ok   ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}`);
    if (extra !== undefined) console.log(JSON.stringify(extra, null, 2).slice(0, 1500));
  }
}

async function login(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`login failed for ${email}: ${response.status}`);
  return response.body.data;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

(async () => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is required');

  const admin = await login('admin@pothik.test', adminPassword);
  const customer = await login('customer@pothik.test', 'PothikDemo123');
  const hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
  const transport = await login('transport@pothik.test', 'PothikDemo123');

  const forbidden = await request(app).get('/api/v1/admin/users').set(auth(customer.accessToken));
  check('customers blocked from admin API', forbidden.status === 403, forbidden.body);

  // ---- overview -----------------------------------------------------------
  const stats = await request(app).get('/api/v1/admin/stats').set(auth(admin.accessToken));
  check('admin stats', stats.status === 200 && stats.body.data.bookings.total > 0, stats.body);
  check('stats includes revenue series', Array.isArray(stats.body.data?.revenue?.series) && stats.body.data.revenue.series.length === 6, stats.body.data?.revenue);

  // ---- users --------------------------------------------------------------
  const users = await request(app).get('/api/v1/admin/users').set(auth(admin.accessToken));
  check('admin lists users', users.status === 200 && users.body.data.items.length > 0, users.body);
  const pendingUser = users.body.data.items.find((row) => row.email === 'pending.hotel@pothik.test');
  check('seeded pending provider visible', Boolean(pendingUser), users.body.data.items.map((row) => row.email));

  const selfSuspend = await request(app)
    .patch(`/api/v1/admin/users/${admin.user.id}/status`)
    .set(auth(admin.accessToken))
    .send({ status: 'SUSPENDED' });
  check('admin cannot suspend self', selfSuspend.status === 400 && selfSuspend.body.code === 'SELF_STATUS_CHANGE', selfSuspend.body);

  const suspend = await request(app)
    .patch(`/api/v1/admin/users/${pendingUser.id}/status`)
    .set(auth(admin.accessToken))
    .send({ status: 'SUSPENDED', reason: 'Smoke test suspension' });
  check('user suspended', suspend.status === 200 && suspend.body.data.status === 'SUSPENDED', suspend.body);
  const reactivate = await request(app)
    .patch(`/api/v1/admin/users/${pendingUser.id}/status`)
    .set(auth(admin.accessToken))
    .send({ status: 'ACTIVE' });
  check('user reactivated', reactivate.status === 200 && reactivate.body.data.status === 'ACTIVE', reactivate.body);

  // ---- provider approvals -------------------------------------------------
  const providers = await request(app).get('/api/v1/admin/providers').query({ status: 'PENDING' }).set(auth(admin.accessToken));
  check('pending providers listed', providers.status === 200 && providers.body.data.items.length >= 2, providers.body);
  const pendingHotel = providers.body.data.items.find((row) => row.type === 'HOTEL');
  const pendingTransfer = providers.body.data.items.find((row) => row.type === 'GUIDE');

  const approved = await request(app)
    .post(`/api/v1/admin/providers/${pendingHotel.id}/approve`)
    .set(auth(admin.accessToken))
    .send({ commissionRate: 15 });
  check('provider approved', approved.status === 200 && approved.body.data.status === 'APPROVED' && approved.body.data.commissionRate === 15, approved.body);

  const rejected = await request(app)
    .post(`/api/v1/admin/providers/${pendingTransfer.id}/reject`)
    .set(auth(admin.accessToken))
    .send({ reason: 'Documents illegible' });
  check('provider rejected', rejected.status === 200 && rejected.body.data.status === 'REJECTED', rejected.body);

  const document = approved.body.data.documents?.[0];
  if (document) {
    const reviewed = await request(app)
      .patch(`/api/v1/admin/providers/${pendingHotel.id}/documents/${document.id}`)
      .set(auth(admin.accessToken))
      .send({ status: 'VERIFIED', notes: 'Checked against trade licence registry' });
    check('provider document verified', reviewed.status === 200, reviewed.body);
  } else {
    console.log('ok   provider document step skipped (no documents)');
  }

  // ---- bookings -----------------------------------------------------------
  const bookings = await request(app).get('/api/v1/admin/bookings').set(auth(admin.accessToken));
  check('admin lists bookings', bookings.status === 200 && bookings.body.data.items.length > 0, bookings.body);

  const seededReference = bookings.body.data.items[0].reference;
  const bookingDetail = await request(app).get(`/api/v1/admin/bookings/${seededReference}`).set(auth(admin.accessToken));
  check('admin reads booking detail', bookingDetail.status === 200 && bookingDetail.body.data.reference === seededReference, bookingDetail.body);

  // ---- coupons ------------------------------------------------------------
  const coupon = await request(app)
    .post('/api/v1/admin/coupons')
    .set(auth(admin.accessToken))
    .send({ code: 'smoke15', type: 'PERCENT', value: 15, maxDiscount: 1500, minSpend: 3000, perUserLimit: 2 });
  check('coupon created and uppercased', coupon.status === 201 && coupon.body.data.code === 'SMOKE15', coupon.body);

  const duplicate = await request(app)
    .post('/api/v1/admin/coupons')
    .set(auth(admin.accessToken))
    .send({ code: 'SMOKE15', type: 'FIXED', value: 100 });
  check('duplicate coupon code rejected', duplicate.status === 409, duplicate.body);

  const updated = await request(app)
    .patch(`/api/v1/admin/coupons/${coupon.body.data.id}`)
    .set(auth(admin.accessToken))
    .send({ usageLimit: 300, isActive: true });
  check('coupon updated', updated.status === 200 && updated.body.data.usageLimit === 300, updated.body);

  const deactivated = await request(app).delete(`/api/v1/admin/coupons/${coupon.body.data.id}`).set(auth(admin.accessToken));
  check('coupon deactivated rather than deleted', deactivated.status === 200 && deactivated.body.data.isActive === false, deactivated.body);

  // ---- reviews ------------------------------------------------------------
  const reviews = await request(app).get('/api/v1/admin/reviews').set(auth(admin.accessToken));
  check('admin lists reviews', reviews.status === 200 && reviews.body.data.items.length > 0, reviews.body);
  const review = reviews.body.data.items[0];
  const rejectReview = await request(app)
    .post(`/api/v1/admin/reviews/${review.id}/moderate`)
    .set(auth(admin.accessToken))
    .send({ status: 'REJECTED' });
  check('review rejected', rejectReview.status === 200 && rejectReview.body.data.status === 'REJECTED', rejectReview.body);
  const restoreReview = await request(app)
    .post(`/api/v1/admin/reviews/${review.id}/moderate`)
    .set(auth(admin.accessToken))
    .send({ status: 'APPROVED' });
  check('review approved again', restoreReview.status === 200 && restoreReview.body.data.status === 'APPROVED', restoreReview.body);

  // ---- blogs --------------------------------------------------------------
  const blog = await request(app)
    .post('/api/v1/admin/blogs')
    .set(auth(admin.accessToken))
    .send({ title: 'Smoke test travel guide', excerpt: 'Temporary post', content: 'Body', status: 'DRAFT' });
  check('blog created with slug', blog.status === 201 && blog.body.data.slug === 'smoke-test-travel-guide', blog.body);

  const published = await request(app)
    .patch(`/api/v1/admin/blogs/${blog.body.data.id}`)
    .set(auth(admin.accessToken))
    .send({ status: 'PUBLISHED' });
  check('blog published', published.status === 200 && published.body.data.status === 'PUBLISHED' && Boolean(published.body.data.publishedAt), published.body);

  const archived = await request(app).delete(`/api/v1/admin/blogs/${blog.body.data.id}`).set(auth(admin.accessToken));
  check('blog archived', archived.status === 200 && archived.body.data.status === 'DRAFT', archived.body);

  // ---- audit trail --------------------------------------------------------
  const audits = await request(app).get('/api/v1/admin/audit-logs').set(auth(admin.accessToken));
  check('audit trail records admin actions', audits.status === 200 && audits.body.data.items.some((row) => row.action === 'provider.approve'), audits.body);

  // ---- dashboards ---------------------------------------------------------
  const hotelDash = await request(app).get('/api/v1/provider/dashboard').set(auth(hotel.accessToken));
  check('hotel dashboard', hotelDash.status === 200 && hotelDash.body.data.type === 'HOTEL' && hotelDash.body.data.finance, hotelDash.body);

  const transportDash = await request(app).get('/api/v1/provider/dashboard').set(auth(transport.accessToken));
  check('transport dashboard', transportDash.status === 200 && transportDash.body.data.type === 'TRANSPORT', transportDash.body);

  const customerDash = await request(app).get('/api/v1/dashboard').set(auth(customer.accessToken));
  check('customer dashboard', customerDash.status === 200 && customerDash.body.data.bookings, customerDash.body);

  console.log(failures === 0 ? '\nADMIN SMOKE PASSED' : `\nADMIN SMOKE FAILURES: ${failures}`);
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error('ADMIN SMOKE CRASH', error);
  try {
    await sequelize.close();
  } catch (closeError) {
    /* ignore */
  }
  process.exit(1);
});
