import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-50 text-primary-600">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-primary-600">404</p>
      <h1 className="mt-2 text-3xl font-extrabold text-ink-900">This path does not exist</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        The page may have moved, or the link may be out of date. Start from the destinations or build a trip instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button as={Link} to="/">Back to home</Button>
        <Button as={Link} to="/destinations" variant="outline">Browse destinations</Button>
        <Button as={Link} to="/plan" variant="outline">Plan a trip</Button>
      </div>
    </div>
  );
}
