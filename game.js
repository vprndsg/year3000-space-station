/*
 * Space Station Explorer
 *
 * This JavaScript file implements a simple isometric exploration game set aboard
 * a futuristic space station in the year 3000. The player can move around
 * using the arrow keys, exploring a handful of interconnected rooms (labs,
 * crew quarters, hydroponics and engineering) connected by a central hub.
 *
 * The world is rendered in an isometric projection using pre‑generated
 * artwork for floors, walls, consoles and a character. We scale all of the
 * artwork to a common tile width/height during rendering. A basic camera
 * keeps the player centred on screen while traversing the map.
 */

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Resize the canvas to fill the viewport.
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Tile dimensions. The width is twice the height for a classic isometric diamond.
  const TILE_W = 128;
  const TILE_H = 64;

  // Load images. We scale images on draw rather than pre‑scaling to retain
  // resolution across devices.
  const assets = {};
  const assetNames = {
    // Image filenames. When deployed to GitHub Pages these images live in the
    // same directory as index.html. If you move them into a sub‑folder be
    // sure to update these paths accordingly.
    floor: 'floor.png',
    wall: 'wall.png',
    console: 'console.png',
    astronaut: 'astronaut.png'
  };

  let assetsLoaded = 0;
  const totalAssets = Object.keys(assetNames).length;

  function loadAssets() {
    return new Promise(resolve => {
      for (const key in assetNames) {
        const img = new Image();
        img.src = assetNames[key];
        img.onload = () => {
          assets[key] = img;
          assetsLoaded++;
          if (assetsLoaded === totalAssets) {
            resolve();
          }
        };
      }
    });
  }

  // Define map constants. 0 = floor, 1 = wall, 2 = console
  // The map is 20x20. We design a simple space station with four rooms.
  const MAP_W = 20;
  const MAP_H = 20;
  const map = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      row.push(0);
    }
    map.push(row);
  }

  // Helper to build rectangular rooms surrounded by walls.
  function buildRoom(x0, y0, x1, y1, consolePositions = []) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Outer perimeter becomes wall; interior stays floor.
        if (y === y0 || y === y1 || x === x0 || x === x1) {
          map[y][x] = 1;
        } else {
          map[y][x] = 0;
        }
      }
    }
    // Place consoles
    for (const pos of consolePositions) {
      const cx = pos[0];
      const cy = pos[1];
      if (cx >= x0 + 1 && cx <= x1 - 1 && cy >= y0 + 1 && cy <= y1 - 1) {
        map[cy][cx] = 2;
      }
    }
  }

  // Central hub: draw a cross walkway in the middle of the map.
  const hubX = Math.floor(MAP_W / 2);
  const hubY = Math.floor(MAP_H / 2);
  for (let i = 0; i < MAP_W; i++) {
    map[hubY][i] = 0;
  }
  for (let j = 0; j < MAP_H; j++) {
    map[j][hubX] = 0;
  }

  // Build rooms: north lab (top), south engineering (bottom), east quarters, west hydroponics.
  // Each room includes a couple of consoles.
  buildRoom(hubX - 2, 0, hubX + 2, 5, [[hubX, 2]]);             // north lab
  buildRoom(hubX - 2, MAP_H - 6, hubX + 2, MAP_H - 1, [[hubX, MAP_H - 3]]); // south engineering
  buildRoom(MAP_W - 6, hubY - 2, MAP_W - 1, hubY + 2, [[MAP_W - 3, hubY]]); // east quarters
  buildRoom(0, hubY - 2, 5, hubY + 2, [[2, hubY]]);             // west hydroponics

  // Additional corridors to connect rooms to the central hub.
  // North
  for (let y = 6; y < hubY; y++) {
    map[y][hubX] = 0;
  }
  // South
  for (let y = hubY + 1; y < MAP_H - 6; y++) {
    map[y][hubX] = 0;
  }
  // East
  for (let x = hubX + 1; x < MAP_W - 6; x++) {
    map[hubY][x] = 0;
  }
  // West
  for (let x = 6; x < hubX; x++) {
    map[hubY][x] = 0;
  }

  // Player state
  const player = {
    x: hubX,
    y: hubY,
    speed: 1 // number of tiles moved per key press
  };

  // Input handling
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
  });
  window.addEventListener('keyup', e => {
    keys[e.key] = false;
  });

  function update() {
    // Move player based on arrow keys. We check collisions with walls (value 1).
    if (keys['ArrowUp']) {
      const newY = player.y - player.speed;
      if (newY >= 0 && map[newY][player.x] !== 1) player.y = newY;
      keys['ArrowUp'] = false;
    }
    if (keys['ArrowDown']) {
      const newY = player.y + player.speed;
      if (newY < MAP_H && map[newY][player.x] !== 1) player.y = newY;
      keys['ArrowDown'] = false;
    }
    if (keys['ArrowLeft']) {
      const newX = player.x - player.speed;
      if (newX >= 0 && map[player.y][newX] !== 1) player.x = newX;
      keys['ArrowLeft'] = false;
    }
    if (keys['ArrowRight']) {
      const newX = player.x + player.speed;
      if (newX < MAP_W && map[player.y][newX] !== 1) player.x = newX;
      keys['ArrowRight'] = false;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Compute camera offset to centre player on screen
    const offsetX = canvas.width / 2 - (player.x - player.y) * (TILE_W / 2) - TILE_W / 2;
    const offsetY = canvas.height / 2 - (player.x + player.y) * (TILE_H / 2) - TILE_H;
    // Draw tiles row by row (isometric draw order). We loop through map tiles and
    // determine screen positions. We draw floor first, then walls and consoles.
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const isoX = (x - y) * (TILE_W / 2) + offsetX;
        const isoY = (x + y) * (TILE_H / 2) + offsetY;
        // Floor tile
        ctx.drawImage(assets.floor, isoX, isoY, TILE_W, TILE_H);
        const tile = map[y][x];
        if (tile === 1) {
          // wall: draw a taller wall by expanding vertically. We shift up by TILE_H to align base.
          const wallHeight = TILE_H * 2;
          ctx.drawImage(assets.wall, isoX, isoY - (wallHeight - TILE_H), TILE_W, wallHeight);
        } else if (tile === 2) {
          // console: similar height to wall
          const objHeight = TILE_H * 2;
          ctx.drawImage(assets.console, isoX, isoY - (objHeight - TILE_H), TILE_W, objHeight);
        }
      }
    }
    // Draw player last
    const playerScreenX = (player.x - player.y) * (TILE_W / 2) + offsetX;
    const playerScreenY = (player.x + player.y) * (TILE_H / 2) + offsetY;
    const charHeight = TILE_H * 2;
    ctx.drawImage(assets.astronaut, playerScreenX, playerScreenY - (charHeight - TILE_H), TILE_W, charHeight);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Kick off the game when assets are ready
  loadAssets().then(() => {
    loop();
  });
})();