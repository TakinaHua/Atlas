export interface DestinationLocation {
  id: string;
  name: string;
  label: string;
  kind: 'city' | 'state';
  state: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  zoom: number;
}
/** Server-backed itinerary records use date-only strings; compatible with exported trip backups. */
export interface Place {
  id: string;
  name: string;
  address: string;
  category: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
}
export interface Day {
  date: string;
  places: Place[];
}
export interface Trip {
  destinationLocation?: DestinationLocation | null;
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  revision: number;
  days: Day[];
}
export interface CalculatedRoute {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  distanceMeters: number;
  durationSeconds: number;
  legs: { distanceMeters: number; durationSeconds: number }[];
  profile: string;
  provider: string;
}
