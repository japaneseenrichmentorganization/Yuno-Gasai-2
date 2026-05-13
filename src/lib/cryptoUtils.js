/*
    Yuno Gasai. A Discord.JS based bot, with multiple features.
    Copyright (C) 2018 Maeeen <maeeennn@gmail.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see https://www.gnu.org/licenses/.
*/

"use strict";

/**
 * Field-level encryption utilities using Node.js built-in crypto.
 * Provides AES-256-GCM encryption for sensitive database fields.
 *
 * Format versions
 * ---------------
 * V1 (legacy): salt(16) + iv(16) + authTag(16) + ciphertext
 *   - PBKDF2 was run on EVERY encrypt/decrypt call (100k iterations each).
 *   - Still supported for decryption of existing data.
 *
 * V2 (current): MAGIC(4) + iv(12) + authTag(16) + ciphertext
 *   - Master key is derived ONCE at startup via async PBKDF2, then cached.
 *   - Encrypt/decrypt calls are fast synchronous AES-256-GCM operations.
 *   - Migration: any V1 ciphertext is automatically returned in V2 format when
 *     re-encrypted (e.g. via a migration script).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const KEY_ITERATIONS = 100000;
const KEY_DIGEST = 'sha256';

// V2 format constants
const V2_MAGIC = Buffer.from([0x59, 0x4E, 0x02, 0x00]); // "YN\x02\x00"
const V2_IV_LENGTH = 12; // GCM recommended nonce size

// V1 (legacy) format constants
const V1_SALT_LENGTH = 16;
const V1_IV_LENGTH = 16;
const V1_MIN_LENGTH = V1_SALT_LENGTH + V1_IV_LENGTH + AUTH_TAG_LENGTH + 1; // 49

/**
 * Derives the V2 master key from a passphrase.
 * The PBKDF2 salt is deterministic from the passphrase so no external salt
 * storage is required. Security relies entirely on passphrase secrecy.
 * This runs ONCE at startup — all subsequent encryptions use the cached key.
 * @param {string} passphrase
 * @returns {Promise<Buffer>} 32-byte master key
 */
async function deriveMasterKey(passphrase) {
    const salt = crypto.createHash('sha256')
        .update('yuno-gasai-field-encryption-v2-salt:')
        .update(passphrase)
        .digest();
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(passphrase, salt, KEY_ITERATIONS, 32, KEY_DIGEST, (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });
}

/**
 * Legacy synchronous key derivation — used ONLY when decrypting V1 ciphertexts
 * (backward compatibility path). New data is never written in V1 format.
 */
function _deriveKeyLegacySync(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, 32, KEY_DIGEST);
}

/** Encrypt a plaintext string using the V2 format (fast — no KDF per call). */
function _encryptV2(text, masterKey) {
    const iv = crypto.randomBytes(V2_IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([V2_MAGIC, iv, authTag, ciphertext]).toString('base64');
}

/** Decrypt a V2 ciphertext (fast — no KDF per call). */
function _decryptV2(buf, masterKey) {
    const iv = buf.slice(V2_MAGIC.length, V2_MAGIC.length + V2_IV_LENGTH);
    const authTag = buf.slice(V2_MAGIC.length + V2_IV_LENGTH, V2_MAGIC.length + V2_IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.slice(V2_MAGIC.length + V2_IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Decrypt a V1 ciphertext synchronously (legacy backward-compat path). */
function _decryptV1Legacy(buf, passphrase) {
    const salt = buf.slice(0, V1_SALT_LENGTH);
    const iv = buf.slice(V1_SALT_LENGTH, V1_SALT_LENGTH + V1_IV_LENGTH);
    const authTag = buf.slice(V1_SALT_LENGTH + V1_IV_LENGTH, V1_SALT_LENGTH + V1_IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.slice(V1_SALT_LENGTH + V1_IV_LENGTH + AUTH_TAG_LENGTH);
    const key = _deriveKeyLegacySync(passphrase, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Creates an async encryption helper that derives the master key once.
 * The returned object has SYNCHRONOUS encrypt() and decrypt() methods
 * that use the cached master key — no event-loop blocking per call.
 * @param {string} passphrase
 * @returns {Promise<{enabled: boolean, encrypt: Function, decrypt: Function}>}
 */
async function createEncryptionHelperAsync(passphrase) {
    const masterKey = await deriveMasterKey(passphrase);

    return {
        enabled: true,
        encrypt(value) {
            if (value === null || value === undefined) return null;
            return _encryptV2(value, masterKey);
        },
        decrypt(value) {
            if (value === null || value === undefined) return null;
            try {
                const buf = Buffer.from(value, 'base64');

                // V2 format: starts with magic bytes
                const minV2 = V2_MAGIC.length + V2_IV_LENGTH + AUTH_TAG_LENGTH + 1;
                if (buf.length >= minV2 && buf.slice(0, V2_MAGIC.length).equals(V2_MAGIC)) {
                    return _decryptV2(buf, masterKey);
                }

                // V1 (legacy) format: salt + iv + authTag + ciphertext
                if (buf.length >= V1_MIN_LENGTH) {
                    return _decryptV1Legacy(buf, passphrase);
                }

                // Too short to be encrypted — return as-is (unencrypted legacy data)
                return value;
            } catch {
                return value;
            }
        }
    };
}

/**
 * Creates a no-op (encryption-disabled) helper synchronously.
 * Used as the initial state before setFieldEncryptionKey is called.
 * @returns {{enabled: boolean, encrypt: Function, decrypt: Function}}
 */
function createEncryptionHelper(passphrase) {
    if (passphrase !== null && passphrase !== undefined && passphrase.length > 0) {
        throw new Error("Use createEncryptionHelperAsync() for encrypted helpers — it derives the key asynchronously to avoid blocking the event loop.");
    }
    return {
        enabled: false,
        encrypt: (value) => value,
        decrypt: (value) => value
    };
}

/**
 * Checks if a value appears to be encrypted in either V1 or V2 format.
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
    if (typeof value !== 'string') return false;
    try {
        const buf = Buffer.from(value, 'base64');
        const minV2 = V2_MAGIC.length + V2_IV_LENGTH + AUTH_TAG_LENGTH + 1;
        if (buf.length >= minV2 && buf.slice(0, V2_MAGIC.length).equals(V2_MAGIC)) return true;
        return buf.length >= V1_MIN_LENGTH;
    } catch {
        return false;
    }
}

module.exports = {
    createEncryptionHelper,
    createEncryptionHelperAsync,
    isEncrypted,
    // Exported for db-integrity-check.js backward-compat (legacy decryption only)
    _deriveKeyLegacySync,
};
