'use strict';

const config = require('../config');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const paramRef = (name) => ({ $ref: `#/components/parameters/${name}` });

const SECURITY = [{ bearerAuth: [] }];

function buildResponses(status, { auth, notFound, write }) {
  const responses = {
    [status]: {
      description: status === 201 ? 'Created' : 'OK',
      content: { 'application/json': { schema: ref('Success') } },
    },
    400: { description: 'Validation failed', content: { 'application/json': { schema: ref('Error') } } },
  };
  if (auth) {
    responses[401] = { description: 'Missing or expired access token', content: { 'application/json': { schema: ref('Error') } } };
    responses[403] = { description: 'Role, permission or ownership check failed', content: { 'application/json': { schema: ref('Error') } } };
  }
  if (notFound) responses[404] = { description: 'Resource not found', content: { 'application/json': { schema: ref('Error') } } };
  if (write) responses[429] = { description: 'Rate limit exceeded', content: { 'application/json': { schema: ref('Error') } } };
  responses[500] = { description: 'Unexpected server error', content: { 'application/json': { schema: ref('Error') } } };
  return responses;
}

function operation({ tags, summary, description, auth = true, params = [], query = [], body, bodyOptional = false, multipart = false, download = false, status = 200, notFound = false, write = false }) {
  const responses = buildResponses(status, { auth, notFound, write });
  if (download) {
    responses[status] = {
      description: 'The stored file, streamed to its owner or an administrator',
      content: {
        'image/png': { schema: { type: 'string', format: 'binary' } },
        'image/jpeg': { schema: { type: 'string', format: 'binary' } },
        'image/webp': { schema: { type: 'string', format: 'binary' } },
        'application/pdf': { schema: { type: 'string', format: 'binary' } },
      },
    };
  }
  const result = { tags, summary, responses };
  if (description) result.description = description;
  if (auth) result.security = SECURITY;
  const parameters = params.map(paramRef);
  for (const item of query) parameters.push(item);
  if (parameters.length) result.parameters = parameters;
  if (body) {
    result.requestBody = {
      required: !bodyOptional,
      content: { [multipart ? 'multipart/form-data' : 'application/json']: { schema: ref(body) } },
    };
  }
  return result;
}

const paths = {};

function add(method, path, options) {
  if (!paths[path]) paths[path] = {};
  paths[path][method] = operation(options);
}

const get = (path, options) => add('get', path, options);
const post = (path, options) => add('post', path, options);
const patch = (path, options) => add('patch', path, options);
const put = (path, options) => add('put', path, options);
const del = (path, options) => add('delete', path, options);

const statusQuery = (values, description) => ({
  name: 'status',
  in: 'query',
  description,
  schema: { type: 'string', enum: values },
});

// -------------------------------------------------------------------- health
get('/health', { tags: ['Health'], summary: 'Service status', auth: false });
get('/health/live', { tags: ['Health'], summary: 'Liveness probe', auth: false });
get('/health/ready', {
  tags: ['Health'],
  summary: 'Readiness probe (database connectivity)',
  auth: false,
});

// ---------------------------------------------------------------------- auth
post('/auth/register', { tags: ['Auth'], summary: 'Create an account', auth: false, body: 'RegisterRequest', status: 201, write: true });
post('/auth/login', { tags: ['Auth'], summary: 'Sign in and receive an access token', auth: false, body: 'LoginRequest', write: true });
post('/auth/refresh', {
  tags: ['Auth'],
  summary: 'Rotate the refresh token (cookie or body) and issue a new access token',
  auth: false,
  body: 'RefreshRequest',
  bodyOptional: true,
  write: true,
});
post('/auth/logout', { tags: ['Auth'], summary: 'Revoke the current refresh-token family', auth: false, body: 'RefreshRequest', bodyOptional: true });
post('/auth/verify-email', { tags: ['Auth'], summary: 'Verify an email address with a token', auth: false, body: 'TokenRequest', write: true });
post('/auth/forgot-password', { tags: ['Auth'], summary: 'Request a password reset link', auth: false, body: 'ForgotPasswordRequest', write: true });
post('/auth/reset-password', { tags: ['Auth'], summary: 'Reset a password with a token', auth: false, body: 'ResetPasswordRequest', write: true });
get('/auth/me', { tags: ['Auth'], summary: 'Current user, roles and permissions' });
patch('/auth/me', { tags: ['Auth'], summary: 'Update the current profile', body: 'UpdateProfileRequest', write: true });
post('/auth/change-password', { tags: ['Auth'], summary: 'Change the current password', body: 'ChangePasswordRequest', write: true });
post('/auth/resend-verification', { tags: ['Auth'], summary: 'Resend the email verification message', write: true });

