# Drift Rally Mini — Credits

**Developer / publisher:** Qadir Games

## Art
All game art was **modelled and rendered in Blender 4.5 (Cycles)** by procedural Python scripts in `blender/`:
- `car.py` / `carlib.py`: the 12 toy cars (64 yaw frames each, baked sun shadow), including the Rally Wagon, Dune Buggy, Trail Boss 4x4 and Black Venom added in v1.2
- `track.py`: the three tracks (Desert Canyon, Snowy Pines, Neon City) with all props, crowds, gantries, the y-sorted overlay pass and the cover key art
- `ui.py`: icons, the garage pedestal, smoke, flame and spark sprites, and the logo

Pillow then post-processed and packed them into WebP atlases (`tools/post.py`, `blender/pack.py`). The dot, beam, confetti and ray particle masks are drawn in code.
**No AI-generated images, textures, models or sounds ship in this game.** A concept image was used only as a visual reference during development.

## Font
- **Lilita One** by Juan Montoreano. SIL Open Font License 1.1 (`assets/OFL_LilitaOne.txt`). From github.com/google/fonts.

## Code / engine
- **Phaser 3.80**. MIT License, © Richard Davey / Phaser Studio.
- All game code is original.

## Audio
- **Engine loop** (`assets/sfx/engine.wav`): "Racing car engine sound loops" by domasx2, OpenGameArt.org. **CC0**.
- **Tire skid loop** (`assets/sfx/skid.wav`): built from "Screeching Tires #1" and "Screeching Tires #4" by Dorian Clair, BigSoundBank.com (sounds 2368 and 2371). **CC0**. Trimmed, crossfaded into a seamless loop and resampled.
- **Engine start** (`assets/sfx/start.mp3`): looneybits, OpenGameArt.org. **CC0**.
- **Impacts, bumps, tire, scrape, UI clicks, confirm, back, deny, tick, coin, whoosh, unlock** (`assets/sfx/*.mp3`): Kenney (www.kenney.nl), *Impact Sounds* and *Interface Sounds* packs. **CC0**.
- The music (one theme per track plus the menu theme) and the accent sounds (countdown beeps, boost, combo, lap, win, star) are synthesised at runtime with the Web Audio API (`src/audio.js`).

## Tools
Blender (GPL; the rendered art belongs to the author), Pillow, NumPy/SciPy, ffmpeg (preview videos) and Playwright (automated tests).
