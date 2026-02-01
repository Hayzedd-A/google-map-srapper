import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import PlaceResult from '@/models/PlaceResult';
import { PlaceResult as ScrapedPlaceResult } from './scraper';

export interface UpdateStats {
  total: number;
  added: number;
}

export async function saveToMongoDB(
  newResults: ScrapedPlaceResult[],
  keyword: string,
  country: string,
  state: string,
  city: string,
  searchQueryId: string
): Promise<UpdateStats> {
  await connectDB();

  let addedCount = 0;

  for (const result of newResults) {
    // Check if place already exists
    const existing = await PlaceResult.findOne({ place_id: result.place_id });
    
    if (!existing) {
      const placeResult = new PlaceResult({
        place_id: result.place_id,
        title: result.title,
        address: result.address,
        phone: result.phone,
        website: result.website,
        rating: result.rating,
        reviews: result.reviews,
        latitude: result.latitude,
        longitude: result.longitude,
        type: result.type,
        thumbnail: result.thumbnail,
        extensions: result.extensions,
        types: result.types,
        service_options: result.service_options,
        reviews_link: result.reviews_link,
        photos_link: result.photos_link,
        hours: result.hours,
        price_level: result.price_level,
        keyword,
        country,
        state,
        city: city || extractCity(result.address),
        searchQueryId,
      });

      await placeResult.save();
      addedCount++;
    }
  }

  const totalCount = await PlaceResult.countDocuments({ searchQueryId });

  return { total: totalCount, added: addedCount };
}

export async function getAllResultsFromMongo(): Promise<any[]> {
  await connectDB();

  const results = await PlaceResult.find({}).lean();
  
  return results.map((item: any) => ({
    keyword: item.keyword,
    name: item.title,
    address: item.address,
    city: item.city,
    state: item.state,
    country: item.country,
    phone_number: item.phone,
    website: item.website,
    rating: item.rating,
    number_of_reviews: item.reviews,
    google_place_id: item.place_id,
    latitude: item.latitude,
    longitude: item.longitude,
    images: item.thumbnail,
    opening_hours: item.hours,
    price_level: item.price_level,
    extensions: item.extensions,
    types: item.types,
    service_options: item.service_options,
    reviews_link: item.reviews_link,
    photos_link: item.photos_link,
  }));
}

export async function generateXlsxFromMongo(): Promise<Buffer> {
  const data = await getAllResultsFromMongo();

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export async function getResultsCount(): Promise<number> {
  await connectDB();
  return await PlaceResult.countDocuments({});
}

function extractCity(address: string): string {
  if (!address) return "";
  // Very naive implementation, usually the part before the zip code or state
  // "123 Main St, New York, NY 10001" -> "New York"
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim().split(' ')[0]; // Rough guess
  }
  return "";
}