// ------------------------------------------------------------------- catalog
get('/destinations', {
  tags: ['Catalog'],
  summary: 'List destinations',
  auth: false,
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'divisionId', in: 'query', schema: { type: 'integer' } },
    { name: 'districtId', in: 'query', schema: { type: 'integer' } },
    { name: 'category', in: 'query', schema: { type: 'string' } },
    { name: 'featured', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['popular', 'rating', 'name'] } },
  ],
});
get('/destinations/meta', { tags: ['Catalog'], summary: 'Divisions, districts and categories for filters', auth: false });
get('/destinations/{slug}', { tags: ['Catalog'], summary: 'Destination detail', auth: false, params: ['SlugParam'], notFound: true });
get('/packages', {
  tags: ['Catalog'],
  summary: 'List tour packages',
  auth: false,
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'destination', in: 'query', schema: { type: 'string' } },
    { name: 'minPrice', in: 'query', schema: { type: 'number' } },
    { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
    { name: 'minDays', in: 'query', schema: { type: 'integer' } },
    { name: 'maxDays', in: 'query', schema: { type: 'integer' } },
    { name: 'featured', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['popular', 'price_asc', 'price_desc', 'duration', 'newest'] } },
  ],
});
get('/packages/{slug}', { tags: ['Catalog'], summary: 'Package detail with itineraries and departures', auth: false, params: ['SlugParam'], notFound: true });
get('/blogs', { tags: ['Catalog'], summary: 'List published journal posts', auth: false, params: ['PageParam', 'LimitParam'] });
get('/blogs/{slug}', { tags: ['Catalog'], summary: 'Journal post detail', auth: false, params: ['SlugParam'], notFound: true });
get('/search', {
  tags: ['Catalog'],
  summary: 'Search destinations, packages, hotels and guides',
  auth: false,
  query: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 120 } }],
});

