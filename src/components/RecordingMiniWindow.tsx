import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { emit, listen } from '@tauri-apps/api/event';

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function RecordingMiniWindow() {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    const setupListeners = async () => {
      unsubscribers.push(await listen('recording-stop-requested', () => {
        setIsStopping(true);
        window.close();
      }));
      unsubscribers.push(await listen('recording-paused', () => setIsPaused(true)));
      unsubscribers.push(await listen('recording-resumed', () => setIsPaused(false)));
      unsubscribers.push(await listen('recording-stopped', () => window.close()));
    };

    setupListeners();

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (isStopping) return 'Stopping';
    return isPaused ? 'Paused' : 'Recording';
  }, [isPaused, isStopping]);

  const handlePauseToggle = async () => {
    await emit(isPaused ? 'recording-mini-resume-requested' : 'recording-mini-pause-requested');
  };

  const handleStop = async () => {
    setIsStopping(true);
    await emit('recording-mini-stop-requested');
  };

  return (
    <div className="flex h-screen w-screen items-center justify-between gap-3 bg-white px-4 text-gray-900">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <span className={isPaused ? 'h-2 w-2 rounded-full bg-amber-500' : 'h-2 w-2 rounded-full bg-red-500'} />
          {statusLabel}
        </div>
        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {formatDuration(elapsed)}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePauseToggle}
          disabled={isStopping}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={handleStop}
          disabled={isStopping}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
          aria-label="Stop recording"
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
