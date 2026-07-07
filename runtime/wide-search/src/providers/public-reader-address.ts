import { isIP } from 'node:net';

function normalizeAddressHost(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

function isPrivateIpv4(parts: readonly number[]): boolean {
  const [a, b] = parts;
  if (a === undefined || b === undefined) {
    return true;
  }
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function ipv4PartsFromMappedIpv6(ip: string): number[] | undefined {
  const dotted = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (dotted) {
    return dotted.split('.').map((part) => Number(part));
  }

  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  const high = hex?.[1] ? Number.parseInt(hex[1], 16) : undefined;
  const low = hex?.[2] ? Number.parseInt(hex[2], 16) : undefined;
  if (high === undefined || low === undefined) {
    return undefined;
  }
  return [high >> 8, high & 255, low >> 8, low & 255];
}

export function isPublicInternetIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map((part) => Number(part));
    return parts.length === 4 && parts.every(Number.isInteger) && !isPrivateIpv4(parts);
  }
  if (version === 6) {
    const normalized = normalizeAddressHost(ip);
    const mappedIpv4Parts = ipv4PartsFromMappedIpv6(normalized);
    if (mappedIpv4Parts) {
      return !isPrivateIpv4(mappedIpv4Parts);
    }
    return (
      normalized !== '::' &&
      normalized !== '::1' &&
      !normalized.startsWith('fc') &&
      !normalized.startsWith('fd') &&
      !normalized.startsWith('fe8') &&
      !normalized.startsWith('fe9') &&
      !normalized.startsWith('fea') &&
      !normalized.startsWith('feb') &&
      !normalized.startsWith('ff') &&
      !normalized.startsWith('2001:db8')
    );
  }
  return false;
}
