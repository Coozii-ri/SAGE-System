CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_email ON Guest(Email COLLATE NOCASE) WHERE Email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gate_pass_guest_created ON GatePass(GuestID, CreatedAt DESC);
