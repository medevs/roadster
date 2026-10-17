# Roadster

Drive and fly the 2028 Tesla Roadster in the browser: suction fans, the 170° wall climb, SpaceX cold-gas thrusters, the five-Tesla jump. three.js + Rapier, no art assets (the car is code, built from the reveal photos).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, host anywhere
```

Controls: `H` in game. Tuning constants and their sources (FACT vs EST) sit at the top of `src/main.ts`; research in `ref/NOTES.md`.

Files: `src/model.ts` car (body loft, canopy, wheels, interior, yoke, screen), `src/world.ts` test site, `src/main.ts` physics, thrusters, fans, cameras, HUD, sound.
