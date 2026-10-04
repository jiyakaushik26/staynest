import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';
import Booking from '../src/models/Booking.js';

describe('Availability Search Tests (Issue #13)', () => {
  let mongod;
  let host;
  let guest;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Booking.deleteMany({});
    await Listing.deleteMany({});
    await User.deleteMany({});

    host = await User.create({
      name: 'Host User',
      email: 'host@test.com',
      password: 'password123',
      role: 'host',
    });

    guest = await User.create({
      name: 'Guest User',
      email: 'guest@test.com',
      password: 'password123',
      role: 'guest',
    });
  });

  const createListing = (overrides = {}) => {
    return Listing.create({
      title: 'Comfortable Nest',
      description: 'A cozy home away from home',
      type: 'villa',
      city: 'Jaipur',
      state: 'Rajasthan',
      address: '123 Heritage Lane',
      pricePerNight: 2500,
      maxGuests: 4,
      host: host._id,
      isActive: true,
      ...overrides,
    });
  };

  const createBooking = (listingId, overrides = {}) => {
    return Booking.create({
      listing: listingId,
      guest: guest._id,
      checkIn: new Date('2026-11-10T00:00:00.000Z'),
      checkOut: new Date('2026-11-15T00:00:00.000Z'),
      guests: 2,
      nights: 5,
      totalPrice: 12500,
      status: 'confirmed',
      ...overrides,
    });
  };

  test('1. Search without dates returns active listings normally', async () => {
    const active1 = await createListing({ title: 'Active Listing 1' });
    const active2 = await createListing({ title: 'Active Listing 2' });
    await createListing({ title: 'Inactive Listing', isActive: false });

    const res = await request(app).get('/api/listings').expect(200);

    expect(res.body).toHaveLength(2);
    const titles = res.body.map((l) => l.title);
    expect(titles).toContain(active1.title);
    expect(titles).toContain(active2.title);
    expect(titles).not.toContain('Inactive Listing');
  });

  test('2. Overlapping confirmed booking excludes listing', async () => {
    const listing1 = await createListing({ title: 'Listing 1 Booked' });
    const listing2 = await createListing({ title: 'Listing 2 Free' });

    await createBooking(listing1._id, {
      checkIn: new Date('2026-11-12T00:00:00.000Z'),
      checkOut: new Date('2026-11-14T00:00:00.000Z'),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing2._id.toString());
  });

  test('3. Overlapping pending booking excludes listing', async () => {
    const listing1 = await createListing({ title: 'Listing 1 Pending' });
    const listing2 = await createListing({ title: 'Listing 2 Free' });

    await createBooking(listing1._id, {
      checkIn: new Date('2026-11-12T00:00:00.000Z'),
      checkOut: new Date('2026-11-14T00:00:00.000Z'),
      status: 'pending',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing2._id.toString());
  });

  test('4. Non-overlapping booking before requested range does not exclude listing', async () => {
    const listing = await createListing({ title: 'Listing Prior Booking' });

    await createBooking(listing._id, {
      checkIn: new Date('2026-11-01T00:00:00.000Z'),
      checkOut: new Date('2026-11-05T00:00:00.000Z'),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing._id.toString());
  });

  test('5. Non-overlapping booking after requested range does not exclude listing', async () => {
    const listing = await createListing({ title: 'Listing Later Booking' });

    await createBooking(listing._id, {
      checkIn: new Date('2026-11-20T00:00:00.000Z'),
      checkOut: new Date('2026-11-25T00:00:00.000Z'),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing._id.toString());
  });

  test('6. Booking ending exactly on requested check-in date does NOT exclude listing', async () => {
    const listing = await createListing({ title: 'Listing Checkout on Search Checkin' });

    await createBooking(listing._id, {
      checkIn: new Date('2026-11-05T00:00:00.000Z'),
      checkOut: new Date('2026-11-10T00:00:00.000Z'),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing._id.toString());
  });

  test('7. Booking starting exactly on requested check-out date does NOT exclude listing', async () => {
    const listing = await createListing({ title: 'Listing Checkin on Search Checkout' });

    await createBooking(listing._id, {
      checkIn: new Date('2026-11-15T00:00:00.000Z'),
      checkOut: new Date('2026-11-20T00:00:00.000Z'),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing._id.toString());
  });

  test('8. Cancelled booking does NOT exclude listing', async () => {
    const listing = await createListing({ title: 'Listing with Cancelled Booking' });

    await createBooking(listing._id, {
      checkIn: new Date('2026-11-12T00:00:00.000Z'),
      checkOut: new Date('2026-11-14T00:00:00.000Z'),
      status: 'cancelled',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(listing._id.toString());
  });

  test('9. Combined filters such as city + availability work correctly', async () => {
    const jaipurBooked = await createListing({ title: 'Jaipur Booked', city: 'Jaipur' });
    const jaipurAvailable = await createListing({ title: 'Jaipur Available', city: 'Jaipur' });
    const udaipurAvailable = await createListing({ title: 'Udaipur Available', city: 'Udaipur' });

    await createBooking(jaipurBooked._id, {
      checkIn: new Date('2026-11-11T00:00:00.000Z'),
      checkOut: new Date('2026-11-13T00:00:00.000Z'),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ city: 'Jaipur', checkIn: '2026-11-10', checkOut: '2026-11-15' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(jaipurAvailable._id.toString());
    expect(res.body[0].city).toBe('Jaipur');
  });

  test('10. Incomplete/invalid date ranges do not crash the API and preserve normal search behavior', async () => {
    const listing = await createListing({ title: 'Listing for Edge Cases' });

    // Only checkIn provided
    const res1 = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10' })
      .expect(200);
    expect(res1.body).toHaveLength(1);

    // Only checkOut provided
    const res2 = await request(app)
      .get('/api/listings')
      .query({ checkOut: '2026-11-15' })
      .expect(200);
    expect(res2.body).toHaveLength(1);

    // checkOut <= checkIn (reversed dates)
    const res3 = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-15', checkOut: '2026-11-10' })
      .expect(200);
    expect(res3.body).toHaveLength(1);

    // checkOut === checkIn (same date)
    const res4 = await request(app)
      .get('/api/listings')
      .query({ checkIn: '2026-11-10', checkOut: '2026-11-10' })
      .expect(200);
    expect(res4.body).toHaveLength(1);

    // Invalid date strings
    const res5 = await request(app)
      .get('/api/listings')
      .query({ checkIn: 'not-a-date', checkOut: 'also-not-a-date' })
      .expect(200);
    expect(res5.body).toHaveLength(1);
  });
});
