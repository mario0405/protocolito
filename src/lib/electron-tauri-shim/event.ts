import { requireBridge, UnlistenFn } from './types';

export type { UnlistenFn };

const LOCAL_EVENT_NAME = '__protocolito-local-event';

export function emitLocal<T = unknown>(event: string, payload?: T): void {
  window.dispatchEvent(
    new CustomEvent(LOCAL_EVENT_NAME, {
      detail: { event, payload },
    })
  );
}

export async function listen<T = unknown>(
  event: string,
  callback: (event: { event: string; payload: T }) => void
): Promise<UnlistenFn> {
  const localHandler = (message: Event) => {
    const detail = (message as CustomEvent).detail;
    if (detail?.event === event) {
      callback({ event, payload: detail.payload });
    }
  };

  window.addEventListener(LOCAL_EVENT_NAME, localHandler);
  const unlistenBridge = await requireBridge().listen<T>(event, callback);

  return () => {
    window.removeEventListener(LOCAL_EVENT_NAME, localHandler);
    unlistenBridge();
  };
}

export async function emit<T = unknown>(event: string, payload?: T): Promise<void> {
  emitLocal(event, payload);
  return requireBridge().emit(event, payload);
}
