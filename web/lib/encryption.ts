import crypto from 'crypto';
import { assertCopyTradingEncryptionKeyConfigured } from '@/lib/copy-trading/runtime-config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const ENCRYPTION_KEY_HEX = assertCopyTradingEncryptionKeyConfigured();

export class EncryptionService {
    private static getKeyBuffer(): Buffer {
        const keyBuffer = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
        if (keyBuffer.length !== 32) {
            throw new Error("Invalid ENCRYPTION_KEY length. Must be 32 bytes (64 hex chars).");
        }
        return keyBuffer;
    }

    /**
     * Encrypts text using AES-256-CBC
     */
    static encrypt(text: string): { encryptedData: string; iv: string } {
        const iv = crypto.randomBytes(IV_LENGTH);
        const keyBuffer = EncryptionService.getKeyBuffer();

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
        const keyBuffer = EncryptionService.getKeyBuffer();

        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    }
}
