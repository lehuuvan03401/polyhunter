import fs from 'fs';
import path from 'path';

const loadEnvFile = (envPath: string) => {
    if (!fs.existsSync(envPath)) return false;
    console.log(`[EnvSetup] Loading env from ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (process.env[key] === undefined || process.env[key] === '') {
                process.env[key] = value;
            }
        }
    });
    return true;
};

// Manual .env loader (prefer .env.local, then .env.local.secrets, fallback to .env)
try {
    const envLocalPath = path.resolve(__dirname, '../.env.local');
    const envLocalSecretsPath = path.resolve(__dirname, '../.env.local.secrets');
    const envPath = path.resolve(__dirname, '../.env');
    const loadedLocal = loadEnvFile(envLocalPath);
    const loadedSecrets = loadEnvFile(envLocalSecretsPath);
    const loadedEnv = loadEnvFile(envPath);
    if (!(loadedLocal || loadedSecrets || loadedEnv)) {
        console.warn(`[EnvSetup] .env.local/.env file not found in ${path.resolve(__dirname, '..')}`);
    }
} catch (e) {
    console.error('[EnvSetup] Failed to load env:', e);
}
