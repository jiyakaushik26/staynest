import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';

describe('Listing Location Tests (Issue #10)', () => {
  let mongod;
  let host;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Listing.deleteMany({});
    await User.deleteMany({});

    host = await User.create({
      name: 'Host User',
      email: 'host@test.com',
      password: 'password123',
      role: 'host',
    });
  });

  const createListingData = (overrides = {}) => ({
    title: 'Jaipur Haveli',
    description: 'A restored haveli in the old city',
    type: 'homestay',
    city: 'Jaipur',
    state: 'Rajasthan',
    address: 'Near Hawa Mahal',
    pricePerNight: 2800,
    maxGuests: 4,
    host: host._id,
    ...overrides,
  });

  test('Listing schema accepts location coordinates', async () => {
    const listing = await Listing.create(
      createListingData({
        location: { lat: 26.9239, lng: 75.8267 },
      })
    );

    const found = await Listing.findById(listing._id);
    expect(found.location).toBeDefined();
    expect(found.location.lat).toBe(26.9239);
    expect(found.location.lng).toBe(75.8267);
  });

  test('Listing API returns location data for single listing and listings list', async () => {
    const listing = await Listing.create(
      createListingData({
        location: { lat: 26.9239, lng: 75.8267 },
      })
    );

    const detailRes = await request(app).get(`/api/listings/${listing._id}`).expect(200);
    expect(detailRes.body.location).toBeDefined();
    expect(detailRes.body.location.lat).toBe(26.9239);
    expect(detailRes.body.location.lng).toBe(75.8267);

    const listRes = await request(app).get('/api/listings').expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].location).toBeDefined();
    expect(listRes.body[0].location.lat).toBe(26.9239);
    expect(listRes.body[0].location.lng).toBe(75.8267);
  });

  test('Missing location does not break listing retrieval', async () => {
    const listing = await Listing.create(createListingData());

    const detailRes = await request(app).get(`/api/listings/${listing._id}`).expect(200);
    expect(detailRes.body._id).toBe(listing._id.toString());
    expect(detailRes.body.location?.lat).toBeUndefined();

    const listRes = await request(app).get('/api/listings').expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]._id).toBe(listing._id.toString());
  });
});
