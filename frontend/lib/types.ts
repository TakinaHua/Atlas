/** API types mirror Django's JSON representation, including date-only strings. */
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
  graphDurationSeconds: number;
  pathIndices: number[];
  algorithm: string;
  profile: string;
  provider: string;
}
