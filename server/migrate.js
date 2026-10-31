import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function migrateDatabase(database) {
  database.exec(readFileSync(path.join(migrationDirectory, '001-initial.sql'), 'utf8'));
  database.exec(`
    CREATE TABLE IF NOT EXISTS SchemaMigration (
      Version TEXT PRIMARY KEY,
      AppliedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const migrations = readdirSync(migrationDirectory)
    .filter((name) => /^\d{3}-.+\.sql$/.test(name))
    .sort();
  for (const migration of migrations) {
    if (database.prepare('SELECT 1 FROM SchemaMigration WHERE Version = ?').get(migration)) continue;

    const applyMigration = database.transaction(() => {
      if (migration === '002-guest-accounts.sql') {
        const columns = new Set(database.prepare('PRAGMA table_info(Guest)').all().map(({ name }) => name));
        if (!columns.has('Email')) database.exec('ALTER TABLE Guest ADD COLUMN Email TEXT');
        if (!columns.has('PasswordHash')) database.exec('ALTER TABLE Guest ADD COLUMN PasswordHash TEXT');
        if (!columns.has('AccountStatus')) {
          database.exec("ALTER TABLE Guest ADD COLUMN AccountStatus TEXT NOT NULL DEFAULT 'Active'");
        }
      }
      database.exec(readFileSync(path.join(migrationDirectory, migration), 'utf8'));
      database.prepare('INSERT INTO SchemaMigration (Version) VALUES (?)').run(migration);
    });
    applyMigration();
  }
}
