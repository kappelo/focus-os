import { existsSync } from "node:fs";
import { resolve } from "node:path";
export const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
// Resolve before the standalone server changes its working directory.
process.env.SQLITE_PATH = resolve(root, process.env.SQLITE_PATH ?? "data/focus-os.sqlite");
