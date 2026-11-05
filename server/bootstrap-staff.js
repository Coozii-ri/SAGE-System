import { bootstrapStaffAccounts, getStaffAccountsFromEnvironment } from './staff-bootstrap.js';

if (process.env.NODE_ENV !== 'production' || !process.env.SAGE_DB_PATH) {
  throw new Error('Staff bootstrap must run in production with SAGE_DB_PATH set to the persistent database.');
}

const { db, closeDatabase } = await import('./db.js');
const staffAccounts = getStaffAccountsFromEnvironment();

try {
  const accounts = await bootstrapStaffAccounts(db, staffAccounts);
  for (const account of accounts) {
    console.log(`Created or reset ${account.role} account: ${account.email}`);
  }
} finally {
  closeDatabase();
}
