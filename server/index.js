import bcrypt from 'bcryptjs';
import express from 'express';
import QRCode from 'qrcode';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './db.js';
import { sendEmail } from './email.js';
import { seedDemoAccounts } from './seed.js';
import { SQLiteSessionStore } from './session-store.js';
import { bootstrapStaffAccounts, getStaffAccountsFromEnvironment } from './staff-bootstrap.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(
  session({
    name: 'sage.sid',
    secret: process.env.SESSION_SECRET || 'development-only-change-me',
    store: new SQLiteSessionStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
const guestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  affiliation: z.string().trim().max(120).default(''),
  contactNumber: z.string().trim().min(5).max(40),
  govIdType: z.string().trim().min(2).max(60),
});
const assetSchema = z.object({
  itemDescription: z.string().trim().min(2).max(160),
  serialNumber: z.string().trim().min(1).max(100),
});
const visitFieldsSchema = z.object({
  hostDepartment: z.string().trim().min(2).max(100),
  purpose: z.string().trim().min(3).max(500),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
  assets: z.array(assetSchema).max(20).default([]),
});
const passSchema = visitFieldsSchema.extend({ guest: guestSchema }).refine((value) => Date.parse(value.validFrom) < Date.parse(value.validUntil), {
  message: 'The end time must be after the start time.',
  path: ['validUntil'],
}).refine((value) => Date.parse(value.validUntil) > Date.now(), {
  message: 'The end of the validity window must be in the future.',
  path: ['validUntil'],
});
const visitorPassSchema = visitFieldsSchema.refine((value) => Date.parse(value.validFrom) < Date.parse(value.validUntil), {
  message: 'The end time must be after the start time.',
  path: ['validUntil'],
}).refine((value) => Date.parse(value.validUntil) > Date.now(), {
  message: 'The end of the validity window must be in the future.',
  path: ['validUntil'],
});
const validitySchema = z.object({
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
}).refine((value) => Date.parse(value.validFrom) < Date.parse(value.validUntil), {
  message: 'The end time must be after the start time.',
  path: ['validUntil'],
});
const guestAccountSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  affiliation: z.string().trim().max(120).default(''),
  contactNumber: z.string().trim().min(5).max(40),
  govIdType: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

function publicStaff(staff) {
  return {
    staffId: staff.StaffID,
    fullName: staff.FullName,
    email: staff.Email,
    role: staff.Role,
  };
}

function publicGuest(guest) {
  return {
    guestId: guest.GuestID,
    fullName: guest.FullName,
    email: guest.Email,
    affiliation: guest.Affiliation,
    contactNumber: guest.ContactNumber,
    govIdType: guest.GovID_Type,
    role: 'Guest / Visitor',
  };
}

async function sendVisitorNotification(to, subject, text, notificationType, emailContent = {}) {
  try {
    await sendEmail({ to, subject, text, ...emailContent });
    return true;
  } catch (error) {
    console.error(`Failed to send visitor ${notificationType} email: ${error.message}`);
    return false;
  }
}

function formatEmailDate(value) {
  return `${new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendLoginNotification({ fullName, email, role }) {
  const signedInAt = formatEmailDate(new Date());
  const safeName = escapeHtml(fullName);
  const safeRole = escapeHtml(role);
  try {
    await sendEmail({
      to: email,
      subject: 'New sign-in to your SAGE account',
      text: [
        `Hello ${fullName},`,
        '',
        'Your SAGE Campus Access account was successfully signed in.',
        `Account type: ${role}`,
        `Time: ${signedInAt}`,
        '',
        'If this was not you, change your password and contact your campus administrator immediately.',
        '',
        'SAGE Campus Access',
      ].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;color:#10243b;line-height:1.55"><p>Hello ${safeName},</p><p>Your SAGE Campus Access account was <strong>successfully signed in</strong>.</p><p><strong>Account type:</strong> ${safeRole}<br><strong>Time:</strong> ${escapeHtml(signedInAt)}</p><p>If this was not you, change your password and contact your campus administrator immediately.</p><p>SAGE Campus Access</p></div>`,
    });
  } catch (error) {
    console.error(`Failed to send login notification email: ${error.message}`);
  }
}

