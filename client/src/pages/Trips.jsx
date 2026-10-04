import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import { formatDate, formatINR } from '../utils/format.js';

export default function Trips() {
  const location = useLocation();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () =>
    api
      .get('/bookings/mine')
      .then(({ data }) => setBookings(data))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!bookingToCancel) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !cancelling) {
        setBookingToCancel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingToCancel, cancelling]);

  const confirmCancel = async () => {
    if (!bookingToCancel) return;
    setCancelling(true);
    try {
      await api.patch(`/bookings/${bookingToCancel._id}/cancel`);
      setBookingToCancel(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
      setBookingToCancel(null);
    } finally {
      setCancelling(false);
    }
  };

  if (!bookings && !error) return <Loader />;

  return (
    <section>
      <h1>My Trips</h1>
      {location.state?.booked && <p className="success">Booking request sent to the host!</p>}
      {error && <p className="error">{error}</p>}
      {bookings?.length === 0 && (
        <p className="muted">No trips yet. <Link to="/">Find a stay</Link></p>
      )}
      <div className="trip-list">
        {bookings?.map((b) => (
          <div key={b._id} className="card trip">
            <img src={b.listing?.images?.[0]} alt={b.listing?.title} />
            <div className="grow">
              <Link to={`/stays/${b.listing?._id}`}><strong>{b.listing?.title}</strong></Link>
              <p className="muted">{b.listing?.city}</p>
              <p>
                {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} night{b.nights > 1 ? 's' : ''} · {b.guests} guest{b.guests > 1 ? 's' : ''}
              </p>
            </div>
            <div className="trip-side">
              <span className={`status status-${b.status}`}>{b.status}</span>
              <strong>{formatINR(b.totalPrice)}</strong>
              {['pending', 'confirmed'].includes(b.status) && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setBookingToCancel(b)}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {bookingToCancel && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          aria-describedby="cancel-dialog-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelling) {
              setBookingToCancel(null);
            }
          }}
        >
          <div className="modal">
            <h2 id="cancel-dialog-title">Cancel Reservation</h2>
            <p id="cancel-dialog-desc" className="muted">
              Are you sure you want to cancel your trip to{' '}
              <strong>{bookingToCancel.listing?.title}</strong>?
            </p>
            <div className="modal-details">
              <div>
                <span className="muted small">Stay:</span>{' '}
                <strong>{bookingToCancel.listing?.title}</strong>
              </div>
              <div>
                <span className="muted small">Check-in:</span>{' '}
                <strong>{formatDate(bookingToCancel.checkIn)}</strong>
              </div>
              <div>
                <span className="muted small">Check-out:</span>{' '}
                <strong>{formatDate(bookingToCancel.checkOut)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBookingToCancel(null)}
                disabled={cancelling}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmCancel}
                disabled={cancelling}
                autoFocus
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
