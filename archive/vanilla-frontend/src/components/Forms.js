import { escapeHTML as e } from '../utilities/helpers.js';
export function openDialog(title, content, onSubmit) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = /* HTML */ `
    <form>
      <div class="dialog-heading">
        <h2>${title}</h2>
        <button type="button" class="icon-button" aria-label="Close dialog">✕</button>
      </div>
      ${content}
      <p class="form-error" role="alert"></p>
      <div class="dialog-actions">
        <button type="button" class="secondary cancel">Cancel</button>
        <button class="button" type="submit">Save</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector('.icon-button').onclick = close;
  dialog.querySelector('.cancel').onclick = close;
  dialog.addEventListener('cancel', () => dialog.remove());
  dialog.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    try {
      onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
      close();
    } catch (error) {
      dialog.querySelector('.form-error').textContent = error.message;
    }
  };
  dialog.showModal();
}
export const CreateTripForm = () => /* HTML */ `
  <label>
    Trip name
    <input name="name" required maxlength="100" placeholder="Hawaii, at my own pace" />
  </label>
  <label>
    Destination
    <input name="destination" required maxlength="150" placeholder="Big Island, Hawaii" />
  </label>
  <div class="form-row">
    <label>
      Start date
      <input name="startDate" type="date" required />
    </label>
    <label>
      End date
      <input name="endDate" type="date" required />
    </label>
  </div>
`;
export const AddPlaceForm = (p = {}) => /* HTML */ `
  <label>
    Place name
    <input
      name="name"
      required
      maxlength="150"
      value="${e(p.name)}"
      placeholder="A place worth stopping for"
    />
  </label>
  <label>
    Address
    <input
      name="address"
      maxlength="300"
      value="${e(p.address)}"
      placeholder="Optional street address"
    />
  </label>
  <div class="form-row">
    <label>
      Latitude
      <input
        name="latitude"
        type="number"
        step="any"
        min="-90"
        max="90"
        value="${e(p.latitude)}"
        placeholder="e.g. 19.64"
      />
    </label>
    <label>
      Longitude
      <input
        name="longitude"
        type="number"
        step="any"
        min="-180"
        max="180"
        value="${e(p.longitude)}"
        placeholder="e.g. -155.99"
      />
    </label>
  </div>
  <p class="field-note">
    Optional. Enter both coordinates to show a map marker. Addresses are not automatically
    geocoded.
  </p>
  <label>
    Category
    <select name="category">
      ${['Sightseeing', 'Food & drink', 'Nature', 'Stay', 'Other']
        .map(
          (c) => /* HTML */ `
            <option ${p.category === c ? 'selected' : ''}>${c}</option>
          `,
        )
        .join('')}
    </select>
  </label>
  <label>
    Notes
    <textarea
      name="notes"
      rows="3"
      maxlength="2000"
      placeholder="Opening hours, things to remember…"
    >
${e(p.notes)}</textarea>
  </label>
`;
