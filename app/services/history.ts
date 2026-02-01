import connectDB from '@/lib/mongodb';
import QueryHistory, { IQueryHistory, QueryStatus } from '@/models/QueryHistory';
import crypto from 'crypto';

// Re-export QueryStatus for convenience
export { QueryStatus };

// Generate a unique query ID based on the search parameters
export function generateQueryId(keyword: string, country: string, state: string, city: string): string {
  const payload = JSON.stringify({ keyword, country, state, city });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface QueryHistoryResult {
  exists: boolean;
  record?: IQueryHistory;
  canResume: boolean;
}

// Check if a query already exists
export async function checkQueryHistory(
  keyword: string,
  country: string,
  state: string,
  city: string
): Promise<QueryHistoryResult> {
  await connectDB();

  const queryId = generateQueryId(keyword, country, state, city);
  
  const record = await QueryHistory.findOne({ queryId }).lean();

  if (!record) {
    return { exists: false, canResume: false };
  }

  // Can resume if in progress or failed with partial progress
  const canResume = 
    record.status === QueryStatus.IN_PROGRESS || 
    (record.status === QueryStatus.FAILED && record.progressIndex > 0);

  return { exists: true, record: record as IQueryHistory, canResume };
}

// Create a new query record (or replace existing one if override)
export async function createQueryRecord(
  keyword: string,
  country: string,
  state: string,
  city: string,
  totalCities: number = 0
): Promise<IQueryHistory> {
  await connectDB();

  const queryId = generateQueryId(keyword, country, state, city);

  // Use findOneAndUpdate with upsert to create or replace the record
  const record = await QueryHistory.findOneAndUpdate(
    { queryId },
    {
      queryId,
      keyword,
      country,
      state,
      city,
      status: QueryStatus.IN_PROGRESS,
      progressIndex: 0,
      totalCities,
      resultCount: 0,
      errorMessage: undefined,
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true 
    }
  );

  return record!;
}

// Update query progress (for automation mode)
export async function updateQueryProgress(
  queryId: string,
  progressIndex: number,
  resultCount?: number
): Promise<void> {
  await connectDB();

  await QueryHistory.findOneAndUpdate(
    { queryId },
    {
      progressIndex,
      resultCount: resultCount ?? undefined,
      status: QueryStatus.IN_PROGRESS,
    }
  );
}

// Mark query as completed
export async function markQueryCompleted(
  queryId: string,
  totalResults: number
): Promise<void> {
  await connectDB();

  await QueryHistory.findOneAndUpdate(
    { queryId },
    {
      status: QueryStatus.COMPLETED,
      progressIndex: 0, // Reset progress as it's complete
      resultCount: totalResults,
    },
    { upsert: true } // Create the record if it doesn't exist (safety fallback)
  );
}

// Mark query as failed
export async function markQueryFailed(
  queryId: string,
  errorMessage: string,
  progressIndex: number = 0
): Promise<void> {
  await connectDB();

  await QueryHistory.findOneAndUpdate(
    { queryId },
    {
      status: QueryStatus.FAILED,
      errorMessage,
      progressIndex,
    }
  );
}

// Get recent queries for display
export async function getRecentQueries(limit: number = 10): Promise<IQueryHistory[]> {
  await connectDB();

  return await QueryHistory.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

// Reset a query record (for override)
export async function resetQueryRecord(
  keyword: string,
  country: string,
  state: string,
  city: string
): Promise<IQueryHistory> {
  await connectDB();

  const queryId = generateQueryId(keyword, country, state, city);

  await QueryHistory.deleteOne({ queryId });

  return await createQueryRecord(keyword, country, state, city, 0);
}

