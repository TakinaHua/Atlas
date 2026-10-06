import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapPanel} from '../src/components/MapPanel.js';
import {TripPlannerPage} from '../src/pages/TripPlannerPage.js';
import {LandingPage} from '../src/pages/LandingPage.js';
import {DashboardPage} from '../src/pages/DashboardPage.js';
import {inclusiveDays} from '../src/utilities/dates.js';
test('map shows valid zero coordinates, keeps itinerary numbering and selected marker',()=>{
  globalThis.ResizeObserver=class {observe(){} disconnect(){}};
  const element={clientWidth:500,clientHeight:440,innerHTML:'',querySelectorAll:()=>[]};
  const map=new MapPanel(element,[{id:'a',name:'Unmapped'},{id:'b',name:'Zero',latitude:0,longitude:0}],'b',()=>{});
  assert.match(element.innerHTML,/data-marker="b"[^>]*>2<\/button>/);assert.match(element.innerHTML,/marker active/);assert.doesNotMatch(element.innerHTML,/data-marker="a"/);assert.doesNotMatch(element.innerHTML,/NaN/);
  map.destroy();
});
test('map empty day and polar coordinates render without invalid positions',()=>{
  globalThis.ResizeObserver=class {observe(){} disconnect(){}};
  const element={clientWidth:500,clientHeight:440,innerHTML:'',querySelectorAll:()=>[]};
  let map=new MapPanel(element,[],null,()=>{});assert.match(element.innerHTML,/Your places will appear here/);map.destroy();
  map=new MapPanel(element,[{id:'p',name:'Pole',latitude:90,longitude:180}],null,()=>{});assert.doesNotMatch(element.innerHTML,/NaN|Infinity/);map.destroy();
});
test('planner derives days and renders selected-day places only; escapes input',()=>{
 const days=inclusiveDays('2026-12-06','2026-12-09');days[0].places=[{id:'a',name:'<script>evil</script>',notes:'<img src=x>',category:'Nature'}];days[1].places=[{id:'b',name:'Day two place'}];
 const trip={id:'t',name:'Test',destination:'Hawaii',startDate:'2026-12-06',endDate:'2026-12-09',days};
 const html=TripPlannerPage(trip,'2026-12-06',null);assert.equal((html.match(/data-day=/g)||[]).length,4);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|Day two place/);
 assert.match(TripPlannerPage(trip,'2026-12-07',null),/Day two place/);
});
test('landing and dashboard expose entry points and empty state',()=>{assert.match(LandingPage(),/Start Planning/);assert.match(DashboardPage([]),/Create New Trip/);});
