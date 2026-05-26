import { invoke } from '@tauri-apps/api/core';

export interface MeetingSearchSource {
  sourceId: string;
  meetingId: string;
  title: string;
  createdAt: string;
}

export interface MeetingSearchAnswer {
  answer: string;
  sources: MeetingSearchSource[];
}

export function askMeetingSearch(query: string) {
  return invoke<MeetingSearchAnswer>('api_meeting_search_chat', { query });
}
