# Might and Magic 3 Web Runner

## Context
Build a web-based runner for Might and Magic 3 (DOS, 1991) using js-dos v8 — a WebAssembly port of DOSBox. The user has the original game files (EXE + data) and wants to play it in a browser with no custom engine work. The project directory is currently empty.

## Approach: js-dos v8 + .jsdos bundle

js-dos v8 is a battle-tested library (~CDN served) that wraps DOSBox compiled to WebAssembly. You provide a `.jsdos` file (a ZIP bundle containing game files + `dosbox.conf`), point the HTML page at it, and the library handles everything else. No backend needed — pure static files.

## Project Structure

```
hommg3_web/
├── index.html       # Player page (js-dos v8 from CDN)
├── dosbox.conf      # DOSBox config for MM3
├── build.sh         # Creates mm3.jsdos from game/ + dosbox.conf
├── package.json     # Dev server scripts
├── game/            # User drops MM3 files here (gitignored)
│   ├── MM3.EXE
│   └── [data files]
└── .gitignore       # Ignores game/ and mm3.jsdos
```

## Files to Create

### 1. `index.html`
- Load js-dos v8 CSS + JS from `https://v8.js-dos.com/latest/`
- Full-viewport `#dos` div
- `Dos(element, { url: "./mm3.jsdos", cycles: "max" })`
- Minimal styling (black background, centered layout)

### 2. `dosbox.conf`
```ini
[cpu]
core=auto
cputype=auto
cycles=10000

[dosbox]
machine=vga
memsize=16

[sblaster]
sbbase=220
irq=7
dma=1
hdma=5

[dos]
xms=true
ems=true
umb=true

[autoexec]
@echo off
mount c .
c:
mm3.exe
```
Note: `cycles=10000` is a safe starting point for a 1991 game; `machine=vga` is appropriate (MM3 is 320×200 VGA, not SVGA).

### 3. `build.sh`
Script that assembles the `.jsdos` zip bundle:
1. Check `game/` directory exists and is non-empty
2. Create temp dir with `.jsdos/` subdirectory
3. Copy all files from `game/` into the temp dir root
4. Copy `dosbox.conf` into temp dir's `.jsdos/` subfolder
5. Zip the temp dir contents into `mm3.jsdos`
6. Clean up temp dir

### 4. `package.json`
```json
{
  "name": "hommg3-web",
  "scripts": {
    "build": "bash build.sh",
    "dev": "npx http-server -p 8080 -c-1",
    "start": "npm run build && npm run dev"
  }
}
```
No runtime dependencies. `http-server` used via npx.

### 5. `.gitignore`
Ignore the original game files (license/IP reasons) and the generated bundle:
```
game/
mm3.jsdos
```

## Workflow (after implementation)

1. Drop MM3 files into `game/` directory
2. `npm run build` → creates `mm3.jsdos`
3. `npm run dev` → serves on `http://localhost:8080`
4. Open browser — DOSBox boots and MM3 launches automatically

## Verification

- Run `npm run build` — confirm `mm3.jsdos` is created (should be ~3–8 MB depending on data files)
- Run `npm run dev`, open `http://localhost:8080`
- DOSBox boot screen should appear, then MM3 title screen
- Test keyboard input (arrow keys, Enter) and mouse (should move cursor in menus)
- If game runs too fast/slow: adjust `cycles=10000` in `dosbox.conf` and rebuild
- If no sound: verify SoundBlaster IRQ/DMA matches what MM3 sound setup expects (220/7/1 is standard)
