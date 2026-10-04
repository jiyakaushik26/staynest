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

describe('POST /api/bookings', () => {
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

    // Create host and guest test users
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

    // Create a listing owned by hostUser
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

  // 1. Valid booking
  it('creates a valid booking, returns HTTP 201, and calculates nights and total price', async () => {
    const checkIn = '2026-11-01';
    const checkOut = '2026-11-04';
    const expectedNights = 3;
    const expectedTotalPrice = expectedNights * listing.pricePerNight; // 3 * 2500 = 7500

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

  // 2. Invalid dates: check-out before check-in
  it('returns HTTP 400 when check-out date is before check-in date', async () => {
    const checkIn = '2026-11-10';
    const checkOut = '2026-11-05';

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

  // 3. Too many guests: booking exceeds the listing's maximum guest capacity
  it('returns HTTP 400 when guests exceed listing maxGuests capacity', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn: '2026-11-01',
        checkOut: '2026-11-03',
        guests: listing.maxGuests + 1, // 5 guests when max is 4
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(new RegExp(`maximum of ${listing.maxGuests} guests`, 'i'));
  });

  // 4. Host booking their own listing
  it('returns HTTP 400 when a host attempts to book their own listing', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        listingId: listing._id.toString(),
        checkIn: '2026-11-01',
        checkOut: '2026-11-03',
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/cannot book your own listing/i);
  });
});
