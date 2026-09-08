// ---------- Config ----------
const TARGET_NUMBER = "410.968.1146";
const LOOP_GAP_MS = 3000;       // idle pause between loops
const DIAL_STEP_MS = 90;        // speed of digits appearing


// ---------- Elements ----------
const digitsEl = document.getElementById('digits');
const clockEl = document.getElementById('clock');
const footStatus = document.getElementById('footStatus');
const footTime = document.getElementById('footTime');
const lineStatus = document.getElementById('lineStatus');
const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');
const gutter = document.getElementById('gutter');
const audioEl = document.getElementById('callAudio');

for (let i=8; i>=1; i--){
  const s = document.createElement('span');
  s.textContent = i;
  gutter.appendChild(s);
}

function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- Auto-fit scaling ----------
// The design is built at a fixed 1366x768 canvas (matching the target
// monitor). This scales that fixed box to fit the actual window/screen,
// so no manual browser zoom is ever needed — on the real kiosk monitor
// at native 1366x768 this naturally lands on scale = 1.
const appEl = document.getElementById('app');
const DESIGN_W = 1366, DESIGN_H = 768;
function fitToScreen(){
  // visualViewport reflects the actual visible area on mobile (excludes
  // the browser's address/toolbar), unlike window.innerHeight which can
  // lag behind or report the wrong value while the toolbar animates.
  const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  appEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  resizeCanvas();
}
window.addEventListener('resize', fitToScreen);
if (window.visualViewport){
  window.visualViewport.addEventListener('resize', fitToScreen);
  window.visualViewport.addEventListener('scroll', fitToScreen);
}
window.addEventListener('orientationchange', () => setTimeout(fitToScreen, 300));
fitToScreen();

// ---------- Clock / timer ----------
let elapsedStart = null;
function tickClock(){
  requestAnimationFrame(tickClock);
  if (elapsedStart === null) return;
  const t = new Date();
  clockEl.textContent = t.toLocaleTimeString('en-GB');
  const elapsed = (performance.now() - elapsedStart)/1000;
  const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
  const ss = String(Math.floor(elapsed%60)).padStart(2,'0');
  const cs = String(Math.floor((elapsed*100)%100)).padStart(2,'0');
  footTime.textContent = `${mm}:${ss}.${cs}`;
}
tickClock();

// Autostart: browsers require a user gesture for audio, but in kiosk mode
// on the Pi/desktop (with --autoplay-policy=no-user-gesture-required) we
// auto-unlock on first paint. As a fallback for normal-browser testing,
// we also unlock on the first click/keypress anywhere on the page.
const unlockOverlay = document.getElementById('unlockOverlay');
let started = false;

function requestFullscreenSafely(){
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen ||
              el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req) req.call(el).catch(() => {
    // Some browsers (notably iOS Safari) reject/ignore this — the page
    // still works fine, just without a hidden address bar there.
  });
}

function startShow(){
  if (started) return;
  started = true;
  unlockOverlay.style.display = 'none';
  requestFullscreenSafely();
  initAudio();
  audioCtx.resume().then(() => {
    console.log('AudioContext state:', audioCtx.state);
  }).catch(err => console.warn('resume() failed:', err));
  runLoop();
}

window.addEventListener('load', () => {
  // Try to start automatically (works in kiosk mode with the autoplay flag).
  initAudio();
  audioCtx.resume().then(() => {
    if (audioCtx.state === 'running') {
      unlockOverlay.style.display = 'none';
      started = true;
      runLoop();
    }
    // If still 'suspended' here, the browser blocked autoplay — the
    // overlay stays visible and we wait for a real user gesture below.
  }).catch(() => {});
});

['click', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, startShow, { once: true });
});

['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange']
  .forEach(evt => document.addEventListener(evt, () => setTimeout(fitToScreen, 100)));
