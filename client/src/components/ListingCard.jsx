import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ListingCard({ listing, onToggleWishlist }) {
  const { user, isWishlisted, toggleWishlist } = useAuth();
  const navigate = useNavigate();
  const saved = isWishlisted ? isWishlisted(listing._id) : false;

  const handleHeartClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await toggleWishlist(listing._id);
      if (onToggleWishlist) onToggleWishlist(listing._id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Link to={`/stays/${listing._id}`} className="card listing-card">
      <div className="card-thumb-wrap">
        <img src={listing.images[0]} alt={listing.title} />
        <button
          type="button"
          className={`heart-btn ${saved ? 'active' : ''}`}
          onClick={handleHeartClick}
          aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
          title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke={saved ? 'var(--primary)' : '#ffffff'}
            strokeWidth="2"
            fill={saved ? 'var(--primary)' : 'rgba(0, 0, 0, 0.3)'}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="card-body">
        <div className="row-between">
          <span className="tag">{listing.type}</span>
          <span className="muted">
            {listing.reviewCount > 0 ? `★ ${listing.avgRating} (${listing.reviewCount})` : 'New'}
          </span>
        </div>
        <strong className="listing-title">{listing.title}</strong>
        <span className="muted">{listing.city}, {listing.state}</span>
        <span>
          <strong>{formatINR(listing.pricePerNight)}</strong> <span className="muted">/ night</span>
        </span>
      </div>
    </Link>
  );
}
