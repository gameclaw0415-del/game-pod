// Tiny Runner — a small, dependency-free canvas game.
// Controls: Space/click to jump, P to pause, M to mute.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const S = {
  t: 0,
  last: 0,
  running: false,
  paused: false,
  muted: false,
  score: 0,
  best: Number(localStorage.getItem('tinyRunnerBest') || 0),
  shake: 0,
};

bestEl.textContent = String(S.best);

const world = {
  g: 2400,      // gravity px/s^2
  floorY: 430,
  speed: 360,   // initial world speed px/s
  speedMax: 780,
};

const player = {
  x: 170,
  y: world.floorY,
  w: 42,
  h: 54,
  vy: 0,
  jumpV: -820,
  onGround: true,
};

let obstacles = [];

function reset() {
  S.t = 0;
  S.last = performance.now();
  S.running = true;
  S.paused = false;
  S.score = 0;
  S.shake = 0;
  player.y = world.floorY;
  player.vy = 0;
  player.onGround = true;
  obstacles = [];
  spawnObstacle(true);
  tick();
}

function spawnObstacle(first = false) {
  const gap = first ? 520 : rand(380, 720);
  const h = rand(38, 84);
  const w = rand(22, 44);
  const y = world.floorY + player.h - h;
  const x = canvas.width + gap;
  obstacles.push({ x, y, w, h, passed: false });
}

function jump() {
  if (!S.running) return;
  if (S.paused) return;
  if (player.onGround) {
    player.vy = player.jumpV;
    player.onGround = false;
    blip(420, 0.06);
  }
}

function togglePause() {
  if (!S.running) return;
  S.paused = !S.paused;
  if (!S.paused) {
    S.last = performance.now();
    tick();
  } else {
    render();
  }
}

function gameOver() {
  S.running = false;
  blip(180, 0.12);
  S.shake = 0.22;
  if (S.score > S.best) {
    S.best = S.score;
    localStorage.setItem('tinyRunnerBest', String(S.best));
    bestEl.textContent = String(S.best);
  }
  render(true);
}

function update(dt) {
  S.t += dt;

  // Speed ramps over time
  const k = clamp(S.t / 50, 0, 1);
  const speed = lerp(world.speed, world.speedMax, k);

  // Player physics
  player.vy += world.g * dt;
  player.y += player.vy * dt;
  if (player.y >= world.floorY) {
    player.y = world.floorY;
    player.vy = 0;
    player.onGround = true;
  }

  // Obstacles
  for (const o of obstacles) {
    o.x -= speed * dt;

    // score when passed
    if (!o.passed && o.x + o.w < player.x) {
      o.passed = true;
      S.score += 1;
      scoreEl.textContent = String(S.score);
      blip(860, 0.03);
    }
  }

  // cleanup
  obstacles = obstacles.filter(o => o.x + o.w > -60);
  if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 360) {
    spawnObstacle(false);
  }

  // collision
  const px = player.x;
  const py = player.y;
  const pw = player.w;
  const ph = player.h;
  for (const o of obstacles) {
    if (aabb(px, py, pw, ph, o.x, o.y, o.w, o.h)) {
      gameOver();
      return;
    }
  }
}

function render(over = false) {
  const dt = 0; // render-only

  // camera shake
  const shake = over ? S.shake : 0;
  const sx = shake ? rand(-8, 8) * shake : 0;
  const sy = shake ? rand(-6, 6) * shake : 0;

  ctx.save();
  ctx.translate(sx, sy);

  // Clear
  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

  // Parallax stars
  const t = S.t;
  drawStars(t);

  // Ground
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, world.floorY + player.h, canvas.width, 4);

  // Player
  drawPlayer();

  // Obstacles
  for (const o of obstacles) {
    ctx.fillStyle = 'rgba(255, 120, 120, 0.9)';
    roundRect(o.x, o.y, o.w, o.h, 8);
    ctx.fill();
  }

  // HUD text
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText('Tiny Runner', 16, 28);

  if (!S.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '800 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Game Over', 360, 230);

    ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Click Start / Restart (or press Space) to try again.', 292, 270);
  }

  if (S.paused && S.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '800 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Paused', 410, 260);
  }

  ctx.restore();

  // decay shake
  S.shake = Math.max(0, S.shake - 0.02);
}

function tick(now = performance.now()) {
  if (!S.running || S.paused) return;
  const dt = Math.min(0.033, (now - S.last) / 1000);
  S.last = now;
  update(dt);
  render();
  requestAnimationFrame(tick);
}

function drawPlayer() {
  const x = player.x;
  const y = player.y;
  ctx.fillStyle = 'rgba(120, 200, 255, 0.95)';
  roundRect(x, y, player.w, player.h, 12);
  ctx.fill();

  // eye
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(x + player.w * 0.68, y + player.h * 0.32, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(t) {
  const n = 80;
  for (let i = 0; i < n; i++) {
    const px = (i * 97.3 + t * 18) % canvas.width;
    const py = (i * 53.1 + t * 6) % (canvas.height * 0.7);
    const r = (i % 3) + 0.7;
    ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 5) * 0.03})`;
    ctx.beginPath();
    ctx.arc(canvas.width - px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Audio (simple blips) ---
let audioCtx = null;
function blip(freq, dur) {
  if (S.muted) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur);
}

// --- Utils ---
function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// --- Events ---
startBtn.addEventListener('click', () => reset());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (!S.running) reset(); else jump(); }
  if (e.key.toLowerCase() === 'p') togglePause();
  if (e.key.toLowerCase() === 'm') { S.muted = !S.muted; }
});
canvas.addEventListener('pointerdown', () => { if (!S.running) reset(); else jump(); });

// start in attract mode
render(true);
