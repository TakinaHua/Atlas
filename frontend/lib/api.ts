/** Centralize HTTP errors and CSRF so every form follows the same save rules. */
let csrfToken = '';

export async function initializeSession(): Promise<void> {
  const response = await fetch('/api/session', { cache: 'no-store' });
  if (!response.ok)
    throw new Error('Could not connect to Atlas. Check that the backend is running.');
  const session = await response.json();
  csrfToken = session.csrfToken;
}

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.error || `Request failed (${response.status}). Please try again.`,
    );
  return result as T;
}

/** UTC date-only arithmetic avoids DST shifts and locale-dependent parsing. */
export function itineraryDates(start: string, end: string): string[] {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  const count = (last.getTime() - first.getTime()) / 86_400_000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 60)
    throw new Error('Choose a trip lasting between 1 and 60 days.');
  return Array.from({ length: count }, (_, index) =>
    new Date(first.getTime() + index * 86_400_000).toISOString().slice(0, 10),
  );
}
