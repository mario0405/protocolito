export type UnlistenFn = () => void;

type EventCallback<T> = (event: { event: string; payload: T }) => void;

declare global {
  interface Window {
    protocolito?: {
      invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
      listen<T = unknown>(event: string, callback: EventCallback<T>): Promise<UnlistenFn>;
      emit<T = unknown>(event: string, payload?: T): Promise<void>;
      getVersion(): Promise<string>;
      appDataDir(): Promise<string>;
      platform(): Promise<string>;
    };
  }
}

export function requireBridge() {
  if (typeof window === 'undefined' || !window.protocolito) {
    throw new Error('Protocolito desktop bridge is not available');
  }

  return window.protocolito;
}
