# Tesla Roadster (2028 production car): research notes, 2026-10-17

Trigger: @the_mcnaveen's "Roadster Launch" browser game (https://x.com/the_mcnaveen/status/2111110070100701196, tesla.mcnaveen.com), made the day after Tesla's reveal.
His game is stylised: drive up a ramp, fly, land. This project models the real car and the real demo instead.

## The event
- FACT: revealed 2026-10-15 at SpaceX's test site near Waco, TX. Car drove up a curved ramp past vertical (inverted), used thrusters to "kickflip" ~7 m over five parked Teslas (Model 3, Model Y, Cybertruck, Cybercab, Semi), did a barrel roll. Nobody in the car. (techcrunch.com/2026/10/15/..., cnn.com/2026/10/15/business/tesla-unveils-what-it-says-is-a-flying-car, paultan.org/2026/10/16/...)
- FACT: wall climb hit 170° pitch at ~21 m, downforce readout 4,700 kg, 3.3 G at ~6.5 m while the thrusters braked the fall (paultan.org, from livestream stills).
- FACT: production 2028, price not announced.

## Trims (FACT, electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip, teslarati.com)
| Trim | Seats | Thrusters | 0-60 mph |
|---|---|---|---|
| Performance | 2 | none (fans + active aero) | < 1.6 s |
| Thrust | 2 | 4 rear diffuser nozzles | < 0.9 s |
| Rocket | 1 | + perimeter nozzles for lift/rotation, not road-legal | < 0.59 s |
All: > 300 mi range, > 230 mph top speed.

## Systems
- FACT: 2 carbon-overwrapped pressure vessels, 600 L, ~250 kg air, ~5,500 psi readout, 10 nozzles, > 80 kN total, car recharges its own air (paultan.org, theevreport.com).
- FACT: underbody suction fans in the rear diffuser (Brabham BT46B idea), "up to 2 G", hold the car upside down when stationary. Modes incl. "Max Grip".
- FACT: tyres alone ~1.26 G (Tesla's Moravy). Pirelli P Zero Trofeo RS.
- FACT: variable-pitch rear wing, Track mode lowers the car and raises wings.
- NOT PUBLISHED: kerb weight, dimensions, power, battery size. Everything in the game for these is an estimate, marked EST in `src/main.ts`.

## Look (from ref/r1-r13, official photos via electrek + paultan)
- Exterior: faceted Cyber-style wedge (SR-71 influence), Ano White paint, gold-tinted visor glass with white frame, full-width white front light bar, full-width red tail bar, butterfly doors, black lower sills, white aero wheels with six black spokes, black diffuser with 4 gold-ringed nozzles, "RDSTR" plate.
- Interior: Ultrawhite seats moulded into the chassis, grey microsuede dash, open-top yoke (steer-by-wire), horizontal track screen right of the yoke with red-on-black UI, two small driver displays, red ambient strip.

## What the game approximates (honest list)
- Body is a hand-built procedural model from photos, not a scan. Proportions estimated.
- Doors don't open. No driver displays. Air mass leaving the tanks doesn't lighten the car.
- Exhaust velocity of cold air (~700 m/s) and compressor refill rate are our estimates; they set ~2 s of full thrust / ~11 s hover per tank.
