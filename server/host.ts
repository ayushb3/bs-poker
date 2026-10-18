/**
 * The host server: one Node process, one port. Serves the built game from
 * `dist/`, answers `/api/host` (so the page knows multiplayer is available),
 * and runs the table's WebSocket at `/ws`. Each socket becomes a Room client.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { HOST_API_PATH, WS_PATH, parseClientMsg, type HostInfo, type ServerMsg } from "../src/net/protocol";
import { Room, type RoomOptions } from "./room";

/** Vite builds for GitHub Pages under this prefix; the host serves the same build at both "/" and here. */
const BASE = "/bs-poker/";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export interface HostOptions extends RoomOptions {
  /** Folder with the built game (index.html + assets/). */
  readonly root: string;
  /** Join URLs to advertise (from lan.ts), best first. */
  readonly urls?: readonly string[];
}

export interface Host {
  readonly server: Server;
  readonly room: Room;
  close(): Promise<void>;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function isLoopback(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK.has(address);
}

export function createHost(opts: HostOptions): Host {
  const root = resolve(opts.root);
  const room = new Room(opts);
  const urls = opts.urls ?? [];

  const server = createServer((req, res) => {
    void handleHttp(req, res, root, urls).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  const wss = new WebSocketServer({ server, path: WS_PATH, maxPayload: 16 * 1024 });
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const id = randomUUID();
    room.connect({
      id,
      local: isLoopback(req.socket.remoteAddress),
      send(msg: ServerMsg) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      },
    });
    ws.on("message", (data) => {
      const msg = parseClientMsg(String(data));
      if (msg) room.handle(id, msg);
      else if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "error", message: "Unrecognised message." }));
    });
    ws.on("close", () => room.disconnect(id));
    ws.on("error", () => ws.terminate());
  });

  return {
    server,
    room,
    close: () =>
      new Promise<void>((done) => {
        room.close();
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => done());
      }),
  };
}

async function handleHttp(req: IncomingMessage, res: ServerResponse, root: string, urls: readonly string[]): Promise<void> {
  const url = new URL(req.url ?? "/", "http://host");
  if (url.pathname === HOST_API_PATH) {
    const info: HostInfo = { host: true, urls };
    res.writeHead(200, { "content-type": TYPES[".json"]!, "cache-control": "no-store" });
    res.end(JSON.stringify(info));
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  let path = decodeURIComponent(url.pathname);
  if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
  const file = await resolveFile(root, path);
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
    return;
  }
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  // Vite hashes asset names, so they can be cached; index.html must always be fresh.
  const cache = file.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable";
  const body = await readFile(file);
  res.writeHead(200, { "content-type": type, "cache-control": cache, "content-length": body.length });
  res.end(req.method === "HEAD" ? undefined : body);
}

/** Map a URL path to a file under root; "/" and unknown non-asset paths fall back to index.html. */
async function resolveFile(root: string, path: string): Promise<string | null> {
  const target = normalize(join(root, path));
  if (target !== root && !target.startsWith(root + sep)) return null;
  try {
    const s = await stat(target);
    if (s.isFile()) return target;
    if (s.isDirectory()) return await existing(join(target, "index.html"));
  } catch {
    /* fall through */
  }
  return extname(path) ? null : await existing(join(root, "index.html"));
}

async function existing(file: string): Promise<string | null> {
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}
