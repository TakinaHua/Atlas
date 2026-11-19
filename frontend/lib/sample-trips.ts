import { itineraryDates } from './api';
import type { Trip } from './types';

export function coastalSample(): Trip {
  return {
    id: crypto.randomUUID(),
    revision: 1,
    name: 'A little aloha',
    destination: 'Oʻahu, Hawaii',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    days: itineraryDates('2026-11-14', '2026-11-16').map((date, index) => ({
      date,
      places:
        index === 0
          ? [
              {
                id: crypto.randomUUID(),
                name: 'Waikīkī Beach',
                address: 'Honolulu, Oʻahu',
                category: 'Nature',
                notes: 'A slow start by the ocean.',
                latitude: 21.2767,
                longitude: -157.8275,
              },
              {
                id: crypto.randomUUID(),
                name: 'Diamond Head',
                address: 'Honolulu, Oʻahu',
                category: 'Nature',
                notes: 'Sample stop — check access and reservations before traveling.',
                latitude: 21.262,
                longitude: -157.805,
              },
            ]
          : [],
    })),
  };
}
export function walkingSample(): Trip {
  return {
    id: crypto.randomUUID(),
    revision: 1,
    name: 'Downtown walking demo',
    destination: 'Pittsburgh, Pennsylvania',
    startDate: '2026-10-14',
    endDate: '2026-10-14',
    days: [
      {
        date: '2026-10-14',
        places: [
          {
            id: crypto.randomUUID(),
            name: 'Gateway area',
            address: 'Downtown Pittsburgh',
            category: 'Sightseeing',
            notes: 'Example graph node; demo only.',
            latitude: 40.4420279,
            longitude: -80.0060824,
          },
          {
            id: crypto.randomUUID(),
            name: 'Market Square area',
            address: 'Downtown Pittsburgh',
            category: 'Sightseeing',
            notes: 'Example graph node; demo only.',
            latitude: 40.4410009,
            longitude: -80.002423,
          },
        ],
      },
    ],
  };
}
