import { requireBridge } from './types';

export async function getVersion(): Promise<string> {
  return requireBridge().getVersion();
}