// ----------------------------------------------------------- public suppliers
get('/hotels', {
  tags: ['Catalog'],
  summary: 'List hotels',
  auth: false,
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'destination', in: 'query', schema: { type: 'string' } },
    { name: 'stars', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
    { name: 'minPrice', in: 'query', schema: { type: 'number' } },
    { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['rating', 'price_asc', 'price_desc', 'name'] } },
  ],
});
get('/hotels/{slug}', { tags: ['Catalog'], summary: 'Hotel detail with rooms', auth: false, params: ['SlugParam'], notFound: true });
get('/hotels/{slug}/availability', {
  tags: ['Catalog'],
  summary: 'Room availability and price for a stay',
  auth: false,
  params: ['SlugParam'],
  query: [
    { name: 'checkIn', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
    { name: 'checkOut', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
    { name: 'rooms', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20 } },
  ],
});
get('/vehicles', {
  tags: ['Catalog'],
  summary: 'List transport vehicles',
  auth: false,
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'category', in: 'query', schema: { type: 'string' } },
    { name: 'minCapacity', in: 'query', schema: { type: 'integer' } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['rating', 'price_asc', 'price_desc', 'capacity'] } },
  ],
});
get('/vehicles/{id}', { tags: ['Catalog'], summary: 'Vehicle detail', auth: false, params: ['IdParam'], notFound: true });
get('/vehicles/{id}/availability', {
  tags: ['Catalog'],
  summary: 'Vehicle availability for a date range',
  auth: false,
  params: ['IdParam'],
  query: [
    { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
    { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
  ],
});
get('/guides', {
  tags: ['Catalog'],
  summary: 'List tour guides',
  auth: false,
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'language', in: 'query', schema: { type: 'string' } },
    { name: 'location', in: 'query', schema: { type: 'string' } },
    { name: 'expertise', in: 'query', schema: { type: 'string' } },
    { name: 'minRating', in: 'query', schema: { type: 'number', minimum: 0, maximum: 5 } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['rating', 'rate_asc', 'rate_desc', 'experience'] } },
  ],
});
get('/guides/{id}', { tags: ['Catalog'], summary: 'Guide detail', auth: false, params: ['IdParam'], notFound: true });
get('/guides/{id}/availability', {
  tags: ['Catalog'],
  summary: 'Guide availability for a date range',
  auth: false,
  params: ['IdParam'],
  query: [
    { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
    { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
  ],
});
get('/vehicle-categories', { tags: ['Catalog'], summary: 'Vehicle categories', auth: false });

// ------------------------------------------------------------------ bookings
post('/bookings', {
  tags: ['Bookings'],
  summary: 'Create a booking from an inline composition or a saved trip',
  body: 'CreateBookingRequest',
  status: 201,
  write: true,
});
get('/bookings', {
  tags: ['Bookings'],
  summary: 'List the current customer bookings',
  params: ['PageParam', 'LimitParam'],
  query: [statusQuery(['PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'])],
});
get('/bookings/{reference}', { tags: ['Bookings'], summary: 'Booking detail (owner, assigned provider or admin)', params: ['ReferenceParam'], notFound: true });
post('/bookings/{reference}/cancel', { tags: ['Bookings'], summary: 'Cancel a booking', params: ['ReferenceParam'], body: 'CancelRequest', bodyOptional: true, write: true, notFound: true });

get('/provider/bookings', {
  tags: ['Provider'],
  summary: 'List bookings assigned to the provider',
  params: ['PageParam', 'LimitParam'],
  query: [statusQuery(['PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'])],
});
get('/provider/bookings/{reference}', { tags: ['Provider'], summary: 'Provider booking detail', params: ['ReferenceParam'], notFound: true });
post('/provider/bookings/{reference}/accept', { tags: ['Provider'], summary: 'Accept a pending booking', params: ['ReferenceParam'], write: true, notFound: true });
post('/provider/bookings/{reference}/reject', { tags: ['Provider'], summary: 'Reject a pending booking', params: ['ReferenceParam'], body: 'RejectRequest', bodyOptional: true, write: true, notFound: true });
post('/provider/bookings/{reference}/start', { tags: ['Provider'], summary: 'Mark a confirmed booking as in progress', params: ['ReferenceParam'], write: true, notFound: true });
post('/provider/bookings/{reference}/complete', { tags: ['Provider'], summary: 'Complete a booking and earn commission', params: ['ReferenceParam'], write: true, notFound: true });

// --------------------------------------------------------------------- trips
get('/trips/addons', { tags: ['Bookings'], summary: 'List add-on services with server prices' });
post('/trips/quote', { tags: ['Bookings'], summary: 'Price a trip composition without saving it', body: 'QuoteRequest', write: true });
post('/trips', { tags: ['Bookings'], summary: 'Save a priced trip to the customer account', body: 'SaveTripRequest', status: 201, write: true });
get('/trips', { tags: ['Bookings'], summary: 'List saved trips', params: ['PageParam', 'LimitParam'], query: [statusQuery(['DRAFT', 'QUOTED', 'CONFIRMED', 'CANCELLED'])] });
get('/trips/{id}', { tags: ['Bookings'], summary: 'Saved trip detail', params: ['IdParam'], notFound: true });
patch('/trips/{id}', { tags: ['Bookings'], summary: 'Update a saved trip', params: ['IdParam'], body: 'UpdateTripRequest', write: true, notFound: true });
del('/trips/{id}', { tags: ['Bookings'], summary: 'Discard a saved trip', params: ['IdParam'], write: true, notFound: true });

// ------------------------------------------------------------------ payments
get('/payments/gateways', {
  tags: ['Payments'],
  summary: 'List payment gateways and whether each is configured',
  auth: false,
});
get('/payments/callback/{gateway}', {
  tags: ['Payments'],
  summary: 'Gateway browser return (bKash redirect; verified by the adapter)',
  description: 'bKash returns the customer with paymentID and a status hint. The hint is not trusted: the adapter executes or queries the payment and only then settles.',
  auth: false,
  params: ['GatewayParam'],
});
post('/payments/callback/{gateway}', {
  tags: ['Payments'],
  summary: 'Gateway server callback (payload verified by the adapter)',
  auth: false,
  params: ['GatewayParam'],
  body: 'GenericObject',
});
post('/payments/callback/{gateway}/{result}', {
  tags: ['Payments'],
  summary: 'Gateway browser return (payload verified by the adapter)',
  auth: false,
  params: ['GatewayParam', 'ResultParam'],
  body: 'GenericObject',
});
post('/payments', { tags: ['Payments'], summary: 'Initiate a payment for a booking', body: 'InitiatePaymentRequest', status: 201, write: true });
get('/payments', { tags: ['Payments'], summary: 'List the current customer payments', params: ['PageParam', 'LimitParam'], query: [statusQuery(['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'])] });
get('/payments/refunds', { tags: ['Payments'], summary: 'List the current customer refunds', params: ['PageParam', 'LimitParam'], query: [statusQuery(['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'])] });
post('/payments/refunds', { tags: ['Payments'], summary: 'Request a refund for a paid booking', body: 'RefundRequest', status: 201, write: true });
get('/payments/{id}', { tags: ['Payments'], summary: 'Payment detail', params: ['IdParam'], notFound: true });
post('/payments/{id}/demo-complete', {
  tags: ['Payments'],
  summary: 'Complete a sandbox payment and settle the booking (demo gateway only)',
  description: 'Rejected when PAYMENT_GATEWAY is not demo. The settlement is idempotent.',
  params: ['IdParam'],
  write: true,
  notFound: true,
});

get('/provider/finance', { tags: ['Provider'], summary: 'Provider finance summary: earned, available, paid out' });
get('/provider/commissions', { tags: ['Provider'], summary: 'Provider commission ledger', params: ['PageParam', 'LimitParam'], query: [statusQuery(['PENDING', 'EARNED', 'PAID', 'REVERSED'])] });
get('/provider/earnings', { tags: ['Provider'], summary: 'Booking-level earnings', params: ['PageParam', 'LimitParam'] });
get('/provider/payouts', { tags: ['Provider'], summary: 'Provider payout requests', params: ['PageParam', 'LimitParam'], query: [statusQuery(['REQUESTED', 'APPROVED', 'PAID', 'REJECTED'])] });
post('/provider/payouts', { tags: ['Provider'], summary: 'Request a payout from the available balance', body: 'PayoutRequest', status: 201, write: true });

// ----------------------------------------------------------- provider profile
get('/provider/profile', { tags: ['Provider'], summary: 'Provider profile' });
patch('/provider/profile', { tags: ['Provider'], summary: 'Update provider profile', body: 'ProviderProfileRequest', write: true });
get('/provider/documents', { tags: ['Provider'], summary: 'Verification documents' });
get('/provider/documents/{id}/file', { tags: ['Provider'], summary: 'Stream an owned verification document', params: ['IdParam'], notFound: true, download: true });
post('/provider/documents', {
  tags: ['Provider'],
  summary: 'Upload a verification document (multipart)',
  description: 'Send multipart/form-data with a `file` field (JPEG, PNG, WEBP or PDF, max MAX_UPLOAD_MB) and a `type` field.',
  body: 'DocumentUploadRequest',
  multipart: true,
  status: 201,
  write: true,
});

get('/provider/hotels', { tags: ['Provider'], summary: 'Hotels owned by the provider' });
post('/provider/hotels', { tags: ['Provider'], summary: 'Create a hotel', body: 'HotelRequest', status: 201, write: true });
patch('/provider/hotels/{id}', { tags: ['Provider'], summary: 'Update an owned hotel', params: ['IdParam'], body: 'HotelRequest', write: true, notFound: true });
post('/provider/hotels/{id}/rooms', { tags: ['Provider'], summary: 'Create a room type', params: ['IdParam'], body: 'RoomRequest', status: 201, write: true, notFound: true });
patch('/provider/rooms/{id}', { tags: ['Provider'], summary: 'Update an owned room', params: ['IdParam'], body: 'RoomRequest', write: true, notFound: true });
del('/provider/rooms/{id}', { tags: ['Provider'], summary: 'Archive an owned room', params: ['IdParam'], write: true, notFound: true });
get('/provider/rooms/{id}/availability', {
  tags: ['Provider'],
  summary: 'Room availability calendar',
  params: ['IdParam'],
  query: [
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
  ],
});
put('/provider/rooms/{id}/availability', { tags: ['Provider'], summary: 'Set room availability for dates', params: ['IdParam'], body: 'RoomAvailabilityRequest', write: true });

get('/provider/vehicles', { tags: ['Provider'], summary: 'Vehicles owned by the provider' });
post('/provider/vehicles', { tags: ['Provider'], summary: 'Create a vehicle', body: 'VehicleRequest', status: 201, write: true });
patch('/provider/vehicles/{id}', { tags: ['Provider'], summary: 'Update an owned vehicle', params: ['IdParam'], body: 'VehicleRequest', write: true, notFound: true });
get('/provider/vehicles/{id}/availability', { tags: ['Provider'], summary: 'Vehicle availability calendar', params: ['IdParam'] });
put('/provider/vehicles/{id}/availability', { tags: ['Provider'], summary: 'Block or open vehicle dates', params: ['IdParam'], body: 'AvailabilityToggleRequest', write: true });

get('/provider/drivers', { tags: ['Provider'], summary: 'Drivers of the transport provider' });
post('/provider/drivers', { tags: ['Provider'], summary: 'Create a driver', body: 'DriverRequest', status: 201, write: true });
patch('/provider/drivers/{id}', { tags: ['Provider'], summary: 'Update a driver', params: ['IdParam'], body: 'DriverRequest', write: true, notFound: true });
del('/provider/drivers/{id}', { tags: ['Provider'], summary: 'Archive a driver', params: ['IdParam'], write: true, notFound: true });

get('/provider/guide', { tags: ['Provider'], summary: 'Guide profile' });
put('/provider/guide', { tags: ['Provider'], summary: 'Create or replace the guide profile', body: 'GuideRequest', write: true });
get('/provider/guide/availability', { tags: ['Provider'], summary: 'Guide availability calendar' });
put('/provider/guide/availability', { tags: ['Provider'], summary: 'Block or open guide dates', body: 'AvailabilityToggleRequest', write: true });

// --------------------------------------------------------------- dashboards
get('/dashboard', { tags: ['Bookings'], summary: 'Customer dashboard summary' });
get('/provider/dashboard', { tags: ['Provider'], summary: 'Provider dashboard summary' });

// ------------------------------------------------------------ reviews, chat
get('/reviews', {
  tags: ['Reviews'],
  summary: 'List approved reviews',
  auth: false,
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'targetType', in: 'query', schema: { type: 'string', enum: ['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION'] } },
    { name: 'targetId', in: 'query', schema: { type: 'integer' } },
    { name: 'rating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
  ],
});
post('/reviews', { tags: ['Reviews'], summary: 'Submit a review for a completed booking', body: 'ReviewRequest', status: 201, write: true });
patch('/reviews/{id}/reply', { tags: ['Reviews'], summary: 'Provider reply to a review', params: ['IdParam'], body: 'ReviewReplyRequest', write: true, notFound: true });

get('/notifications', { tags: ['Notifications'], summary: 'List notifications', params: ['PageParam', 'LimitParam'] });
get('/notifications/unread-count', { tags: ['Notifications'], summary: 'Unread notification count' });
post('/notifications/read-all', { tags: ['Notifications'], summary: 'Mark all notifications as read' });
post('/notifications/{id}/read', { tags: ['Notifications'], summary: 'Mark one notification as read', params: ['IdParam'] });
get('/messages', {
  tags: ['Notifications'],
  summary: 'List a message thread',
  query: [{ name: 'bookingId', in: 'query', schema: { type: 'integer' } }],
});
post('/messages', { tags: ['Notifications'], summary: 'Send a message', body: 'MessageRequest', status: 201, write: true });

// ------------------------------------------------------------------- admin
get('/admin/stats', { tags: ['Admin'], summary: 'Platform statistics and revenue' });
get('/admin/users', {
  tags: ['Admin'],
  summary: 'List users',
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'role', in: 'query', schema: { type: 'string', enum: ['ADMIN', 'HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE', 'CUSTOMER'] } },
    statusQuery(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED']),
  ],
});
get('/admin/users/{id}', { tags: ['Admin'], summary: 'User detail', params: ['IdParam'], notFound: true });
patch('/admin/users/{id}/status', { tags: ['Admin'], summary: 'Activate, suspend or deactivate a user', params: ['IdParam'], body: 'UserStatusRequest', write: true, notFound: true });
put('/admin/users/{id}/roles', { tags: ['Admin'], summary: 'Replace user roles', params: ['IdParam'], body: 'UserRolesRequest', write: true, notFound: true });

