import {inclusiveDays} from '../utilities/dates.js';
import {uniqueId} from '../utilities/helpers.js';
const KEY = 'atlas.trips.v1';
// This module is the only persistence boundary. Replace these calls with REST requests later.
export function loadTrips() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const trips = JSON.parse(raw);
    if (!Array.isArray(trips) || trips.some(t => !t || typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.destination !== 'string' || !Array.isArray(t.days) || t.days.some(d => !d || typeof d.date !== 'string' || !Array.isArray(d.places) || d.places.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string')))) throw new Error();
    for (const t of trips) if (inclusiveDays(t.startDate,t.endDate).map(d=>d.date).join() !== t.days.map(d=>d.date).join()) throw new Error();
    return trips;
  } catch { throw new Error('Saved trip data could not be read. Your original data has been preserved.'); }
}
export function saveTrips(trips) { localStorage.setItem(KEY, JSON.stringify(trips)); }
export function createTrip({name,destination,startDate,endDate}) {
  if (!name.trim() || !destination.trim()) throw new Error('Enter a trip name and destination.');
  const trip = {id:uniqueId(),name:name.trim(),destination:destination.trim(),startDate,endDate,days:inclusiveDays(startDate,endDate)};
  saveTrips([...loadTrips(),trip]); return trip;
}
export function updateTrip(trip) { saveTrips(loadTrips().map(t=>t.id===trip.id?trip:t)); }
export function deleteTrip(id) { saveTrips(loadTrips().filter(t=>t.id!==id)); }
export function addPlaceToDay(trip,date,place) { return changePlaces(trip,date,places=>[...places,place]); }
export function removePlaceFromDay(trip,date,id) { return changePlaces(trip,date,places=>places.filter(p=>p.id!==id)); }
/** Immutable day updates prevent places from leaking into another day. */
export function changePlaces(trip,date,transform) {
  const next = {...trip,days:trip.days.map(d=>d.date===date?{...d,places:transform(d.places)}:d)};
  updateTrip(next); return next;
}
