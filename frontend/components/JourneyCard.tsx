import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  type TouchEvent,
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

type PostcardImage = {
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  credit?: string;
  locationLabel?: string;
  nearby?: boolean;
};

function PhotoPrint({
  photo,
  name,
  priority,
}: {
  photo: PostcardImage;
  name: string;
  priority: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="studio-print">
      <img
        src={photo.url}
        alt={photo.nearby && photo.locationLabel ? photo.locationLabel : name}
        draggable={false}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        referrerPolicy="no-referrer"
        width={640}
        height={380}
        onError={() => setFailed(true)}
      />
      <figcaption>
        {photo.nearby && photo.locationLabel && (
          <>
            Nearby · {photo.locationLabel}
            <br />
          </>
        )}
        <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
          {photo.author}
        </a>
        {photo.credit && ` / ${photo.credit}`}
        {' / '}
        <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
          {photo.license}
        </a>
        {' / cropped'}
      </figcaption>
    </figure>
  );
}

function PlacePhoto({
  lookup,
  name,
  card,
  priority,
}: {
  lookup: string;
  name: string;
  card: RefObject<HTMLDivElement | null>;
  priority: boolean;
}) {
  const [photo, setPhoto] = useState<PostcardImage | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(lookup, {
          signal: controller.signal,
          cache: 'no-cache',
        });
        if (!response.ok) return;
        const result: { photo: PostcardImage | null } = await response.json();
        if (!controller.signal.aborted) setPhoto(result.photo);
      } catch {
        // Keep the pinned paper card if the photo service is unreachable.
      }
    }
    const target = card.current;
    let observer: IntersectionObserver | undefined;
    if (target && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries, observation) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observation.disconnect();
        void load();
      });
      observer.observe(target);
    } else {
      void load();
    }
    return () => {
      observer?.disconnect();
      controller.abort();
    };
  }, [lookup, card]);

  return photo && <PhotoPrint photo={photo} name={name} priority={priority} />;
}

function PostcardPhoto({
  place,
  card,
  priority,
}: {
  place: Place;
  card: RefObject<HTMLDivElement | null>;
  priority: boolean;
}) {
  const { name, latitude, longitude } = place;
  if (latitude === null || longitude === null) return null;
  const curated = photos.find(
    ({ name: photoName, point }) =>
      photoKey(photoName) === photoKey(name) &&
      Math.abs(latitude - point[0]) < 0.025 &&
      Math.abs(longitude - point[1]) < 0.025,
  );
  if (curated) {
    return (
      <PhotoPrint
        key={curated.file}
        name={curated.name}
        priority={priority}
        photo={{
          ...curated,
          url: `/images/journey/${curated.file}.webp`,
          sourceUrl: `https://commons.wikimedia.org/wiki/File:${curated.source}`,
        }}
      />
    );
  }
  if (name.includes('|')) return null;
  const query = new URLSearchParams({
    name,
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
  });
  const lookup = `/api/place-photo?${query}`;
  return (
    <PlacePhoto
      key={lookup}
      lookup={lookup}
      name={name}
      card={card}
      priority={priority}
    />
  );
}

export function StudioIcon({ name }: { name: 'up' | 'down' | 'plus' | 'save' | 'fit' }) {
  const paths = {
    up: 'm6 15 6-6 6 6',
    down: 'm6 9 6 6 6-6',
    plus: 'M12 5v14M5 12h14',
    save: 'M6 4h12v16l-6-4-6 4z',
    fit: 'M9 5H5v4m10-4h4v4m0 6v4h-4m-6 0H5v-4m7-5v4m-2-2h4',
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
  savedCount,
  dropBefore,
  select,
  edit,
  action,
  hover,
  startDrag,
  startTouchDrag,
  dragging,
  mapAction,
}: {
  place: Place;
  day: Day | null;
  index: number;
  days: Day[];
  busy: boolean;
  selected: boolean;
  savedCount: number;
  dropBefore: boolean;
  select: (place: Place, date: PlaceLocation) => void;
  edit: (date: PlaceLocation, place: Place) => void;
  action: PlaceAction;
  hover: (id: string | null) => void;
  startDrag: (
    event: PointerEvent<HTMLLIElement>,
    source: PlaceLocation,
    place: Place,
  ) => void;
  startTouchDrag: (
    event: TouchEvent<HTMLLIElement>,
    source: PlaceLocation,
    place: Place,
  ) => void;
  dragging: boolean;
  mapAction?: ReactNode;
}) {
  const source = day?.date ?? null;
  const [toolsOpen, setToolsOpen] = useState(false);
  const tools = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const previous = day?.places[index - 1];
  const next = day?.places[index + 1];
  const seed = Array.from(place.id).reduce(
    (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0,
    0,
  );
  const postcardStyle = {
    '--print-rotation': `${[-1.6, 0.9, -0.65, 1.55, 0][seed % 5]}deg`,
    '--print-pin': `${32 + (seed % 38)}%`,
  } as CSSProperties;

  return (
    <li
      id={`stop-${place.id}`}
      className={`studio-card${selected ? ' selected' : ''}`}
      tabIndex={-1}
      data-drop-before={dropBefore}
      data-drop-stop={place.id}
      data-dragging={dragging}
      onPointerDown={(event) => startDrag(event, source, place)}
      onTouchStart={(event) => startTouchDrag(event, source, place)}
      onDragStart={(event) => {
        if (!(event.target instanceof Element && event.target.closest('a')))
          event.preventDefault();
      }}
      onPointerEnter={() => hover(place.id)}
      onPointerLeave={() => hover(null)}
    >
      <div
        ref={card}
        className="studio-card-content"
        data-paper={seed % 3}
        style={postcardStyle}
      >
        <PostcardPhoto
          place={place}
          card={card}
          priority={day === days[0] && index === 0}
        />
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
