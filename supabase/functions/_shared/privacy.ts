/**
 * Truncate IP address for GDPR compliance.
 * IPv4: 192.168.1.123 → 192.168.1.0
 * IPv6: 2001:db8::1 → 2001:db8::0
 */
export function truncateIp(ip: string | null): string {
  if (!ip) return '';
  const trimmed = ip.trim().split(',')[0].trim();

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    return parts.slice(0, 3).join(':') + '::0';
  }

  const parts = trimmed.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  return trimmed;
}
