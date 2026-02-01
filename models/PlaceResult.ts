import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for PlaceResult document
export interface IPlaceResult extends Document {
  place_id: string;
  title: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  latitude?: number;
  longitude?: number;
  type?: string;
  thumbnail?: string;
  hours?: string;
  extensions?: string;
  types?: string;
  service_options?: string;
  reviews_link?: string;
  photos_link?: string;
  price_level?: string;
  keyword: string;
  country: string;
  state: string;
  city?: string;
  searchQueryId: string;
  createdAt: Date;
}

// PlaceResult schema
const PlaceResultSchema = new Schema<IPlaceResult>(
  {
    place_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: false,
    },
    phone: String,
    website: String,
    rating: Number,
    reviews: Number,
    latitude: Number,
    longitude: Number,
    type: String,
    thumbnail: String,
    hours: String,
    price_level: String,
    extensions: String,
    types: String,
    service_options: String,
    reviews_link: String,
    photos_link: String,
    keyword: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: String,
    searchQueryId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
PlaceResultSchema.index({ country: 1, state: 1, city: 1 });
PlaceResultSchema.index({ title: 'text', address: 'text' });

// Prevent model overwrite in development hot reloading
const PlaceResult: Model<IPlaceResult> =
  mongoose.models.PlaceResult || mongoose.model<IPlaceResult>('PlaceResult', PlaceResultSchema);

export default PlaceResult;

