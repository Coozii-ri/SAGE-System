import session from 'express-session';

export class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.getStatement = database.prepare(
      'SELECT SessionData, ExpiresAt FROM SessionStore WHERE SessionID = ?',
    );
    this.setStatement = database.prepare(`
      INSERT INTO SessionStore (SessionID, SessionData, ExpiresAt)
      VALUES (?, ?, ?)
      ON CONFLICT(SessionID) DO UPDATE SET
        SessionData = excluded.SessionData,
        ExpiresAt = excluded.ExpiresAt
    `);
    this.destroyStatement = database.prepare('DELETE FROM SessionStore WHERE SessionID = ?');
    this.touchStatement = database.prepare(
      'UPDATE SessionStore SET ExpiresAt = ? WHERE SessionID = ?',
    );
    this.cleanupStatement = database.prepare('DELETE FROM SessionStore WHERE ExpiresAt <= ?');
  }

  get(sessionId, callback) {
    try {
      const row = this.getStatement.get(sessionId);
      if (!row || row.ExpiresAt <= Date.now()) {
        this.destroyStatement.run(sessionId);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.SessionData));
    } catch (error) {
      callback(error);
    }
  }

  set(sessionId, sessionData, callback = () => {}) {
    try {
      const expiry = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this.setStatement.run(sessionId, JSON.stringify(sessionData), expiry);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sessionId, callback = () => {}) {
    try {
      this.destroyStatement.run(sessionId);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sessionId, sessionData, callback = () => {}) {
    try {
      const expiry = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this.touchStatement.run(expiry, sessionId);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  cleanup() {
    this.cleanupStatement.run(Date.now());
  }
}
