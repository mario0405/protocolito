import { requireBridge } from './types';

export async function appDataDir(): Promise<string> {
  return requireBridge().appDataDir();
}
