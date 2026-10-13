import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Trip } from './models.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// Each trip is one aggregate. SQLite transactions make read/modify/write atomic,
// including concurrent requests or multiple local processes using the same file.
export class TripStore {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)));`);
  }
  list(): Trip[] {
    return this.db
      .prepare('SELECT document FROM trips ORDER BY rowid')
      .all()
      .map((row) => JSON.parse(row.document as string) as Trip);
  }
  get(id: string): Trip {
    const row = this.db.prepare('SELECT document FROM trips WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Trip not found');
    return JSON.parse(row.document as string) as Trip;
  }
  create(trip: Trip): Trip {
    this.db
      .prepare('INSERT INTO trips (id, document) VALUES (?, ?)')
      .run(trip.id, JSON.stringify(trip));
    return trip;
  }
  update<T>(id: string, change: (trip: Trip) => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const trip = this.get(id);
      const result = change(trip);
      trip.updatedAt = new Date().toISOString();
      trip.revision = (trip.revision ?? 1) + 1;
      this.db
        .prepare('UPDATE trips SET document = ? WHERE id = ?')
        .run(JSON.stringify(trip), id);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  delete(id: string): void {
    const result = this.db.prepare('DELETE FROM trips WHERE id = ?').run(id);
    if (!result.changes) throw new ApiError(404, 'NOT_FOUND', 'Trip not found');
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close(): void {
    this.db.close();
  }
}
