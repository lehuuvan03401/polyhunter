import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Fallback key if env var is missing (Use with caution in dev only)
// In prod, ensure ENCRYPTION_KEY is set and 32 bytes hex.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
const IV_LENGTH = 16;

export class EncryptionService {

    /**
     * Encrypts text using AES-256-CBC
     */
    static encrypt(text: string): { encryptedData: string; iv: string } {
        const iv = crypto.randomBytes(IV_LENGTH);
        const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

        // Ensure key length is correct (32 bytes for AES-256)
        if (keyBuffer.length !== 32) {
            throw new Error("Invalid ENCRYPTION_KEY length. Must be 32 bytes (64 hex chars).");
        }

        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return {
            encryptedData: encrypted.toString('hex'),
            iv: iv.toString('hex')
        };
    }

    /**
     * Decrypts text using AES-256-CBC
     */
    static decrypt(encryptedData: string, ivHex: string): string {
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedData, 'hex');
        const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

        // Ensure key length is correct
        if (keyBuffer.length !== 32) {
            throw new Error("Invalid ENCRYPTION_KEY length. Must be 32 bytes (64 hex chars).");
        }

        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    }
}
