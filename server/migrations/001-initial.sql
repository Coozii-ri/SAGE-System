PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS StaffAccount (
  StaffID INTEGER PRIMARY KEY AUTOINCREMENT,
  FullName TEXT NOT NULL,
  Email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  Role TEXT NOT NULL CHECK (Role IN ('Facilities Officer', 'Campus Security Guard')),
  AccountStatus TEXT NOT NULL DEFAULT 'Active' CHECK (AccountStatus IN ('Active', 'Disabled')),
  PasswordHash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Guest (
  GuestID INTEGER PRIMARY KEY AUTOINCREMENT,
  FullName TEXT NOT NULL,
  Affiliation TEXT NOT NULL DEFAULT '',
  ContactNumber TEXT NOT NULL,
  GovID_Type TEXT NOT NULL,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS GatePass (
  PassID INTEGER PRIMARY KEY AUTOINCREMENT,
  GuestID INTEGER NOT NULL REFERENCES Guest(GuestID),
  ReferenceID TEXT UNIQUE,
  HostDepartment TEXT NOT NULL,
  Purpose TEXT NOT NULL,
  ValidFrom TEXT NOT NULL,
  ValidUntil TEXT NOT NULL,
  ApprovalStatus TEXT NOT NULL DEFAULT 'Pending' CHECK (ApprovalStatus IN ('Pending', 'Approved', 'Rejected')),
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ApprovedBy INTEGER REFERENCES StaffAccount(StaffID),
  ApprovedAt TEXT,
  CHECK (ValidFrom < ValidUntil)
);

CREATE TABLE IF NOT EXISTS AssetEntry (
  AssetID INTEGER PRIMARY KEY AUTOINCREMENT,
  PassID INTEGER NOT NULL REFERENCES GatePass(PassID),
  ItemDescription TEXT NOT NULL,
  SerialNumber TEXT NOT NULL,
  ClearanceStatus TEXT NOT NULL DEFAULT 'Pending' CHECK (ClearanceStatus IN ('Pending', 'Cleared', 'Denied'))
);

CREATE TABLE IF NOT EXISTS GateLog (
  LogID INTEGER PRIMARY KEY AUTOINCREMENT,
  PassID INTEGER NOT NULL REFERENCES GatePass(PassID),
  AssetID INTEGER REFERENCES AssetEntry(AssetID),
  StaffID INTEGER NOT NULL REFERENCES StaffAccount(StaffID),
  Direction TEXT NOT NULL CHECK (Direction IN ('IN', 'OUT')),
  Timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS SessionStore (
  SessionID TEXT PRIMARY KEY,
  SessionData TEXT NOT NULL,
  ExpiresAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_full_name ON Guest(FullName COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_pass_reference ON GatePass(ReferenceID);
CREATE INDEX IF NOT EXISTS idx_pass_status_validity ON GatePass(ApprovalStatus, ValidFrom, ValidUntil);
CREATE INDEX IF NOT EXISTS idx_asset_pass ON AssetEntry(PassID);
CREATE INDEX IF NOT EXISTS idx_gate_log_pass_time ON GateLog(PassID, Timestamp DESC);
