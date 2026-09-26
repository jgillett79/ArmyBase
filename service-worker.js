// Offline support for the static game. Increase the version when changing cached assets.
const CACHE_NAME = 'command-base-v5';
const APP_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/building.js",
  "js/main.js",
  "js/mission.js",
  "js/render.js",
  "js/save.js",
  "js/state.js",
  "js/unit.js",
  "js/utils.js",
  "js/world.js",
  "assets/buildings/.gitkeep",
  "assets/buildings/barracks.png",
  "assets/buildings/barracks-organic.webp",
  "assets/buildings/drill_yard.png",
  "assets/buildings/entrance_hall.png",
  "assets/buildings/entrance-hall-organic.webp",
  "assets/buildings/gatehouse.png",
  "assets/buildings/mess_hall.png",
  "assets/buildings/mess-hall-organic.webp",
  "assets/buildings/obstacle_course.png",
  "assets/buildings/rec_room.png",
  "assets/buildings/shooting_range.png",
  "assets/buildings/shooting-range-organic.webp",
  "assets/buildings/showers.png",
  "assets/buildings/vacant_lot.png",
  "assets/buildings/weight_room.png",
  "assets/illustrations/base-sunrise.webp",
  "assets/illustrations/icon-192.png",
  "assets/illustrations/icon-512.png",
  "assets/terrain/.gitkeep",
  "assets/terrain/ground.png",
  "assets/terrain/ground_apron-v2.webp",
  "assets/terrain/ground_apron.png",
  "assets/terrain/ground_grass-v2.webp",
  "assets/terrain/ground_grass.png",
  "assets/terrain/road.png",
  "assets/terrain/wall.png",
  "assets/units/civilians/.gitkeep",
  "assets/units/civilians/bus_rider.png",
  "assets/units/civilians/bus_rider_down.png",
  "assets/units/civilians/bus_rider_right.png",
  "assets/units/civilians/bus_rider_sitting.png",
  "assets/units/civilians/bus_rider_up.png",
  "assets/units/civilians/civilian.png",
  "assets/units/civilians/civilian_down.png",
  "assets/units/civilians/civilian_right.png",
  "assets/units/civilians/civilian_sitting.png",
  "assets/units/civilians/civilian_up.png",
  "assets/units/civilians/taxi.png",
  "assets/units/civilians/taxi_down.png",
  "assets/units/civilians/taxi_right.png",
  "assets/units/civilians/taxi_sitting.png",
  "assets/units/civilians/taxi_up.png",
  "assets/units/soldiers/.gitkeep",
  "assets/units/soldiers/soldier_01.png",
  "assets/units/soldiers/soldier_01_down.png",
  "assets/units/soldiers/soldier_01_right.png",
  "assets/units/soldiers/soldier_01_up.png",
  "assets/units/soldiers/soldier_02.png",
  "assets/units/soldiers/soldier_02_down.png",
  "assets/units/soldiers/soldier_02_right.png",
  "assets/units/soldiers/soldier_02_up.png",
  "assets/units/soldiers/soldier_03.png",
  "assets/units/soldiers/soldier_03_down.png",
  "assets/units/soldiers/soldier_03_right.png",
  "assets/units/soldiers/soldier_03_up.png",
  "assets/units/soldiers/soldier_04.png",
  "assets/units/soldiers/soldier_04_down.png",
  "assets/units/soldiers/soldier_04_right.png",
  "assets/units/soldiers/soldier_04_up.png",
  "assets/units/soldiers/soldier_05.png",
  "assets/units/soldiers/soldier_05_down.png",
  "assets/units/soldiers/soldier_05_right.png",
  "assets/units/soldiers/soldier_05_up.png",
  "assets/units/soldiers/soldier_06.png",
  "assets/units/soldiers/soldier_06_down.png",
  "assets/units/soldiers/soldier_06_right.png",
  "assets/units/soldiers/soldier_06_up.png"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('./'))));
  } else {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});
