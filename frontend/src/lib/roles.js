export const PROVIDER_ROLES = ['HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE'];

export function homeForUser(user) {
  const roles = user?.roles || [];
  if (roles.includes('ADMIN')) return '/admin';
  if (roles.some((role) => PROVIDER_ROLES.includes(role))) return '/provider';
  return '/account';
}

export function canReturnTo(path, user) {
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  const roles = user?.roles || [];
  if (path.startsWith('/admin')) return roles.includes('ADMIN');
  if (path.startsWith('/provider')) return roles.some((role) => PROVIDER_ROLES.includes(role));
  if (path.startsWith('/account') || path.startsWith('/pay/demo')) return roles.includes('CUSTOMER');
  return true;
}
