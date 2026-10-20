// The only place the app touches localStorage. Every failure (blocked, quota, corrupt) degrades to "not saved".

const PROBE = 'ttg:probe';
let persists: boolean | null = null;

export function canPersist(): boolean {
  if (persists === null) {
    try {
      localStorage.setItem(PROBE, '1');
      localStorage.removeItem(PROBE);
      persists = true;
    } catch {
      persists = false;
    }
  }
  return persists;
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // blocked storage: nothing to remove
  }
}

/** Parsed value if present and `guard` accepts it; otherwise null, and the bad entry is removed. */
export function load<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (guard(value)) return value;
  } catch {
    // unreadable storage or invalid JSON: fall through to cleanup
  }
  remove(key);
  return null;
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    persists = false;
  }
}
