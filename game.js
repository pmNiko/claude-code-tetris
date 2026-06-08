'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_COLORS = {
  retro:  [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#5B8CCC', '#ffb74d', '#90a4ae'],
  neon:   [null, '#00ffff', '#ffff00', '#ff00ff', '#00ff88', '#ff3366', '#0088ff', '#ff8800', '#aaaaaa'],
  pastel: [null, '#b3e5fc', '#fff9c4', '#e1bee7', '#c8e6c9', '#ffcdd2', '#bbdefb', '#ffe0b2', '#cfd8dc'],
  pixel:  [null, '#00bcd4', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#78909c'],
};

let currentSkin = 'retro';

// COLORS es un alias dinámico que drawBlock usa; se actualiza al cambiar de skin
let COLORS = SKIN_COLORS.retro;

const NUT = 8; // pieza tuerca 3x3 con agujero central

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // NUT - tuerca (centro hueco)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Colores de grilla por skin (constante de módulo para evitar allocations en cada frame)
const GRID_COLORS = {
  neon:   'rgba(255,255,255,0.05)',
  pastel: 'rgba(200,200,220,0.4)',
  pixel:  'rgba(0,0,0,0.2)',
  retro:  null, // determinado dinámicamente según light/dark mode
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  // la tuerca aparece como reto ocasional (~15%); el resto, una de las 7 clásicas
  const type = Math.random() < 0.15 ? NUT : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const a = alpha ?? 1;
  context.globalAlpha = a;

  const bx = x * size + 1;
  const by = y * size + 1;
  const bw = size - 2;
  const bh = size - 2;

  if (currentSkin === 'neon') {
    context.shadowBlur = 12;
    context.shadowColor = color;
    context.fillStyle = color;
    context.fillRect(bx, by, bw, bh);
    context.shadowBlur = 0;

  } else if (currentSkin === 'pastel') {
    const r = 4;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(bx + r, by);
    context.lineTo(bx + bw - r, by);
    context.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    context.lineTo(bx + bw, by + bh - r);
    context.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    context.lineTo(bx + r, by + bh);
    context.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    context.lineTo(bx, by + r);
    context.quadraticCurveTo(bx, by, bx + r, by);
    context.closePath();
    context.fill();

  } else if (currentSkin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(bx, by, bw, bh);
    // textura pixel art: 2 líneas horizontales + 2 verticales (4 calls fijos por bloque)
    context.fillStyle = 'rgba(0,0,0,0.18)';
    const mx = bx + Math.floor(bw / 2);
    const my = by + Math.floor(bh / 2);
    context.fillRect(bx, my, bw, 1);
    context.fillRect(bx, by + Math.floor(bh * 0.75), bw, 1);
    context.fillRect(mx, by, 1, bh);
    context.fillRect(bx + Math.floor(bw * 0.75), by, 1, bh);

  } else {
    // retro (default)
    context.fillStyle = color;
    context.fillRect(bx, by, bw, bh);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(bx, by, bw, 4);
  }

  context.globalAlpha = 1;
}

function drawNutHole(context, cx, cy, size) {
  // perfora un agujero circular en el centro de la celda (cx, cy)
  const px = (cx + 0.5) * size;
  const py = (cy + 0.5) * size;
  const r = size * 0.6;
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  context.arc(px, py, r, 0, Math.PI * 2);
  context.fill();
  context.restore();
  // borde del agujero, para dar aspecto de tuerca
  context.strokeStyle = 'rgba(0,0,0,0.45)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(px, py, r, 0, Math.PI * 2);
  context.stroke();
}

function drawGrid() {
  const retroColor = document.body.classList.contains('light-mode') ? '#d0d0df' : '#22222e';
  ctx.strokeStyle = (currentSkin === 'retro' ? retroColor : GRID_COLORS[currentSkin]) ?? '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.type === NUT) drawNutHole(nextCtx, offX + 1, offY + 1, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function applySkin(skinName) {
  currentSkin = skinName;
  COLORS = SKIN_COLORS[skinName] ?? SKIN_COLORS.retro;
  localStorage.setItem('tetrisSkin', skinName);
  document.body.dataset.skin = skinName;
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === skinName);
  });
  // Refrescar la preview de la siguiente pieza al cambiar de skin
  if (next) drawNext();
}

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  document.body.classList.toggle('light-mode', themeToggle.checked);
});

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.addEventListener('click', () => applySkin(btn.dataset.skin));
});

const savedSkin = localStorage.getItem('tetrisSkin') || 'retro';
applySkin(savedSkin);

init();
