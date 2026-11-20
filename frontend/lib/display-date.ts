export function displayDate(
  date: string,
  includeYear = false,
  weekday?: 'short' | 'long',
) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday,
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
