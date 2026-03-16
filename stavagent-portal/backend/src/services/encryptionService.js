/**
 * Encryption Service — AES-256-GCM envelope encryption
 *
 * MASTER_ENCRYPTION_KEY: 64-char hex string (32 bytes) from env.
 * Never stored in DB, never logged.
 *
 * Storage format: base64url(iv[12] + ciphertext + authTag[16])
 * AAD (Additional Authenticated Data) = connection UUID — prevents ciphertext reuse.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96 bits per NIST recommendation
const TAG_LENGTH = 16;      // 128 bits

/**
 * Get the master key as a Buffer. Throws if not configured.
 */
function getMasterKey() {
  const hex = process.env.MASTER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('MASTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext credentials.
 * @param {string} plaintext - The API key or credentials JSON string
 * @param {string} connectionId - UUID used as AAD to bind ciphertext to this connection
 * @returns {{ encrypted: string, iv: string }} base64url-encoded encrypted blob + hex IV
 */
export function encrypt(plaintext, connectionId) {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const aad = Buffer.from(connectionId, 'utf8');

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + ciphertext + authTag
  const packed = Buffer.concat([iv, ciphertext, authTag]);

  return {
    encrypted: packed.toString('base64url'),
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypt credentials.
 * @param {string} encryptedBase64 - base64url(iv + ciphertext + authTag)
 * @param {string} connectionId - UUID used as AAD
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedBase64, connectionId) {
  const key = getMasterKey();
  const packed = Buffer.from(encryptedBase64, 'base64url');

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH);
  const aad = Buffer.from(connectionId, 'utf8');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Check if encryption is available (MASTER_ENCRYPTION_KEY is set).
 */
export function isEncryptionAvailable() {
  const hex = process.env.MASTER_ENCRYPTION_KEY;
  return !!hex && hex.length === 64;
}
