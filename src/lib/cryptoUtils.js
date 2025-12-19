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

/**
 * Field-level encryption utilities using Node.js built-in crypto.
 * Provides AES-256-GCM encryption for sensitive database fields.
 *
 * This is an alternative to SQLCipher when using Node.js 24 native SQLite,
 * which doesn't support database-level encryption.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_ITERATIONS = 100000;

/**
 * Derives a 32-byte key from a passphrase using PBKDF2
 * @param {string} passphrase - The passphrase to derive from
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} 32-byte key
 */
function deriveKey(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, 32, 'sha256');
}

/**
 * Encrypts a string using AES-256-GCM
 * @param {string|null} plaintext - The text to encrypt
 * @param {string} passphrase - The encryption passphrase
 * @returns {string|null} Base64 encoded encrypted data (salt + iv + authTag + ciphertext) or null
 */
function encrypt(plaintext, passphrase) {
    if (plaintext === null || plaintext === undefined) {
        return null;
    }

    const text = String(plaintext);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(passphrase, salt);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: salt (16) + iv (16) + authTag (16) + ciphertext
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString('base64');
}

/**
 * Decrypts a string encrypted with encrypt()
 * @param {string|null} encryptedData - Base64 encoded encrypted data
 * @param {string} passphrase - The encryption passphrase
 * @returns {string|null} Decrypted plaintext or original value if decryption fails
 */
function decrypt(encryptedData, passphrase) {
    if (encryptedData === null || encryptedData === undefined) {
        return null;
    }

    try {
        const buffer = Buffer.from(encryptedData, 'base64');

        // Minimum size check: salt (16) + iv (16) + authTag (16) + at least 1 byte ciphertext
        if (buffer.length < 49) {
            // Too short to be encrypted data, return as-is (legacy unencrypted data)
            return encryptedData;
        }

        const salt = buffer.slice(0, SALT_LENGTH);
        const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = buffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = buffer.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

        const key = deriveKey(passphrase, salt);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        // If decryption fails, it might be unencrypted legacy data
        // Return the original value
        return encryptedData;
    }
}

/**
 * Checks if a value appears to be encrypted (base64 with correct minimum length)
 * @param {string} value - Value to check
 * @returns {boolean}
 */
function isEncrypted(value) {
    if (typeof value !== 'string') return false;
    try {
        const buffer = Buffer.from(value, 'base64');
        // Minimum size: salt (16) + iv (16) + authTag (16) + 1 (min ciphertext)
        return buffer.length >= 49;
    } catch {
        return false;
    }
}

/**
 * Creates an encryption helper bound to a specific passphrase
 * @param {string|null} passphrase - The encryption passphrase (null to disable)
 * @returns {Object} Object with encrypt and decrypt methods
 */
function createEncryptionHelper(passphrase) {
    const enabled = passphrase !== null && passphrase !== undefined && passphrase.length > 0;

    return {
        enabled,
        encrypt: enabled ? (value) => encrypt(value, passphrase) : (value) => value,
        decrypt: enabled ? (value) => decrypt(value, passphrase) : (value) => value
    };
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted,
    deriveKey,
    createEncryptionHelper
};
