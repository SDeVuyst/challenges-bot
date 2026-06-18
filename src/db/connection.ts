import { mkdirSync } from "fs";
import { dirname } from "path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function getDb(databasePath: string): Database.Database {
  if (!db) {
    mkdirSync(dirname(databasePath), { recursive: true });
    db = new Database(databasePath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
