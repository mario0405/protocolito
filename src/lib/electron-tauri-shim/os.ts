import { requireBridge } from './types';

export function platform(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('windows')) return 'windows';
  if (userAgent.includes('mac os')) return 'macos';
  if (userAgent.includes('linux')) return 'linux';
  return 'unknown';
}
