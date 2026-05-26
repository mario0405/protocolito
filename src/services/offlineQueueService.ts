import { invoke } from '@tauri-apps/api/core';
import { Transcript } from '@/types';

export interface OfflineQueueItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'queued' | 'syncing' | 'error';
  attempts: number;
  error: string | null;
  transcriptCount: number;
}

export function listOfflineQueue() {
  return invoke<OfflineQueueItem[]>('api_offline_queue_list');
}

export function enqueueOfflineRecording(args: {
  title: string;
  transcripts: Transcript[];
  folderPath: string | null;
  templateId: string | null;
}) {
  return invoke('api_offline_queue_enqueue_recording', args);
}

export function retryOfflineQueueItem(id: string) {
  return invoke<{ status: string; meetingId: string }>('api_offline_queue_retry', { id });
}

export function deleteOfflineQueueItem(id: string) {
  return invoke('api_offline_queue_delete', { id });
}

export async function waitForConnectivity(timeoutMs = 90000) {
  if (navigator.onLine) return true;

  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (navigator.onLine) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 2000);
  });
}
