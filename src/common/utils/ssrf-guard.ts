import * as dns from 'dns/promises';
import * as net from 'net';

const BLOCKED_RANGES = [
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '127.',
  '0.',
  '169.254.',
  'fc00:',
  'fd00:',
  'fe80:',
  '::1',
];

/**
 * Validates a URL is safe against SSRF attacks:
 * - Only http/https
 * - DNS resolves to public IP
 * - No private/link-local/loopback ranges
 */
export async function validateUrlSafety(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname;

  // Block direct IP input against private ranges
  if (net.isIP(hostname)) {
    assertPublicIp(hostname);
    return;
  }

  // Resolve DNS and verify all IPs are public
  const addresses = await dns.resolve4(hostname).catch(() => []);
  const addresses6 = await dns.resolve6(hostname).catch(() => []);
  const allAddresses = [...addresses, ...addresses6];

  if (allAddresses.length === 0) {
    throw new Error('Could not resolve hostname');
  }

  for (const addr of allAddresses) {
    assertPublicIp(addr);
  }
}

function assertPublicIp(ip: string): void {
  for (const prefix of BLOCKED_RANGES) {
    if (ip.startsWith(prefix)) {
      throw new Error(`URL resolves to a blocked IP range`);
    }
  }
}
