import { getJson } from "serpapi";

const API_KEY = process.env.SERP_API_KEY;

export interface PlaceResult {
  place_id: string;
  title: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  latitude?: number;
  longitude?: number;
  type?: string;
  thumbnail?: string;
  hours?: string;
  price_level?: string;
  extensions?: string;
  types?: string;
  service_options?: string;
  reviews_link?: string;
  photos_link?: string;
}

export async function searchGoogleMaps(query: string, limit: number = 100, _queryId?: string): Promise<PlaceResult[]> {
  if (!API_KEY) {
    throw new Error("SERP_API_KEY is not set in environment variables.");
  }

  const results: PlaceResult[] = [];
  let start = 0;
  // SerpApi Google Maps engine usually returns 20 results per page.
  // We need to loop to fetch 'limit' results.
  
  while (results.length < limit) {
    console.log(`Fetching results starting at ${start} for query: ${query}`);
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        getJson({
          engine: "google_maps",
          q: query,
          api_key: API_KEY,
          start: start,
          type: "search",
          ll: "@40.7455096,-74.0083012,14z", // Default to a generic location if not specified, but usually query handles it.
          // Note: 'll' might be needed if the query is generic like "restaurants". 
          // For now relying on the query containing location e.g. "restaurants in New York"
        }, (json) => {
            if (json.error) reject(json.error);
            else resolve(json);
        });
      });

      if (!response.local_results) {
        console.log("No local_results found.");
        break;
      }

      console.log("local_results", response.local_results.map(e => ({
        place_id: e.place_id,
        extensions: JSON.stringify(e.extensions),
        service_options: e.service_options,
        types: e.types,
        })));

      const mappedResults = response.local_results.map((item: any) => ({
        place_id: item.place_id,
        title: item.title,
        address: item.address,
        phone: item.phone,
        website: item.website,
        rating: item.rating,
        reviews: item.reviews,
        extensions: item.extensions ? JSON.stringify(item.extensions) : undefined,
        latitude: item.gps_coordinates?.latitude,
        longitude: item.gps_coordinates?.longitude,
        types: item.types ? JSON.stringify(item.types) : undefined,
        type: item.type,
        service_options: item.service_options ? JSON.stringify(item.service_options) : undefined,
        reviews_link: item.reviews_link,
        photos_link: item.photos_link,
        thumbnail: item.thumbnail,
        hours: item.operating_hours ? JSON.stringify(item.operating_hours) : undefined,
        price_level: item.price,
      }));

      results.push(...mappedResults);

      if (!response.serpapi_pagination?.next) {
        console.log("No more pages.");
        break;
      }

      start += 20; // SerpApi pagination usually increments by 20
      
      // Safety break to prevent infinite loops if API behaves unexpectedly
      if (start >= limit + 20) break;

    } catch (error) {
      console.error("Error fetching from SerpApi:", error);
      break;
    }
  }

  // Deduplicate just in case, though we handle it at file level too.
  const uniqueResults = Array.from(new Map(results.map(item => [item.place_id, item])).values());
  
  return uniqueResults.slice(0, limit);
}
