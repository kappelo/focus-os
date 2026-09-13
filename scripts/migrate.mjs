import "./environment.mjs";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.env.SQLITE_PATH ?? "data/focus-os.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.close();
console.log(`SQLite storage is ready: ${databasePath}`);
