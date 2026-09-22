import "./environment.mjs";

const port = process.env.PORT ?? process.env.APP_PORT ?? "2026";
const url = `http://127.0.0.1:${port}/api/push/dispatch`;
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const response = await fetch(url, { method: "POST", headers: { "x-focus-worker-token": process.env.SESSION_SECRET ?? "" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) console.error(`Push worker: serwer zwrócił ${response.status}.`);
  } catch (error) {
    console.error(`Push worker: ${error instanceof Error ? error.message : "brak połączenia"}`);
  } finally {
    running = false;
  }
}
setTimeout(() => void tick(), 3_000);
setInterval(() => void tick(), 30_000);
