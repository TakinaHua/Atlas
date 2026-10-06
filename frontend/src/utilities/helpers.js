export const uniqueId = () => globalThis.crypto.randomUUID();
// User-supplied strings are escaped before insertion into HTML templates.
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const validCoordinates = p => typeof p.latitude === 'number' && Number.isFinite(p.latitude) && Math.abs(p.latitude)<=90 && typeof p.longitude === 'number' && Number.isFinite(p.longitude) && Math.abs(p.longitude)<=180;
