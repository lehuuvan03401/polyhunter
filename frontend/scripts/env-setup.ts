import fs from 'fs';
import path from 'path';

// Manual .env loader
try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
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
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    } else {
        console.warn(`[EnvSetup] .env file not found at ${envPath}`);
    }
} catch (e) {
    console.error('[EnvSetup] Failed to load env:', e);
}
