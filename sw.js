// Service Worker for 留学重开模拟器 PWA
// Bump CACHE_VER to force re-cache after content updates
const CACHE_VER = 'sasr-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  // JS
  './js/game.js',
  './js/dsl.js',
  './js/avatar.js',
  './js/cinematic.js',
  './js/achievements.js',
  './js/audio.js',
  './js/memory.js',
  './js/multiplayer.js',
  './js/flowchart.js',
  // Data
  './data/ages.json',
  './data/events.json',
  './data/random_events.json',
  './data/talents.json',
  './data/xianxia_events.json',
  './data/hogwarts_events.json',
  './data/timeloop_events.json',
  './data/multiplayer_events.json',
  './data/flowchart.json',
  // Icons & UI
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/ui/memory-mirror.png',
  // SFX
  './assets/sfx/click1.ogg',
  './assets/sfx/click2.ogg',
  './assets/sfx/click3.ogg',
  './assets/sfx/click4.ogg',
  './assets/sfx/click5.ogg',
  './assets/sfx/click_002.ogg',
  './assets/sfx/click_005.ogg',
  './assets/sfx/confirmation_002.ogg',
  './assets/sfx/error_005.ogg',
  './assets/sfx/glitch_004.ogg',
  './assets/sfx/rollover1.ogg',
  './assets/sfx/rollover2.ogg',
  './assets/sfx/switch1.ogg',
  './assets/sfx/switch11.ogg',
  './assets/sfx/switch2.ogg',
  './assets/sfx/switch3.ogg',
  './assets/sfx/switch4.ogg',
  './assets/sfx/switch5.ogg',
  './assets/sfx/switch6.ogg',
  './assets/sfx/switch7.ogg',
  './assets/sfx/switch8.ogg',
  './assets/sfx/switch9.ogg',
  // Avatar assets (modular_v1_calibrated)
  './assets/avatars/modular_v1_calibrated/anchors.json',
  // -- bg
  './assets/avatars/modular_v1_calibrated/bg/cafe_date.png',
  './assets/avatars/modular_v1_calibrated/bg/campus.png',
  './assets/avatars/modular_v1_calibrated/bg/casino_party.png',
  './assets/avatars/modular_v1_calibrated/bg/dorm_day.png',
  './assets/avatars/modular_v1_calibrated/bg/dorm_night.png',
  './assets/avatars/modular_v1_calibrated/bg/esports_room.png',
  './assets/avatars/modular_v1_calibrated/bg/gym.png',
  './assets/avatars/modular_v1_calibrated/bg/kitchen.png',
  './assets/avatars/modular_v1_calibrated/bg/library.png',
  './assets/avatars/modular_v1_calibrated/bg/magic_corridor.png',
  './assets/avatars/modular_v1_calibrated/bg/office.png',
  './assets/avatars/modular_v1_calibrated/bg/xianxia_temple.png',
  // -- body_base
  './assets/avatars/modular_v1_calibrated/body_base/female_fit.png',
  './assets/avatars/modular_v1_calibrated/body_base/female_low_health.png',
  './assets/avatars/modular_v1_calibrated/body_base/female_normal.png',
  './assets/avatars/modular_v1_calibrated/body_base/male_fit.png',
  './assets/avatars/modular_v1_calibrated/body_base/male_low_health.png',
  './assets/avatars/modular_v1_calibrated/body_base/male_normal.png',
  // -- body_full
  './assets/avatars/modular_v1_calibrated/body_full/business_blazer.png',
  './assets/avatars/modular_v1_calibrated/body_full/cardigan.png',
  './assets/avatars/modular_v1_calibrated/body_full/chef_coat.png',
  './assets/avatars/modular_v1_calibrated/body_full/esports_jersey.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_business_blazer.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_cardigan_cream.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_chef_coat.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_esports_jersey.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_gym_jacket.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_idol_stage.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_labcoat.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_office_shirt.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_party_top.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_preppy_blazer.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_suit.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_teal_crop_hoodie.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_white_blouse.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_wizard_robe.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_worn_sweater.png',
  './assets/avatars/modular_v1_calibrated/body_full/female_xianxia_hanfu.png',
  './assets/avatars/modular_v1_calibrated/body_full/gym_top.png',
  './assets/avatars/modular_v1_calibrated/body_full/idol_jacket.png',
  './assets/avatars/modular_v1_calibrated/body_full/labcoat.png',
  './assets/avatars/modular_v1_calibrated/body_full/office_shirt.png',
  './assets/avatars/modular_v1_calibrated/body_full/party_shirt.png',
  './assets/avatars/modular_v1_calibrated/body_full/school_uniform.png',
  './assets/avatars/modular_v1_calibrated/body_full/suit.png',
  './assets/avatars/modular_v1_calibrated/body_full/teal_student_hoodie.png',
  './assets/avatars/modular_v1_calibrated/body_full/tracksuit.png',
  './assets/avatars/modular_v1_calibrated/body_full/wizard_robe.png',
  './assets/avatars/modular_v1_calibrated/body_full/worn_hoodie.png',
  './assets/avatars/modular_v1_calibrated/body_full/xianxia_robe.png',
  // -- head
  './assets/avatars/modular_v1_calibrated/head/female_happy.png',
  './assets/avatars/modular_v1_calibrated/head/female_neutral.png',
  './assets/avatars/modular_v1_calibrated/head/female_tired.png',
  './assets/avatars/modular_v1_calibrated/head/male_happy.png',
  './assets/avatars/modular_v1_calibrated/head/male_neutral.png',
  './assets/avatars/modular_v1_calibrated/head/male_tired.png',
  // -- hair (male)
  './assets/avatars/modular_v1_calibrated/hair/male_messy_black.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_silver.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_tousled_black.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_tousled_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_tousled_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/male_messy_tousled_silver.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_black.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_blonde.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_fluffy_black.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_fluffy_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_fluffy_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_fluffy_silver.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_neat_black.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_neat_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_neat_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/male_short_neat_silver.png',
  './assets/avatars/modular_v1_calibrated/hair/male_side_swept_black.png',
  './assets/avatars/modular_v1_calibrated/hair/male_side_swept_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/male_side_swept_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/male_side_swept_silver.png',
  // -- hair (female)
  './assets/avatars/modular_v1_calibrated/hair/female_bob_black.png',
  './assets/avatars/modular_v1_calibrated/hair/female_bob_blonde.png',
  './assets/avatars/modular_v1_calibrated/hair/female_bob_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/female_bob_pink.png',
  './assets/avatars/modular_v1_calibrated/hair/female_bob_rose_pink.png',
  './assets/avatars/modular_v1_calibrated/hair/female_bun_blue.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_black.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_blonde.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_dark_brown.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_straight_black.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_straight_blonde.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_straight_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/female_long_straight_rose_pink.png',
  './assets/avatars/modular_v1_calibrated/hair/female_messy_bun_black.png',
  './assets/avatars/modular_v1_calibrated/hair/female_messy_bun_blonde.png',
  './assets/avatars/modular_v1_calibrated/hair/female_messy_bun_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/female_messy_bun_rose_pink.png',
  './assets/avatars/modular_v1_calibrated/hair/female_ponytail_black.png',
  './assets/avatars/modular_v1_calibrated/hair/female_ponytail_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/female_side_ponytail_black.png',
  './assets/avatars/modular_v1_calibrated/hair/female_side_ponytail_blonde.png',
  './assets/avatars/modular_v1_calibrated/hair/female_side_ponytail_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/female_side_ponytail_rose_pink.png',
  // -- hair (legacy/shared)
  './assets/avatars/modular_v1_calibrated/hair/long_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/messy_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/ponytail_chestnut.png',
  './assets/avatars/modular_v1_calibrated/hair/short_fluffy_chestnut.png',
  // -- torso_clothes
  './assets/avatars/modular_v1_calibrated/torso_clothes/business_blazer.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/cardigan.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/chef_coat.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/esports_jersey.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_business_blazer.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_cardigan_cream.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_chef_coat.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_esports_jersey.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_gym_jacket.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_idol_stage.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_labcoat.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_office_shirt.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_party_top.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_preppy_blazer.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_suit.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_teal_crop_hoodie.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_white_blouse.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_wizard_robe.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_worn_sweater.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/female_xianxia_hanfu.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/gym_top.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/idol_jacket.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/labcoat.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/office_shirt.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/party_shirt.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/school_uniform.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/suit.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/teal_student_hoodie.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/tracksuit.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/wizard_robe.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/worn_hoodie.png',
  './assets/avatars/modular_v1_calibrated/torso_clothes/xianxia_robe.png',
  // -- accessory
  './assets/avatars/modular_v1_calibrated/accessory/backpack_strap.png',
  './assets/avatars/modular_v1_calibrated/accessory/glasses.png',
  './assets/avatars/modular_v1_calibrated/accessory/headphones.png',
  './assets/avatars/modular_v1_calibrated/accessory/spirit_beads.png',
  './assets/avatars/modular_v1_calibrated/accessory_under/headphones.png',
  // -- bubble
  './assets/avatars/modular_v1_calibrated/bubble/academic.png',
  './assets/avatars/modular_v1_calibrated/bubble/academic_warning.png',
  './assets/avatars/modular_v1_calibrated/bubble/breakup.png',
  './assets/avatars/modular_v1_calibrated/bubble/chef.png',
  './assets/avatars/modular_v1_calibrated/bubble/esports.png',
  './assets/avatars/modular_v1_calibrated/bubble/happy.png',
  './assets/avatars/modular_v1_calibrated/bubble/love.png',
  './assets/avatars/modular_v1_calibrated/bubble/magic.png',
  './assets/avatars/modular_v1_calibrated/bubble/rich.png',
  './assets/avatars/modular_v1_calibrated/bubble/sick.png',
  './assets/avatars/modular_v1_calibrated/bubble/stress.png',
  './assets/avatars/modular_v1_calibrated/bubble/tired.png',
  './assets/avatars/modular_v1_calibrated/bubble/xianxia.png',
];

// Install: pre-cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, fallback to network
self.addEventListener('fetch', e => {
  // Skip non-GET and cross-origin (e.g. CDN html2canvas, QR code API)
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // Cache new same-origin requests on the fly
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_VER).then(cache => cache.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