get('/admin/providers', {
  tags: ['Admin'],
  summary: 'List provider applications',
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'type', in: 'query', schema: { type: 'string', enum: ['HOTEL', 'TRANSPORT', 'GUIDE'] } },
    statusQuery(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
  ],
});
get('/admin/providers/{id}', { tags: ['Admin'], summary: 'Provider detail with documents', params: ['IdParam'], notFound: true });
for (const action of ['approve', 'reject', 'suspend']) {
  post(`/admin/providers/{id}/${action}`, {
    tags: ['Admin'],
    summary: `Provider ${action}`,
    params: ['IdParam'],
    body: 'ProviderDecisionRequest',
    bodyOptional: action === 'approve',
    write: true,
    notFound: true,
  });
}
patch('/admin/providers/{id}/documents/{documentId}', {
  tags: ['Admin'],
  summary: 'Verify or reject a provider document',
  params: ['IdParam', 'DocumentIdParam'],
  body: 'DocumentDecisionRequest',
  write: true,
  notFound: true,
});
get('/admin/providers/{id}/documents/{documentId}/file', {
  tags: ['Admin'],
  summary: 'Stream a provider verification document',
  params: ['IdParam', 'DocumentIdParam'],
  notFound: true,
  download: true,
});

get('/admin/bookings', {
  tags: ['Admin'],
  summary: 'List all bookings',
  params: ['PageParam', 'LimitParam'],
  query: [
    statusQuery(['PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED']),
    { name: 'type', in: 'query', schema: { type: 'string', enum: ['PACKAGE', 'CUSTOM_TRIP', 'HOTEL', 'TRANSPORT', 'GUIDE'] } },
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
  ],
});
get('/admin/bookings/{reference}', { tags: ['Admin'], summary: 'Booking detail', params: ['ReferenceParam'], notFound: true });

