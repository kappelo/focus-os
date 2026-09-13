import { root } from "./environment.mjs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const server = resolve(root, ".next", "standalone", "server.js");
if (!existsSync(server)) throw new Error("Brak kompilacji. Uruchom npm run build.");
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("Brak SESSION_SECRET. Uruchom npm run setup lub skonfiguruj środowisko.");
}
process.env.PORT ??= process.env.APP_PORT ?? "2026";
process.env.HOSTNAME ??= "0.0.0.0";
const child = spawn(process.execPath, [server], {
  cwd: resolve(root, ".next", "standalone"), env: process.env, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
