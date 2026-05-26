import { useEffect, useMemo, useSyncExternalStore } from 'react';

function normalizeRoute(input: string) {
  if (!input || input === '#') return '/';
  const route = input.startsWith('#') ? input.slice(1) : input;
  return route.startsWith('/') ? route : `/${route}`;
}

function currentRoute() {
  return normalizeRoute(window.location.hash || '/');
}

function notifyRouteChange() {
  window.dispatchEvent(new Event('protocolito-route-change'));
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  window.addEventListener('protocolito-route-change', callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener('protocolito-route-change', callback);
  };
}

function useRoute() {
  return useSyncExternalStore(subscribe, currentRoute, () => '/');
}

export function usePathname() {
  const route = useRoute();
  return route.split('?')[0] || '/';
}

export function useSearchParams() {
  const route = useRoute();
  return useMemo(() => {
    const query = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
    return new URLSearchParams(query);
  }, [route]);
}

export function useRouter() {
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '/';
    }
  }, []);

  return {
    push(path: string) {
      window.location.hash = normalizeRoute(path);
      notifyRouteChange();
    },
    replace(path: string) {
      const url = `${window.location.pathname}${window.location.search}#${normalizeRoute(path)}`;
      window.location.replace(url);
      notifyRouteChange();
    },
    back() {
      window.history.back();
    },
    refresh() {
      notifyRouteChange();
    },
  };
}
