import fs from "fs";
import path from "path";

const envType = process.argv[2];

if (!envType) {
    console.error("Please provide an environment type (e.g., mainnet, localhost)");
    process.exit(1);
}

const rootDir = process.cwd();
const envLocalTarget = path.join(rootDir, ".env.local");
const envLocalFile = path.join(rootDir, `.env.local.${envType}`);
const envSecretsFile = path.join(rootDir, ".env.local.secrets");

let finalContent = "";

if (fs.existsSync(envLocalFile)) {
    finalContent += fs.readFileSync(envLocalFile, "utf-8") + "\n";
} else {
    console.warn(`Warning: ${envLocalFile} not found.`);
}

if (fs.existsSync(envSecretsFile)) {
    finalContent += fs.readFileSync(envSecretsFile, "utf-8") + "\n";
} else {
    console.warn(`Warning: ${envSecretsFile} not found.`);
}

fs.writeFileSync(envLocalTarget, finalContent);
console.log(`Successfully merged .env.local.${envType} and .env.local.secrets into .env.local`);
