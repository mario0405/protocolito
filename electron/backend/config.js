const path = require('path');
const { ownerInfomaniakConfig } = require('./infomaniak');

function defaultOnboardingStatus() {
  return {
    version: '1.0',
    completed: false,
    current_step: 1,
    model_status: {
      parakeet: 'not_downloaded',
      summary: 'not_downloaded',
    },
    last_updated: new Date().toISOString(),
  };
}

function defaultNotificationSettings() {
  return {
    recording_notifications: true,
    time_based_reminders: false,
    meeting_reminders: false,
    respect_do_not_disturb: true,
    notification_sound: true,
    system_permission_granted: true,
    consent_given: true,
    manual_dnd_mode: false,
    notification_preferences: {
      show_recording_started: true,
      show_recording_stopped: true,
      show_recording_paused: true,
      show_recording_resumed: true,
      show_transcription_complete: true,
      show_meeting_reminders: false,
      show_system_errors: true,
      meeting_reminder_minutes: [5],
    },
  };
}

function defaultModelConfig() {
  return {
    provider: 'builtin-ai',
    model: 'qwen2.5-0.5b-instruct-q4',
    whisperModel: 'large-v3-turbo',
    apiKey: null,
    ollamaEndpoint: null,
  };
}

function normalizeModelConfig(config) {
  const allowedProviders = new Set(['ollama', 'builtin-ai', 'infomaniak']);
  const defaults = defaultModelConfig();
  const next = { ...defaults, ...(config || {}) };
  if (!allowedProviders.has(next.provider)) {
    next.provider = defaults.provider;
    next.model = defaults.model;
  }
  if (!next.model && next.provider !== 'infomaniak') next.model = defaults.model;
  if (next.provider === 'builtin-ai' && /^gemma3:/i.test(String(next.model || ''))) {
    next.model = defaults.model;
  }
  if (!next.whisperModel) next.whisperModel = defaults.whisperModel;
  if (next.provider === 'infomaniak') {
    next.productId = null;
    next.apiKey = null;
    next.model = next.model || '';
  }
  return next;
}

function defaultTranscriptConfig() {
  return {
    provider: 'localWhisper',
    model: 'large-v3-turbo',
    productId: null,
    apiKey: null,
  };
}

function normalizeTranscriptConfig(config) {
  const allowedProviders = new Set(['localWhisper', 'parakeet', 'infomaniak']);
  const defaults = defaultTranscriptConfig();
  const next = { ...defaults, ...(config || {}) };
  if (!allowedProviders.has(next.provider)) {
    next.provider = defaults.provider;
    next.model = defaults.model;
    next.apiKey = null;
  }
  if (next.provider === 'infomaniak') {
    next.productId = null;
    next.apiKey = null;
    next.modelName = next.modelName || next.transcriptionModel || next.model || ownerInfomaniakConfig().transcriptionModels[0] || 'whisper-large-v3';
    next.model = next.modelName;
  } else if (!next.model) {
    next.model = defaults.model;
  }
  return next;
}

function defaultRecordingPreferences(app) {
  return {
    save_folder: path.join(app.getPath('userData'), 'recordings'),
    auto_save: true,
    file_format: 'mp4',
    preferred_mic_device: null,
    preferred_system_device: null,
  };
}

module.exports = {
  defaultModelConfig,
  defaultNotificationSettings,
  defaultOnboardingStatus,
  defaultRecordingPreferences,
  defaultTranscriptConfig,
  normalizeModelConfig,
  normalizeTranscriptConfig,
};
