# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly:

```
start index.html          # Windows
open index.html           # macOS
```

Or serve locally (avoids some browser restrictions):

```
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000`.

## Architecture

Three files, no dependencies:

- `index.html` — DOM structure: `<canvas id="board">` (300×600 px), sidebar panel, overlay div for pause/game-over states.
- `style.css` — dark/retro theme, flexbox layout, backdrop-blur on overlay.
- `game.js` — all game logic (~305 lines, `'use strict'`, ES6+, Canvas 2D API).

### Key data model (`game.js`)

- **Board**: `board[row][col]` — `0` = empty, `1–7` = piece color index.
- **Piece object**: `{ type, shape, x, y }` — `shape` is a 2D matrix of color indices.
- **State globals**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`.

### Core functions

| Function | Role |
|---|---|
| `collide(shape, ox, oy)` | Bounds + overlap check |
| `rotateCW(shape)` | Transpose + row-reverse |
| `tryRotate()` | Rotate with wall kicks `[0, -1, 1, -2, 2]` |
| `ghostY()` | Project current piece down for ghost render |
| `lockPiece()` | `merge → clearLines → spawn` |
| `clearLines()` | Bottom-up splice; updates score/level/speed |
| `loop(ts)` | `requestAnimationFrame` loop; accumulates `dropAccum` |
| `init()` | Full reset; entry point on load and restart |

### Scoring & speed

- Lines: `LINE_SCORES[count] * level` where `LINE_SCORES = [0, 100, 300, 500, 800]`.
- Hard drop: `+2` per cell fallen; soft drop: `+1` per row.
- Drop interval: `max(100, 1000 − (level − 1) × 90)` ms; level increments every 10 lines.

### Canvas sizing constraint

`<canvas id="board" width="300" height="600">` must equal `COLS × BLOCK` × `ROWS × BLOCK`. If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, update the canvas attributes in `index.html` to match.
