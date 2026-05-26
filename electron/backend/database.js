const path = require('path');
const { JsonStore, ensureDir } = require('./json-store');

function nowIso() {
  return new Date().toISOString();
}

function normalizeTranscript(segment, index) {
  const id = segment.id || `segment-${Date.now()}-${index}`;
  return {
    id,
    text: segment.text || segment.transcript || '',
    timestamp: segment.timestamp || nowIso(),
    speaker: segment.speaker || null,
    audio_start_time: segment.audio_start_time ?? null,
    audio_end_time: segment.audio_end_time ?? null,
    duration: segment.duration ?? null,
  };
}

class Database {
  constructor(userDataPath) {
    this.root = path.join(userDataPath, 'data');
    ensureDir(this.root);
    this.store = new JsonStore(path.join(this.root, 'database.json'), {
      meetings: [],
      settings: {},
      apiKeys: {},
      transcriptApiKeys: {},
      summaries: {},
      processes: {},
    });
  }

  listMeetings() {
    return [...this.store.data.meetings]
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(({ transcripts, summary, ...meeting }) => meeting);
  }

  getMeeting(meetingId) {
    const meeting = this.store.data.meetings.find((item) => item.id === meetingId);
    if (!meeting) return null;
    return { ...meeting, transcripts: meeting.transcripts || [] };
  }

  saveMeeting({ meetingTitle, transcripts = [], folderPath = null, templateId = null }) {
    const id = `meeting-${Date.now()}`;
    const created = nowIso();
    const meeting = {
      id,
      title: meetingTitle || 'Untitled Meeting',
      created_at: created,
      updated_at: created,
      folder_path: folderPath,
      template_id: templateId || null,
      transcripts: transcripts.map(normalizeTranscript),
      summary: null,
    };

    this.store.data.meetings.push(meeting);
    this.store.save();
    return { meeting_id: id, id };
  }

  appendMeetingFromRecording(title, transcripts, audioPath = null) {
    return this.saveMeeting({ meetingTitle: title, transcripts, folderPath: audioPath });
  }

  updateMeetingTitle(meetingId, title) {
    const meeting = this.getMutableMeeting(meetingId);
    meeting.title = title;
    meeting.updated_at = nowIso();
    this.store.save();
    return { message: 'Meeting title saved successfully' };
  }

  deleteMeeting(meetingId) {
    const before = this.store.data.meetings.length;
    this.store.data.meetings = this.store.data.meetings.filter((item) => item.id !== meetingId);
    delete this.store.data.summaries[meetingId];
    this.store.save();
    return { deleted: before !== this.store.data.meetings.length };
  }

  saveSummary(meetingId, summary) {
    const meeting = this.getMutableMeeting(meetingId);
    meeting.summary = summary;
    meeting.updated_at = nowIso();
    this.store.data.summaries[meetingId] = summary;
    this.store.save();
    return { message: 'Meeting summary saved successfully' };
  }

  getSummary(meetingId) {
    const meeting = this.getMeeting(meetingId);
    const summary = this.store.data.summaries[meetingId] || meeting?.summary || null;
    if (!meeting) {
      return {
        status: 'error',
        meetingName: null,
        meeting_id: meetingId,
        data: null,
        error: 'Meeting ID not found',
      };
    }

    return {
      status: summary ? 'completed' : 'empty',
      meetingName: meeting.title,
      meeting_id: meetingId,
      data: summary,
      start: meeting.created_at,
      end: meeting.updated_at,
    };
  }

  searchTranscripts(query) {
    const lower = String(query || '').toLowerCase();
    if (!lower) return [];

    return this.store.data.meetings.flatMap((meeting) =>
      (meeting.transcripts || [])
        .filter((segment) => String(segment.text).toLowerCase().includes(lower))
        .map((segment) => ({
          meeting_id: meeting.id,
          meeting_title: meeting.title,
          transcript: segment.text,
          timestamp: segment.timestamp,
        }))
    );
  }

  getSetting(key, fallback = null) {
    return this.store.data.settings[key] ?? fallback;
  }

  setSetting(key, value) {
    this.store.data.settings[key] = value;
    this.store.save();
  }

  getApiKey(provider) {
    return this.store.data.apiKeys[provider] || null;
  }

  setApiKey(provider, apiKey) {
    if (apiKey) this.store.data.apiKeys[provider] = apiKey;
    this.store.save();
  }

  getTranscriptApiKey(provider) {
    return this.store.data.transcriptApiKeys[provider] || null;
  }

  setTranscriptApiKey(provider, apiKey) {
    if (apiKey) this.store.data.transcriptApiKeys[provider] = apiKey;
    this.store.save();
  }

  getMutableMeeting(meetingId) {
    const meeting = this.store.data.meetings.find((item) => item.id === meetingId);
    if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
    return meeting;
  }
}

module.exports = { Database };
