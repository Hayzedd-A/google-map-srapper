import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { PlaceResult } from './scraper';

const FILE_PATH = path.join(process.cwd(), 'public', 'results.xlsx');

export async function updateSpreadsheet(newResults: PlaceResult[], country: string, state: string, city: string) {
  let workbook: XLSX.WorkBook;
  let existingData: any[] = [];

  if (fs.existsSync(FILE_PATH)) {
    const fileBuffer = fs.readFileSync(FILE_PATH);
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    existingData = XLSX.utils.sheet_to_json(worksheet);
  } else {
    workbook = XLSX.utils.book_new();
  }

  // Create a Map of existing place_ids to avoid duplicates
  const existingMap = new Map(existingData.map((item: any) => [item.google_place_id, item]));

  let addedCount = 0;
  for (const result of newResults) {
    if (!existingMap.has(result.place_id)) {
      existingMap.set(result.place_id, {
        name: result.title,
        address: result.address,
        city: city || extractCity(result.address), 
        state: state, 
        country: country,
        phone_number: result.phone,
        website: result.website,
        rating: result.rating,
        number_of_reviews: result.reviews,
        google_place_id: result.place_id,
        latitude: result.latitude,
        longitude: result.longitude,
        images: result.thumbnail,
        opening_hours: result.hours,
        price_level: result.price_level,
      });
      addedCount++;
    }
  }

  const allData = Array.from(existingMap.values());
  const newWorksheet = XLSX.utils.json_to_sheet(allData);

  // If workbook has no sheets, append one. Else replace the first one.
  if (workbook.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(workbook, newWorksheet, 'Results');
  } else {
    workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
  }

  // Ensure directory exists
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file using fs directly for better control
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(FILE_PATH, buffer);
  
  return { total: allData.length, added: addedCount };
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
