import { emitLocal } from './event';
import { requireBridge } from './types';

type TranscriptSegment = {
  id: string;
  text: string;
  timestamp: string;
  sequence_id: number;
  chunk_start_time: number;
  audio_start_time: number;
  audio_end_time: number;
  duration: number;
};

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let startedAt = 0;
let paused = false;
let meetingName = '';
let lastTranscriptAt = 0;
let sequenceId = 0;
let chunks: Blob[] = [];
let transcripts: TranscriptSegment[] = [];
let hostedTranscriptionEnabled = false;
let transcriptionProvider: string | null = null;
let lastTranscriptionError: string | null = null;

function isRecordingCommand(command: string) {
  return [
    'start_recording',
    'start_recording_with_devices_and_meeting',
    'stop_recording',
    'pause_recording',
    'resume_recording',
    'is_recording',
    'get_recording_state',
    'get_recording_meeting_name',
    'get_transcript_history',
    'get_transcription_status',
    'get_audio_devices',
    'start_audio_level_monitoring',
    'stop_audio_level_monitoring',
  ].includes(command);
}

function pushTranscript(text: string) {
  const now = Math.max(0, (Date.now() - startedAt) / 1000);
  const segment: TranscriptSegment = {
    id: `segment-${Date.now()}`,
    text,
    timestamp: new Date().toISOString(),
    sequence_id: sequenceId++,
    chunk_start_time: lastTranscriptAt,
    audio_start_time: lastTranscriptAt,
    audio_end_time: now,
    duration: Math.max(0, now - lastTranscriptAt),
  };
  lastTranscriptAt = now;
  transcripts.push(segment);
  emitLocal('transcript-update', segment);
}

function encodeWav(audioBuffer: AudioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const length = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + length, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numberOfChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;
  writeString('data');
  view.setUint32(offset, length, true); offset += 4;

  const channels = Array.from({ length: numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  for (let i = 0; i < audioBuffer.length; i += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
}

async function blobToByteArray(blob: Blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

function arrayBufferToByteArray(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer));
}

async function prepareAudioForInfomaniak(blob: Blob) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass();
    const source = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(source.slice(0));
    await context.close();
    return {
      audioData: arrayBufferToByteArray(encodeWav(decoded)),
      mimeType: 'audio/wav',
      fileName: 'recording.wav',
    };
  } catch (error) {
    console.warn('Failed to convert recording to WAV, sending captured audio as-is.', error);
    return {
      audioData: await blobToByteArray(blob),
      mimeType: blob.type || 'audio/webm',
      fileName: blob.type.includes('ogg') ? 'recording.ogg' : 'recording.webm',
    };
  }
}

async function transcribeWithInfomaniak(blob: Blob) {
  const payload = await prepareAudioForInfomaniak(blob);
  try {
    return await requireBridge().invoke<{ configured: boolean; text: string }>('infomaniak_transcribe_audio', payload as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cleaned = message.replace(/^Error invoking remote method 'protocolito:invoke': Error:\s*/i, '');
    throw new Error(cleaned || message);
  }
}

async function transcribeWithLocalProvider(blob: Blob, provider: string) {
  const payload = await prepareAudioForInfomaniak(blob);
  const command = provider === 'parakeet' ? 'parakeet_transcribe_audio' : 'whisper_transcribe_audio';
  try {
    return await requireBridge().invoke<{ text: string }>(command, payload as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cleaned = message.replace(/^Error invoking remote method 'protocolito:invoke': Error:\s*/i, '');
    throw new Error(cleaned || message);
  }
}

async function enumerateDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audioinput' || device.kind === 'audiooutput')
      .map((device, index) => ({
        id: device.deviceId,
        name:
          device.label ||
          (device.kind === 'audioinput'
            ? `Microphone ${index + 1}`
            : `Speaker ${index + 1}`),
        device_type: device.kind === 'audioinput' ? 'Input' : 'Output',
        is_default: device.deviceId === 'default',
      }));
  } catch {
    return [];
  }
}

