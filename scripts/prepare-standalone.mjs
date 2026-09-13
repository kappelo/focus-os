import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const standalone = resolve(root, ".next", "standalone");

for (const [source, destination] of [
  [resolve(root, "public"), resolve(standalone, "public")],
  [resolve(root, ".next", "static"), resolve(standalone, ".next", "static")],
]) {
  if (existsSync(source)) cpSync(source, destination, { recursive: true, force: true });
}

console.log("Standalone runtime prepared.");
