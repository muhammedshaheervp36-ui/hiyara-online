/**
 * Session and HttpOnly Cookie Management Service
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.HIYARA_DATA_DIR || path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSessions() {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) {
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeSessions(sessions) {
    const temp = SESSIONS_FILE + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(sessions, null, 2), { mode: 0o600 });
    fs.renameSync(temp, SESSIONS_FILE);
}

const SessionService = {
    COOKIE_NAME: SESSION_COOKIE_NAME,

    createSession(user) {
        const token = crypto.randomBytes(32).toString('hex');
        const now = Date.now();
        const session = {
            id: `SESS-${now}-${crypto.randomBytes(4).toString('hex')}`,
            token,
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
        };

        const sessions = readSessions().filter(s => new Date(s.expiresAt).getTime() > Date.now());
        sessions.push(session);
        writeSessions(sessions);
        return session;
    },

    getSession(token) {
        if (!token) return null;
        const sessions = readSessions();
        const session = sessions.find(s => s.token === token);
        if (!session) return null;

        if (!(new Date(session.expiresAt).getTime() > Date.now())) {
            this.destroySession(token);
            return null;
        }

        return session;
    },

    destroySession(token) {
        let sessions = readSessions();
        sessions = sessions.filter(s => s.token !== token);
        writeSessions(sessions);
    },

    parseCookies(req) {
        const list = Object.create(null);
        const rc = req.headers.cookie;

        if (rc) {
            rc.split(';').forEach(cookie => {
                const parts = cookie.split('=');
                const key = parts.shift().trim();
                try { list[key] = decodeURIComponent(parts.join('=')); } catch { /* Ignore malformed cookies. */ }
            });
        }
        return list;
    },

    buildSessionCookieHeader(token) {
        return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    },

    buildLogoutCookieHeader() {
        return `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    }
};

module.exports = SessionService;
