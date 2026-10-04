import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';
import Booking from '../src/models/Booking.js';
import generateToken from '../src/utils/generateToken.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('POST /api/bookings (Issue #2)', () => {
  let mongoServer;
  let hostUser;
  let guestUser;
  let hostToken;
  let guestToken;
  let listing;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    hostUser = await User.create({
      name: 'Test Host',
      email: 'host@staynest.test',
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
    guestToken = generateToken(guestUser._id);

    listing = await Listing.create({
      title: 'Heritage Haveli Stay',
      description: 'A quiet heritage haveli stay for testing.',
      type: 'homestay',
      city: 'Jaipur',
      state: 'Rajasthan',
      address: 'Old City, Jaipur',
      pricePerNight: 2500,
      maxGuests: 4,
      bedrooms: 2,
      amenities: ['WiFi', 'AC', 'Breakfast'],
      host: hostUser._id,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Booking.deleteMany({});
  });

  // 1. Valid booking (future dates)
  it('creates a valid booking with future dates, returns HTTP 201, and calculates nights and total price', async () => {
    const futureCheckIn = new Date();
    futureCheckIn.setDate(futureCheckIn.getDate() + 10);
    const futureCheckOut = new Date(futureCheckIn);
    futureCheckOut.setDate(futureCheckOut.getDate() + 3);

    const checkIn = formatDate(futureCheckIn);
    const checkOut = formatDate(futureCheckOut);
    const expectedNights = 3;
    const expectedTotalPrice = expectedNights * listing.pricePerNight;

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.nights).toBe(expectedNights);
    expect(res.body.totalPrice).toBe(expectedTotalPrice);
    expect(res.body.guests).toBe(2);
    expect(res.body.listing).toBe(listing._id.toString());
    expect(res.body.guest).toBe(guestUser._id.toString());
    expect(res.body.status).toBe('pending');
  });

  // 2. Valid booking starting today (Issue #2 requirement: today check-in accepted)
  it('accepts a valid booking with check-in starting today', async () => {
    const today = new Date();
    const futureCheckOut = new Date(today);
    futureCheckOut.setDate(futureCheckOut.getDate() + 2);

    const checkIn = formatDate(today);
    const checkOut = formatDate(futureCheckOut);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.nights).toBe(2);
  });

  // 3. Past check-in date rejected (Issue #2 requirement)
  it('returns HTTP 400 when check-in date is in the past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkIn = formatDate(yesterday);
    const checkOut = formatDate(tomorrow);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/check-in date cannot be in the past/i);
  });

  // 4. Invalid dates: check-out before check-in (Issue #2 requirement)
  it('returns HTTP 400 when check-out date is before check-in date', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const earlierDate = new Date(futureDate);
    earlierDate.setDate(earlierDate.getDate() - 5);

    const checkIn = formatDate(futureDate);
    const checkOut = formatDate(earlierDate);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/check-out must be at least one day after check-in/i);
  });

  // 5. Invalid dates: check-out same day as check-in (0 nights)
  it('returns HTTP 400 when check-out date is the same as check-in date', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const checkIn = formatDate(futureDate);
    const checkOut = formatDate(futureDate);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/check-out must be at least one day after check-in/i);
  });

  // 6. Too many guests
  it('returns HTTP 400 when guests exceed listing maxGuests capacity', async () => {
    const futureCheckIn = new Date();
    futureCheckIn.setDate(futureCheckIn.getDate() + 5);
    const futureCheckOut = new Date(futureCheckIn);
    futureCheckOut.setDate(futureCheckOut.getDate() + 2);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn: formatDate(futureCheckIn),
        checkOut: formatDate(futureCheckOut),
        guests: listing.maxGuests + 1,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(new RegExp(`maximum of ${listing.maxGuests} guests`, 'i'));
  });

  // 7. Host booking own listing
  it('returns HTTP 400 when a host attempts to book their own listing', async () => {
    const futureCheckIn = new Date();
    futureCheckIn.setDate(futureCheckIn.getDate() + 5);
    const futureCheckOut = new Date(futureCheckIn);
    futureCheckOut.setDate(futureCheckOut.getDate() + 2);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn: formatDate(futureCheckIn),
        checkOut: formatDate(futureCheckOut),
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/cannot book your own listing/i);
  });
});
