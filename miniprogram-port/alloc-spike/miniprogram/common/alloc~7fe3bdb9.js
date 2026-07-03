module.exports = function(window, document) {var App = function(options) {window.appOptions = options};var self = window.self;var HTMLElement = window.HTMLElement;var Element = window.Element;var Node = window.Node;var localStorage = window.localStorage;var sessionStorage = window.sessionStorage;var navigator = window.navigator;var history = window.history;var location = window.location;var performance = window.performance;var Image = window.Image;var CustomEvent = window.CustomEvent;var Event = window.Event;var requestAnimationFrame = window.requestAnimationFrame;var cancelAnimationFrame = window.cancelAnimationFrame;var getComputedStyle = window.getComputedStyle;var XMLHttpRequest = window.XMLHttpRequest;var Worker = window.Worker;var SharedWorker = window.SharedWorker;/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 478
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ createApp)
/* harmony export */ });


// ── Feasibility spike: 分配属性 (stat allocation) screen under kbone ──────
// Deliberately vanilla JS / manual DOM, matching the real project's style
// (game.js has no framework, just createElement/innerHTML/addEventListener
// scattered across a big render() function). Scope is trimmed down from the
// real screen: no achievement popover, no preset save/import/export, no
// real pixel-avatar renderer — just the part that matters for the spike,
// which is "does kbone handle our actual DOM/CSS/event-listener patterns."
//
// STAT_KEYS / MAX_PER_STAT / ALLOC_TOTAL_BASE mirror engine/constants.js;
// the +/- button logic below is copied verbatim from game.js's real
// click handlers (search "plus-${k}" in game.js) so this spike tests the
// real interaction, not a simplified stand-in.

const STAT_KEYS = ['SOC', 'INT', 'MNY', 'HLT', 'PER', 'APP'];
const STAT_LABELS = { SOC: '社交', INT: '智力', MNY: '家境', HLT: '健康', PER: '毅力', APP: '颜值' };
const MAX_PER_STAT = 10;
const ALLOC_TOTAL = 25;

const state = {
  alloc: { SOC: 0, INT: 0, MNY: 0, HLT: 0, PER: 0, APP: 0 },
};

function buildMarkup() {
  const rows = STAT_KEYS.map(k => `
    <div class="alloc-row">
      <span>${STAT_LABELS[k]}</span>
      <button class="step" id="minus-${k}">−</button>
      <span class="alloc-val" id="alloc-${k}">0</span>
      <button class="step" id="plus-${k}">＋</button>
      <span class="alloc-bonus" id="bonus-${k}"></span>
    </div>`).join('');

  return `
    <div class="creation-step" id="step-alloc">
      <div class="alloc-split">
        <div class="alloc-left">
          <div class="alloc-avatar-wrap-lg">
            <canvas id="alloc-avatar-canvas" width="128" height="192"></canvas>
            <div class="avatar-overlay-controls">
              <div class="avatar-ov-group avatar-ov-sex">
                <button id="sex-male" class="avatar-ov-btn active" title="男">♂</button>
                <button id="sex-female" class="avatar-ov-btn" title="女">♀</button>
              </div>
              <button id="btn-random-appearance" class="avatar-ov-btn" title="随机">🎲</button>
            </div>
            <div class="avatar-ov-hint">属性会实时影响外貌（占位——本 spike 不接入真实 avatar.js 渲染器）</div>
          </div>
        </div>
        <div class="alloc-right">
          <header class="screen-head">
            <h1>分配属性</h1>
            <p class="sub">总共 <strong>${ALLOC_TOTAL}</strong> 点，单项上限 ${MAX_PER_STAT}。</p>
          </header>
          <div class="alloc-banner">剩余点数 <span id="alloc-remaining">${ALLOC_TOTAL}</span></div>
          <div class="alloc-list">${rows}</div>
          <div class="alloc-actions">
            <button class="ghost" id="alloc-random">🎲 随机分配</button>
            <button class="primary" id="alloc-start">确认分配 →</button>
          </div>
        </div>
      </div>
    </div>`;
}

function render() {
  const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
  const remaining = ALLOC_TOTAL - used;
  document.getElementById('alloc-remaining').textContent = remaining;
  for (const k of STAT_KEYS) {
    document.getElementById(`alloc-${k}`).textContent = state.alloc[k];
  }
}

function drawAvatarPlaceholder() {
  const canvas = document.getElementById('alloc-avatar-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141a26';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#e6c650';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('avatar', 64, 96);
  ctx.fillText('placeholder', 64, 114);
}

function wireEvents() {
  for (const k of STAT_KEYS) {
    document.getElementById(`plus-${k}`).addEventListener('click', () => {
      const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
      if (used < ALLOC_TOTAL && state.alloc[k] < MAX_PER_STAT) {
        state.alloc[k] += 1;
        render();
      }
    });
    document.getElementById(`minus-${k}`).addEventListener('click', () => {
      if (state.alloc[k] > 0) {
        state.alloc[k] -= 1;
        render();
      }
    });
  }

  document.getElementById('alloc-random').addEventListener('click', () => {
    for (const k of STAT_KEYS) state.alloc[k] = 0;
    let remaining = ALLOC_TOTAL;
    while (remaining > 0) {
      const availableKeys = STAT_KEYS.filter(k => state.alloc[k] < MAX_PER_STAT);
      if (availableKeys.length === 0) break;
      const k = availableKeys[Math.floor(Math.random() * availableKeys.length)];
      state.alloc[k]++;
      remaining--;
    }
    render();
  });

  document.getElementById('alloc-start').addEventListener('click', () => {
    // real version calls initGame() here; spike just confirms the tap lands
    console.log('confirmed alloc:', JSON.stringify(state.alloc));
  });

  document.getElementById('sex-male').addEventListener('click', (e) => {
    document.getElementById('sex-male').classList.add('active');
    document.getElementById('sex-female').classList.remove('active');
  });
  document.getElementById('sex-female').addEventListener('click', (e) => {
    document.getElementById('sex-female').classList.add('active');
    document.getElementById('sex-male').classList.remove('active');
  });
}

function createApp() {
  const container = document.createElement('div');
  container.id = 'app';
  container.innerHTML = buildMarkup();
  document.body.appendChild(container);
  wireEvents();
  drawAvatarPlaceholder();
  render();
  return container;
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		const deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			let notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				let [chunkIds, fn, priority] = deferred[i];
/******/ 				let fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					const r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		const installedChunks = {
/******/ 			210: 0,
/******/ 			241: 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		__webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		const webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			let [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 			return __webpack_require__.O(result);
/******/ 		}
/******/ 		
/******/ 		const chunkLoadingGlobal = self["webpackChunkcreateApp"] = self["webpackChunkcreateApp"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 	let __webpack_exports__ = __webpack_require__.O(undefined, [241], () => (__webpack_require__(478)))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	window.createApp = __webpack_exports__["default"];
/******/ 	
/******/ })()
;}