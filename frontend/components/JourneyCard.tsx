import {
  memo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react';
import { displayDate } from '../lib/display-date';
import type { Day, Place } from '../lib/types';

export type PlaceLocation = string | null;
export type PlaceAction = (
  source: PlaceLocation,
  place: Place,
  target?: PlaceLocation,
  beforeId?: string,
) => void;

const photos = [
  {
    name: 'Gateway area',
    point: [40.442, -80.006],
    file: 'gateway',
    source: 'Gateway_Building_Pittsburgh.jpg',
    author: 'HoboJones',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  {
    name: 'Market Square area',
    point: [40.441, -80.002],
    file: 'market-square',
    source: 'Pittsburgh_marketsquare.jpg',
    author: 'PerryPlanet',
    license: 'Public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  {
    name: 'Waikīkī Beach',
    point: [21.2767, -157.8275],
    file: 'waikiki',
    source: 'Diamond_Head_from_Waikiki.jpg',
    author: 'Alfred Adler',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  {
    name: 'Diamond Head',
    point: [21.262, -157.805],
    file: 'diamond-head',
    source: 'Diamond_Head_2024.jpg',
    author: 'ELLK Photo',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  {
    name: 'Hanauma Bay',
    point: [21.269, -157.694],
    file: 'hanauma',
    source: 'Hanauma_Bay.JPG',
    author: 'ErgoSum88',
    license: 'Public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  {
    name: 'Waimea Bay',
    point: [21.641, -158.064],
    file: 'waimea',
    source: 'Waimea_Bay_Oahu_Hawaii_Photo_Don_Ramey_Logan.jpg',
    author: 'Don Ramey Logan',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
];
const photoKey = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function PostcardPhoto({ place, priority }: { place: Place; priority: boolean }) {
  const [failed, setFailed] = useState('');
  const photo = photos.find(
    ({ name, point }) =>
      photoKey(name) === photoKey(place.name) &&
      place.latitude !== null &&
      Math.abs(place.latitude - point[0]) < 0.025 &&
      place.longitude !== null &&
      Math.abs(place.longitude - point[1]) < 0.025,
  );
  if (!photo || photo.file === failed) return null;
  const seed = Array.from(place.id).reduce(
    (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0,
    0,
  );
  return (
    <figure
      className="studio-print"
      data-pinned={seed % 4 !== 0}
      style={
        {
          '--print-rotation': `${[-1.6, 0.9, -0.65, 1.55, 0][seed % 5]}deg`,
          '--print-pin': `${32 + (seed % 38)}%`,
        } as CSSProperties
      }
    >
      <img
        src={`/images/journey/${photo.file}.webp`}
        alt={photo.name}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        width={640}
        height={380}
        onError={() => setFailed(photo.file)}
      />
      <figcaption>
        <a
          href={`https://commons.wikimedia.org/wiki/File:${photo.source}`}
          target="_blank"
          rel="noreferrer"
        >
          {photo.author}
        </a>
        {' / '}
        <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
          {photo.license}
        </a>
        {' / cropped'}
      </figcaption>
    </figure>
  );
}

export function StudioIcon({
  name,
}: {
  name:
    | 'back'
    | 'forward'
    | 'up'
    | 'down'
    | 'plus'
    | 'save'
    | 'grip'
    | 'fit'
    | 'card'
    | 'list';
}) {
  const paths = {
    back: 'm14 6-6 6 6 6',
    forward: 'm10 6 6 6-6 6',
    up: 'm6 15 6-6 6 6',
    down: 'm6 9 6 6 6-6',
    plus: 'M12 5v14M5 12h14',
    save: 'M6 4h12v16l-6-4-6 4z',
    grip: 'M6 8h12M6 12h12M6 16h12',
    fit: 'M9 5H5v4m10-4h4v4m0 6v4h-4m-6 0H5v-4m7-5v4m-2-2h4',
    card: 'M4 5h6v14H4zm10 0h6v14h-6z',
    list: 'M4 6h2m3 0h11M4 12h2m3 0h11M4 18h2m3 0h11',
  };
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export default memo(function JourneyCard({
  place,
  day,
  index,
  days,
  busy,
  selected,
  visual,
  savedCount,
  dropBefore,
  select,
  edit,
  action,
  hover,
  startDrag,
  handleDrop,
  mapAction,
}: {
  place: Place;
  day: Day | null;
  index: number;
  days: Day[];
  busy: boolean;
  selected: boolean;
  visual: boolean;
  savedCount: number;
  dropBefore: boolean;
  select: (place: Place, date: PlaceLocation) => void;
  edit: (date: PlaceLocation, place: Place) => void;
  action: PlaceAction;
  hover: (id: string | null) => void;
  startDrag: (event: DragEvent, source: PlaceLocation, place: Place) => void;
  handleDrop: (event: DragEvent, target: PlaceLocation, before?: string) => void;
  mapAction?: ReactNode;
}) {
  const source = day?.date ?? null;
  const [toolsOpen, setToolsOpen] = useState(false);
  const tools = useRef<HTMLDivElement>(null);
  const previous = day?.places[index - 1];
  const next = day?.places[index + 1];
  return (
    <li
      id={`stop-${place.id}`}
      className={`studio-card${selected ? ' selected' : ''}`}
      tabIndex={-1}
      data-drop-before={dropBefore}
      onPointerEnter={() => hover(place.id)}
      onPointerLeave={() => hover(null)}
      onDragOver={(event) => handleDrop(event, source, place.id)}
      onDrop={(event) => handleDrop(event, source, place.id)}
    >
      <div className="studio-card-content">
        {visual && (
          <PostcardPhoto place={place} priority={day === days[0] && index === 0} />
        )}
        <div className="studio-card-main">
          <button
            type="button"
            className="stop-title"
            aria-pressed={selected}
            onClick={() => select(place, source)}
          >
            <span className="studio-stop-number" aria-hidden="true">
              {day ? index + 1 : <StudioIcon name="save" />}
            </span>
            <strong>{place.name}</strong>
          </button>
          {place.address && <p className="studio-address">{place.address}</p>}
          {place.category && <p className="studio-category">{place.category}</p>}
          {place.notes && <p className="studio-notes">{place.notes}</p>}
          {place.latitude === null && <p className="studio-unmapped">No map location</p>}
          {mapAction}
        </div>
        <div
          className="studio-card-actions"
          role="group"
          aria-label={`Actions for ${place.name}`}
        >
          <button
            type="button"
            className="studio-drag"
            disabled={busy}
            draggable={!busy}
            tabIndex={-1}
            aria-hidden="true"
            title={`Drag ${place.name}`}
            onDragStart={(event) => startDrag(event, source, place)}
          >
            <StudioIcon name="grip" />
          </button>
          <button type="button" disabled={busy} onClick={() => edit(source, place)}>
            Edit
          </button>
          {day && (
            <>
              <button
                type="button"
                aria-label={`Move ${place.name} up`}
                title="Move up"
                disabled={busy || !previous}
                onClick={() => action(source, place, source, previous?.id)}
              >
                <StudioIcon name="up" />
              </button>
              <button
                type="button"
                aria-label={`Move ${place.name} down`}
                title="Move down"
                disabled={busy || !next}
                onClick={() => action(source, place, source, day.places[index + 2]?.id)}
              >
                <StudioIcon name="down" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label={`More actions for ${place.name}`}
            aria-expanded={toolsOpen}
            disabled={busy}
            onClick={() => {
              setToolsOpen(!toolsOpen);
              if (!toolsOpen)
                requestAnimationFrame(() =>
                  tools.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
                );
            }}
          >
            More
          </button>
        </div>
        {toolsOpen && (
          <div className="studio-card-tools" ref={tools}>
            {(source === null || days.length > 1) && (
              <label>
                {day ? 'Move to another day' : 'Schedule on a day'}
                <select
                  aria-label={
                    day ? `Move ${place.name} to another day` : `Schedule ${place.name}`
                  }
                  value=""
                  disabled={busy}
                  onChange={(event) => action(source, place, event.target.value)}
                >
                  <option value="" disabled>
                    Choose a day
                  </option>
                  {days.map(
                    (target, dayIndex) =>
                      target.date !== source && (
                        <option
                          key={target.date}
                          value={target.date}
                          disabled={target.places.length >= 30}
                        >
                          Day {dayIndex + 1}, {displayDate(target.date)}
                          {target.places.length === 30 ? ' (full)' : ''}
                        </option>
                      ),
                  )}
                </select>
              </label>
            )}
            {day && (
              <button
                type="button"
                disabled={busy || savedCount >= 120}
                onClick={() => action(source, place, null)}
              >
                Save for later
              </button>
            )}
            <button
              type="button"
              className="studio-danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Remove ${place.name}?`)) action(source, place);
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </li>
  );
});
