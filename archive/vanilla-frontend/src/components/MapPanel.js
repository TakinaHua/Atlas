import { validCoordinates, escapeHTML as e } from '../utilities/helpers.js';
/** Lightweight Web Mercator tile viewer. No routes or geocoding are requested.
 * Marker clicks and itinerary selection share the same selected-place ID. */
export class MapPanel {
  constructor(element, places, selected, onSelect) {
    this.element = element;
    this.placeNumbers = new Map(places.map((p, i) => [p.id, i + 1]));
    this.places = places.filter(validCoordinates);
    this.selected = selected;
    this.onSelect = onSelect;
    this.zoom = 4;
    this.center = [-155.6, 19.6];
    this.fit();
    this.observer = new ResizeObserver(() => this.render());
    this.observer.observe(element);
    this.render();
  }
  project(lon, lat, z) {
    const size = 256 * 2 ** z,
      clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
    return [
      ((lon + 180) / 360) * size,
      ((1 - Math.asinh(Math.tan((clamped * Math.PI) / 180)) / Math.PI) / 2) * size,
    ];
  }
  fit() {
    if (!this.places.length) return;
    this.center = [
      this.places.reduce((s, p) => s + p.longitude, 0) / this.places.length,
      this.places.reduce((s, p) => s + p.latitude, 0) / this.places.length,
    ];
    const width = this.element.clientWidth || 500,
      height = this.element.clientHeight || 450;
    for (let z = 13; z >= 0; z--) {
      const pts = this.places.map((p) => this.project(p.longitude, p.latitude, z));
      if (
        Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])) <
          width - 100 &&
        Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) <
          height - 100
      ) {
        this.zoom = z;
        break;
      }
    }
  }
  render() {
    const w = this.element.clientWidth,
      h = this.element.clientHeight,
      [cx, cy] = this.project(...this.center, this.zoom),
      left = cx - w / 2,
      top = cy - h / 2,
      n = 2 ** this.zoom;
    let tiles = '';
    for (let x = Math.floor(left / 256); x <= Math.floor((left + w) / 256); x++)
      for (let y = Math.floor(top / 256); y <= Math.floor((top + h) / 256); y++) {
        if (y < 0 || y >= n) continue;
        tiles += /* HTML */ `
          <img
            alt=""
            draggable="false"
            class="map-tile"
            style="left:${x * 256 - left}px;top:${y * 256 - top}px"
            src="https://tile.openstreetmap.org/${this.zoom}/${((x % n) + n) % n}/${y}.png"
          />
        `;
      }
    this.element.innerHTML = /* HTML */ `
      <div class="tile-layer">${tiles}</div>
      <div class="map-controls">
        <button data-map="in" aria-label="Zoom in">+</button>
        <button data-map="out" aria-label="Zoom out">−</button>
        <button data-map="fit" aria-label="Fit places">⌖</button>
      </div>
      ${this.places
        .map((p, i) => {
          const [x, y] = this.project(p.longitude, p.latitude, this.zoom);
          return /* HTML */ `
            <button
              class="marker ${this.selected === p.id ? 'active' : ''}"
              style="left:${x - left}px;top:${y - top}px"
              data-marker="${p.id}"
              aria-label="Select ${e(p.name)}"
              title="${e(p.name)}"
            >
              ${this.placeNumbers.get(p.id)}
            </button>
          `;
        })
        .join(
          '',
        )}${!this.places.length ? '<div class="map-empty">Your places will appear here<br><small>Add latitude and longitude to a place.</small></div>' : ''}
      <span class="tile-status"></span>
      <a
        class="attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener"
      >
        © OpenStreetMap contributors
      </a>
    `;
    this.element.querySelectorAll('img').forEach(
      (img) =>
        (img.onerror = () => {
          img.style.display = 'none';
          this.element.querySelector('.tile-status').textContent =
            'Tiles unavailable · coordinate markers still shown';
        }),
    );
    this.element
      .querySelectorAll('[data-marker]')
      .forEach((b) => (b.onclick = () => this.onSelect(b.dataset.marker)));
    this.element.querySelectorAll('[data-map]').forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.map === 'fit') this.fit();
          else
            this.zoom = Math.max(
              0,
              Math.min(18, this.zoom + (b.dataset.map === 'in' ? 1 : -1)),
            );
          this.render();
        }),
    );
  }
  destroy() {
    this.observer.disconnect();
  }
}
