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
