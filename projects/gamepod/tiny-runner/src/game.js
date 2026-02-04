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
  countdown: 0, // seconds before motion starts
  coyote: 0,    // seconds of grace after leaving ground
  jumpBuf: 0,   // buffered jump input (seconds)
  jumpHeld: false,
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
  S.countdown = 1.2;
  S.coyote = 0;
  S.jumpBuf = 0;
  S.jumpHeld = false;
  player.y = world.floorY;
  player.vy = 0;
  player.onGround = true;
  obstacles = [];
  spawnObstacle(true);
  tick();
}

function spawnObstacle(first = false) {
  const gap = first ? 520 : rand(360, 700);

  // Variety: mostly ground blocks, sometimes a flying block.
  const flying = !first && Math.random() < 0.28;

  let h, w, y;
  if (flying) {
    h = rand(26, 44);
    w = rand(26, 54);
    y = world.floorY - rand(92, 160);
  } else {
    h = rand(38, 92);
    w = rand(22, 46);
    y = world.floorY + player.h - h;
  }

  const x = canvas.width + gap;
  obstacles.push({ x, y, w, h, passed: false, flying });
}

function tryJump() {
  if (!S.running) return;
  if (S.paused) return;
  if (S.countdown > 0) return;

  const canJump = player.onGround || S.coyote > 0;
  if (canJump) {
    player.vy = player.jumpV;
    player.onGround = false;
    S.coyote = 0;
    S.jumpBuf = 0;
    blip(420, 0.06);
  }
}