async function start(args: Record<string, any>) {
  if (recorder?.state === 'recording') return;

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  transcripts = [];
  startedAt = Date.now();
  lastTranscriptAt = 0;
  sequenceId = 1;
  paused = false;
  meetingName = args.meeting_name || args.meetingName || 'New Meeting';
  hostedTranscriptionEnabled = false;
  transcriptionProvider = null;
  lastTranscriptionError = null;

  try {
    const config = await requireBridge().invoke<{ provider?: string }>('api_get_transcript_config', {});
    transcriptionProvider = config?.provider || null;
    hostedTranscriptionEnabled = config?.provider === 'infomaniak';
  } catch {
    hostedTranscriptionEnabled = false;
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : '';
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(1000);

  emitLocal('recording-started', { meeting_name: meetingName });
  emitLocal('recording-state-changed', { is_recording: true, is_paused: false });
}

async function stop() {
  if (!recorder || recorder.state === 'inactive') return { transcripts };

  await new Promise<void>((resolve) => {
    if (!recorder) return resolve();
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  const capturedMimeType = recorder.mimeType || 'audio/webm';
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  recorder = null;

  const recordingBlob = new Blob(chunks, { type: capturedMimeType });
  if (hostedTranscriptionEnabled) {
    try {
      const result = await transcribeWithInfomaniak(recordingBlob);
      if (result.configured && result.text?.trim()) {
        pushTranscript(result.text.trim());
      } else {
        pushTranscript('Recording stopped. Infomaniak transcription is not configured yet.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastTranscriptionError = message;
      emitLocal('transcription-error', {
        error: message,
        userMessage: `Infomaniak transcription failed: ${message}`,
        actionable: false,
      });
    }
  } else if (transcriptionProvider === 'localWhisper' || transcriptionProvider === 'parakeet') {
    try {
      const result = await transcribeWithLocalProvider(recordingBlob, transcriptionProvider);
      if (result.text?.trim()) {
        pushTranscript(result.text.trim());
      } else {
        throw new Error('Local transcription returned no text.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastTranscriptionError = message;
      emitLocal('transcription-error', {
        error: message,
        userMessage: `Local transcription failed: ${message}`,
        actionable: false,
      });
    }
  } else {
    lastTranscriptionError = 'No transcription provider is configured.';
    emitLocal('transcription-error', {
      error: lastTranscriptionError,
      userMessage: lastTranscriptionError,
      actionable: false,
    });
  }
  emitLocal('transcription-complete', {});
  emitLocal('recording-stopped', {
    message: 'Recording stopped',
    meeting_name: meetingName,
  });
  emitLocal('recording-state-changed', { is_recording: false, is_paused: false });

  return { transcripts, transcriptionError: lastTranscriptionError };
}

export async function invokeRecording(command: string, args: Record<string, any> = {}) {
  if (!isRecordingCommand(command)) return undefined;

  switch (command) {
    case 'start_recording':
    case 'start_recording_with_devices_and_meeting':
      await start(args);
      return { status: 'success' };
    case 'stop_recording':
      return stop();
    case 'pause_recording':
      paused = true;
      recorder?.pause();
      emitLocal('recording-paused', {});
      return { status: 'success' };
    case 'resume_recording':
      paused = false;
      recorder?.resume();
      emitLocal('recording-resumed', {});
      return { status: 'success' };
    case 'is_recording':
      return recorder?.state === 'recording';
    case 'get_recording_state':
      return {
        is_recording: recorder?.state === 'recording',
        is_paused: paused,
        is_active: !!recorder,
        recording_duration: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : null,
        active_duration: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : null,
      };
    case 'get_recording_meeting_name':
      return meetingName || null;
    case 'get_transcript_history':
      return transcripts;
    case 'get_transcription_status':
      return {
        chunks_in_queue: 0,
        is_processing: false,
        last_activity_ms: startedAt ? Date.now() - startedAt : 0,
        error: lastTranscriptionError,
      };
    case 'get_audio_devices':
      return enumerateDevices();
    case 'start_audio_level_monitoring':
    case 'stop_audio_level_monitoring':
      return { status: 'success' };
    default:
      return undefined;
  }
}
