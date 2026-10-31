import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateDatabase } from './migrate.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
let db;

before(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrateDatabase(db);
});

after(() => db.close());

test('migration creates the relational pass, equipment, movement, and staff schema', () => {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table'
  `).all().map((row) => row.name);
  for (const table of ['Guest', 'GatePass', 'AssetEntry', 'GateLog', 'StaffAccount', 'SessionStore', 'SchemaMigration']) {
    assert.ok(tables.includes(table), `Expected ${table} table`);
  }
  const passColumns = db.prepare('PRAGMA table_info(GatePass)').all().map((row) => row.name);
  assert.ok(passColumns.includes('ReferenceID'));
  assert.ok(passColumns.includes('ApprovalStatus'));
  assert.ok(passColumns.includes('ValidUntil'));
  const guestColumns = db.prepare('PRAGMA table_info(Guest)').all().map((row) => row.name);
  assert.ok(guestColumns.includes('Email'));
  assert.ok(guestColumns.includes('PasswordHash'));
  assert.ok(guestColumns.includes('AccountStatus'));
});

test('guest-account migration upgrades an existing schema and is safe to rerun', () => {
  const legacyDb = new Database(':memory:');
  legacyDb.pragma('foreign_keys = ON');
  legacyDb.exec(readFileSync(path.join(serverDirectory, 'migrations', '001-initial.sql'), 'utf8'));
  legacyDb.prepare(`
    INSERT INTO Guest (FullName, ContactNumber, GovID_Type)
    VALUES ('Existing guest', '+1 555 0111', 'Passport')
  `).run();
  migrateDatabase(legacyDb);
  migrateDatabase(legacyDb);
  const columns = legacyDb.prepare('PRAGMA table_info(Guest)').all().map(({ name }) => name);
  assert.ok(columns.includes('Email'));
  assert.equal(legacyDb.prepare('SELECT FullName, AccountStatus FROM Guest').get().AccountStatus, 'Active');
  assert.equal(legacyDb.prepare('SELECT COUNT(*) AS count FROM SchemaMigration').get().count, 2);
  legacyDb.close();
});

test('a guest can have multiple passes and equipment is linked to its pass', () => {
  const guestId = db.prepare(`
    INSERT INTO Guest (FullName, ContactNumber, GovID_Type)
    VALUES ('Riley Morgan', '+1 555 0100', 'Passport')
  `).run().lastInsertRowid;
  const addPass = db.prepare(`
    INSERT INTO GatePass (GuestID, HostDepartment, Purpose, ValidFrom, ValidUntil)
    VALUES (?, 'Facilities', 'Campus meeting', '2026-11-01T10:00:00.000Z', '2026-11-01T12:00:00.000Z')
  `);
  const firstPass = addPass.run(guestId).lastInsertRowid;
  addPass.run(guestId);
  db.prepare(`
    INSERT INTO AssetEntry (PassID, ItemDescription, SerialNumber)
    VALUES (?, 'Camera', 'CAM-01')
  `).run(firstPass);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM GatePass WHERE GuestID = ?').get(guestId).total, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM AssetEntry WHERE PassID = ?').get(firstPass).total, 1);
});

test('reference IDs are unique and gate logs require a registered staff member', () => {
  const guestId = db.prepare(`
    INSERT INTO Guest (FullName, ContactNumber, GovID_Type)
    VALUES ('Casey North', '+1 555 0101', 'Passport')
  `).run().lastInsertRowid;
  const staffId = db.prepare(`
    INSERT INTO StaffAccount (FullName, Email, Role, PasswordHash)
    VALUES ('Security', 'guard@example.test', 'Campus Security Guard', 'hash')
  `).run().lastInsertRowid;
  const passId = db.prepare(`
    INSERT INTO GatePass (GuestID, ReferenceID, HostDepartment, Purpose, ValidFrom, ValidUntil, ApprovalStatus)
    VALUES (?, 'SAGE-2026-UNIQUE', 'Facilities', 'Campus meeting', '2026-11-01T10:00:00.000Z', '2026-11-01T12:00:00.000Z', 'Approved')
  `).run(guestId).lastInsertRowid;
  assert.throws(() => db.prepare(`
    INSERT INTO GatePass (GuestID, ReferenceID, HostDepartment, Purpose, ValidFrom, ValidUntil)
    VALUES (?, 'SAGE-2026-UNIQUE', 'Facilities', 'Campus meeting', '2026-11-01T10:00:00.000Z', '2026-11-01T12:00:00.000Z')
  `).run(guestId), /UNIQUE constraint failed/);
  db.prepare(`
    INSERT INTO GateLog (PassID, StaffID, Direction) VALUES (?, ?, 'IN')
  `).run(passId, staffId);
  assert.equal(db.prepare('SELECT StaffID FROM GateLog WHERE PassID = ?').get(passId).StaffID, staffId);
  assert.throws(() => db.prepare(`
    INSERT INTO GateLog (PassID, StaffID, Direction) VALUES (?, 999, 'OUT')
  `).run(passId), /FOREIGN KEY constraint failed/);
});