get('/admin/payments', { tags: ['Admin'], summary: 'List all payments', params: ['PageParam', 'LimitParam'], query: [statusQuery(['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'])] });
get('/admin/refunds', { tags: ['Admin'], summary: 'Refund queue', params: ['PageParam', 'LimitParam'], query: [statusQuery(['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'])] });
post('/admin/refunds/{id}/approve', { tags: ['Admin'], summary: 'Approve a refund', params: ['IdParam'], body: 'RefundDecisionRequest', bodyOptional: true, write: true, notFound: true });
post('/admin/refunds/{id}/reject', { tags: ['Admin'], summary: 'Reject a refund', params: ['IdParam'], body: 'RefundDecisionRequest', bodyOptional: true, write: true, notFound: true });
post('/admin/refunds/{id}/process', { tags: ['Admin'], summary: 'Mark an approved refund as processed', params: ['IdParam'], body: 'RefundDecisionRequest', bodyOptional: true, write: true, notFound: true });
get('/admin/commissions', { tags: ['Admin'], summary: 'Commission ledger', params: ['PageParam', 'LimitParam'], query: [statusQuery(['PENDING', 'EARNED', 'PAID', 'REVERSED'])] });
get('/admin/commissions/summary', { tags: ['Admin'], summary: 'Commission totals' });
get('/admin/payouts', { tags: ['Admin'], summary: 'Payout queue', params: ['PageParam', 'LimitParam'], query: [statusQuery(['REQUESTED', 'APPROVED', 'PAID', 'REJECTED'])] });
for (const action of ['approve', 'reject', 'paid']) {
  post(`/admin/payouts/{id}/${action}`, {
    tags: ['Admin'],
    summary: `Mark payout ${action === 'paid' ? 'as paid' : action}`,
    params: ['IdParam'],
    body: 'PayoutActionRequest',
    bodyOptional: true,
    write: true,
    notFound: true,
  });
}

get('/admin/coupons', { tags: ['Admin'], summary: 'List coupons', params: ['PageParam', 'LimitParam'] });
post('/admin/coupons', { tags: ['Admin'], summary: 'Create a coupon', body: 'CouponRequest', status: 201, write: true });
patch('/admin/coupons/{id}', { tags: ['Admin'], summary: 'Update a coupon', params: ['IdParam'], body: 'CouponRequest', write: true, notFound: true });
del('/admin/coupons/{id}', { tags: ['Admin'], summary: 'Deactivate a coupon', params: ['IdParam'], write: true, notFound: true });

get('/admin/reviews', { tags: ['Admin'], summary: 'Moderation queue', params: ['PageParam', 'LimitParam'], query: [statusQuery(['PENDING', 'APPROVED', 'REJECTED'])] });
post('/admin/reviews/{id}/moderate', { tags: ['Admin'], summary: 'Approve or reject a review', params: ['IdParam'], body: 'ReviewModerationRequest', write: true, notFound: true });

get('/admin/blogs', { tags: ['Admin'], summary: 'List journal posts', params: ['PageParam', 'LimitParam'] });
post('/admin/blogs', { tags: ['Admin'], summary: 'Create a journal post', body: 'BlogRequest', status: 201, write: true });
patch('/admin/blogs/{id}', { tags: ['Admin'], summary: 'Update a journal post', params: ['IdParam'], body: 'BlogRequest', write: true, notFound: true });
del('/admin/blogs/{id}', { tags: ['Admin'], summary: 'Archive a journal post', params: ['IdParam'], write: true, notFound: true });

get('/admin/audit-logs', {
  tags: ['Admin'],
  summary: 'Audit trail',
  params: ['PageParam', 'LimitParam'],
  query: [
    { name: 'action', in: 'query', schema: { type: 'string' } },
    { name: 'entityType', in: 'query', schema: { type: 'string' } },
    { name: 'actorUserId', in: 'query', schema: { type: 'integer' } },
  ],
});

