// UTC arithmetic keeps day generation independent of daylight-saving changes.
export function inclusiveDays(start, end) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(start) || !valid(end) || start > end) throw new Error('Choose a valid end date on or after the start date.');
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (count > 366) throw new Error('Please keep trips to 366 days or fewer.');
  return Array.from({length:count}, (_,i) => ({date:new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10),places:[]}));
}
export const formatDate = date => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date));
