// Settings and tallies kept in the browser, shared by the game and the fortune-telling page.

/** A stored object laid over its defaults, or the defaults when nothing usable is stored. */
export function load<T>(key: string, fallback: T, store: () => Storage = () => localStorage): T {
  try {
    const raw = store().getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown, store: () => Storage = () => localStorage): void {
  try {
    store().setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private window); the page works without it.
  }
}
