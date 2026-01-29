'use server';

import { searchGoogleMaps } from "./services/scraper";
import { saveToMongoDB, generateXlsxFromMongo, UpdateStats } from "./services/spreadsheet";
import {
  checkQueryHistory,
  createQueryRecord,
  updateQueryProgress,
  markQueryCompleted,
  markQueryFailed,
  generateQueryId,
  QueryStatus,
} from "./services/history";

export interface SearchResult {
  success: boolean;
  count?: number;
  stats?: UpdateStats;
  error?: string;
  skipped?: boolean;
  resumedFromIndex?: number;
  queryId?: string;
}

export async function searchAndSave(
  keyword: string,
  country: string,
  state: string,
  city: string,
  override: boolean = false
): Promise<SearchResult> {
  try {
    const location = [city, state, country].filter(Boolean).join(", ");
    const query = `${keyword} in ${location}`;
    const queryId = generateQueryId(keyword, country, state, city);

    console.log("Starting search for:", query);

    // Check query history
    const historyCheck = await checkQueryHistory(keyword, country, state, city);

    if (historyCheck.exists && !override) {
      if (historyCheck.record?.status === QueryStatus.COMPLETED) {
        console.log("Query already completed, skipping:", query);
        return { 
          success: true, 
          count: historyCheck.record.resultCount || 0,
          skipped: true,
          queryId,
        };
      }
      
      if (historyCheck.record?.status === QueryStatus.IN_PROGRESS || 
          historyCheck.record?.status === QueryStatus.FAILED) {
        // Will be handled by the automation loop
        console.log("Query in progress or failed, may resume:", query);
      }
    }

    // If override, reset the query record
    if (override && historyCheck.exists) {
      console.log("Overriding previous query:", query);
      await createQueryRecord(keyword, country, state, city, 0);
    }

    const results = await searchGoogleMaps(query);
    console.log(`Found ${results.length} results.`);

    const stats = await saveToMongoDB(results, keyword, country, state, city, queryId);
    console.log("MongoDB updated:", stats);

    // Mark as completed
    await markQueryCompleted(queryId, stats.total);

    return { success: true, count: results.length, stats, queryId };
  } catch (error) {
    console.error("Search failed:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred in actions." };
  }
}

export async function searchWithAutomation(
  keyword: string,
  country: string,
  state: string,
  city: string,
  cities: { name: string }[],
  override: boolean = false
): Promise<SearchResult> {
  try {
    const location = [state, country].filter(Boolean).join(", ");
    const queryBase = `${keyword} in ${location}`;
    const queryId = generateQueryId(keyword, country, state, "");

    console.log("Starting automation for:", queryBase);

    // Check if this automation query exists
    const historyCheck = await checkQueryHistory(keyword, country, state, "");

    let startIndex = 0;
    let existingResultsCount = 0;

    if (historyCheck.exists && !override) {
      if (historyCheck.record?.status === QueryStatus.COMPLETED) {
        // Get total count from history
        existingResultsCount = historyCheck.record.resultCount || 0;
        console.log("Automation already completed, skipping all cities");
        return {
          success: true,
          count: existingResultsCount,
          skipped: true,
          queryId,
        };
      }

      if (historyCheck.record?.status === QueryStatus.IN_PROGRESS || 
          historyCheck.record?.status === QueryStatus.FAILED) {
        // Resume from progress
        startIndex = historyCheck.record.progressIndex || 0;
        console.log(`Resuming automation from city index ${startIndex}`);
      }
    }

    // If override, reset the query record
    if (override && historyCheck.exists) {
      console.log("Overriding previous automation query");
      startIndex = 0;
    }

    // Create or update query record
    let currentQueryId = queryId;
    if (!historyCheck.exists || override) {
      const record = await createQueryRecord(keyword, country, state, "", cities.length);
      currentQueryId = record.queryId;
    }

    let totalFound = existingResultsCount;
    let totalAdded = 0;

    // Process cities from startIndex
    for (let i = startIndex; i < cities.length; i++) {
      const cityObj = cities[i];
      const cityName = cityObj.name;

      console.log(`Processing city ${i + 1}/${cities.length}: ${cityName}`);

      // Update progress
      await updateQueryProgress(currentQueryId, i + 1);

      try {
        const cityQuery = `${keyword} in ${cityName}, ${state}, ${country}`;
        const results = await searchGoogleMaps(cityQuery);
        
        const stats = await saveToMongoDB(results, keyword, country, state, cityName, currentQueryId);
        
        totalFound += results.length;
        totalAdded += stats.added;
      } catch (err) {
        console.error(`Failed to search for ${cityName}`, err);
        // Continue with next city on error
      }

      // Small delay to be nice to the server/API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Mark as completed
    const totalCount = totalFound; // This is the cumulative count
    await markQueryCompleted(currentQueryId, totalCount);

    console.log(`Automation complete. Found ${totalFound} results, added ${totalAdded} new entries.`);

    return { 
      success: true, 
      count: totalFound, 
      stats: { total: totalCount, added: totalAdded },
      resumedFromIndex: startIndex > 0 ? startIndex : undefined,
      queryId: currentQueryId,
    };
  } catch (error) {
    console.error("Automation failed:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred in actions." };
  }
}

export async function downloadSpreadsheet(): Promise<Buffer> {
  return await generateXlsxFromMongo();
}

export async function checkQueryStatus(
  keyword: string,
  country: string,
  state: string,
  city: string
): Promise<{ exists: boolean; status?: string; progressIndex?: number; totalCities?: number }> {
  const historyCheck = await checkQueryHistory(keyword, country, state, city);
  
  if (!historyCheck.exists) {
    return { exists: false };
  }

  return {
    exists: true,
    status: historyCheck.record?.status,
    progressIndex: historyCheck.record?.progressIndex,
    totalCities: historyCheck.record?.totalCities,
  };
}

export async function checkAutomationStatus(
  keyword: string,
  country: string,
  state: string
): Promise<{ exists: boolean; status?: string; progressIndex?: number; totalCities?: number }> {
  return checkQueryStatus(keyword, country, state, "");
}

