import bcrypt from 'bcryptjs';

export async function seedDemoAccounts(database, demoPassword = 'SageDemo2026!') {
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const staffCount = database.prepare('SELECT COUNT(*) AS count FROM StaffAccount').get().count;

  const upgradeDemoEmail = database.prepare(`
    UPDATE StaffAccount SET Email = ?
    WHERE Email = ? COLLATE NOCASE
      AND Role = ?
      AND NOT EXISTS (SELECT 1 FROM StaffAccount WHERE Email = ? COLLATE NOCASE)
  `);
  upgradeDemoEmail.run('facility@feu.edu.ph', 'facilities@sage.campus', 'Facilities Officer', 'facility@feu.edu.ph');
  upgradeDemoEmail.run('guard@feu.edu.ph', 'guard@sage.campus', 'Campus Security Guard', 'guard@feu.edu.ph');

  if (staffCount === 0) {
    const insertStaff = database.prepare(`
      INSERT INTO StaffAccount (FullName, Email, Role, PasswordHash)
      VALUES (?, ?, ?, ?)
    `);
    database.transaction(() => {
      insertStaff.run('Jordan Ellis', 'facility@feu.edu.ph', 'Facilities Officer', passwordHash);
      insertStaff.run('Morgan Chen', 'guard@feu.edu.ph', 'Campus Security Guard', passwordHash);
    })();
  }

  const guestCount = database.prepare('SELECT COUNT(*) AS count FROM Guest').get().count;
  if (guestCount !== 0) {
    database.prepare(`
      UPDATE Guest SET Email = 'visitor@feu.edu.ph', PasswordHash = ?
      WHERE GuestID = (
        SELECT GuestID FROM Guest
        WHERE FullName = 'Amara Okafor' AND Email IS NULL AND PasswordHash IS NULL
        ORDER BY GuestID LIMIT 1
      )
      AND NOT EXISTS (SELECT 1 FROM Guest WHERE Email = 'visitor@feu.edu.ph' COLLATE NOCASE)
    `).run(passwordHash);
    return;
  }

  const facilityOfficer = database.prepare(`
    SELECT StaffID FROM StaffAccount WHERE Role = 'Facilities Officer' ORDER BY StaffID LIMIT 1
  `).get();
  const createDemoVisitors = database.transaction(() => {
    const guestId = database.prepare(`
      INSERT INTO Guest (FullName, Affiliation, ContactNumber, GovID_Type, Email, PasswordHash)
      VALUES ('Amara Okafor', 'Northstar Research', '+1 (555) 018-2840', 'Driver license', 'visitor@feu.edu.ph', ?)
    `).run(passwordHash).lastInsertRowid;
    const validFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const validUntil = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    const passId = database.prepare(`
      INSERT INTO GatePass (
        GuestID, ReferenceID, HostDepartment, Purpose, ValidFrom, ValidUntil,
        ApprovalStatus, ApprovedBy, ApprovedAt
      ) VALUES (?, ?, 'Research & Innovation', 'Equipment demonstration', ?, ?, 'Approved', ?, ?)
    `).run(
      guestId,
      `SAGE-${new Date().getUTCFullYear()}-7K4P2M9Q`,
      validFrom,
      validUntil,
      facilityOfficer?.StaffID ?? null,
      new Date().toISOString(),
    ).lastInsertRowid;
    database.prepare(`
      INSERT INTO AssetEntry (PassID, ItemDescription, SerialNumber, ClearanceStatus)
      VALUES (?, 'Portable thermal camera', 'TC-8841-AX', 'Cleared')
    `).run(passId);

    const pendingGuestId = database.prepare(`
      INSERT INTO Guest (FullName, Affiliation, ContactNumber, GovID_Type)
      VALUES ('Elliot Park', 'Blue Oak Consulting', '+1 (555) 013-7742', 'Passport')
    `).run().lastInsertRowid;
    database.prepare(`
      INSERT INTO GatePass (GuestID, HostDepartment, Purpose, ValidFrom, ValidUntil)
      VALUES (?, 'Campus Planning', 'Site review and measurements', ?, ?)
    `).run(
      pendingGuestId,
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
    );
  });
  createDemoVisitors();
}
