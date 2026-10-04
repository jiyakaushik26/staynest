import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';
import Booking from '../src/models/Booking.js';
import Review from '../src/models/Review.js';
import generateToken from '../src/utils/generateToken.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

describe('Listing Soft Deletion and Orphan Protection (Issue #16)', () => {
  let mongoServer;
  let hostUser;
  let otherHostUser;
  let guestUser;
  let hostToken;
  let otherHostToken;
  let guestToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    hostUser = await User.create({
      name: 'Owner Host',
      email: 'host1@staynest.test',
      password: 'password123',
      role: 'host',
    });

    otherHostUser = await User.create({
      name: 'Other Host',
      email: 'host2@staynest.test',
      password: 'password123',
      role: 'host',
    });

    guestUser = await User.create({
      name: 'Test Guest',
      email: 'guest@staynest.test',
      password: 'password123',
      role: 'guest',
    });

    hostToken = generateToken(hostUser._id);
    otherHostToken = generateToken(otherHostUser._id);
    guestToken = generateToken(guestUser._id);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Booking.deleteMany({});
    await Review.deleteMany({});
    await Listing.deleteMany({});
  });

  const createTestListing = (overrides = {}) =>
    Listing.create({
      title: 'Serene Villa',
      description: 'A beautiful luxury villa',
      type: 'villa',
      city: 'Udaipur',
      state: 'Rajasthan',
      address: 'Near Lake Pichola',
      pricePerNight: 5000,
      maxGuests: 4,
      host: hostUser._id,
      isActive: true,
      ...overrides,
    });

  it('soft deletion keeps the MongoDB listing document and sets isActive=false', async () => {
    const listing = await createTestListing();

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Listing deleted' });

    // Document is NOT deleted from MongoDB
    const dbListing = await Listing.findById(listing._id);
    expect(dbListing).not.toBeNull();
    expect(dbListing.isActive).toBe(false);
  });

  it('upcoming confirmed booking blocks deletion with HTTP 400', async () => {
    const listing = await createTestListing();

    // Create upcoming confirmed booking
    const checkIn = new Date(Date.now() + 86400000); // tomorrow
    const checkOut = new Date(Date.now() + 86400000 * 3); // 3 days later
    await Booking.create({
      listing: listing._id,
      guest: guestUser._id,
      checkIn,
      checkOut,
      guests: 2,
      nights: 2,
      totalPrice: 10000,
      status: 'confirmed',
    });

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cannot delete listing with upcoming confirmed bookings');

    // Listing remains active
    const dbListing = await Listing.findById(listing._id);
    expect(dbListing.isActive).toBe(true);
  });

  it('past confirmed booking allows deletion', async () => {
    const listing = await createTestListing();

    // Past booking (ended in the past)
    const checkIn = new Date(Date.now() - 86400000 * 5);
    const checkOut = new Date(Date.now() - 86400000 * 2);
    await Booking.create({
      listing: listing._id,
      guest: guestUser._id,
      checkIn,
      checkOut,
      guests: 2,
      nights: 3,
      totalPrice: 15000,
      status: 'confirmed',
    });

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Listing deleted');

    const dbListing = await Listing.findById(listing._id);
    expect(dbListing.isActive).toBe(false);
  });

  it('cancelled or completed bookings allow deletion even if in future or past', async () => {
    const listing = await createTestListing();

    // Cancelled future booking
    const checkIn = new Date(Date.now() + 86400000);
    const checkOut = new Date(Date.now() + 86400000 * 2);
    await Booking.create({
      listing: listing._id,
      guest: guestUser._id,
      checkIn,
      checkOut,
      guests: 2,
      nights: 1,
      totalPrice: 5000,
      status: 'cancelled',
    });

    // Completed past booking
    await Booking.create({
      listing: listing._id,
      guest: guestUser._id,
      checkIn: new Date(Date.now() - 86400000 * 4),
      checkOut: new Date(Date.now() - 86400000 * 2),
      guests: 2,
      nights: 2,
      totalPrice: 10000,
      status: 'completed',
    });

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Listing deleted');

    const dbListing = await Listing.findById(listing._id);
    expect(dbListing.isActive).toBe(false);
  });

  it('existing bookings remain intact after soft deletion', async () => {
    const listing = await createTestListing();

    const booking = await Booking.create({
      listing: listing._id,
      guest: guestUser._id,
      checkIn: new Date(Date.now() - 86400000 * 3),
      checkOut: new Date(Date.now() - 86400000 * 1),
      guests: 2,
      nights: 2,
      totalPrice: 10000,
      status: 'completed',
    });

    await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    const dbBooking = await Booking.findById(booking._id).populate('listing');
    expect(dbBooking).not.toBeNull();
    expect(dbBooking.listing).not.toBeNull();
    expect(dbBooking.listing.title).toBe('Serene Villa');
    expect(dbBooking.listing.isActive).toBe(false);
  });

  it('existing reviews remain intact after soft deletion', async () => {
    const listing = await createTestListing();

    const review = await Review.create({
      listing: listing._id,
      user: guestUser._id,
      rating: 5,
      comment: 'Unforgettable stay!',
    });

    await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    const dbReview = await Review.findById(review._id);
    expect(dbReview).not.toBeNull();
    expect(dbReview.comment).toBe('Unforgettable stay!');
    expect(dbReview.listing.toString()).toBe(listing._id.toString());
  });

  it('soft-deleted listing is hidden from public listing results', async () => {
    const activeListing = await createTestListing({ title: 'Active Listing' });
    const deletedListing = await createTestListing({ title: 'Deleted Listing' });

    await request(app)
      .delete(`/api/listings/${deletedListing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);

    const ids = res.body.map((l) => l._id.toString());
    expect(ids).toContain(activeListing._id.toString());
    expect(ids).not.toContain(deletedListing._id.toString());
  });

  it('soft-deleted listing returns 404 from direct GET', async () => {
    const listing = await createTestListing();

    await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    const res = await request(app).get(`/api/listings/${listing._id}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Listing not found');
  });

  it('guest cannot delete a listing (HTTP 403)', async () => {
    const listing = await createTestListing();

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${guestToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only hosts can do this/i);

    const dbListing = await Listing.findById(listing._id);
    expect(dbListing.isActive).toBe(true);
  });

  it("another host cannot delete someone else's listing (HTTP 403)", async () => {
    const listing = await createTestListing();

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', `Bearer ${otherHostToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You can only manage your own listings');

    const dbListing = await Listing.findById(listing._id);
    expect(dbListing.isActive).toBe(true);
  });
});
