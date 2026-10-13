/** The frontend proxy keeps browser requests on the same origin as the page. */
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const url = `/api/itineraries${path.slice('/trips'.length)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      method === 'GET'
        ? 'Cannot reach Atlas. Check that the server is running, then reload trips.'
        : 'Could not confirm the save. Check the server, then reload trips before retrying. Your form input is still here.',
    );
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = result?.error?.details?.[0]?.message;
    throw new Error(
      response.status >= 500
        ? 'Atlas could not complete this request. Check the server and reload trips before retrying.'
        : detail ||
            result?.error?.message ||
            `Request failed (${response.status}). Reload trips and try again.`,
    );
  }
  if (result === null)
    throw new Error('Atlas returned an invalid response. Reload trips and try again.');
  return result as T;
}
