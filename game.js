'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#5B8CCC', // J - blue
  '#ffb74d', // L - orange
  '#90a4ae', // NUT - metallic grey
];

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
let combo, maxCombo, maxLinesInGame;

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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (lines > maxLinesInGame) maxLinesInGame = lines;
    updateHUD();
  } else {
    combo = 0;
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
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
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
  ctx.strokeStyle = document.body.classList.contains('light-mode') ? '#d0d0df' : '#22222e';
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

const RECORDS_KEY = 'tetrisRecords';

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecord(name, sc, cmb, lns) {
  const records = loadRecords();
  const entry = { name: name.trim() || 'AAA', score: sc, combo: cmb, lines: lns };
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  records.splice(5); // keep top 5
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  // return index of the just-saved entry (first match after sort)
  return records.findIndex(r => r === entry);
}

function renderRecords(containerEl, highlightIdx) {
  const records = loadRecords();
  containerEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'records-header';
  header.textContent = 'TOP 5';
  containerEl.appendChild(header);

  if (records.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'records-empty';
    empty.textContent = 'Sin records aún';
    containerEl.appendChild(empty);
    return;
  }

  records.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'record-row' + (i === highlightIdx ? ' highlight' : '');

    const pos = document.createElement('span');
    pos.className = 'record-pos';
    pos.textContent = `${i + 1}.`;

    const name = document.createElement('span');
    name.className = 'record-name';
    name.textContent = r.name;

    const sc = document.createElement('span');
    sc.className = 'record-score';
    sc.textContent = r.score.toLocaleString();

    const cmb = document.createElement('span');
    cmb.className = 'record-combo';
    cmb.title = 'Combo';
    cmb.textContent = `x${r.combo}`;

    const lns = document.createElement('span');
    lns.className = 'record-lines';
    lns.title = 'Líneas';
    lns.textContent = `${r.lines}L`;

    row.append(pos, name, sc, cmb, lns);
    containerEl.appendChild(row);
  });
}

function resetRecords() {
  localStorage.removeItem(RECORDS_KEY);
  renderRecords(document.getElementById('records-list'));
}

function isTopFive(sc) {
  const records = loadRecords();
  return records.length < 5 || sc >= records[records.length - 1].score;
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const recordsList = document.getElementById('records-list');
  const nameInputRow = document.getElementById('name-input-row');
  const playerNameInput = document.getElementById('player-name');
  const saveRecordBtn = document.getElementById('save-record-btn');
  const resetRecordsBtn = document.getElementById('reset-records-btn');

  renderRecords(recordsList);

  if (isTopFive(score)) {
    nameInputRow.classList.remove('hidden');
    // Clone both input and button to drop all stale event listeners from prior game-overs
    const newSaveBtn = saveRecordBtn.cloneNode(true);
    saveRecordBtn.parentNode.replaceChild(newSaveBtn, saveRecordBtn);
    const newNameInput = playerNameInput.cloneNode(true);
    newNameInput.value = '';
    playerNameInput.parentNode.replaceChild(newNameInput, playerNameInput);

    const finalScore = score;
    const finalCombo = maxCombo;
    const finalLines = maxLinesInGame;

    newSaveBtn.addEventListener('click', () => {
      const name = newNameInput.value.trim() || 'AAA';
      const idx = saveRecord(name, finalScore, finalCombo, finalLines);
      nameInputRow.classList.add('hidden');
      renderRecords(recordsList, idx);
    });

    newNameInput.addEventListener('keydown', function onEnter(e) {
      if (e.code === 'Enter') {
        newSaveBtn.click();
        newNameInput.removeEventListener('keydown', onEnter);
      }
    });

    newNameInput.focus();
  } else {
    nameInputRow.classList.add('hidden');
  }

  // Clone reset button to clear old listeners
  const newResetBtn = resetRecordsBtn.cloneNode(true);
  resetRecordsBtn.parentNode.replaceChild(newResetBtn, resetRecordsBtn);
  newResetBtn.addEventListener('click', () => {
    resetRecords();
    nameInputRow.classList.add('hidden');
  });

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
  combo = 0;
  maxCombo = 0;
  maxLinesInGame = 0;
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

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  document.body.classList.toggle('light-mode', themeToggle.checked);
});

init();
