import * as storage from './storage/tripStorage.js';
import {uniqueId} from './utilities/helpers.js';
import {Navbar} from './components/Navbar.js';
import {LandingPage} from './pages/LandingPage.js';
import {DashboardPage} from './pages/DashboardPage.js';
import {TripPlannerPage} from './pages/TripPlannerPage.js';
import {openDialog,CreateTripForm,AddPlaceForm} from './components/Forms.js';
import {MapPanel} from './components/MapPanel.js';
const root=document.querySelector('#app');
let currentTripId=null,selectedDate=null,selectedPlace=null,map=null;
function showError(error){const banner=document.createElement('div');banner.className='error-banner';banner.setAttribute('role','alert');banner.textContent=error.message;root.prepend(banner);}
// Hash navigation works on a simple static server without server-side route configuration.
function render(){
  map?.destroy();map=null;
  try{
    const route=location.hash||'#/';
    root.innerHTML=Navbar();
    if(route==='#/') {root.insertAdjacentHTML('beforeend',LandingPage());return;}
    const trips=storage.loadTrips();
    if(route==='#/dashboard'){
      root.insertAdjacentHTML('beforeend',DashboardPage(trips));
      for(const id of ['create-trip','first-trip'])document.getElementById(id)?.addEventListener('click',()=>openDialog('Start a new journey',CreateTripForm(),data=>{const trip=storage.createTrip(data);location.hash=`#/trip/${trip.id}`;}));
      root.querySelectorAll('[data-delete-trip]').forEach(button=>button.onclick=()=>openDialog('Delete this trip?',`<p>This removes the trip and all its places from this browser.</p>`,()=>{storage.deleteTrip(button.dataset.deleteTrip);render();}));return;
    }
    const trip=trips.find(t=>route===`#/trip/${t.id}`);
    if(!trip){location.hash='#/dashboard';return;}
    if(currentTripId!==trip.id){currentTripId=trip.id;selectedDate=trip.startDate;selectedPlace=null;}
    const day=trip.days.find(d=>d.date===selectedDate);
    root.insertAdjacentHTML('beforeend',TripPlannerPage(trip,selectedDate,selectedPlace));
    root.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.day;selectedPlace=null;render();});
    const select=id=>{selectedPlace=id;render();root.querySelector(`[data-place="${id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});};
    root.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>select(b.dataset.select));
    map=new MapPanel(document.getElementById('map'),day.places,selectedPlace,select);
    // Persist first, then re-render, so storage failures never appear as successful changes.
    const editPlace=place=>openDialog(place?'Edit place':'Add a place',AddPlaceForm(place),data=>{
      if(!data.name.trim())throw new Error('Enter a place name.');
      if((data.latitude==='')!==(data.longitude===''))throw new Error('Enter both coordinates, or leave both empty.');
      const latitude=data.latitude===''?null:Number(data.latitude),longitude=data.longitude===''?null:Number(data.longitude);
      if(latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180))throw new Error('Coordinates must be within valid latitude and longitude ranges.');
      const next={...data,name:data.name.trim(),id:place?.id||uniqueId(),latitude,longitude};
      if(place)storage.changePlaces(trip,selectedDate,ps=>ps.map(p=>p.id===place.id?next:p));else storage.addPlaceToDay(trip,selectedDate,next);
      render();
    });
    document.getElementById('add-place').onclick=()=>editPlace();
    root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{try{
      const index=day.places.findIndex(p=>p.id===b.dataset.id),place=day.places[index];
      if(b.dataset.action==='edit'){editPlace(place);return;}
      if(b.dataset.action==='delete'){storage.removePlaceFromDay(trip,selectedDate,place.id);if(selectedPlace===place.id)selectedPlace=null;}
      else storage.changePlaces(trip,selectedDate,ps=>{const next=[...ps],to=index+(b.dataset.action==='up'?-1:1);if(to>=0&&to<next.length)[next[index],next[to]]=[next[to],next[index]];return next;});
      render();
    }catch(error){showError(error);}});
  }catch(error){showError(error);}
}
window.addEventListener('hashchange',render);render();
