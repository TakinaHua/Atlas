export interface Destination {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes?: string | null;
}

export interface DayPlan {
  id: string;
  dayNumber: number;
  title?: string | null;
  notes?: string | null;
  destinations: Destination[];
}

export interface Trip {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  days: DayPlan[];
  createdAt: string;
  updatedAt: string;
}
