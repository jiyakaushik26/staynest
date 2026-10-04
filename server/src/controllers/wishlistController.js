import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    populate: { path: 'host', select: 'name' },
  });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const seen = new Set();
  const listings = (user.wishlist || []).filter((l) => {
    if (!l?._id) return false;
    const id = l._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  res.json(listings);
});

// POST /api/wishlist/:id
export const toggleWishlist = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid listing ID');
  }

  const listing = await Listing.findById(id);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (!Array.isArray(user.wishlist)) {
    user.wishlist = [];
  }

  const listingIdStr = listing._id.toString();
  const index = user.wishlist.findIndex(
    (item) => (item?._id || item).toString() === listingIdStr
  );

  let isWishlisted = false;
  if (index > -1) {
    user.wishlist.splice(index, 1);
    isWishlisted = false;
  } else {
    user.wishlist.push(listing._id);
    isWishlisted = true;
  }

  // Prevent duplicate entries
  const uniqueMap = new Map();
  user.wishlist.forEach((item) => {
    const key = (item?._id || item).toString();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });
  user.wishlist = Array.from(uniqueMap.values());

  await user.save();

  res.json({
    message: isWishlisted ? 'Listing added to wishlist' : 'Listing removed from wishlist',
    isWishlisted,
    wishlist: user.wishlist,
  });
});
