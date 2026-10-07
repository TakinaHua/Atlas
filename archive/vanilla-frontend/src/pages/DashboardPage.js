import { TripCard } from '../components/TripCard.js';
export const DashboardPage = (trips) => /* HTML */ `
  <main class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR PERSONAL TRAVEL SPACE</p>
        <h1>Somewhere starts here.</h1>
        <p>Pick up a plan, or dream up the next one.</p>
      </div>
      <button class="button" id="create-trip">+ Create New Trip</button>
    </div>
    ${
      trips.length
        ? /* HTML */ `
            <div class="trip-grid">${trips.map(TripCard).join('')}</div>
          `
        : /* HTML */ `
            <section class="empty-dashboard">
              <div class="empty-icon">↗</div>
              <h2>Your next adventure is a blank page.</h2>
              <p>
                Create your first trip to start collecting places and planning your days.
              </p>
              <button class="button" id="first-trip">Create New Trip</button>
            </section>
          `
    }
    <p class="storage-note">
      Saved on this device, in this browser. Clearing browser data removes your trips.
    </p>
  </main>
`;
