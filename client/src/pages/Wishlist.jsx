import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import ListingCard from '../components/ListingCard.jsx';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Wishlist() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api
      .get('/wishlist')
      .then(({ data }) => setListings(Array.isArray(data) ? data : []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) {
      load();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <section>
        <h1>My Wishlist</h1>
        <p className="muted">
          Please <Link to="/login" state={{ from: '/wishlist' }}>log in</Link> to view your saved stays.
        </p>
      </section>
    );
  }

  if (loading) return <Loader />;

  return (
    <section>
      <h1>My Wishlist</h1>
      {error && <p className="error">{error}</p>}
      {!error && listings.length === 0 ? (
        <div className="empty">
          <p className="muted">You haven't saved any stays yet.</p>
          <p className="muted small">Click the heart icon on any stay to save it here for later.</p>
          <div style={{ marginTop: '16px' }}>
            <Link to="/" className="btn">
              Explore Stays
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid">
          {listings.map((l) => (
            <ListingCard
              key={l._id}
              listing={l}
              onToggleWishlist={(toggledId) => {
                setListings((prev) => prev.filter((item) => item._id !== toggledId));
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
