'use client';

import { useEffect, useRef } from 'react';
import { CalendarClock, Mic } from 'lucide-react';
import { toast } from 'sonner';
import {
  getGoogleCalendarStatus,
  listGoogleCalendarEvents,
  syncGoogleCalendar,
  GoogleCalendarEvent,
} from '@/services/calendarService';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useConfig } from '@/contexts/ConfigContext';

const REMINDER_STORAGE_KEY = 'protocolito.calendarReminders.v1';
const CHECK_INTERVAL_MS = 30000;
const SYNC_INTERVAL_MS = 120000;
const REMINDER_WINDOW_MS = 5 * 60 * 1000;
const PAST_GRACE_MS = 60 * 1000;

function loadReminderIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || '[]') as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveReminderIds(ids: Set<string>) {
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify([...ids].slice(-500)));
}

function eventStartMs(event: GoogleCalendarEvent) {
  if (!event.start) return null;
  const ms = new Date(event.start).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function eventReminderId(event: GoogleCalendarEvent) {
  return `${event.id}:${event.start || ''}`;
}

function hasMeetingAttendees(event: GoogleCalendarEvent) {
  const attendees = event.attendees || [];
  if (attendees.some((attendee) => !attendee.self && !attendee.organizer)) return true;
  return attendees.length > 1;
}

function formatStartTime(startMs: number) {
  return new Date(startMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requestRecordingStart() {
  window.dispatchEvent(new CustomEvent('request-recording-toggle'));
}

async function showNativeNotification(title: string, body: string) {
  if (!('Notification' in window)) return;

  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        silent: false,
      });
      notification.onclick = () => {
        window.focus();
        requestRecordingStart();
      };
    }
  } catch {
    // Native notifications are best-effort; the in-app toast is the reliable reminder.
  }
}

export function CalendarMeetingReminder() {
  const { isRecording } = useRecordingState();
  const { t } = useConfig();
  const isRecordingRef = useRef(isRecording);
  const remindedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    remindedRef.current = loadReminderIds();
    let cancelled = false;
    let syncTimer: number | undefined;
    let checkTimer: number | undefined;

    const runSync = async () => {
      try {
        const status = await getGoogleCalendarStatus();
        if (status.connected) {
          await syncGoogleCalendar();
        }
      } catch (error) {
        console.warn('[CalendarReminder] Calendar sync skipped:', error);
      }
    };

    const checkEvents = async () => {
      if (cancelled || isRecordingRef.current) return;

      try {
        const status = await getGoogleCalendarStatus();
        if (!status.connected) return;

        const events = await listGoogleCalendarEvents();
        const now = Date.now();
        const upcoming = events
          .map((event) => ({ event, startMs: eventStartMs(event) }))
          .filter((item): item is { event: GoogleCalendarEvent; startMs: number } => item.startMs !== null)
          .filter(({ event }) => hasMeetingAttendees(event))
          .filter(({ startMs }) => startMs >= now - PAST_GRACE_MS && startMs <= now + REMINDER_WINDOW_MS)
          .sort((a, b) => a.startMs - b.startMs);

        for (const { event, startMs } of upcoming) {
          const reminderId = eventReminderId(event);
          if (remindedRef.current.has(reminderId)) continue;

          remindedRef.current.add(reminderId);
          saveReminderIds(remindedRef.current);

          const title = event.title || t('calendar.upcomingMeeting');
          const startLabel = formatStartTime(startMs);
          const toastId = toast.info(t('calendar.meetingStartsSoon'), {
            description: (
              <div className="min-w-[260px] space-y-3">
                <div>
                  <div className="font-medium text-stone-950">{title}</div>
                  <div className="text-xs text-stone-600">{t('calendar.startsAt').replace('{time}', startLabel)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(toastId);
                    requestRecordingStart();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-stone-800"
                >
                  <Mic className="h-3.5 w-3.5" />
                  {t('home.startRecording')}
                </button>
              </div>
            ),
            icon: <CalendarClock className="h-4 w-4" />,
            duration: 60000,
            position: 'bottom-right',
          });

          showNativeNotification(t('calendar.meetingStartsSoon'), t('calendar.nativeBody').replace('{title}', title).replace('{time}', startLabel));
          break;
        }
      } catch (error) {
        console.warn('[CalendarReminder] Failed to check calendar events:', error);
      }
    };

    runSync().finally(checkEvents);
    syncTimer = window.setInterval(runSync, SYNC_INTERVAL_MS);
    checkTimer = window.setInterval(checkEvents, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (syncTimer) window.clearInterval(syncTimer);
      if (checkTimer) window.clearInterval(checkTimer);
    };
  }, [t]);

  return null;
}
