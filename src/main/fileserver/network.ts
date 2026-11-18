import * as os from 'node:os';

/** Returns all active local IPv4 addresses (excluding loopback 127.0.0.1). */
export function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      // Skip over non-IPv4 and internal/loopback addresses
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  // Sort so 192.168.x.x or 10.x.x.x come first (most common home/office Wi-Fi)
  ips.sort((a, b) => {
    const isAPrivate = a.startsWith('192.168.') || a.startsWith('10.') || a.startsWith('172.');
    const isBPrivate = b.startsWith('192.168.') || b.startsWith('10.') || b.startsWith('172.');
    if (isAPrivate && !isBPrivate) return -1;
    if (!isAPrivate && isBPrivate) return 1;
    return a.localeCompare(b);
  });

  return ips;
}

export function buildServerUrls(
  port: number,
  lanIps: string[],
  https = false,
): { localUrl: string; lanUrls: string[] } {
  const scheme = https ? 'https' : 'http';
  const defaultPort = (https && port === 443) || (!https && port === 80);
  const portSuffix = defaultPort ? '' : `:${port}`;

  return {
    localUrl: `${scheme}://localhost${portSuffix}`,
    lanUrls: lanIps.map((ip) => `${scheme}://${ip}${portSuffix}`),
  };
}
