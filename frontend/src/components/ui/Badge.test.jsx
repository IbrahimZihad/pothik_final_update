import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Badge, { StatusBadge } from './Badge';
import Rating, { RatingInput } from './Rating';

describe('Badge', () => {
  it('renders a status label with the right tone', () => {
    render(<StatusBadge status="AWAITING_PAYMENT" />);
    const badge = screen.getByText('awaiting payment');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-orange-50');
  });

  it('omits an empty status', () => {
    const { container } = render(<StatusBadge status={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders custom content', () => {
    render(<Badge tone="primary">Verified</Badge>);
    expect(screen.getByText('Verified').className).toContain('bg-primary-50');
  });
});

describe('Rating', () => {
  it('exposes an accessible rating and count', () => {
    render(<Rating value={4.5} count={12} />);
    expect(screen.getByLabelText('Rated 4.5 out of 5')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('reports the chosen star from RatingInput', () => {
    const onChange = vi.fn();
    render(<RatingInput value={2} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
