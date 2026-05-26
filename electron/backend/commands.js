const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Database } = require('./database');
const { JsonStore, ensureDir } = require('./json-store');
const { generateSummary } = require('./summary');
const { listOllamaModels, builtinModels } = require('./models');
const {
  callInfomaniakTranscription,
  infomaniakChatEndpoint,
  infomaniakTranscriptionEndpoint,
  listInfomaniakChatModels,
  ownerInfomaniakConfig,
  uniqueStrings,
} = require('./infomaniak');
const {
  getCloudModels,
  readProtocolitoCloudConfig,
  transcribeWithCloud,
} = require('./protocolito-cloud');
const {
  defaultNotificationSettings,
  defaultOnboardingStatus,
  defaultRecordingPreferences,
  normalizeModelConfig,
  normalizeTranscriptConfig,
} = require('./config');

function normalizePlatform() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function trimSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function templateDir(app) {
  const packaged = path.join(process.resourcesPath || '', 'resources', 'templates');
  const dev = path.join(app.getAppPath(), 'resources', 'templates');
  return fs.existsSync(packaged) ? packaged : dev;
}

function loadTemplates(app) {
  const dir = templateDir(app);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      return { id: path.basename(file, '.json'), ...data };
    });
}

function getSummaryTemplate(app, templateId) {
  const normalizedId = String(templateId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!normalizedId) return null;

  const file = path.join(templateDir(app), `${normalizedId}.json`);
  if (!fs.existsSync(file)) return null;

  return { id: normalizedId, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function createCommandRegistry({ app, shell, emitToRenderer }) {
  const db = new Database(app.getPath('userData'));
  const stores = new Map();
  const recording = {
    isRecording: false,
    isPaused: false,
    startedAt: null,
    meetingName: null,
    folderPath: null,
  };

  function userFile(...segments) {
    const file = path.join(app.getPath('userData'), ...segments);
    ensureDir(path.dirname(file));
    return file;
  }

  function userDir(...segments) {
    const dir = path.join(app.getPath('userData'), ...segments);
    ensureDir(dir);
    return dir;
  }

  async function openDirectory(dir) {
    ensureDir(dir);
    const error = await shell.openPath(dir);
    if (error) throw new Error(error);
    return { status: 'success', path: dir };
  }

  function getDeviceId() {
    const existing = db.getSetting('deviceId', null);
    if (existing) return existing;
    const next = crypto.randomUUID();
    db.setSetting('deviceId', next);
    return next;
  }

  function getAccessConfig() {
    const saved = db.getSetting('accessConfig', null) || {};
    const cloud = readProtocolitoCloudConfig(app);
    return {
      baseUrl: trimSlash(saved.baseUrl || cloud.baseUrl || process.env.PROTOCOLITO_CLOUD_URL || ''),
      accessKey: String(saved.accessKey || saved.companyKey || '').trim(),
      company: saved.company || null,
      lastCheckedAt: saved.lastCheckedAt || null,
      lastStatus: saved.lastStatus || null,
    };
  }

  function getAccessCloudOverride() {
    const config = getAccessConfig();
    if (!config.baseUrl || !config.accessKey) return null;
    return {
      baseUrl: config.baseUrl,
      companyKey: config.accessKey,
    };
  }

  function saveAccessConfig(config) {
    const previous = getAccessConfig();
    const next = {
      ...previous,
      baseUrl: trimSlash(config.baseUrl),
      accessKey: String(config.accessKey || '').trim(),
      company: config.company || previous.company || null,
      lastCheckedAt: config.lastCheckedAt || previous.lastCheckedAt || null,
      lastStatus: config.lastStatus || previous.lastStatus || null,
    };
    db.setSetting('accessConfig', next);
    return next;
  }

  async function checkAccess(action = 'unknown') {
    const config = getAccessConfig();
    if (!config.baseUrl || !config.accessKey) {
      return {
        ok: false,
        status: 'missing',
        message: 'Protocolito access key is missing. Add it in Settings > Preferences.',
      };
    }

    try {
      const response = await fetch(`${config.baseUrl}/v1/access/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-protocolito-key': config.accessKey,
        },
        body: JSON.stringify({
          action,
          appVersion: app.getVersion(),
          deviceId: getDeviceId(),
          platform: normalizePlatform(),
        }),
      });

      const data = await response.json().catch(async () => ({ error: await response.text() }));
      if (!response.ok || !data.ok) {
        const failed = {
          ...config,
          lastCheckedAt: new Date().toISOString(),
          lastStatus: 'denied',
          company: null,
        };
        db.setSetting('accessConfig', failed);
        return {
          ok: false,
          status: 'denied',
          message: data.error || `Access check failed with status ${response.status}.`,
        };
      }

      const updated = {
        ...config,
        company: data.company || null,
        lastCheckedAt: new Date().toISOString(),
        lastStatus: 'active',
      };
      db.setSetting('accessConfig', updated);
      return {
        ok: true,
        status: 'active',
        company: data.company || null,
      };
    } catch (error) {
      return {
        ok: false,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function getStore(filename) {
    const safeName = String(filename || 'store.json').replace(/[\\/]/g, '_');
    if (!stores.has(safeName)) {
      stores.set(safeName, new JsonStore(userFile('stores', safeName), {}));
    }
    return stores.get(safeName);
  }

  const handlers = {
    app_get_version: () => app.getVersion(),
    app_data_dir: () => `${app.getPath('userData')}${path.sep}`,
    platform: () => normalizePlatform(),

    store_get: ({ filename, key }) => getStore(filename).get(key),
    store_has: ({ filename, key }) => getStore(filename).get(key) !== null,
    store_set: ({ filename, key, value }) => getStore(filename).set(key, value),
    store_delete: ({ filename, key }) => getStore(filename).delete(key),
    store_save: ({ filename }) => getStore(filename).save(),

    get_onboarding_status: () => {
      const status = db.getSetting('onboardingStatus', null);
      return {
        ...defaultOnboardingStatus(),
        ...(status || {}),
        current_step: status?.current_step || 1,
      };
    },
    save_onboarding_status_cmd: (args) => {
      db.setSetting('onboardingStatus', {
        ...defaultOnboardingStatus(),
        ...(args.status || args),
      });
      return { status: 'success' };
    },
    complete_onboarding: (args) => {
      db.setSetting('onboardingStatus', {
        ...defaultOnboardingStatus(),
        completed: true,
        current_step: 3,
        model_status: {
          parakeet: 'downloaded',
          summary: 'downloaded',
        },
        ...args,
        last_updated: new Date().toISOString(),
      });
      return { status: 'success' };
    },
    check_first_launch: () => !db.getSetting('databaseInitialized', false),
    check_homebrew_database: () => null,
    check_default_legacy_database: () => null,
    initialize_fresh_database: () => {
      db.setSetting('databaseInitialized', true);
      return { status: 'success' };
    },
    import_and_initialize_database: () => ({ status: 'success' }),
    builtin_ai_get_recommended_model: () => 'gemma3:1b',

    api_get_meetings: () => db.listMeetings(),
    api_get_meeting: ({ meetingId }) => {
      const meeting = db.getMeeting(meetingId);
      if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
      return meeting;
    },
    api_get_meeting_metadata: ({ meetingId }) => {
      const meeting = db.getMeeting(meetingId);
      if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
      const { transcripts, summary, ...metadata } = meeting;
      return { ...metadata, total_transcripts: transcripts.length };
    },
    api_get_meeting_transcripts: ({ meetingId, limit = 100, offset = 0 }) => {
      const meeting = db.getMeeting(meetingId);
      if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
      const transcripts = meeting.transcripts || [];
      const slice = transcripts.slice(offset, offset + limit);
      return {
        transcripts: slice,
        total_count: transcripts.length,
        has_more: offset + slice.length < transcripts.length,
      };
    },
    api_save_transcript: (args) => db.saveMeeting(args),
    api_save_meeting_title: ({ meetingId, meeting_id, title }) => db.updateMeetingTitle(meetingId || meeting_id, title),
    api_delete_meeting: ({ meetingId, meeting_id }) => db.deleteMeeting(meetingId || meeting_id),
    api_search_transcripts: ({ query }) => db.searchTranscripts(query),
    api_get_summary: ({ meetingId, meeting_id }) => db.getSummary(meetingId || meeting_id),
    api_save_meeting_summary: ({ meetingId, meeting_id, summary }) => db.saveSummary(meetingId || meeting_id, summary),
    api_process_transcript: async (args) => {
      const processId = `process-${Date.now()}`;
      db.store.data.processes[processId] = { status: 'processing', meetingId: args.meetingId };
      db.store.save();

      generateSummary({
        app,
        db,
        args: {
          ...args,
          template: getSummaryTemplate(app, args.templateId),
        },
      })
        .then((summary) => {
          db.store.data.processes[processId] = {
            status: 'completed',
            meetingId: args.meetingId,
            data: summary,
            meetingName: summary.MeetingName,
          };
          db.store.save();
          emitToRenderer('summary-progress', {
            process_id: processId,
            meeting_id: args.meetingId,
            status: 'completed',
            data: summary,
            meetingName: summary.MeetingName,
          });
        })
        .catch((error) => {
          db.store.data.processes[processId] = {
            status: 'error',
            meetingId: args.meetingId,
            error: error.message,
          };
          db.store.save();
          emitToRenderer('summary-progress', {
            process_id: processId,
            meeting_id: args.meetingId,
            status: 'error',
            error: error.message,
          });
        });

      return { message: 'Processing started', process_id: processId };
    },
    api_get_process_status: ({ processId, process_id }) => db.store.data.processes[processId || process_id] || { status: 'idle' },
    api_cancel_summary: ({ meetingId }) => ({ status: 'cancelled', meetingId }),

    api_get_model_config: () => normalizeModelConfig(db.getSetting('modelConfig', null)),
    api_save_model_config: (args) => {
      const config = normalizeModelConfig(args);
      db.setSetting('modelConfig', config);
      if (args.provider && args.apiKey) db.setApiKey(args.provider, args.apiKey);
      emitToRenderer('model-config-updated', config);
      return { status: 'success' };
    },
    api_get_transcript_config: () => normalizeTranscriptConfig(db.getSetting('transcriptConfig', null)),
    api_save_transcript_config: (args) => {
      const config = normalizeTranscriptConfig(args);
      db.setSetting('transcriptConfig', config);
      if (args.provider && args.apiKey) db.setTranscriptApiKey(args.provider, args.apiKey);
      return { status: 'success' };
    },
    api_get_api_key: ({ provider }) => db.getApiKey(provider),
    api_get_transcript_api_key: ({ provider }) => db.getTranscriptApiKey(provider),
    api_get_infomaniak_cloud_config: async () => {
      const accessCloud = getAccessCloudOverride();
      const cloud = readProtocolitoCloudConfig(app, accessCloud);
      if (cloud.configured) {
        const models = await getCloudModels(app, accessCloud);
        return {
          configured: true,
          mode: 'protocolito-cloud',
          baseUrl: cloud.baseUrl,
          companyId: models.companyId || null,
          transcriptionModels: models.transcriptionModels || [],
          summaryModels: models.summaryModels || [],
        };
      }

      const config = ownerInfomaniakConfig();
      let summaryModels = config.summaryModels;

      try {
        const remoteSummaryModels = await listInfomaniakChatModels();
        summaryModels = uniqueStrings([...summaryModels, ...remoteSummaryModels]);
      } catch (error) {
        console.warn('[Protocolito] Failed to load Infomaniak chat models:', error.message || error);
      }

      return {
        configured: Boolean(config.productId && config.apiKey),
        mode: 'owner-local',
        baseUrl: null,
        companyId: null,
        transcriptionModels: config.transcriptionModels,
        summaryModels,
      };
    },
    api_get_infomaniak_endpoints: () => {
      const cloud = readProtocolitoCloudConfig(app, getAccessCloudOverride());
      if (cloud.configured) {
        return {
          chat: `${cloud.baseUrl}/v1/summarize`,
          transcription: `${cloud.baseUrl}/v1/transcribe`,
        };
      }

      return {
        chat: infomaniakChatEndpoint(ownerInfomaniakConfig().productId),
        transcription: infomaniakTranscriptionEndpoint(ownerInfomaniakConfig().productId),
      };
    },
    api_get_auto_generate_setting: () => db.getSetting('autoGenerateSummary', false),
    api_save_auto_generate_setting: ({ enabled }) => db.setSetting('autoGenerateSummary', !!enabled),
    api_get_access_config: () => getAccessConfig(),
    api_save_access_config: (args) => {
      const config = saveAccessConfig(args || {});
      return {
        status: 'success',
        config,
      };
    },
    api_check_access: ({ action }) => checkAccess(action),

    get_ollama_models: async ({ endpoint }) => listOllamaModels(endpoint),
    pull_ollama_model: ({ modelName }) => ({ status: 'unsupported', modelName }),
    delete_ollama_model: ({ modelName }) => ({ status: 'unsupported', modelName }),
    builtin_ai_list_models: () => builtinModels(),
    builtin_ai_get_model_info: ({ modelName }) => builtinModels().find((model) => model.name === modelName) || null,
    builtin_ai_is_model_ready: () => true,
    builtin_ai_get_available_summary_model: () => builtinModels()[0],
    builtin_ai_download_model: ({ modelName }) => {
      emitToRenderer('builtin-ai-download-complete', { modelName });
      return { status: 'success' };
    },
    builtin_ai_cancel_download: () => ({ status: 'cancelled' }),
    builtin_ai_delete_model: () => ({ status: 'success' }),
    builtin_ai_get_models_directory: () => userDir('models'),

    whisper_init: () => ({ status: 'success' }),
    whisper_get_available_models: () => [],
    whisper_load_model: ({ modelName }) => ({ status: 'success', modelName }),
    whisper_get_current_model: () => null,
    whisper_is_model_loaded: () => false,
    whisper_transcribe_audio: () => ({ text: '' }),
    whisper_get_models_directory: () => userDir('models', 'whisper'),
    whisper_download_model: ({ modelName }) => {
      emitToRenderer('model-download-complete', { modelName });
      return { status: 'success' };
    },
    whisper_cancel_download: () => ({ status: 'cancelled' }),
    whisper_delete_corrupted_model: () => true,
    whisper_has_available_models: () => false,
    whisper_validate_model_ready: () => false,

    parakeet_init: () => ({ status: 'success' }),
    parakeet_get_available_models: () => [{ name: 'browser-media', status: { type: 'ready' } }],
    parakeet_load_model: ({ modelName }) => ({ status: 'success', modelName }),
    parakeet_get_current_model: () => null,
    parakeet_is_model_loaded: () => false,
    parakeet_transcribe_audio: () => ({ text: '' }),
    parakeet_get_models_directory: () => userDir('models', 'parakeet'),
    parakeet_download_model: ({ modelName }) => {
      emitToRenderer('parakeet-model-download-complete', { modelName });
      return { status: 'success' };
    },
    parakeet_retry_download: ({ modelName }) => handlers.parakeet_download_model({ modelName }),
    parakeet_cancel_download: () => ({ status: 'cancelled' }),
    parakeet_delete_corrupted_model: () => true,
    parakeet_has_available_models: () => true,
    parakeet_validate_model_ready: () => true,
    infomaniak_transcribe_audio: async (args) => {
      const config = normalizeTranscriptConfig(db.getSetting('transcriptConfig', null));
      if (config.provider !== 'infomaniak') return { configured: false, text: '' };
      const accessCloud = getAccessCloudOverride();
      const cloud = readProtocolitoCloudConfig(app, accessCloud);
      if (cloud.configured) {
        return transcribeWithCloud({
          app,
          configOverride: accessCloud,
          model: config.modelName || config.model || 'whisper-large-v3',
          audioData: args.audioData,
          mimeType: args.mimeType,
          fileName: args.fileName,
        });
      }

      return callInfomaniakTranscription({
        productId: ownerInfomaniakConfig().productId,
        apiKey: ownerInfomaniakConfig().apiKey,
        model: config.modelName || config.model || ownerInfomaniakConfig().transcriptionModels[0] || 'whisper-large-v3',
        audioData: args.audioData,
        mimeType: args.mimeType,
        fileName: args.fileName,
      });
    },

    get_audio_devices: () => [],
    get_audio_backend_info: () => [
      {
        id: 'electron-default',
        name: 'Electron Default',
        description: 'Uses Electron and the browser audio layer for microphone capture.',
      },
    ],
    get_current_audio_backend: () => db.getSetting('audioBackend', 'electron-default'),
    set_audio_backend: ({ backend }) => db.setSetting('audioBackend', backend),
    start_audio_level_monitoring: () => ({ status: 'success' }),
    stop_audio_level_monitoring: () => ({ status: 'success' }),
    is_recording: () => recording.isRecording,
    start_recording: () => handlers.start_recording_with_devices_and_meeting({}),
    start_recording_with_devices_and_meeting: ({ meeting_name }) => {
      recording.isRecording = true;
      recording.isPaused = false;
      recording.startedAt = Date.now();
      recording.meetingName = meeting_name || `Meeting ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`;
      recording.folderPath = userDir('recordings', recording.meetingName);
      ensureDir(recording.folderPath);
      emitToRenderer('recording-started', {
        meeting_name: recording.meetingName,
        folder_path: recording.folderPath,
      });
      return { status: 'success', meeting_name: recording.meetingName, folder_path: recording.folderPath };
    },
    stop_recording: ({ args = {} }) => {
      if (!recording.isRecording) return { status: 'idle' };
      const stoppedName = recording.meetingName || 'New Meeting';
      const folderPath = recording.folderPath || path.dirname(args.save_path || userFile('recordings'));
      recording.isRecording = false;
      recording.isPaused = false;
      emitToRenderer('recording-stopped', {
        message: 'Recording stopped',
        folder_path: folderPath,
        meeting_name: stoppedName,
      });
      emitToRenderer('transcription-complete', {
        meeting_name: stoppedName,
      });
      return { status: 'success', save_path: args.save_path || null, folder_path: folderPath, meeting_name: stoppedName };
    },
    pause_recording: () => {
      if (!recording.isRecording) return { status: 'idle' };
      recording.isPaused = true;
      emitToRenderer('recording-paused', {});
      return { status: 'success' };
    },
    resume_recording: () => {
      if (!recording.isRecording) return { status: 'idle' };
      recording.isPaused = false;
      emitToRenderer('recording-resumed', {});
      return { status: 'success' };
    },
    get_recording_state: () => {
      const duration = recording.startedAt ? Math.floor((Date.now() - recording.startedAt) / 1000) : null;
      return {
        is_recording: recording.isRecording,
        is_paused: recording.isPaused,
        is_active: recording.isRecording && !recording.isPaused,
        recording_duration: recording.isRecording ? duration : null,
        active_duration: recording.isRecording && !recording.isPaused ? duration : null,
      };
    },
    get_recording_meeting_name: () => recording.meetingName,
    get_transcript_history: () => [],
    get_transcription_status: () => ({ chunks_in_queue: 0, is_processing: false, last_activity_ms: 0 }),

    set_language_preference: ({ language }) => db.setSetting('language', language),
    set_notification_settings: ({ settings }) => db.setSetting('notificationSettings', {
      ...defaultNotificationSettings(),
      ...(settings || {}),
      notification_preferences: {
        ...defaultNotificationSettings().notification_preferences,
        ...(settings?.notification_preferences || {}),
      },
    }),
    get_notification_settings: () => {
      const settings = db.getSetting('notificationSettings', null);
      return {
        ...defaultNotificationSettings(),
        ...(settings || {}),
        notification_preferences: {
          ...defaultNotificationSettings().notification_preferences,
          ...(settings?.notification_preferences || {}),
        },
      };
    },
    set_recording_preferences: ({ preferences }) => db.setSetting('recordingPreferences', {
      ...defaultRecordingPreferences(app),
      ...(preferences || {}),
    }),
    get_recording_preferences: () => ({
      ...defaultRecordingPreferences(app),
      ...(db.getSetting('recordingPreferences', null) || {}),
    }),
    get_summary_templates: () => loadTemplates(app),
    list_summary_templates: () => loadTemplates(app),

    open_external_url: ({ url }) => shell.openExternal(url),
    get_database_directory: () => userDir('data'),
    get_default_recordings_folder_path: () => userDir('recordings'),
    open_database_folder: () => openDirectory(userDir('data')),
    open_models_folder: () => openDirectory(userDir('models')),
    open_parakeet_models_folder: () => openDirectory(userDir('models', 'parakeet')),
    open_recordings_folder: () => openDirectory(userDir('recordings')),
    open_meeting_folder: ({ folderPath, folder_path }) => openDirectory(folderPath || folder_path || app.getPath('userData')),
    open_system_settings: () => undefined,
    toggle_console: () => ({ visible: false }),
    show_console: () => ({ visible: true }),
    hide_console: () => ({ visible: false }),

    start_import_audio_command: () => ({ status: 'unsupported' }),
    cancel_import_command: () => ({ status: 'cancelled' }),
    start_retranscription_command: () => ({ status: 'unsupported' }),
    cancel_retranscription_command: () => ({ status: 'cancelled' }),
    cleanup_checkpoints: () => ({ status: 'success' }),

    init_analytics: () => undefined,
    disable_analytics: () => undefined,
    is_analytics_enabled: () => false,
    track_event: () => undefined,
    identify_user: () => undefined,
    start_analytics_session: () => `session-${Date.now()}`,
    end_analytics_session: () => undefined,
    track_daily_active_user: () => undefined,
    track_user_first_launch: () => undefined,
    is_analytics_session_active: () => false,
    track_meeting_started: () => undefined,
    track_recording_started: () => undefined,
    track_recording_stopped: () => undefined,
    track_meeting_deleted: () => undefined,
    track_settings_changed: () => undefined,
    track_feature_used: () => undefined,
    track_summary_generation_completed: () => undefined,
    track_summary_regenerated: () => undefined,
    track_model_changed: () => undefined,
    track_custom_prompt_used: () => undefined,
    track_analytics_transparency_viewed: () => undefined,
    track_analytics_enabled: () => undefined,
    track_analytics_disabled: () => undefined,
  };

  return {
    async invoke(command, args = {}) {
      const handler = handlers[command];
      if (!handler) {
        console.warn(`[Protocolito] Unimplemented command: ${command}`);
        return null;
      }

      return handler(args || {});
    },
  };
}

module.exports = { createCommandRegistry };
