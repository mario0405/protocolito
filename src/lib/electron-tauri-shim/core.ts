import { requireBridge } from './types';
import { invokeRecording } from './recording';

export async function invoke<T = unknown>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const recordingResult = await invokeRecording(command, args || {});
  if (recordingResult !== undefined) {
    return recordingResult as T;
  }

  return requireBridge().invoke<T>(command, args);
}
