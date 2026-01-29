'use server';

import { searchGoogleMaps } from "./services/scraper";
import { updateSpreadsheet } from "./services/spreadsheet";

export async function searchAndSave(keyword: string, country: string, state: string, city: string) {
  try {
    const location = [city, state, country].filter(Boolean).join(", ");
    const query = `${keyword} in ${location}`;
    
    console.log("Starting search for:", query);
    const results = await searchGoogleMaps(query);
    console.log(`Found ${results.length} results.`);
    
    const stats = await updateSpreadsheet(results, country, state, city);
    console.log("Spreadsheet updated:", stats);
    
    return { success: true, count: results.length, stats };
  } catch (error: any) {
    console.error("Search failed:", error);
    return { success: false, error: error.message };
  }
}