async function sendPassCreatedEmail(pass, fullName, email) {
  const qrCode = await QRCode.toBuffer(pass.referenceId, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: { dark: '#052659', light: '#ffffff' },
  });
  const safeName = escapeHtml(fullName);
  const safeReferenceId = escapeHtml(pass.referenceId);
  const safeHost = escapeHtml(pass.hostDepartment);
  const safePurpose = escapeHtml(pass.purpose);
  const safeAssets = pass.assets.map((asset) =>
    `<li>${escapeHtml(asset.itemDescription)} (Serial: ${escapeHtml(asset.serialNumber)})</li>`,
  ).join('');
  return sendVisitorNotification(
    email,
    'SAGE campus visit request received',
    [
      `Hello ${fullName},`,
      '',
      'We received your campus visit request. Its current status is pending approval.',
      '',
      `Reference ID: ${pass.referenceId}`,
      `Host department: ${pass.hostDepartment}`,
      `Purpose: ${pass.purpose}`,
      `Arrival: ${formatEmailDate(pass.validFrom)}`,
      `Departure: ${formatEmailDate(pass.validUntil)}`,
      ...(pass.assets.length
        ? ['', 'Registered equipment:', ...pass.assets.map((asset) => `- ${asset.itemDescription} (Serial: ${asset.serialNumber})`)]
        : []),
      '',
      'Campus has one main entrance gate. Present either this Reference ID or the attached QR code to the security guard for pass verification and check-in.',
      'Entry is allowed only after the pass is approved and during its validity window. Bring your government-issued photo ID.',
      '',
      'SAGE Campus Access',
    ].join('\n'),
    'visit request',
    {
      html: `<div style="font-family:Arial,sans-serif;color:#10243b;line-height:1.55"><p>Hello ${safeName},</p><p>Your campus visit request has been received and is <strong>pending approval</strong>.</p><p><strong>Reference ID</strong><br><span style="display:inline-block;padding:10px 14px;border:1px solid #7da0ca;border-radius:6px;background:#eff8ff;color:#052659;font-size:18px;font-weight:bold;letter-spacing:1px">${safeReferenceId}</span></p><p><strong>Host department:</strong> ${safeHost}<br><strong>Purpose:</strong> ${safePurpose}<br><strong>Arrival:</strong> ${escapeHtml(formatEmailDate(pass.validFrom))}<br><strong>Departure:</strong> ${escapeHtml(formatEmailDate(pass.validUntil))}</p>${safeAssets ? `<p><strong>Registered equipment</strong></p><ul>${safeAssets}</ul>` : ''}<p><strong>At the gate:</strong> Campus has one main entrance gate. Present either the Reference ID above or the attached QR code to the security guard for pass verification and check-in. Bring your government-issued photo ID.</p><p>Entry is allowed only after approval and during the pass validity window.</p><p><img src="cid:sage-pass-qr" width="240" height="240" alt="QR code for Reference ID ${safeReferenceId}" style="display:block;width:240px;height:240px"><br><small>QR code for Reference ID ${safeReferenceId}</small></p><p>SAGE Campus Access</p></div>`,
      attachments: [{
        filename: `SAGE-${pass.passId}-QR.png`,
        content: qrCode,
        contentType: 'image/png',
        cid: 'sage-pass-qr',
      }],
    },
  );
}

function requireAuth(req, res, next) {
  if (!req.session.staffId) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  const staff = db.prepare(`
    SELECT StaffID, FullName, Email, Role, AccountStatus
    FROM StaffAccount WHERE StaffID = ?
  `).get(req.session.staffId);
  if (!staff || staff.AccountStatus !== 'Active') {
    req.session.destroy(() => {});
    res.status(401).json({ error: 'Your account is unavailable. Please sign in again.' });
    return;
  }
  req.staff = staff;
  next();
}

