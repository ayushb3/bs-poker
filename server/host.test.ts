import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { DEFAULT_ROOM_SETTINGS, cleanName, parseClientMsg, validateRoomSettings, type ServerMsg } from "../src/net/protocol";
import { createHost, type Host } from "./host";
import { lanAddresses, privateRank } from "./lan";

describe("protocol", () => {
  it("parses known messages and canonicalises bids", () => {
    expect(parseClientMsg('{"type":"start"}')).toEqual({ type: "start" });
    expect(parseClientMsg('{"type":"bid","bid":{"category":"pair","rank":7}}')).toEqual({
      type: "bid",
      bid: { category: "pair", rank: 7 },
    });
    expect(parseClientMsg('{"type":"join","name":"  Sam\\u0007 ","token":"t"}')).toEqual({ type: "join", name: "Sam", token: "t" });
  });

  it("rejects junk, unknown types and fake bids", () => {
    for (const raw of [
      "nope",
      "null",
      "[]",
      '{"type":"explode"}',
      '{"type":"bid","bid":{"category":"pair","rank":"7"}}',
      '{"type":"bid","bid":{"category":"pair","rank":2}}',
      '{"type":"bid","bid":{"category":"flush"}}',
      '{"type":"removeSeat","seat":"1"}',
    ]) {
      expect(parseClientMsg(raw)).toBeNull();
    }
  });

  it("cleans names and validates settings", () => {
    expect(cleanName("A very long name that keeps going")).toHaveLength(16);
    expect(cleanName(42)).toBe("");
    expect(validateRoomSettings(DEFAULT_ROOM_SETTINGS, { cardCap: 3, turnTimer: 90, botSpeed: "warp" })).toEqual({
      ...DEFAULT_ROOM_SETTINGS,
      turnTimer: 90,
    });
  });
});

describe("lan", () => {
  it("prefers real private Wi-Fi addresses over virtual adapters", () => {
    const iface = (address: string) => ({
      address,
      family: "IPv4" as const,
      internal: false,
      netmask: "255.255.255.0",
      mac: "f8:3d:c6:d4:97:82",
      cidr: null,
    });
    const found = lanAddresses({
      ProTUN: [{ ...iface("10.2.0.2"), netmask: "255.255.255.255", mac: "00:00:00:00:00:00" }],
      "vEthernet (WSL)": [iface("172.20.0.1")],
      lo: [{ ...iface("127.0.0.1"), internal: true }],
      "Wi-Fi": [iface("192.168.1.42"), { ...iface("fe80::1"), family: "IPv6" as const }],
      Ethernet: [iface("10.0.0.5"), iface("8.8.8.8")],
    } as never);
    expect(found).toEqual(["192.168.1.42", "10.0.0.5", "10.2.0.2", "172.20.0.1"]);
    expect(privateRank("172.32.0.1")).toBeNull();
  });
});

describe("host server", () => {
  let host: Host;
  let base: string;

  beforeAll(async () => {
    const root = mkdtempSync(join(tmpdir(), "bs-host-"));
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "index.html"), "<!doctype html><title>BS Poker</title>");
    writeFileSync(join(root, "assets", "app.js"), "console.log(1)");
    host = createHost({ root, urls: ["http://192.168.1.42:5180/"] });
    await new Promise<void>((done) => host.server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(host.server.address() as AddressInfo).port}`;
  });
  afterAll(() => host.close());

  it("serves the build at / and under the Pages prefix, and says it's a host", async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain("BS Poker");
    const js = await fetch(`${base}/bs-poker/assets/app.js`);
    expect(js.headers.get("content-type")).toMatch(/javascript/);
    expect(await (await fetch(`${base}/api/host`)).json()).toEqual({ host: true, urls: ["http://192.168.1.42:5180/"] });
    expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
    expect((await fetch(`${base}/%2e%2e/package.json`)).status).toBe(404);
  });

  it("seats a phone over a real WebSocket and treats the laptop as host", async () => {
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws`);
    const msgs: ServerMsg[] = [];
    const next = () =>
      new Promise<ServerMsg>((done) => ws.once("message", (d) => done(JSON.parse(String(d)) as ServerMsg)));
    let pending = next();
    await new Promise((done) => ws.once("open", done));
    msgs.push(await pending);
    expect(msgs[0]).toMatchObject({ type: "lobby", me: { seat: null, host: true } });
    pending = next();
    ws.send(JSON.stringify({ type: "join", name: "Laptop" }));
    msgs.push(await pending);
    expect(msgs[1]).toMatchObject({ type: "lobby", me: { seat: 0 }, seats: [{ name: "Laptop", connected: true }] });
    pending = next();
    ws.send("garbage");
    expect(await pending).toEqual({ type: "error", message: "Unrecognised message." });
    ws.close();
  });
});
