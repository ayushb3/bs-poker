/** Find the laptop's address on the local network, for the join link and QR code. */
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/** Rank a private IPv4 address: home Wi-Fi ranges first, then 10.x, then 172.16–31.x. Null if not private. */
export function privateRank(address: string): number | null {
  const [a, b] = address.split(".").map(Number);
  if (a === 192 && b === 168) return 0;
  if (a === 10) return 1;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return 2;
  return null;
}

const VIRTUAL_NAME = /vethernet|wsl|hyper-v|virtual|vmware|vbox|docker|tailscale|zerotier|tun|tap|vpn|wireguard|wg\d|proton|nord|mullvad/i;

/**
 * Something phones on the Wi-Fi can't reach: a VPN or virtual adapter. Tunnels
 * show up with no hardware address or a single-host (/32) netmask.
 */
function isVirtual(name: string, info: NetworkInterfaceInfo): boolean {
  return VIRTUAL_NAME.test(name) || /^(00:){5}00$/.test(info.mac) || info.netmask === "255.255.255.255";
}

/** Private IPv4 addresses, best first: real adapters before VPNs and virtual ones, then by range. */
export function lanAddresses(ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()): string[] {
  const found: { address: string; rank: number; virtual: boolean }[] = [];
  for (const [name, list] of Object.entries(ifaces)) {
    for (const info of list ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      const rank = privateRank(info.address);
      if (rank === null) continue;
      found.push({ address: info.address, rank, virtual: isVirtual(name, info) });
    }
  }
  found.sort((x, y) => Number(x.virtual) - Number(y.virtual) || x.rank - y.rank);
  return [...new Set(found.map((f) => f.address))];
}