function requireGuest(req, res, next) {
  if (!req.session.guestId) {
    res.status(401).json({ error: 'Please sign in to your visitor account.' });
    return;
  }
  const guest = db.prepare(`
    SELECT GuestID, FullName, Email, Affiliation, ContactNumber, GovID_Type, AccountStatus
    FROM Guest WHERE GuestID = ? AND PasswordHash IS NOT NULL
  `).get(req.session.guestId);
  if (!guest || guest.AccountStatus !== 'Active') {
    req.session.destroy(() => {});
    res.status(401).json({ error: 'Your visitor account is unavailable. Please sign in again.' });
    return;
  }
  req.guest = guest;
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.staff.Role)) {
      res.status(403).json({ error: 'Your account does not have permission to do that.' });
      return;
    }
    next();
  };
}

function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { error: result.error.issues[0]?.message || 'Please check the submitted information.' };
  }
  return { data: result.data };
}

function passReference() {
  const year = new Date().getUTCFullYear();
  return `SAGE-${year}-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function setUniqueReference(passId) {
  const update = db.prepare('UPDATE GatePass SET ReferenceID = ? WHERE PassID = ?');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      update.run(passReference(), passId);
      return;
    } catch (error) {
      if (!String(error.message).includes('UNIQUE constraint failed')) throw error;
    }
  }
  throw new Error('Could not generate a unique pass reference.');
}

function getPass(passId) {
  const pass = db.prepare(`
    SELECT p.PassID AS passId, p.GuestID AS guestId, p.ReferenceID AS referenceId,
      p.HostDepartment AS hostDepartment, p.Purpose AS purpose,
      p.ValidFrom AS validFrom, p.ValidUntil AS validUntil,
      p.ApprovalStatus AS approvalStatus, p.CreatedAt AS createdAt,
      g.FullName AS fullName, g.Affiliation AS affiliation,
      g.ContactNumber AS contactNumber, g.GovID_Type AS govIdType,
      approving.FullName AS approvedBy,
      (SELECT Direction FROM GateLog
        WHERE PassID = p.PassID AND AssetID IS NULL
        ORDER BY Timestamp DESC, LogID DESC LIMIT 1) AS guestDirection
    FROM GatePass p
    JOIN Guest g ON g.GuestID = p.GuestID
    LEFT JOIN StaffAccount approving ON approving.StaffID = p.ApprovedBy
    WHERE p.PassID = ?
  `).get(passId);
  if (!pass) return null;
  const assets = db.prepare(`
    SELECT AssetID AS assetId, ItemDescription AS itemDescription,
      SerialNumber AS serialNumber, ClearanceStatus AS clearanceStatus,
      (SELECT Direction FROM GateLog
        WHERE AssetID = AssetEntry.AssetID
        ORDER BY Timestamp DESC, LogID DESC LIMIT 1) AS lastDirection
    FROM AssetEntry WHERE PassID = ? ORDER BY AssetID
  `).all(passId);
  const logs = db.prepare(`
    SELECT l.LogID AS logId, l.AssetID AS assetId, l.Direction AS direction,
      l.Timestamp AS timestamp, a.ItemDescription AS assetDescription,
      s.FullName AS staffName, s.StaffID AS staffId
    FROM GateLog l
    LEFT JOIN AssetEntry a ON a.AssetID = l.AssetID
    JOIN StaffAccount s ON s.StaffID = l.StaffID
    WHERE l.PassID = ? ORDER BY l.Timestamp DESC, l.LogID DESC LIMIT 20
  `).all(passId);
  return { ...pass, assets, logs };
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/guest/auth/register', async (req, res, next) => {
  const result = validate(guestAccountSchema, req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    const data = result.data;
    const email = data.email.toLowerCase();
    const existing = db.prepare('SELECT 1 FROM Guest WHERE Email = ? COLLATE NOCASE').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account already exists for this email address.' });
      return;
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const guestId = db.prepare(`
        INSERT INTO Guest (FullName, Affiliation, ContactNumber, GovID_Type, Email, PasswordHash)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        data.fullName,
        data.affiliation,
        data.contactNumber,
        data.govIdType,
        email,
        passwordHash,
      ).lastInsertRowid;
    const emailSent = await sendVisitorNotification(
      email,
      'Welcome to SAGE visitor access',
      `Hello ${data.fullName},\n\nYour SAGE visitor account has been created. Sign in with this email address to request and manage campus visits. Each submitted request receives a Reference ID, which you can copy from your pass or present as its QR code after approval. Entry is allowed only for approved passes during their validity window; bring your government-issued photo ID.\n\nFor your security, never share your password.\n\nSAGE Campus Access`,
      'welcome',
    );
    req.session.regenerate((error) => {
      if (error) {
        next(error);
        return;
      }
      req.session.guestId = Number(guestId);
      const guest = db.prepare('SELECT * FROM Guest WHERE GuestID = ?').get(guestId);
      res.status(201).json({
        guest: publicGuest(guest),
        emailSent,
      });
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'An account already exists for this email address.' });
      return;
    }
    next(error);
  }
});

