import mongoose, { Schema, Document, Model } from 'mongoose';

// Query History Status enum
export const QueryStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type QueryStatusType = (typeof QueryStatus)[keyof typeof QueryStatus];

// Interface for QueryHistory document
export interface IQueryHistory extends Document {
  queryId: string;
  keyword: string;
  country: string;
  state: string;
  city: string;
  status: QueryStatusType;
  progressIndex: number;
  totalCities: number;
  resultCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// QueryHistory schema
const QueryHistorySchema = new Schema<IQueryHistory>(
  {
    queryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
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
    city: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(QueryStatus),
      default: QueryStatus.PENDING,
    },
    progressIndex: {
      type: Number,
      default: 0,
    },
    totalCities: {
      type: Number,
      default: 0,
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for common queries
QueryHistorySchema.index({ keyword: 1, country: 1, state: 1, city: 1 });
QueryHistorySchema.index({ status: 1, createdAt: -1 });

// Prevent model overwrite in development hot reloading
const QueryHistory: Model<IQueryHistory> =
  mongoose.models.QueryHistory || mongoose.model<IQueryHistory>('QueryHistory', QueryHistorySchema);

export default QueryHistory;

