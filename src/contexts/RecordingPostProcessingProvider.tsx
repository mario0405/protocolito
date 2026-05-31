'use client';

import React, { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import { useRecordingStop } from '@/hooks/useRecordingStop';

/**
 * RecordingPostProcessingProvider
 *
 * This provider handles post-processing when recording stops from any source:
 * - Tray menu stop
 * - Global keyboard shortcut
 * - Overlay stop button
 * - Main UI stop button
 *
 * It listens for the 'recording-stop-complete' event from Rust backend
 * and triggers the full post-processing flow (save to database, navigate, analytics)
 * regardless of which page the user is currently on.
 */
export function RecordingPostProcessingProvider({ children }: { children: React.ReactNode }) {
  // No-op functions since the global RecordingStateContext already handles state updates
  // These are only needed for the hook's local component state management
  const setIsRecording = () => { };
  const setIsRecordingDisabled = () => { };

  const {
    handleRecordingStop,
    setIsStopping,
  } = useRecordingStop(setIsRecording, setIsRecordingDisabled);
  const miniStopInProgressRef = useRef(false);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    const setupListener = async () => {
      try {
        // Listen for recording-stop-complete event from Rust
        unsubscribers.push(await listen<boolean>('recording-stop-complete', (event) => {
          console.log('[RecordingPostProcessing] Received recording-stop-complete event:', event.payload);

          // Call the post-processing handler
          // event.payload is the callApi boolean (true for normal stops)
          handleRecordingStop(event.payload);
        }));

        unsubscribers.push(await listen('recording-mini-pause-requested', () => {
          void invoke('pause_recording');
        }));

        unsubscribers.push(await listen('recording-mini-resume-requested', () => {
          void invoke('resume_recording');
        }));

        unsubscribers.push(await listen('recording-mini-stop-requested', async () => {
          if (miniStopInProgressRef.current) return;
          miniStopInProgressRef.current = true;
          setIsStopping(true);
          await emit('recording-stop-requested', {});

          try {
            const dataDir = await appDataDir();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const savePath = `${dataDir}/recording-${timestamp}.wav`;
            const result = await invoke<{ transcriptionError?: string }>('stop_recording', {
              args: {
                save_path: savePath,
              },
            });

            if (result?.transcriptionError) {
              throw new Error(result.transcriptionError);
            }

            await handleRecordingStop(true);
          } catch (error) {
            console.error('[RecordingPostProcessing] Failed to stop from mini window:', error);
            await handleRecordingStop(false);
          } finally {
            miniStopInProgressRef.current = false;
          }
        }));

        console.log('[RecordingPostProcessing] Event listener set up successfully');
      } catch (error) {
        console.error('[RecordingPostProcessing] Failed to set up event listener:', error);
      }
    };

    setupListener();

    return () => {
      console.log('[RecordingPostProcessing] Cleaning up event listeners');
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [handleRecordingStop, setIsStopping]);

  return <>{children}</>;
}
