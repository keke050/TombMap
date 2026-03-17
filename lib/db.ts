import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

const globalForDb = globalThis as unknown as { pool?: Pool };

export const hasDatabase = Boolean(connectionString);
export const hasTombDatabase = hasDatabase && process.env.TOMBS_DATABASE === '1';

export const pool = hasDatabase
  ? globalForDb.pool ?? new Pool({ connectionString })
  : null;

if (pool && process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export type DbQueryResult<T> = {
  rows: T[];
  rowCount: number;
};

export type DbParam = string | number | boolean | null | string[] | number[] | boolean[];

export const query = async <T = unknown>(
  text: string,
  params?: DbParam[]
): Promise<DbQueryResult<T>> => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }
  return (await pool.query(text, params)) as unknown as DbQueryResult<T>;
};
