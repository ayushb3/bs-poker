/**
 * `npm run host`: build the game, then serve it and the multiplayer table on
 * the local network. Phones on the same Wi-Fi open the printed address.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT } from "../src/net/protocol";
import { createHost } from "./host";
import { lanAddresses } from "./lan";

const port = Number(process.env["PORT"]) || DEFAULT_PORT;
const root = fileURLToPath(new URL("../dist", import.meta.url));

if (!existsSync(root)) {
  console.error("No build found in dist/. Run `npm run build` first (or use `npm run host`, which builds for you).");
  process.exit(1);
}

const urls = lanAddresses().map((ip) => `http://${ip}:${port}/`);
const host = createHost({ root, urls });

host.server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${port} is busy. Try PORT=5181 npm run host.` : err.message);
  process.exit(1);
});

host.server.listen(port, "0.0.0.0", () => {
  console.log("\n  BS Poker table is open.\n");
  console.log(`  On this laptop:  http://localhost:${port}/`);
  if (urls.length === 0) console.log("  No Wi-Fi address found. Are you connected to a network?");
  for (const [i, url] of urls.entries()) console.log(`  ${i === 0 ? "Phones join at:" : "            or:"}  ${url}`);
  console.log("\n  Everyone must be on the same Wi-Fi. Ctrl+C closes the table.\n");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void host.close().then(() => process.exit(0)));
}
