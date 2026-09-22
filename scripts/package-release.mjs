import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { zipSync } from "fflate";

const root = resolve(import.meta.dirname, "..");
// Explicit source allowlist: never recursively archive the working directory.
const roots = ["src", "scripts", "public", ".github", "docs"];
const files = ["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts",
  "next.config.ts", "eslint.config.mjs", "vitest.config.mts", ".gitignore", ".dockerignore",
  ".env.example", "Dockerfile", "docker-compose.yml", "README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md"];
function collect(path) {
  const info = lstatSync(path);
  if (info.isSymbolicLink()) throw new Error("Pakiet nie może zawierać linków symbolicznych.");
  if (info.isDirectory()) return readdirSync(path).flatMap((name) => collect(resolve(path, name)));
  return [relative(root, path).replaceAll("\\", "/")];
}
for (const name of roots) files.push(...collect(resolve(root, name)));
const blocked = /(^|\/)(data|backups|node_modules|\.next|\.git)(\/|$)|\.(sqlite[^/]*|db|pem|key|log)$|(^|\/)\.env(?!\.example$)/i;
const localSecrets = existsSync(resolve(root, ".env.local"))
  ? readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/).filter((line) => /^(SESSION_SECRET|WORKSPACE_ENCRYPTION_KEY|VAPID_PRIVATE_KEY)=/.test(line)).map((line) => line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")).filter((value) => value.length >= 32)
  : [];
const entries = {};
for (const name of files) {
  if (blocked.test(name)) throw new Error(`Prywatny plik w pakiecie: ${name}`);
  const bytes = readFileSync(resolve(root, name));
  if (localSecrets.some((secret) => bytes.includes(Buffer.from(secret)))) throw new Error(`Sekret konfiguracji znaleziony w pliku: ${name}`);
  entries[`focus-os/${name}`] = new Uint8Array(bytes);
}
const output = resolve(root, "dist");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "focus-os-source.zip"), zipSync(entries));
console.log(`Gotowy pakiet: dist/focus-os-source.zip (${files.length} plików źródłowych, bez baz i konfiguracji lokalnej).`);
