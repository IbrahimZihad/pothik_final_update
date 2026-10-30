import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Car, Clock, MapPin, Star, Users } from 'lucide-react';
import SmartImage from '../ui/SmartImage';
import Rating from '../ui/Rating';
import Badge from '../ui/Badge';
import { formatCurrency, pluralize } from '../../lib/format';

export function DestinationCard({ destination }) {
  return (
    <Link
      to={`/destinations/${destination.slug}`}
      className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float"
    >
      <SmartImage src={destination.coverImage} alt={destination.name} wrapperClassName="h-48 w-full" className="h-48 w-full object-cover transition duration-500 group-hover:scale-105" />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-ink-900 group-hover:text-primary-700">{destination.name}</h3>
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-600" aria-hidden="true" />
        </div>
        {destination.district && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {destination.district.name}
            {destination.district.division ? `, ${destination.district.division}` : ''}
          </p>
        )}
        <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-slate-600">{destination.summary}</p>
        <div className="mt-3 flex items-center justify-between">
          <Rating value={destination.ratingAvg} count={destination.ratingCount} />
          {destination.category && <Badge tone="primary">{destination.category.name}</Badge>}
        </div>
      </div>
    </Link>
  );
}

export function PackageCard({ pkg }) {
  return (
    <Link to={`/packages/${pkg.slug}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="relative">
        <SmartImage src={pkg.coverImage} alt={pkg.title} wrapperClassName="h-48 w-full" className="h-48 w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink-900 shadow-sm">
            {pkg.durationDays}D / {pkg.durationNights}N
          </span>
          {pkg.featured && <span className="rounded-full bg-secondary-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">Featured</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-ink-900 group-hover:text-primary-700">{pkg.title}</h3>
        {pkg.destinations?.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {pkg.destinations.map((d) => d.name).join(' · ')}
          </p>
        )}
        <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">{pkg.summary}</p>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">From</p>
            <p className="text-lg font-extrabold text-ink-900">{formatCurrency(pkg.pricePerPerson)}</p>
            <p className="text-[11px] text-slate-500">per person</p>
          </div>
          <Rating value={pkg.ratingAvg} count={pkg.ratingCount} />
        </div>
      </div>
    </Link>
  );
}

export function HotelCard({ hotel }) {
  return (
    <Link to={`/hotels/${hotel.slug}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="relative">
        <SmartImage src={hotel.image} alt={hotel.name} wrapperClassName="h-44 w-full" className="h-44 w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-amber-600 shadow-sm">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
          {hotel.starRating || 3}-star
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-ink-900 group-hover:text-primary-700">{hotel.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {hotel.destination?.name || hotel.address || 'Bangladesh'}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(hotel.facilities || []).slice(0, 3).map((facility) => (
            <span key={facility} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {facility}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-1 items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-lg font-extrabold text-ink-900">{formatCurrency(hotel.minPrice ?? 0)}</p>
            <p className="text-[11px] text-slate-500">per night</p>
          </div>
          <Rating value={hotel.rating?.average} count={hotel.rating?.count} />
        </div>
      </div>
    </Link>
  );
}

export function VehicleCard({ vehicle }) {
  return (
    <Link to={`/transport/${vehicle.id}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float">
      <SmartImage src={vehicle.image} alt={vehicle.name} wrapperClassName="h-40 w-full" className="h-40 w-full object-cover transition duration-500 group-hover:scale-105" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-ink-900 group-hover:text-primary-700">{vehicle.name}</h3>
          {vehicle.category && <Badge tone="primary">{vehicle.category.name}</Badge>}
        </div>
        <p className="mt-1 text-xs font-medium text-slate-500">
          {vehicle.provider?.businessName || 'Verified operator'} {vehicle.model ? `· ${vehicle.model}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" /> {vehicle.capacity} seats
          </span>
          <span className="inline-flex items-center gap-1">
            <Car className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" /> {vehicle.driverIncluded ? 'Driver included' : 'Self drive'}
          </span>
        </div>
        <div className="mt-4 flex flex-1 items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-lg font-extrabold text-ink-900">{formatCurrency(vehicle.pricePerDay)}</p>
            <p className="text-[11px] text-slate-500">per day{vehicle.pricePerKm ? ` + ৳${vehicle.pricePerKm}/km` : ''}</p>
          </div>
          <Rating value={vehicle.rating?.average} count={vehicle.rating?.count} />
        </div>
      </div>
    </Link>
  );
}

export function GuideCard({ guide }) {
  return (
    <Link to={`/guides/${guide.id}`} className="group card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="flex items-start gap-3">
        <SmartImage
          src={guide.photo}
          alt={guide.provider?.businessName || 'Tour guide'}
          wrapperClassName="h-16 w-16 shrink-0 rounded-2xl"
          className="h-16 w-16 rounded-2xl object-cover"
        />
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink-900 group-hover:text-primary-700">{guide.provider?.businessName || 'Local guide'}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {pluralize(guide.yearsExperience || 0, 'year')} experience
          </p>
          <Rating value={guide.rating?.average} count={guide.rating?.count} className="mt-1.5" />
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{guide.bio || 'Local guide for custom Bangladesh itineraries.'}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(guide.languages || []).slice(0, 3).map((language) => (
          <span key={language} className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
            {language}
          </span>
        ))}
        {(guide.expertise || []).slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
        <div>
          <p className="text-lg font-extrabold text-ink-900">{formatCurrency(guide.dailyRate)}</p>
          <p className="text-[11px] text-slate-500">per day</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Check dates
        </span>
      </div>
    </Link>
  );
}

export function BlogCard({ post }) {
  return (
    <Link to={`/journal/${post.slug}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float">
      <SmartImage src={post.coverImage} alt={post.title} wrapperClassName="h-44 w-full" className="h-44 w-full object-cover transition duration-500 group-hover:scale-105" />
      <div className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-600">
          {post.author || 'POTHIK journal'}
          {post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </p>
        <h3 className="mt-2 text-base font-bold text-ink-900 group-hover:text-primary-700">{post.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.excerpt}</p>
      </div>
    </Link>
  );
}
