import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute, { GuestRoute } from './routes/ProtectedRoute';
import Home from './pages/Home';
import Destinations from './pages/Destinations';
import DestinationDetail from './pages/DestinationDetail';
import Packages from './pages/Packages';
import PackageDetail from './pages/PackageDetail';
import Hotels from './pages/Hotels';
import HotelDetail from './pages/HotelDetail';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Guides from './pages/Guides';
import GuideDetail from './pages/GuideDetail';
import Blogs from './pages/Blogs';
import BlogDetail from './pages/BlogDetail';
import Search from './pages/Search';
import TripBuilder from './pages/TripBuilder';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import About from './pages/About';
import Contact from './pages/Contact';
import Help from './pages/Help';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';

import AccountDashboard from './pages/account/Dashboard';
import AccountBookings from './pages/account/Bookings';
import AccountBookingDetail from './pages/account/BookingDetail';
import AccountPay from './pages/account/Pay';
import AccountNotifications from './pages/account/Notifications';
import AccountProfile from './pages/account/Profile';

import ProviderDashboard from './pages/provider/Dashboard';
import ProviderBookings from './pages/provider/Bookings';
import ProviderBookingDetail from './pages/provider/BookingDetail';
import ProviderFinance from './pages/provider/Finance';
import ProviderProfile from './pages/provider/Profile';
import ProviderHotels from './pages/provider/Hotels';
import ProviderHotelEditor from './pages/provider/HotelEditor';
import ProviderVehicles from './pages/provider/Vehicles';
import ProviderDrivers from './pages/provider/Drivers';
import ProviderGuide from './pages/provider/Guide';

import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminProviders from './pages/admin/Providers';
import AdminBookings from './pages/admin/Bookings';
import AdminBookingDetail from './pages/admin/BookingDetail';
import AdminFinance from './pages/admin/Finance';
import AdminCoupons from './pages/admin/Coupons';
import AdminReviews from './pages/admin/Reviews';
import AdminBlogs from './pages/admin/Blogs';
import AdminAudit from './pages/admin/Audit';

import DemoCheckout from './pages/pay/DemoCheckout';

const CUSTOMER_ROLES = ['CUSTOMER'];
const PROVIDER_ROLES = ['HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE'];
const ADMIN_ROLES = ['ADMIN'];

const guard = (roles, element) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="destinations" element={<Destinations />} />
        <Route path="destinations/:slug" element={<DestinationDetail />} />
        <Route path="packages" element={<Packages />} />
        <Route path="packages/:slug" element={<PackageDetail />} />
        <Route path="hotels" element={<Hotels />} />
        <Route path="hotels/:slug" element={<HotelDetail />} />
        <Route path="transport" element={<Vehicles />} />
        <Route path="transport/:id" element={<VehicleDetail />} />
        <Route path="guides" element={<Guides />} />
        <Route path="guides/:id" element={<GuideDetail />} />
        <Route path="journal" element={<Blogs />} />
        <Route path="journal/:slug" element={<BlogDetail />} />
        <Route path="search" element={<Search />} />
        <Route path="plan" element={<TripBuilder />} />
        <Route path="pay/demo/:paymentId" element={guard(CUSTOMER_ROLES, <DemoCheckout />)} />
        <Route path="login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="help" element={<Help />} />
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/account" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={guard(CUSTOMER_ROLES, <AccountDashboard />)} />
        <Route path="bookings" element={guard(CUSTOMER_ROLES, <AccountBookings />)} />
        <Route path="bookings/:reference" element={guard(CUSTOMER_ROLES, <AccountBookingDetail />)} />
        <Route path="bookings/:reference/pay" element={guard(CUSTOMER_ROLES, <AccountPay />)} />
        <Route path="notifications" element={guard(CUSTOMER_ROLES, <AccountNotifications />)} />
        <Route path="profile" element={guard(CUSTOMER_ROLES, <AccountProfile />)} />
      </Route>

      <Route path="/provider" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={guard(PROVIDER_ROLES, <ProviderDashboard />)} />
        <Route path="bookings" element={guard(PROVIDER_ROLES, <ProviderBookings />)} />
        <Route path="bookings/:reference" element={guard(PROVIDER_ROLES, <ProviderBookingDetail />)} />
        <Route path="finance" element={guard(PROVIDER_ROLES, <ProviderFinance />)} />
        <Route path="profile" element={guard(PROVIDER_ROLES, <ProviderProfile />)} />
        <Route path="hotels" element={guard(PROVIDER_ROLES, <ProviderHotels />)} />
        <Route path="hotels/:hotelId" element={guard(PROVIDER_ROLES, <ProviderHotelEditor />)} />
        <Route path="vehicles" element={guard(PROVIDER_ROLES, <ProviderVehicles />)} />
        <Route path="drivers" element={guard(PROVIDER_ROLES, <ProviderDrivers />)} />
        <Route path="guide" element={guard(PROVIDER_ROLES, <ProviderGuide />)} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={guard(ADMIN_ROLES, <AdminDashboard />)} />
        <Route path="users" element={guard(ADMIN_ROLES, <AdminUsers />)} />
        <Route path="providers" element={guard(ADMIN_ROLES, <AdminProviders />)} />
        <Route path="bookings" element={guard(ADMIN_ROLES, <AdminBookings />)} />
        <Route path="bookings/:reference" element={guard(ADMIN_ROLES, <AdminBookingDetail />)} />
        <Route path="finance" element={guard(ADMIN_ROLES, <AdminFinance />)} />
        <Route path="coupons" element={guard(ADMIN_ROLES, <AdminCoupons />)} />
        <Route path="reviews" element={guard(ADMIN_ROLES, <AdminReviews />)} />
        <Route path="blogs" element={guard(ADMIN_ROLES, <AdminBlogs />)} />
        <Route path="audit" element={guard(ADMIN_ROLES, <AdminAudit />)} />
      </Route>
    </Routes>
  );
}
