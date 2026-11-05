import bcrypt from 'bcryptjs';
import { z } from 'zod';

const staffAccountSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(['Facilities Officer', 'Campus Security Guard']),
});

export function getStaffAccountsFromEnvironment(environment = process.env) {
  return [
    environment.SAGE_FACILITIES_PASSWORD && {
      fullName: environment.SAGE_FACILITIES_NAME || 'Facilities Officer',
      email: environment.SAGE_FACILITIES_EMAIL || 'facility@feu.edu.ph',
      password: environment.SAGE_FACILITIES_PASSWORD,
      role: 'Facilities Officer',
    },
    environment.SAGE_GUARD_PASSWORD && {
      fullName: environment.SAGE_GUARD_NAME || 'Campus Security Guard',
      email: environment.SAGE_GUARD_EMAIL || 'guard@feu.edu.ph',
      password: environment.SAGE_GUARD_PASSWORD,
      role: 'Campus Security Guard',
    },
  ].filter(Boolean);
}

export async function bootstrapStaffAccounts(database, staffAccounts) {
  if (!staffAccounts.length) {
    throw new Error('Provide at least one staff account to bootstrap.');
  }

  const parsedAccounts = staffAccounts.map((account) => staffAccountSchema.parse(account));
  const emails = new Set(parsedAccounts.map(({ email }) => email.toLowerCase()));
  if (emails.size !== parsedAccounts.length) {
    throw new Error('Each staff role must use a different email address.');
  }

  const accountsWithHashes = await Promise.all(parsedAccounts.map(async (account) => ({
    ...account,
    email: account.email.toLowerCase(),
    passwordHash: await bcrypt.hash(account.password, 12),
  })));

  const saveAccount = database.prepare(`
    INSERT INTO StaffAccount (FullName, Email, Role, AccountStatus, PasswordHash)
    VALUES (?, ?, ?, 'Active', ?)
    ON CONFLICT(Email) DO UPDATE SET
      FullName = excluded.FullName,
      AccountStatus = 'Active',
      PasswordHash = excluded.PasswordHash
    WHERE StaffAccount.Role = excluded.Role
  `);
  const transaction = database.transaction(() => {
    for (const account of accountsWithHashes) {
      const result = saveAccount.run(
        account.fullName,
        account.email,
        account.role,
        account.passwordHash,
      );
      if (result.changes !== 1) {
        throw new Error(`The email ${account.email} is already assigned to a different staff role.`);
      }
    }
  });
  transaction();

  return accountsWithHashes.map(({ email, role }) => ({ email, role }));
}
