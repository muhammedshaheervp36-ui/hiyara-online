// Run from a terminal. The password is read interactively and never logged.
const readline = require('node:readline');
const { Writable } = require('node:stream');
const Store = require('../database/store');
const { hashPassword } = require('../services/passwordService');
const SessionService = require('../services/sessionService');
let muted = false;
const output = new Writable({write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); }});
const rl = readline.createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
const ask = prompt => new Promise(resolve => rl.question(prompt, resolve));
(async () => {
    const email = (await ask('Admin email: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
    process.stdout.write('New password (at least 12 characters): ');
    muted = true;
    const password = await ask('');
    muted = false;
    process.stdout.write('\n');
    if (password.length < 12) throw new Error('Use at least 12 characters.');
    const old = Store.getUserByEmail(email);
    Store.saveUser({id: old?.id || require('node:crypto').randomUUID(), email,
        name: old?.name || 'Administrator', role: 'admin', passwordHash: hashPassword(password)});
    // Invalidate sessions when resetting an account password.
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.join(process.env.HIYARA_DATA_DIR || path.join(__dirname, '..', 'data'), 'sessions.json');
    if (fs.existsSync(file)) {
        for (const session of JSON.parse(fs.readFileSync(file, 'utf8'))) {
            if (session.userId === old?.id) SessionService.destroySession(session.token);
        }
    }
    console.log('Admin account saved. Start the server with npm start.');
})().catch(error => { muted = false; console.error(error.message); process.exitCode = 1; }).finally(() => rl.close());
