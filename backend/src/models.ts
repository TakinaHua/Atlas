import type { DestinationLocation } from './destinations.js';
export interface Destination {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  notes?: string | null;
  address?: string;
  category?: string;
}

export interface DayPlan {
  id: string;
  dayNumber: number;
  title?: string | null;
  notes?: string | null;
  destinations: Destination[];
}

export interface Trip {
  destinationLocation?: DestinationLocation | null;
  destination?: string;
  revision?: number;
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  days: DayPlan[];
  createdAt: string;
  updatedAt: string;
}
