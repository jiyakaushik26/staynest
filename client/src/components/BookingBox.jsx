import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR, nightsBetween } from '../utils/format.js';

export default function BookingBox({ listing }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ checkIn: '', checkOut: '', guests: 1 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const getNextDay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return next.toISOString().split('T')[0];
  };

  const minCheckOut = form.checkIn ? getNextDay(form.checkIn) : getNextDay(today);

  const nights = nightsBetween(form.checkIn, form.checkOut);
  const total = nights * listing.pricePerNight;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleCheckInChange = (e) => {
    const newCheckIn = e.target.value;
    const minOut = getNextDay(newCheckIn);
    setForm((prev) => {
      const isCheckoutInvalid = prev.checkOut && newCheckIn && prev.checkOut < minOut;
      return {
        ...prev,
        checkIn: newCheckIn,
        checkOut: isCheckoutInvalid ? '' : prev.checkOut,
      };
    });
  };

  const book = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login', { state: { from: `/stays/${listing._id}` } });
    setLoading(true);
    setError('');
    try {
      await api.post('/bookings', {
        listingId: listing._id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: Number(form.guests),
      });
      navigate('/trips', { state: { booked: true } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card booking-box" onSubmit={book}>
      <h3>
        {formatINR(listing.pricePerNight)} <span className="muted">/ night</span>
      </h3>
      <div className="row">
        <label className="grow">
          Check-in
          <input
            type="date"
            required
            min={today}
            value={form.checkIn}
            onChange={handleCheckInChange}
          />
        </label>
        <label className="grow">
          Check-out
          <input
            type="date"
            required
            min={minCheckOut}
            value={form.checkOut}
            onChange={set('checkOut')}
          />
        </label>
      </div>
      <label>
        Guests
        <input type="number" min="1" max={listing.maxGuests} value={form.guests} onChange={set('guests')} />
      </label>
      {nights > 0 && (
        <div className="row-between">
          <span>{formatINR(listing.pricePerNight)} × {nights} night{nights > 1 ? 's' : ''}</span>
          <strong>{formatINR(total)}</strong>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn full" disabled={loading}>
        {loading ? 'Booking...' : 'Reserve'}
      </button>
      <p className="muted small">You won't be charged yet. The host will confirm your request.</p>
    </form>
  );
}