function queueJump() {
  // Jump buffering makes the game feel much less "unfair".
  S.jumpBuf = 0.12;
  S.jumpHeld = true;
  tryJump();
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

  // Countdown: let the player get ready.
  if (S.countdown > 0) {
    S.countdown = Math.max(0, S.countdown - dt);
    return;
  }

  // Jump timing helpers
  S.jumpBuf = Math.max(0, S.jumpBuf - dt);
  S.coyote = Math.max(0, S.coyote - dt);

  // Speed ramps over time
  const k = clamp(S.t / 50, 0, 1);
  const speed = lerp(world.speed, world.speedMax, k);

  // Player physics
  player.vy += world.g * dt;

  // Variable jump height: if you release early, you don't go as high.
  if (!S.jumpHeld && player.vy < 0) player.vy *= 0.86;

  player.y += player.vy * dt;
  if (player.y >= world.floorY) {
    player.y = world.floorY;
    player.vy = 0;
    player.onGround = true;
  } else {
    // give a tiny grace period after stepping off / leaving ground
    if (player.onGround) S.coyote = 0.09;
    player.onGround = false;
  }

  // buffered jump triggers as soon as it's valid
  if (S.jumpBuf > 0) tryJump();

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

  // Countdown overlay
  if (S.countdown > 0 && S.running) {
    const n = Math.ceil(S.countdown / 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '900 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(String(n), canvas.width / 2 - 18, canvas.height / 2);
    ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('准备…', canvas.width / 2 - 30, canvas.height / 2 + 34);
  }

  // Obstacles
  for (const o of obstacles) {
    ctx.fillStyle = o.flying ? 'rgba(180, 140, 255, 0.9)' : 'rgba(255, 120, 120, 0.9)';
    roundRect(o.x, o.y, o.w, o.h, 8);
    ctx.fill();

    // tiny "wing" shine for flying ones
    if (o.flying) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(o.x + 6, o.y + 6, Math.max(8, o.w * 0.35), 6, 4);
      ctx.fill();
    }
  }

  // HUD text
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText('小小跑酷', 16, 28);

  if (!S.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '800 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('游戏结束', 380, 230);

    ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('点击「开始 / 重新开始」（或按空格）再试一次。', 280, 270);
  }

  if (S.paused && S.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '800 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('已暂停', 420, 260);
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
  // Anime-ish chibi runner (still a simple shape, but with face + hair + outfit).
  const x = player.x;
  const y = player.y;
  const w = player.w;
  const h = player.h;

  // Small run bob
  const bob = S.running && !S.paused && S.countdown === 0 ? Math.sin(S.t * 10) * 1.6 : 0;
  const px = x;
  const py = y + bob;

  const head = {
    x: px + w * 0.12,
    y: py + h * 0.02,
    w: w * 0.76,
    h: h * 0.56,
  };
  const body = {
    x: px + w * 0.18,
    y: py + h * 0.46,
    w: w * 0.64,
    h: h * 0.52,
  };

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px + w * 0.5, py + h + 8, w * 0.42, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair (dark blue)
  ctx.fillStyle = 'rgba(70, 95, 185, 0.95)';
  roundRect(head.x, head.y - 2, head.w, head.h * 0.72, 14);
  ctx.fill();
  // Bangs
  ctx.beginPath();
  ctx.moveTo(head.x + head.w * 0.12, head.y + head.h * 0.22);
  ctx.quadraticCurveTo(head.x + head.w * 0.45, head.y + head.h * 0.58, head.x + head.w * 0.58, head.y + head.h * 0.18);
  ctx.quadraticCurveTo(head.x + head.w * 0.68, head.y + head.h * 0.50, head.x + head.w * 0.88, head.y + head.h * 0.20);
  ctx.lineTo(head.x + head.w * 0.88, head.y + head.h * 0.05);
  ctx.lineTo(head.x + head.w * 0.12, head.y + head.h * 0.05);
  ctx.closePath();
  ctx.fill();

  // Face
  ctx.fillStyle = 'rgba(255, 226, 200, 0.98)';
  roundRect(head.x + 2, head.y + head.h * 0.18, head.w - 4, head.h * 0.82, 16);
  ctx.fill();

  // Eyes (big + shiny)
  const eyeY = head.y + head.h * 0.55;
  const eyeLX = head.x + head.w * 0.32;
  const eyeRX = head.x + head.w * 0.68;
  ctx.fillStyle = 'rgba(20, 30, 60, 0.95)';
  ctx.beginPath();
  ctx.ellipse(eyeLX, eyeY, 4.3, 5.4, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeRX, eyeY, 4.3, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 200, 255, 0.9)';
  ctx.beginPath();
  ctx.ellipse(eyeLX, eyeY + 1.2, 2.2, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeRX, eyeY + 1.2, 2.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(eyeLX + 1.2, eyeY - 2.0, 1.4, 0, Math.PI * 2);
  ctx.arc(eyeRX + 1.2, eyeY - 2.0, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = 'rgba(255, 120, 170, 0.22)';
  ctx.beginPath();
  ctx.arc(head.x + head.w * 0.22, head.y + head.h * 0.74, 6.6, 0, Math.PI * 2);
  ctx.arc(head.x + head.w * 0.78, head.y + head.h * 0.74, 6.6, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = 'rgba(120, 60, 60, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(head.x + head.w * 0.5, head.y + head.h * 0.78, 4, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.stroke();

  // Outfit (hoodie-ish)
  ctx.fillStyle = 'rgba(255, 214, 74, 0.96)';
  roundRect(body.x, body.y, body.w, body.h, 14);
  ctx.fill();
  // Hoodie pocket
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  roundRect(body.x + body.w * 0.18, body.y + body.h * 0.46, body.w * 0.64, body.h * 0.34, 10);
  ctx.fill();
  // Collar highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(body.x + body.w * 0.28, body.y + body.h * 0.06, body.w * 0.44, body.h * 0.18, 10);
  ctx.fill();

  // Feet (little shoes)
  const footY = py + h * 0.98;
  ctx.fillStyle = 'rgba(30, 35, 60, 0.9)';
  roundRect(px + w * 0.22, footY, w * 0.22, 8, 6);
  roundRect(px + w * 0.56, footY, w * 0.22, 8, 6);
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
  if (e.code === 'Space') {
    e.preventDefault();
    if (!S.running) reset();
    else queueJump();
  }
  if (e.key.toLowerCase() === 'p') togglePause();
  if (e.key.toLowerCase() === 'm') { S.muted = !S.muted; }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') S.jumpHeld = false;
});
canvas.addEventListener('pointerdown', () => { if (!S.running) reset(); else { S.jumpHeld = true; queueJump(); } });
canvas.addEventListener('pointerup', () => { S.jumpHeld = false; });

// start in attract mode
render(true);