// admin catalog (mounted under /admin by routes/index.js)
post('/admin/destinations', { tags: ['Admin'], summary: 'Create a destination', body: 'DestinationRequest', status: 201, write: true });
patch('/admin/destinations/{id}', { tags: ['Admin'], summary: 'Update a destination', params: ['IdParam'], body: 'DestinationRequest', write: true, notFound: true });
del('/admin/destinations/{id}', { tags: ['Admin'], summary: 'Archive a destination', params: ['IdParam'], write: true, notFound: true });
post('/admin/packages', { tags: ['Admin'], summary: 'Create a package with itinerary and departures', body: 'PackageRequest', status: 201, write: true });
patch('/admin/packages/{id}', { tags: ['Admin'], summary: 'Update a package', params: ['IdParam'], body: 'PackageRequest', write: true, notFound: true });

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'POTHIK OTA API',
    version: '1.0.0',
    description:
      'REST API for the POTHIK online travel agency. All endpoints are versioned under /api/v1 and return the envelope ' +
      '`{ success, message, data, meta? }` on success or `{ success: false, message, code, errors? }` on failure. ' +
      'Authenticate with a Bearer access token; permissions are enforced centrally by role and resource ownership is ' +
      'checked in the service layer. Generate a static copy with `npm run openapi` in backend/.',
  },
  servers: [{ url: `${config.apiUrl}${config.apiPrefix}`, description: 'Configured API base URL' }],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Auth', description: 'Registration, login, rotating refresh tokens, password reset' },
    { name: 'Catalog', description: 'Public destinations, packages, hotels, vehicles, guides, journal, search' },
    { name: 'Bookings', description: 'Booking engine and custom trips' },
    { name: 'Payments', description: 'Payments, callbacks, refunds, commissions and payouts' },
    { name: 'Provider', description: 'Provider inventory, reservations and finance' },
    { name: 'Reviews', description: 'Verified-booking reviews and moderation' },
    { name: 'Notifications', description: 'Notifications and booking messages' },
    { name: 'Admin', description: 'Administration, moderation, finance and audit' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      PageParam: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      LimitParam: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      IdParam: { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
      ReferenceParam: { name: 'reference', in: 'path', required: true, schema: { type: 'string', example: 'PTK-2026-000123' } },
      SlugParam: { name: 'slug', in: 'path', required: true, schema: { type: 'string', example: 'sajek-valley' } },
      DocumentIdParam: { name: 'documentId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
      GatewayParam: { name: 'gateway', in: 'path', required: true, schema: { type: 'string', enum: ['demo', 'sslcommerz', 'bkash'] } },
      ResultParam: { name: 'result', in: 'path', required: true, schema: { type: 'string', enum: ['success', 'fail', 'cancel'] } },
    },
    schemas: {
      Success: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { nullable: true },
          meta: ref('PaginationMeta'),
        },
      },
      Error: {
        type: 'object',
        required: ['success', 'message', 'code'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' },
        },
      },
      GenericObject: { type: 'object', additionalProperties: true },

      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 },
          phone: { type: 'string', example: '01712345678' },
          role: { type: 'string', enum: ['CUSTOMER', 'HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE'], default: 'CUSTOMER' },
          businessName: { type: 'string' },
          locale: { type: 'string', enum: ['en', 'bn'] },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } },
      },
      RefreshRequest: { type: 'object', properties: { refreshToken: { type: 'string', description: 'Omit when the httpOnly refresh cookie is present' } } },
      TokenRequest: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      ForgotPasswordRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'password'],
        properties: { token: { type: 'string' }, password: { type: 'string', format: 'password', minLength: 8 } },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          locale: { type: 'string', enum: ['en', 'bn'] },
          avatar_url: { type: 'string' },
          travel_preferences: { type: 'object', additionalProperties: true },
        },
      },

      CreateBookingRequest: {
        type: 'object',
        required: ['type', 'contact'],
        properties: {
          type: { type: 'string', enum: ['PACKAGE', 'HOTEL', 'TRANSPORT', 'GUIDE', 'CUSTOM_TRIP'] },
          customTripId: { type: 'integer', description: 'Required for CUSTOM_TRIP; mutually exclusive with composition' },
          composition: ref('TripComposition'),
          contact: {
            type: 'object',
            required: ['name', 'phone', 'email'],
            properties: { name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string', format: 'email' } },
          },
          passengers: {
            type: 'array',
            maxItems: 50,
            items: {
              type: 'object',
              properties: {
                fullName: { type: 'string' },
                age: { type: 'integer' },
                gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'] },
                nid: { type: 'string' },
                passportNo: { type: 'string' },
              },
            },
          },
          couponCode: { type: 'string' },
        },
      },
      TripComposition: {
        type: 'object',
        required: ['adults'],
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 50 },
          children: { type: 'integer', minimum: 0, maximum: 30, default: 0 },
          package: {
            type: 'object',
            properties: { packageId: { type: 'integer' }, departureId: { type: 'integer' } },
          },
          hotel: {
            type: 'object',
            required: ['hotelId', 'checkIn', 'checkOut', 'rooms'],
            properties: {
              hotelId: { type: 'integer' },
              checkIn: { type: 'string', format: 'date' },
              checkOut: { type: 'string', format: 'date' },
              rooms: {
                type: 'array',
                minItems: 1,
                maxItems: 10,
                items: {
                  type: 'object',
                  required: ['roomId', 'units'],
                  properties: { roomId: { type: 'integer' }, units: { type: 'integer', minimum: 1, maximum: 10 } },
                },
              },
            },
          },
          transport: {
            type: 'object',
            required: ['vehicleId', 'startDate', 'endDate'],
            properties: {
              vehicleId: { type: 'integer' },
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' },
              distanceKm: { type: 'number' },
            },
          },
          guide: {
            type: 'object',
            required: ['guideId', 'startDate', 'endDate'],
            properties: {
              guideId: { type: 'integer' },
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' },
              hours: { type: 'number' },
            },
          },
          destinations: {
            type: 'array',
            items: {
              type: 'object',
              properties: { destinationId: { type: 'integer' }, touristSpotIds: { type: 'array', items: { type: 'integer' } } },
            },
          },
          addons: {
            type: 'array',
            items: {
              type: 'object',
              required: ['code', 'quantity'],
              properties: { code: { type: 'string' }, quantity: { type: 'integer' } },
            },
          },
          specialRequests: { type: 'string', maxLength: 2000 },
        },
      },
      CancelRequest: { type: 'object', properties: { reason: { type: 'string', maxLength: 500 } } },
      RejectRequest: { type: 'object', properties: { reason: { type: 'string', maxLength: 500 } } },
      QuoteRequest: {
        type: 'object',
        required: ['composition'],
        properties: { composition: ref('TripComposition'), couponCode: { type: 'string' } },
      },
      SaveTripRequest: {
        type: 'object',
        required: ['composition'],
        properties: {
          composition: ref('TripComposition'),
          couponCode: { type: 'string' },
          title: { type: 'string', maxLength: 200 },
          requirements: { type: 'string', maxLength: 4000 },
        },
      },
      UpdateTripRequest: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          requirements: { type: 'string' },
          composition: ref('TripComposition'),
          couponCode: { type: 'string' },
        },
      },

      InitiatePaymentRequest: {
        type: 'object',
        required: ['bookingReference', 'idempotencyKey'],
        properties: {
          bookingReference: { type: 'string', example: 'PTK-2026-000123' },
          amount: { type: 'number', description: 'Optional; server validates against the booking balance' },
          method: { type: 'string', enum: ['card', 'bkash', 'nagad', 'rocket', 'bank', 'sslcommerz'], default: 'card' },
          gateway: { type: 'string', enum: ['demo', 'sslcommerz', 'bkash'] },
          idempotencyKey: { type: 'string', minLength: 8, maxLength: 120 },
        },
      },
      RefundRequest: {
        type: 'object',
        required: ['bookingReference', 'reason'],
        properties: {
          bookingReference: { type: 'string' },
          amount: { type: 'number' },
          reason: { type: 'string', minLength: 3, maxLength: 500 },
        },
      },
      RefundDecisionRequest: {
        type: 'object',
        properties: { notes: { type: 'string', maxLength: 500 }, providerRefundId: { type: 'string', maxLength: 120 } },
      },
      PayoutRequest: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', exclusiveMinimum: 0 },
          method: { type: 'string', enum: ['bkash', 'nagad', 'bank', 'cash'], default: 'bkash' },
          notes: { type: 'string', maxLength: 500 },
        },
      },
      PayoutActionRequest: {
        type: 'object',
        properties: { reference: { type: 'string', maxLength: 120 }, notes: { type: 'string', maxLength: 500 } },
      },

      ReviewRequest: {
        type: 'object',
        required: ['bookingId', 'targetType', 'targetId', 'rating'],
        properties: {
          bookingId: { type: 'integer' },
          targetType: { type: 'string', enum: ['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION'] },
          targetId: { type: 'integer' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string', maxLength: 160 },
          comment: { type: 'string', maxLength: 3000 },
        },
      },
      ReviewReplyRequest: { type: 'object', required: ['reply'], properties: { reply: { type: 'string', minLength: 2, maxLength: 3000 } } },
      ReviewModerationRequest: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['APPROVED', 'REJECTED'] } } },
      MessageRequest: {
        type: 'object',
        required: ['body'],
        properties: {
          bookingId: { type: 'integer' },
          body: { type: 'string', maxLength: 4000 },
          recipientId: { type: 'integer' },
        },
      },

      ProviderDecisionRequest: {
        type: 'object',
        properties: { reason: { type: 'string', maxLength: 500 }, commissionRate: { type: 'number', minimum: 0, maximum: 100 } },
      },
      DocumentDecisionRequest: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] }, notes: { type: 'string', maxLength: 500 } },
      },
      UserStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'] },
          reason: { type: 'string', maxLength: 500 },
        },
      },
      UserRolesRequest: {
        type: 'object',
        required: ['roles'],
        properties: {
          roles: { type: 'array', minItems: 1, items: { type: 'string', enum: ['ADMIN', 'HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE', 'CUSTOMER'] } },
        },
      },
      CouponRequest: {
        type: 'object',
        required: ['code', 'type', 'value'],
        properties: {
          code: { type: 'string', minLength: 3, maxLength: 40 },
          description: { type: 'string' },
          type: { type: 'string', enum: ['PERCENT', 'FIXED'] },
          value: { type: 'number', exclusiveMinimum: 0 },
          minSpend: { type: 'number', default: 0 },
          maxDiscount: { type: 'number' },
          usageLimit: { type: 'integer' },
          perUserLimit: { type: 'integer', default: 1 },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          isActive: { type: 'boolean', default: true },
        },
      },
      BlogRequest: {
        type: 'object',
        required: ['title'],
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          titleBn: { type: 'string' },
          excerpt: { type: 'string' },
          content: { type: 'string' },
          coverImage: { type: 'string' },
          authorName: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] },
          publishedAt: { type: 'string', format: 'date-time' },
        },
      },
      DestinationRequest: {
        type: 'object',
        required: ['name', 'districtId'],
        properties: {
          name: { type: 'string' },
          nameBn: { type: 'string' },
          districtId: { type: 'integer' },
          categoryId: { type: 'integer' },
          summary: { type: 'string' },
          description: { type: 'string' },
          coverImage: { type: 'string' },
          gallery: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
          featured: { type: 'boolean' },
        },
      },
      PackageRequest: {
        type: 'object',
        required: ['title', 'durationDays', 'durationNights', 'pricePerPerson'],
        properties: {
          title: { type: 'string' },
          titleBn: { type: 'string' },
          slug: { type: 'string' },
          summary: { type: 'string' },
          description: { type: 'string' },
          coverImage: { type: 'string' },
          gallery: { type: 'array', items: { type: 'string' } },
          durationDays: { type: 'integer' },
          durationNights: { type: 'integer' },
          pricePerPerson: { type: 'number' },
          childPrice: { type: 'number' },
          maxCapacity: { type: 'integer', default: 20 },
          includes: { type: 'array', items: { type: 'string' } },
          excludes: { type: 'array', items: { type: 'string' } },
          highlights: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
          featured: { type: 'boolean' },
          itineraries: {
            type: 'array',
            items: {
              type: 'object',
              required: ['title'],
              properties: {
                day: { type: 'integer' },
                title: { type: 'string' },
                description: { type: 'string' },
                meals: { type: 'array', items: { type: 'string' } },
                accommodation: { type: 'string' },
              },
            },
          },
          destinationIds: { type: 'array', items: { type: 'integer' } },
          departures: {
            type: 'array',
            items: {
              type: 'object',
              required: ['startDate', 'endDate', 'capacity'],
              properties: {
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                capacity: { type: 'integer' },
                price: { type: 'number' },
              },
            },
          },
        },
      },

      ProviderProfileRequest: {
        type: 'object',
        properties: {
          businessName: { type: 'string' },
          description: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          logo: { type: 'string' },
        },
      },
      DocumentUploadRequest: {
        type: 'object',
        required: ['file', 'type'],
        properties: {
          file: { type: 'string', format: 'binary' },
          type: { type: 'string', description: 'Document type, e.g. trade_license or nid' },
        },
      },
      HotelRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          destinationId: { type: 'integer' },
          description: { type: 'string' },
          starRating: { type: 'integer', minimum: 1, maximum: 5 },
          address: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
          checkInTime: { type: 'string', example: '14:00' },
          checkOutTime: { type: 'string', example: '11:00' },
          image: { type: 'string' },
          gallery: { type: 'array', items: { type: 'string' } },
          facilities: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED'] },
        },
      },
      RoomRequest: {
        type: 'object',
        required: ['name', 'basePrice', 'totalUnits'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          roomType: { type: 'string', enum: ['SINGLE', 'DOUBLE', 'TWIN', 'SUITE', 'FAMILY', 'DORMITORY'] },
          capacityAdults: { type: 'integer' },
          capacityChildren: { type: 'integer' },
          basePrice: { type: 'number', exclusiveMinimum: 0 },
          extraBedPrice: { type: 'number' },
          totalUnits: { type: 'integer', minimum: 1 },
          minStayNights: { type: 'integer' },
          maxStayNights: { type: 'integer' },
          image: { type: 'string' },
          amenities: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        },
      },
      RoomAvailabilityRequest: {
        type: 'object',
        required: ['dates'],
        properties: {
          dates: {
            type: 'array',
            maxItems: 90,
            items: {
              type: 'object',
              required: ['date'],
              properties: {
                date: { type: 'string', format: 'date' },
                totalUnits: { type: 'integer', minimum: 0 },
                isBlocked: { type: 'boolean' },
                priceOverride: { type: 'number', nullable: true },
              },
            },
          },
        },
      },
      VehicleRequest: {
        type: 'object',
        required: ['name', 'registrationNo', 'capacity'],
        properties: {
          name: { type: 'string' },
          model: { type: 'string' },
          registrationNo: { type: 'string' },
          categoryId: { type: 'integer' },
          categoryCode: { type: 'string' },
          capacity: { type: 'integer' },
          pricePerDay: { type: 'number' },
          pricePerKm: { type: 'number' },
          image: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          driverIncluded: { type: 'boolean' },
          status: { type: 'string', enum: ['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'PENDING_REVIEW'] },
        },
      },
      DriverRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          licenseNo: { type: 'string' },
          licenseExpiry: { type: 'string', format: 'date' },
          photo: { type: 'string' },
          vehicleId: { type: 'integer', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
        },
      },
      GuideRequest: {
        type: 'object',
        required: ['dailyRate'],
        properties: {
          bio: { type: 'string' },
          languages: { type: 'array', items: { type: 'string' } },
          expertise: { type: 'array', items: { type: 'string' } },
          yearsExperience: { type: 'integer' },
          dailyRate: { type: 'number', exclusiveMinimum: 0 },
          hourlyRate: { type: 'number' },
          serviceLocations: { type: 'array', items: { type: 'string' } },
          photo: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PENDING_REVIEW'] },
        },
      },
      AvailabilityToggleRequest: {
        type: 'object',
        required: ['dates'],
        properties: {
          dates: {
            type: 'array',
            maxItems: 90,
            items: {
              type: 'object',
              required: ['date', 'status'],
              properties: {
                date: { type: 'string', format: 'date' },
                status: { type: 'string', enum: ['AVAILABLE', 'BLOCKED'] },
              },
            },
          },
        },
      },
    },
  },
  paths,
};

module.exports = openapi;
