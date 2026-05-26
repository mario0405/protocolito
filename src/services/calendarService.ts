import { invoke } from '@tauri-apps/api/core';

export interface GoogleCalendarStatus {
  connected: boolean;
  expiresAt: number | null;
  clientIdConfigured: boolean;
  ownerConfigured: boolean;
  realtimeWebhookUrl: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  eventCount: number;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  attendees: Array<{ email: string; name: string; responseStatus: string; self?: boolean; organizer?: boolean }>;
  description: string;
  location: string;
  htmlLink: string;
  isPrivate: boolean;
  updated: string | null;
}

export function getGoogleCalendarStatus() {
  return invoke<GoogleCalendarStatus>('api_google_calendar_get_status');
}

export function saveGoogleCalendarConfig(config: {
  clientId: string;
  clientSecret?: string;
  realtimeWebhookUrl?: string;
}) {
  return invoke('api_google_calendar_save_config', config);
}

export function connectGoogleCalendar() {
  return invoke('api_google_calendar_connect');
}

export function disconnectGoogleCalendar() {
  return invoke('api_google_calendar_disconnect');
}

export function syncGoogleCalendar() {
  return invoke<{ status: string; events: GoogleCalendarEvent[]; count: number }>('api_google_calendar_sync');
}

export function listGoogleCalendarEvents() {
  return invoke<GoogleCalendarEvent[]>('api_google_calendar_list_events');
}

export function startGoogleCalendarWatch() {
  return invoke('api_google_calendar_start_watch');
}