app.post('/api/guest/auth/login', async (req, res, next) => {
  const result = validate(credentialsSchema, req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    const guest = db.prepare(`
      SELECT * FROM Guest WHERE Email = ? COLLATE NOCASE AND PasswordHash IS NOT NULL
    `).get(result.data.email);
    const validPassword = guest && await bcrypt.compare(result.data.password, guest.PasswordHash);
    if (!guest || !validPassword || guest.AccountStatus !== 'Active') {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }
    req.session.regenerate((error) => {
      if (error) {
        next(error);
        return;
      }
      req.session.guestId = guest.GuestID;
      void sendLoginNotification(publicGuest(guest));
      res.json({ guest: publicGuest(guest) });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/guest/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie('sage.sid', { httpOnly: true, sameSite: 'strict', secure: isProduction });
    res.status(204).end();
  });
});

app.get('/api/guest/auth/session', requireGuest, (req, res) => {
  res.json({ guest: publicGuest(req.guest) });
});

app.post('/api/guest/passes', requireGuest, async (req, res) => {
  const result = validate(visitorPassSchema, req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  const data = result.data;
  const createPass = db.transaction(() => {
    const pass = db.prepare(`
      INSERT INTO GatePass (GuestID, HostDepartment, Purpose, ValidFrom, ValidUntil)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.guest.GuestID,
      data.hostDepartment,
      data.purpose,
      new Date(data.validFrom).toISOString(),
      new Date(data.validUntil).toISOString(),
    );
    setUniqueReference(Number(pass.lastInsertRowid));
    const insertAsset = db.prepare(`
      INSERT INTO AssetEntry (PassID, ItemDescription, SerialNumber)
      VALUES (?, ?, ?)
    `);
    for (const asset of data.assets) {
      insertAsset.run(pass.lastInsertRowid, asset.itemDescription, asset.serialNumber);
    }
    return Number(pass.lastInsertRowid);
  });
  const passId = createPass();
  const pass = getPass(passId);
  const emailSent = await sendPassCreatedEmail(pass, req.guest.FullName, req.guest.Email);
  res.status(201).json({ pass, emailSent });
});

app.get('/api/guest/passes', requireGuest, (req, res) => {
  const passIds = db.prepare(`
    SELECT PassID FROM GatePass WHERE GuestID = ? ORDER BY CreatedAt DESC LIMIT 50
  `).all(req.guest.GuestID);
  res.json({ passes: passIds.map(({ PassID }) => getPass(PassID)) });
});

app.get('/api/guest/passes/reference/:referenceId', (req, res) => {
  const referenceId = req.params.referenceId.trim();
  if (!referenceId || referenceId.length > 64) {
    res.status(400).json({ error: 'Enter a valid visitor Reference ID.' });
    return;
  }
  const passId = db.prepare(`
    SELECT PassID FROM GatePass
    WHERE ReferenceID = ? COLLATE NOCASE AND ApprovalStatus = 'Approved'
  `).get(referenceId)?.PassID;
  if (!passId) {
    res.status(404).json({ error: 'No visitor pass was found for that Reference ID.' });
    return;
  }
  const pass = getPass(passId);
  res.json({
    guest: {
      fullName: pass.fullName,
      affiliation: pass.affiliation,
      role: 'Guest / Visitor',
    },
    pass: {
      passId: pass.passId,
      referenceId: pass.referenceId,
      hostDepartment: pass.hostDepartment,
      purpose: pass.purpose,
      validFrom: pass.validFrom,
      validUntil: pass.validUntil,
      approvalStatus: pass.approvalStatus,
      createdAt: pass.createdAt,
      assets: pass.assets.map(({ assetId, itemDescription, serialNumber, clearanceStatus }) => ({
        assetId,
        itemDescription,
        serialNumber,
        clearanceStatus,
      })),
    },
  });
});

app.get('/api/guest/passes/:id', requireGuest, (req, res) => {
  const passId = Number(req.params.id);
  if (!Number.isSafeInteger(passId) || passId < 1) {
    res.status(400).json({ error: 'Invalid pass ID.' });
    return;
  }
  const pass = db.prepare(`
    SELECT PassID FROM GatePass WHERE PassID = ? AND GuestID = ?
  `).get(passId, req.guest.GuestID);
  if (!pass) {
    res.status(404).json({ error: 'Pass not found.' });
    return;
  }
  res.json({ pass: getPass(passId) });
});

app.post('/api/auth/login', async (req, res, next) => {
  const result = validate(credentialsSchema, req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    const staff = db.prepare(`
      SELECT StaffID, FullName, Email, Role, AccountStatus, PasswordHash
      FROM StaffAccount WHERE Email = ? COLLATE NOCASE
    `).get(result.data.email);
    if (staff && staff.AccountStatus === 'Active' && await bcrypt.compare(result.data.password, staff.PasswordHash)) {
      req.session.regenerate((error) => {
        if (error) {
          next(error);
          return;
        }
        req.session.staffId = staff.StaffID;
        void sendLoginNotification(publicStaff(staff));
        res.json({ staff: publicStaff(staff) });
      });
      return;
    }

    const guest = db.prepare(`
      SELECT * FROM Guest WHERE Email = ? COLLATE NOCASE AND PasswordHash IS NOT NULL
    `).get(result.data.email);
    if (!guest || guest.AccountStatus !== 'Active' || !await bcrypt.compare(result.data.password, guest.PasswordHash)) {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }
    req.session.regenerate((error) => {
      if (error) {
        next(error);
        return;
      }
      req.session.guestId = guest.GuestID;
      void sendLoginNotification(publicGuest(guest));
      res.json({ guest: publicGuest(guest) });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie('sage.sid', { httpOnly: true, sameSite: 'strict', secure: isProduction });
    res.status(204).end();
  });
});

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ staff: publicStaff(req.staff) });
});

app.get('/api/summary', requireAuth, (_req, res) => {
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM GatePass WHERE ApprovalStatus = 'Pending') AS pending,
      (SELECT COUNT(*) FROM GatePass
        WHERE ApprovalStatus = 'Approved' AND ValidFrom <= ? AND ValidUntil >= ?) AS active,
      (SELECT COUNT(*) FROM GatePass WHERE date(CreatedAt) = date('now')) AS today,
      (SELECT COUNT(*) FROM Guest) AS guests
  `).get(new Date().toISOString(), new Date().toISOString());
  const recentLogs = db.prepare(`
    SELECT l.LogID AS logId, l.Direction AS direction, l.Timestamp AS timestamp,
      p.ReferenceID AS referenceId, g.FullName AS fullName,
      s.FullName AS staffName, a.ItemDescription AS assetDescription
    FROM GateLog l
    JOIN GatePass p ON p.PassID = l.PassID
    JOIN Guest g ON g.GuestID = p.GuestID
    JOIN StaffAccount s ON s.StaffID = l.StaffID
    LEFT JOIN AssetEntry a ON a.AssetID = l.AssetID
    ORDER BY l.Timestamp DESC, l.LogID DESC LIMIT 8
  `).all();
  res.json({ ...counts, recentLogs });
});

app.get('/api/passes', requireAuth, (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 120);
  const like = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const passes = db.prepare(`
    SELECT p.PassID AS passId, p.ReferenceID AS referenceId,
      p.HostDepartment AS hostDepartment, p.Purpose AS purpose,
      p.ValidFrom AS validFrom, p.ValidUntil AS validUntil,
      p.ApprovalStatus AS approvalStatus, p.CreatedAt AS createdAt,
      g.FullName AS fullName, g.Affiliation AS affiliation,
      (SELECT COUNT(*) FROM AssetEntry a WHERE a.PassID = p.PassID) AS assetCount
    FROM GatePass p JOIN Guest g ON g.GuestID = p.GuestID
    WHERE (? = '' OR p.ReferenceID = ? COLLATE NOCASE
      OR g.FullName LIKE ? ESCAPE char(92))
    ORDER BY p.CreatedAt DESC LIMIT 50
  `).all(query, query, like);
  res.json({ passes });
});

app.get('/api/passes/:id', requireAuth, (req, res) => {
  const passId = Number(req.params.id);
  if (!Number.isSafeInteger(passId) || passId < 1) {
    res.status(400).json({ error: 'Invalid pass ID.' });
    return;
  }
  const pass = getPass(passId);
  if (!pass) {
    res.status(404).json({ error: 'Pass not found.' });
    return;
  }
  res.json({ pass });
});

app.post('/api/passes', requireAuth, allowRoles('Facilities Officer'), async (req, res) => {
  const result = validate(passSchema, req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  const data = result.data;
  const guestEmail = data.guest.email.toLowerCase();
  const createPass = db.transaction(() => {
    const existingGuest = db.prepare(`
      SELECT GuestID, PasswordHash FROM Guest WHERE Email = ? COLLATE NOCASE
    `).get(guestEmail);
    let guestId;
    if (existingGuest) {
      guestId = existingGuest.GuestID;
      if (!existingGuest.PasswordHash) {
        db.prepare(`
          UPDATE Guest SET FullName = ?, Affiliation = ?, ContactNumber = ?, GovID_Type = ?
          WHERE GuestID = ?
        `).run(
          data.guest.fullName,
          data.guest.affiliation,
          data.guest.contactNumber,
          data.guest.govIdType,
          guestId,
        );
      }
    } else {
      guestId = db.prepare(`
        INSERT INTO Guest (FullName, Affiliation, ContactNumber, GovID_Type, Email)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        data.guest.fullName,
        data.guest.affiliation,
        data.guest.contactNumber,
        data.guest.govIdType,
        guestEmail,
      ).lastInsertRowid;
    }
    const pass = db.prepare(`
      INSERT INTO GatePass (GuestID, HostDepartment, Purpose, ValidFrom, ValidUntil)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      guestId,
      data.hostDepartment,
      data.purpose,
      new Date(data.validFrom).toISOString(),
      new Date(data.validUntil).toISOString(),
    );
    setUniqueReference(Number(pass.lastInsertRowid));
    const insertAsset = db.prepare(`
      INSERT INTO AssetEntry (PassID, ItemDescription, SerialNumber)
      VALUES (?, ?, ?)
    `);
    for (const asset of data.assets) {
      insertAsset.run(pass.lastInsertRowid, asset.itemDescription, asset.serialNumber);
    }
    return Number(pass.lastInsertRowid);
  });
  const passId = createPass();
  const pass = getPass(passId);
  const emailSent = await sendPassCreatedEmail(pass, pass.fullName, guestEmail);
  res.status(201).json({ pass, emailSent });
});

app.patch('/api/passes/:id/validity', requireAuth, allowRoles('Facilities Officer'), (req, res) => {
  const passId = Number(req.params.id);
  const result = validate(validitySchema, req.body);
  if (!Number.isSafeInteger(passId) || passId < 1) {
    res.status(400).json({ error: 'Invalid pass ID.' });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  const pass = db.prepare('SELECT * FROM GatePass WHERE PassID = ?').get(passId);
  if (!pass) {
    res.status(404).json({ error: 'Pass not found.' });
    return;
  }
  if (pass.ApprovalStatus === 'Rejected') {
    res.status(409).json({ error: 'A declined pass cannot be changed.' });
    return;
  }
  if (Date.parse(result.data.validUntil) <= Date.now()) {
    res.status(400).json({ error: 'The end of the validity window must be in the future.' });
    return;
  }
  const latestGuestMovement = db.prepare(`
    SELECT Direction FROM GateLog WHERE PassID = ? AND AssetID IS NULL
    ORDER BY Timestamp DESC, LogID DESC LIMIT 1
  `).get(passId);
  if (latestGuestMovement?.Direction === 'IN') {
    res.status(409).json({ error: 'A validity window cannot be changed while the guest is inside.' });
    return;
  }
  db.prepare(`
    UPDATE GatePass SET ValidFrom = ?, ValidUntil = ? WHERE PassID = ?
  `).run(
    new Date(result.data.validFrom).toISOString(),
    new Date(result.data.validUntil).toISOString(),
    passId,
  );
  res.json({ pass: getPass(passId) });
});

app.patch('/api/passes/:id/approval', requireAuth, allowRoles('Facilities Officer'), (req, res) => {
  const passId = Number(req.params.id);
  const result = validate(z.object({ status: z.enum(['Approved', 'Rejected']) }), req.body);
  if (!Number.isSafeInteger(passId) || passId < 1) {
    res.status(400).json({ error: 'Invalid pass ID.' });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  const pass = db.prepare('SELECT * FROM GatePass WHERE PassID = ?').get(passId);
  if (!pass) {
    res.status(404).json({ error: 'Pass not found.' });
    return;
  }
  if (pass.ApprovalStatus !== 'Pending') {
    res.status(409).json({ error: 'Only pending passes can be approved or rejected.' });
    return;
  }
  if (result.data.status === 'Approved') {
    const now = new Date().toISOString();
    if (Date.parse(pass.ValidUntil) <= Date.now() || Date.parse(pass.ValidFrom) >= Date.parse(pass.ValidUntil)) {
      res.status(409).json({ error: 'This pass is expired or has an invalid validity window.' });
      return;
    }
    const approve = db.transaction(() => {
      if (!pass.ReferenceID) setUniqueReference(passId);
      db.prepare(`
        UPDATE GatePass SET ApprovalStatus = 'Approved', ApprovedBy = ?, ApprovedAt = ?
        WHERE PassID = ?
      `).run(req.staff.StaffID, now, passId);
    });
    approve();
  } else {
    db.prepare(`
      UPDATE GatePass SET ApprovalStatus = 'Rejected', ApprovedBy = ?, ApprovedAt = ?
      WHERE PassID = ?
    `).run(req.staff.StaffID, new Date().toISOString(), passId);
  }
  res.json({ pass: getPass(passId) });
});

app.patch('/api/assets/:id/clearance', requireAuth, allowRoles('Facilities Officer'), (req, res) => {
  const assetId = Number(req.params.id);
  const result = validate(z.object({ status: z.enum(['Cleared', 'Denied']) }), req.body);
  if (!Number.isSafeInteger(assetId) || assetId < 1) {
    res.status(400).json({ error: 'Invalid equipment ID.' });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  const update = db.prepare(`
    UPDATE AssetEntry SET ClearanceStatus = ? WHERE AssetID = ?
  `).run(result.data.status, assetId);
  if (!update.changes) {
    res.status(404).json({ error: 'Equipment item not found.' });
    return;
  }
  res.json({ status: result.data.status });
});

app.post('/api/passes/:id/logs', requireAuth, allowRoles('Facilities Officer', 'Campus Security Guard'), (req, res) => {
  const passId = Number(req.params.id);
  const result = validate(z.object({
    direction: z.enum(['IN', 'OUT']),
    assetId: z.number().int().positive().nullable().optional(),
  }), req.body);
  if (!Number.isSafeInteger(passId) || passId < 1) {
    res.status(400).json({ error: 'Invalid pass ID.' });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  const pass = db.prepare('SELECT * FROM GatePass WHERE PassID = ?').get(passId);
  if (!pass) {
    res.status(404).json({ error: 'Pass not found.' });
    return;
  }
  const now = Date.now();
  if (
    pass.ApprovalStatus !== 'Approved'
    || now < Date.parse(pass.ValidFrom)
    || now > Date.parse(pass.ValidUntil)
  ) {
    res.status(409).json({ error: 'This pass is not approved and currently valid.' });
    return;
  }
  const assetId = result.data.assetId ?? null;
  if (assetId !== null) {
    const asset = db.prepare(`
      SELECT ClearanceStatus FROM AssetEntry WHERE AssetID = ? AND PassID = ?
    `).get(assetId, passId);
    if (!asset) {
      res.status(400).json({ error: 'That equipment item is not attached to this pass.' });
      return;
    }
    if (asset.ClearanceStatus !== 'Cleared') {
      res.status(409).json({ error: 'This equipment item has not been cleared.' });
      return;
    }
  }
  const latest = assetId === null
    ? db.prepare(`
      SELECT Direction FROM GateLog WHERE PassID = ? AND AssetID IS NULL
      ORDER BY Timestamp DESC, LogID DESC LIMIT 1
    `).get(passId)
    : db.prepare(`
      SELECT Direction FROM GateLog WHERE AssetID = ?
      ORDER BY Timestamp DESC, LogID DESC LIMIT 1
    `).get(assetId);
  if (result.data.direction === 'IN' && latest?.Direction === 'IN') {
    res.status(409).json({ error: 'This movement is already recorded as inside.' });
    return;
  }
  if (result.data.direction === 'OUT' && latest?.Direction !== 'IN') {
    res.status(409).json({ error: 'An entry must be recorded before an exit.' });
    return;
  }
  const log = db.prepare(`
    INSERT INTO GateLog (PassID, AssetID, StaffID, Direction)
    VALUES (?, ?, ?, ?)
  `).run(passId, assetId, req.staff.StaffID, result.data.direction);
  res.status(201).json({ logId: Number(log.lastInsertRowid), timestamp: new Date().toISOString() });
});

app.use((error, req, res, _next) => {
  console.error(`Request failed: ${req.method} ${req.path}`, error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  const message = status < 500 || !isProduction
    ? error.message
    : 'The server could not complete this request. Please retry; the failure was logged.';
  res.status(status).json({ error: message });
});

const frontendBuildDirectory = path.join(projectDirectory, 'dist');
if (isProduction && existsSync(path.join(frontendBuildDirectory, 'index.html'))) {
  app.use(express.static(frontendBuildDirectory));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendBuildDirectory, 'index.html')));
}

if (!isProduction && process.env.SAGE_SEED_DEMO !== 'false') {
  try {
    await seedDemoAccounts(db, process.env.SAGE_DEMO_PASSWORD || 'SageDemo2026!');
  } catch (error) {
    console.error('SAGE startup failed while initializing demo accounts:', error);
    db.close();
    process.exit(1);
  }
}

if (isProduction && (process.env.SAGE_FACILITIES_PASSWORD || process.env.SAGE_GUARD_PASSWORD)) {
  const accounts = await bootstrapStaffAccounts(db, getStaffAccountsFromEnvironment());
  for (const account of accounts) {
    console.log(`Created or reset ${account.role} account: ${account.email}`);
  }
}

const cleanupTimer = setInterval(() => {
  try {
    db.prepare('DELETE FROM SessionStore WHERE ExpiresAt <= ?').run(Date.now());
  } catch (error) {
    console.error('Session cleanup failed:', error);
  }
}, 60 * 60 * 1000);
cleanupTimer.unref();

const server = app.listen(port, () => {
  console.log(`SAGE API listening on http://localhost:${port}`);
});

function shutDown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
