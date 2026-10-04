import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['homestay', 'hotel', 'villa', 'hostel', 'cottage'],
      required: true,
    },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    location: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
    },
    pricePerNight: { type: Number, required: true, min: 0 },
    maxGuests: { type: Number, required: true, min: 1 },
    bedrooms: { type: Number, default: 1, min: 0 },
    amenities: [{ type: String }],
    images: {
      type: [String],
      default: ['https://placehold.co/800x500?text=StayNest'],
    },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

listingSchema.index({ city: 1, pricePerNight: 1 });

export default mongoose.model('Listing', listingSchema);
