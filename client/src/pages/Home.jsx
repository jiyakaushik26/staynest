import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import ListingCard from '../components/ListingCard.jsx';
import Loader from '../components/Loader.jsx';
import { STAY_TYPES } from '../utils/format.js';

const initial = { city: '', type: '', checkIn: '', checkOut: '', guests: '', maxPrice: '' };

export default function Home() {
  const [filters, setFilters] = useState(initial);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const search = (params) => {
    setLoading(true);
    setError('');
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''));
    api
      .get('/listings', { params: clean })
      .then(({ data }) => setListings(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    search(initial);
  }, []);

  const set = (key) => (e) => {
    const val = e.target.value;
    if (key === 'checkIn' && filters.checkOut && val && filters.checkOut < val) {
      setFilters({ ...filters, checkIn: val, checkOut: '' });
    } else {
      setFilters({ ...filters, [key]: val });
    }
  };

  const submit = (e) => {
    e.preventDefault();
    search(filters);
  };

  return (
    <section>
      <div className="hero">
        <h1>Find your next nest.</h1>
        <p className="muted">Homestays, havelis, villas and hostels across India.</p>
        <form className="search-bar card" onSubmit={submit}>
          <input placeholder="Where to? (e.g. Jaipur)" value={filters.city} onChange={set('city')} />
          <select value={filters.type} onChange={set('type')}>
            <option value="">Any type</option>
            {STAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="date"
            min={today}
            value={filters.checkIn}
            onChange={set('checkIn')}
            title="Check-in"
          />
          <input
            type="date"
            min={filters.checkIn || today}
            value={filters.checkOut}
            onChange={set('checkOut')}
            title="Check-out"
          />
          <input type="number" min="1" placeholder="Guests" value={filters.guests} onChange={set('guests')} />
          <input type="number" min="0" placeholder="Max ₹/night" value={filters.maxPrice} onChange={set('maxPrice')} />
          <button className="btn">Search</button>
        </form>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <Loader />
      ) : listings.length === 0 ? (
        <p className="muted">No stays match your search.</p>
      ) : (
        <div className="grid">
          {listings.map((l) => <ListingCard key={l._id} listing={l} />)}
        </div>
      )}
    </section>
  );
}
