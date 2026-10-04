import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';
import Review from '../src/models/Review.js';
import Booking from '../src/models/Booking.js';
import generateToken from '../src/utils/generateToken.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

describe('Review Edit and Delete API', () => {
  let mongoServer;
  let hostUser;
  let guestUser1;
  let guestUser2;
  let guestToken1;
  let guestToken2;
  let listing;
  let otherListing;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    hostUser = await User.create({
      name: 'Host User',
      email: 'host@staynest.test',
      password: 'password123',
      role: 'host',
    });

    guestUser1 = await User.create({
      name: 'Guest One',
      email: 'guest1@staynest.test',
      password: 'password123',
      role: 'guest',
    });

    guestUser2 = await User.create({
      name: 'Guest Two',
      email: 'guest2@staynest.test',
      password: 'password123',
      role: 'guest',
    });

    guestToken1 = generateToken(guestUser1._id);
    guestToken2 = generateToken(guestUser2._id);

    listing = await Listing.create({
      title: 'Sunrise Beach Villa',
      description: 'Stunning villa by the sea',
      type: 'villa',
      city: 'Goa',
      state: 'Goa',
      address: 'Anjuna Beach',
      pricePerNight: 8000,
      maxGuests: 6,
      host: hostUser._id,
      isActive: true,
    });

    otherListing = await Listing.create({
      title: 'Mountain Retreat',
      description: 'Quiet cabin in the hills',
      type: 'cottage',
      city: 'Manali',
      state: 'Himachal Pradesh',
      address: 'Old Manali',
      pricePerNight: 3000,
      maxGuests: 4,
      host: hostUser._id,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Review.deleteMany({});
    listing.avgRating = 0;
    listing.reviewCount = 0;
    await listing.save();
  });

  describe('PUT /api/listings/:id/reviews/:reviewId', () => {
    it('allows author to edit their own review and recalculates listing avgRating', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 3,
        comment: 'Average stay.',
      });

      // Recalculate initially
      const stats = await Review.aggregate([
        { $match: { listing: listing._id } },
        { $group: { _id: '$listing', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      listing.avgRating = stats[0].avg;
      listing.reviewCount = stats[0].count;
      await listing.save();

      const res = await request(app)
        .put(`/api/listings/${listing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({ rating: 5, comment: 'Updated: Actually fantastic stay!' });

      expect(res.status).toBe(200);
      expect(res.body.rating).toBe(5);
      expect(res.body.comment).toBe('Updated: Actually fantastic stay!');

      const updatedListing = await Listing.findById(listing._id);
      expect(updatedListing.avgRating).toBe(5);
      expect(updatedListing.reviewCount).toBe(1);
    });

    it('rejects edit from a user who is not the author (HTTP 403)', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 4,
        comment: 'Nice place.',
      });

      const res = await request(app)
        .put(`/api/listings/${listing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken2}`)
        .send({ rating: 1, comment: 'Hacked comment' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only edit your own review/i);
    });

    it('rejects edit with invalid rating (HTTP 400)', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 4,
        comment: 'Great.',
      });

      const res = await request(app)
        .put(`/api/listings/${listing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({ rating: 6, comment: 'Invalid rating' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/between 1 and 5/i);
    });

    it('rejects edit when review does not belong to listing (HTTP 400)', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 4,
        comment: 'Great.',
      });

      const res = await request(app)
        .put(`/api/listings/${otherListing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({ rating: 5, comment: 'Mismatched listing' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to this listing/i);
    });
  });

  describe('DELETE /api/listings/:id/reviews/:reviewId', () => {
    it('allows author to delete review and recalculates listing rating to 0 when all reviews deleted', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 4,
        comment: 'Will delete this.',
      });

      listing.avgRating = 4;
      listing.reviewCount = 1;
      await listing.save();

      const res = await request(app)
        .delete(`/api/listings/${listing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/review deleted/i);

      const dbReview = await Review.findById(review._id);
      expect(dbReview).toBeNull();

      const updatedListing = await Listing.findById(listing._id);
      expect(updatedListing.avgRating).toBe(0);
      expect(updatedListing.reviewCount).toBe(0);
    });

    it('recalculates avgRating correctly when one of multiple reviews is deleted', async () => {
      const review1 = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 2,
        comment: 'Not great.',
      });

      const review2 = await Review.create({
        listing: listing._id,
        user: guestUser2._id,
        rating: 4,
        comment: 'Pretty good.',
      });

      listing.avgRating = 3;
      listing.reviewCount = 2;
      await listing.save();

      const res = await request(app)
        .delete(`/api/listings/${listing._id}/reviews/${review1._id}`)
        .set('Authorization', `Bearer ${guestToken1}`);

      expect(res.status).toBe(200);

      const updatedListing = await Listing.findById(listing._id);
      expect(updatedListing.avgRating).toBe(4);
      expect(updatedListing.reviewCount).toBe(1);
    });

    it('rejects delete from a user who is not the author (HTTP 403)', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 4,
        comment: 'Nice place.',
      });

      const res = await request(app)
        .delete(`/api/listings/${listing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken2}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only delete your own review/i);
    });

    it('rejects delete when review does not belong to listing (HTTP 400)', async () => {
      const review = await Review.create({
        listing: listing._id,
        user: guestUser1._id,
        rating: 4,
        comment: 'Nice place.',
      });

      const res = await request(app)
        .delete(`/api/listings/${otherListing._id}/reviews/${review._id}`)
        .set('Authorization', `Bearer ${guestToken1}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to this listing/i);
    });
  });
});
