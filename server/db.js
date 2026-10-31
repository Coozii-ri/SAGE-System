import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateDatabase } from './migrate.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, '..');
const databasePath = process.env.SAGE_DB_PATH || path.join(projectDirectory, 'data', 'sage.sqlite');

mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
migrateDatabase(db);

export function closeDatabase() {
  db.close();
}
