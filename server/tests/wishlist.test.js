import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Listing from '../src/models/Listing.js';
import generateToken from '../src/utils/generateToken.js';

process.env.JWT_SECRET = 'testsecret';

describe('Wishlist API Tests (Issue #14)', () => {
  let mongod;
  let user;
  let token;
  let host;
  let listing1;
  let listing2;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Listing.deleteMany({});

    host = await User.create({
      name: 'Host User',
      email: 'host@test.com',
      password: 'password123',
      role: 'host',
    });

    user = await User.create({
      name: 'Guest User',
      email: 'guest@test.com',
      password: 'password123',
      role: 'guest',
    });
    token = generateToken(user._id);

    listing1 = await Listing.create({
      title: 'Jaipur Haveli',
      description: 'Restored royal haveli',
      type: 'homestay',
      city: 'Jaipur',
      state: 'Rajasthan',
      address: 'Old City, Jaipur',
      pricePerNight: 2800,
      maxGuests: 4,
      host: host._id,
      isActive: true,
    });

    listing2 = await Listing.create({
      title: 'Goa Villa',
      description: 'Beachside luxury villa',
      type: 'villa',
      city: 'Goa',
      state: 'Goa',
      address: 'Vagator, Goa',
      pricePerNight: 9000,
      maxGuests: 6,
      host: host._id,
      isActive: true,
    });
  });

  test('Adding a listing to wishlist', async () => {
    const res = await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.isWishlisted).toBe(true);
    expect(res.body.wishlist.map(String)).toContain(listing1._id.toString());

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.wishlist.map(String)).toContain(listing1._id.toString());
  });

  test('Removing a listing from wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.isWishlisted).toBe(false);
    expect(res.body.wishlist.map(String)).not.toContain(listing1._id.toString());

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.wishlist.map(String)).not.toContain(listing1._id.toString());
  });

  test('Preventing duplicates in wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await User.findByIdAndUpdate(user._id, { $push: { wishlist: listing1._id } });

    const listRes = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const occurrences = listRes.body.filter((l) => l._id.toString() === listing1._id.toString());
    expect(occurrences).toHaveLength(1);
  });

  test('Retrieving wishlist returns user saved listings with details', async () => {
    await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post(`/api/wishlist/${listing2._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    const titles = res.body.map((l) => l.title);
    expect(titles).toContain('Jaipur Haveli');
    expect(titles).toContain('Goa Villa');
  });

  test('Invalid and nonexistent listing handling', async () => {
    const resInvalid = await request(app)
      .post('/api/wishlist/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(resInvalid.body.message).toMatch(/invalid.*id/i);

    const nonExistentId = new mongoose.Types.ObjectId();
    const resNotFound = await request(app)
      .post(`/api/wishlist/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(resNotFound.body.message).toMatch(/not found/i);

    await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .expect(401);

    await request(app)
      .get('/api/wishlist')
      .expect(401);
  });

  test('Users can only view and modify their own wishlist', async () => {
    const user2 = await User.create({
      name: 'Another User',
      email: 'another@test.com',
      password: 'password123',
      role: 'guest',
    });
    const token2 = generateToken(user2._id);

    await request(app)
      .post(`/api/wishlist/${listing1._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const resUser2 = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    expect(resUser2.body).toHaveLength(0);

    const resUser1 = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resUser1.body).toHaveLength(1);
  });
});
