import { invoke } from './core';

class JsonStore {
  constructor(private readonly filename: string) {}

  static async load(filename: string): Promise<JsonStore> {
    return new JsonStore(filename);
  }

  async get<T = unknown>(key: string, defaultValue?: T): Promise<T | null> {
    const value = await invoke<T | null>('store_get', { filename: this.filename, key });
    return value ?? defaultValue ?? null;
  }

  async has(key: string): Promise<boolean> {
    return invoke<boolean>('store_has', { filename: this.filename, key });
  }

  async set(key: string, value: unknown): Promise<void> {
    await invoke('store_set', { filename: this.filename, key, value });
  }

  async delete(key: string): Promise<void> {
    await invoke('store_delete', { filename: this.filename, key });
  }

  async save(): Promise<void> {
    await invoke('store_save', { filename: this.filename });
  }
}

export const Store = JsonStore;

export async function load(filename: string, _options?: unknown): Promise<JsonStore> {
  return new JsonStore(filename);
}
