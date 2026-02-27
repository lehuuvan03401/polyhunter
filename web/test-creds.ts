import "dotenv/config";
import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve(__dirname, ".env.local") });

const CLOB_API_KEY = process.env.POLY_API_KEY || process.env.CLOB_API_KEY;
const CLOB_API_SECRET = process.env.POLY_API_SECRET || process.env.CLOB_API_SECRET;
const CLOB_API_PASSPHRASE = process.env.POLY_API_PASSPHRASE || process.env.CLOB_API_PASSPHRASE;

console.log("CLOB_API_KEY:", CLOB_API_KEY);
console.log("CLOB_API_SECRET:", CLOB_API_SECRET ? "***" : "undefined");
console.log("CLOB_API_PASSPHRASE:", CLOB_API_PASSPHRASE ? "***" : "undefined");
