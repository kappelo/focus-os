import "./environment.mjs";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(process.env.SQLITE_PATH ?? resolve(root, "data", "focus-os.sqlite"));
const directory = resolve(root, process.env.BACKUP_DIR ?? "backups");
const rootPrefix = `${root}${sep}`;

if (!directory.startsWith(rootPrefix)) {
  throw new Error("BACKUP_DIR musi wskazywać katalog wewnątrz projektu");
}
if (!existsSync(source)) throw new Error(`Nie znaleziono bazy SQLite: ${source}`);

mkdirSync(directory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = resolve(directory, `focus-os-${timestamp}.sqlite`);
const database = new Database(source, { readonly: true });

try {
  await database.backup(destination);
  console.log(`Spójny backup SQLite zapisany: ${destination}`);
} finally {
  database.close();
}
