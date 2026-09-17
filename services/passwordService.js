/**
 * Cryptographic Password Hashing and Verification Service
 * Uses Node.js built-in crypto.scryptSync with random salts and timing-safe comparison
 */

const crypto = require('crypto');

const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Hash plain text password securely with scrypt and random salt
 * @param {string} password 
 * @returns {string} Formatted hash string: 'scrypt$salt$hash'
 */
function hashPassword(password) {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string.');
    }
    const salt = crypto.randomBytes(SALT_LEN).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verify plain text password against stored salt-hashed string using timingSafeEqual
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
    if (!password || !storedHash || typeof storedHash !== 'string') {
        return false;
    }

    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
    }

    const salt = parts[1];
    const key = parts[2];
    const keyBuffer = Buffer.from(key, 'hex');

    try {
        const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
        return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch (err) {
        return false;
    }
}

module.exports = {
    hashPassword,
    verifyPassword
};
