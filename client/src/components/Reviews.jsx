import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StarRating from './StarRating.jsx';
import { formatDate } from '../utils/format.js';

export default function Reviews({ listingId, onReviewAdded }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [error, setError] = useState('');

  // Editing state for own review
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: '' });
  const [editError, setEditError] = useState('');

  const load = () => api.get(`/listings/${listingId}/reviews`).then(({ data }) => setReviews(data));
  useEffect(() => {
    load();
  }, [listingId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/listings/${listingId}/reviews`, form);
      setForm({ rating: 5, comment: '' });
      await load();
      onReviewAdded?.();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleStartEdit = (r) => {
    setEditingId(r._id);
    setEditForm({ rating: r.rating, comment: r.comment });
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const handleEditSubmit = async (e, reviewId) => {
    e.preventDefault();
    setEditError('');
    try {
      await api.put(`/listings/${listingId}/reviews/${reviewId}`, editForm);
      setEditingId(null);
      await load();
      onReviewAdded?.();
    } catch (err) {
      setEditError(getErrorMessage(err));
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    try {
      await api.delete(`/listings/${listingId}/reviews/${reviewId}`);
      if (editingId === reviewId) setEditingId(null);
      await load();
      onReviewAdded?.();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const userReview = user ? reviews.find((r) => r.user?._id === user._id || r.user === user._id) : null;

  return (
    <section className="reviews">
      <h2>Reviews ({reviews.length})</h2>
      {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
      {reviews.map((r) => {
        const isAuthor = user && (r.user?._id === user._id || r.user === user._id);
        const isEditing = editingId === r._id;

        return (
          <div key={r._id} className="review">
            <div className="row-between">
              <strong>{r.user?.name}</strong>
              <div className="row" style={{ gap: '8px' }}>
                <span className="muted small">{formatDate(r.createdAt)}</span>
                {isAuthor && !isEditing && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleStartEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger btn-sm"
                      onClick={() => handleDelete(r._id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <form
                className="card form"
                style={{ marginTop: '10px', padding: '14px', maxWidth: '100%' }}
                onSubmit={(e) => handleEditSubmit(e, r._id)}
              >
                <h4>Edit your review</h4>
                <StarRating
                  value={editForm.rating}
                  onChange={(rating) => setEditForm({ ...editForm, rating })}
                />
                <textarea
                  required
                  value={editForm.comment}
                  onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                />
                {editError && <p className="error small">{editError}</p>}
                <div className="row">
                  <button type="submit" className="btn btn-sm">Save</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="stars-static">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                <p>{r.comment}</p>
              </>
            )}
          </div>
        );
      })}

      {user && !userReview && (
        <form className="card form" onSubmit={submit}>
          <h3>Write a review</h3>
          <StarRating value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
          <textarea
            required
            placeholder="How was your stay?"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn">Submit review</button>
        </form>
      )}
    </section>
  );
}
