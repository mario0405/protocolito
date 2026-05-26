const ANALYTICS_STORE_FILE = 'analytics.json';
const USER_ID_KEY = 'protocolito_user_id';
const FIRST_LAUNCH_KEY = 'is_first_launch';

export function createAnalyticsUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function todayKey() {
  return new Date().toISOString().split('T')[0];
}

export async function loadAnalyticsStore() {
  const { Store } = await import('@tauri-apps/plugin-store');
  return Store.load(ANALYTICS_STORE_FILE);
}

export function getSessionUserId() {
  let userId = sessionStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = createAnalyticsUserId();
    sessionStorage.setItem(USER_ID_KEY, userId);
    sessionStorage.setItem(FIRST_LAUNCH_KEY, 'true');
  }
  return userId;
}

export function consumeSessionFirstLaunch() {
  const isFirstLaunch = sessionStorage.getItem(FIRST_LAUNCH_KEY) === 'true';
  if (isFirstLaunch) sessionStorage.removeItem(FIRST_LAUNCH_KEY);
  return isFirstLaunch;
}
