import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRoadsterModel, DIM } from './model';
import { buildWorld, RAMP, ROW, JUMP_ROW_Z } from './world';
import { bindTouch, better, LABEL, loadRecords, renderRecords, saveRecords, shareUrl, type Mode, type Records } from './ui';

// ---- Tuning. FACT = Tesla/reveal coverage 2026-10-15; EST = our estimate (Tesla gave no figure) ----
const T = {
  mass: 1650,            // EST kg, Tesla published no kerb weight
  power: 1_100_000,      // EST W, sets the 370 km/h top-speed region
  vmax: 103,             // FACT >230 mph (103 m/s), electronically capped here
  tyreMu: 1.26,          // FACT "tyres alone ~1.26 G" (Moravy, paultan.org)
  driveForceCap: 1.9,    // EST × m·g motor limit; Performance trim lands near its quoted <1.6 s 0-60
  fanPull: [0, 0.35, 2.0], // × m·g for OFF / ROAD / MAX GRIP; FACT "up to 2 G", holds the car on the 170° wall
  CdA: 0.55, wingClA: 1.4, rho: 1.2,
  mainThrust: 45_000,    // N, 4 rear diffuser nozzles (EST split of FACT ">80 kN" total)
  liftThrust: 40_000,    // N, 4 corner nozzles (Rocket trim), clears the Semi from ~40 m out at 100 km/h
  attitudeTorque: 9000,  // N·m, attitude-control thrusters (FACT they exist, EST size)
  airKg: 250,            // FACT 2 COPVs, 600 L, ~250 kg of air
  ve: 700,               // EST m/s cold-air exhaust velocity -> ~2.2 s of full thrust
  refillKgS: 3,          // EST on-board compressor refill on the ground
  psiFull: 5500,         // FACT readout on the reveal car
};

type Trim = 'Performance' | 'Thrust' | 'Rocket';
const TRIMS: Trim[] = ['Performance', 'Thrust', 'Rocket'];
const FAN_NAMES = ['OFF', 'ROAD', 'MAX GRIP'];

await RAPIER.init();

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 3000);
// glow on light bars, neon and thruster plumes; skipped on phones to keep 60 fps
const LOW = matchMedia('(pointer: coarse)').matches;
if (LOW) { renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; }
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
if (!LOW) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.85));
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 120;
const { moon } = buildWorld(scene, world);

// ---- car ----
const car = createRoadsterModel();
scene.add(car.root);
const head = new THREE.SpotLight(0xf4f7ff, 60, 120, 0.45, 0.5, 1.2);
head.position.set(0, 0.6, 2.1); head.target.position.set(0, 0, 20);
car.root.add(head, head.target);

const START = { pos: new THREE.Vector3(0, 0.05, 0), rot: new THREE.Quaternion() };
const chassis = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.05, 0).setCanSleep(false).setCcdEnabled(true)
  .setAngularDamping(0.3));
world.createCollider(RAPIER.ColliderDesc.cuboid(0.92, 0.22, 2.08).setTranslation(0, 0.48, 0).setMass(T.mass * 0.92).setFriction(0.4), chassis);
world.createCollider(RAPIER.ColliderDesc.cuboid(0.75, 0.14, 1.1).setTranslation(0, 0.96, -0.4).setMass(T.mass * 0.08).setFriction(0.4), chassis);

const vehicle = world.createVehicleController(chassis);
vehicle.indexUpAxis = 1;
vehicle.setIndexForwardAxis = 2;
const CONN_Y = 0.5, REST = 0.17; // ~2 cm static sag brings the wheel centre to its design height
for (const w of car.wheels) {
  vehicle.addWheel({ x: w.position.x, y: CONN_Y, z: w.position.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, DIM.wheelR);
}
for (let i = 0; i < 4; i++) {
  vehicle.setWheelSuspensionStiffness(i, 120);
  vehicle.setWheelSuspensionCompression(i, 6);
  vehicle.setWheelSuspensionRelaxation(i, 5);
  vehicle.setWheelMaxSuspensionTravel(i, 0.16);
  vehicle.setWheelMaxSuspensionForce(i, 200_000);
  vehicle.setWheelFrictionSlip(i, T.tyreMu);
  vehicle.setWheelSideFrictionStiffness(i, 1.0);
}

// ---- input ----
const keys = new Set<string>();
const once = new Set<string>();
addEventListener('keydown', e => { if (!keys.has(e.code)) once.add(e.code); keys.add(e.code); audio.start(); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.code));
// a key released while the tab is hidden never fires keyup: clear everything and pause
addEventListener('blur', () => { keys.clear(); if (S.mode === 'play') setMode('paused'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (S.mode === 'play') setMode('paused'); } });
(window as any).__keys = keys; (window as any).__once = once; // for scripted tests
const down = (...c: string[]) => c.some(k => keys.has(k));
const touch = bindTouch(keys, once);

// ---- state ----
const S = {
  mode: 'menu' as Mode, easy: true, muted: false,
  records: loadRecords() as Records, flipT: 0, rowOk: false, rowClear: Infinity, wallMax: 0,
  trim: 'Rocket' as Trim, fan: 1, track: false, cam: 0,
  air: T.airKg, steer: 0, airborne: 0, maxAlt: 0, maxG: 0,
  zeroT: -1, zeroDone: 0, prevVel: new THREE.Vector3(), g: 1, mainT: 0, liftT: [0, 0, 0, 0], brake: false, speed: 0, alt: 0,
  wheelsDown: 0, t: 0,
};
(window as any).__S = S; (window as any).__chassis = chassis; (window as any).__vehicle = vehicle;

const v3 = (v: { x: number; y: number; z: number }) => new THREE.Vector3(v.x, v.y, v.z);
const LIFT_PTS = [[0.82, 1.85], [-0.82, 1.85], [0.82, -1.8], [-0.82, -1.8]];

function resetCar(toStart: boolean) {
  const p = toStart ? START.pos : v3(chassis.translation()).add(new THREE.Vector3(0, 1.5, 0));
  if (!toStart) p.y = Math.max(p.y, 1.5);
  const q = new THREE.Quaternion();
  if (!toStart) { // keep heading, drop roll/pitch
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(chassis.rotation() as any as THREE.Quaternion);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(f.x, f.z));
  }
  chassis.setTranslation(p, true); chassis.setRotation(q, true);
  chassis.setLinvel({ x: 0, y: 0, z: 0 }, true); chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
  if (toStart) S.air = T.airKg;
  S.zeroT = -1; S.zeroDone = 0;
}

// ---- physics step ----
function step(dt: number) {
  const q = new THREE.Quaternion().copy(chassis.rotation() as any);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const vel = v3(chassis.linvel());
  const vF = vel.dot(fwd);
  const speed = vel.length();
  chassis.resetForces(true); chassis.resetTorques(true);

  let contacts = 0;
  for (let i = 0; i < 4; i++) if (vehicle.wheelIsInContact(i)) contacts++;
  S.wheelsDown = contacts;
  const onGround = contacts >= 2;

  const thr = down('KeyW', 'ArrowUp') ? 1 : 0;
  const rev = down('KeyS', 'ArrowDown') ? 1 : 0;
  const steerIn = (down('KeyA', 'ArrowLeft') ? 1 : 0) - (down('KeyD', 'ArrowRight') ? 1 : 0);
  const handbrake = down('KeyX');

  // drive: AWD (three motors), traction- then power-limited
  const m = T.mass, g = 9.81;
  const fanF = T.fanPull[S.fan] * m * g;
  let drive = 0;
  if (thr && vF < T.vmax) drive = Math.min(T.driveForceCap * m * g, T.power / Math.max(Math.abs(vF), 1));
  if (rev) drive = vF > 1 ? 0 : -0.35 * m * g;
  const braking = rev && vF > 1;
  S.brake = braking || handbrake;
  for (let i = 0; i < 4; i++) {
    vehicle.setWheelEngineForce(i, drive / 4);
    vehicle.setWheelBrake(i, braking ? 900 : (handbrake && i >= 2 ? 1500 : (thr || rev ? 0 : 6)));
  }
  // speed-sensitive steer, eased
  const maxSteer = 0.6 / (1 + Math.abs(vF) / 14);
  S.steer += (steerIn * maxSteer - S.steer) * Math.min(1, dt * 8);
  vehicle.setWheelSteering(0, S.steer); vehicle.setWheelSteering(1, S.steer);
  vehicle.setWheelSideFrictionStiffness(2, handbrake ? 0.35 : 1);
  vehicle.setWheelSideFrictionStiffness(3, handbrake ? 0.35 : 1);

  const p0 = chassis.translation();
  const nearWall = p0.z > RAMP.z0 - 45 && p0.z < RAMP.z0 + RAMP.R + 3 && Math.abs(p0.x) < RAMP.width;
  if (S.easy) {
    // stability control: steer the yaw rate toward what the front wheels ask for, damp body roll
    if (onGround) {
      const w = v3(chassis.angvel());
      const want = (vF * Math.tan(S.steer)) / DIM.wheelbase;
      chassis.addTorque(up.clone().multiplyScalar((want - w.dot(up)) * T.mass * 2), true);
      chassis.addTorque(fwd.clone().multiplyScalar(-w.dot(fwd) * T.mass * 1.5), true);
    }
    // wall assist: the 11 m pipe is a ~45 g loop at 250 km/h, so cap entry speed and max the fans
    if (nearWall) {
      S.fan = 2;
      if (p0.z < RAMP.z0 && vF > 22) for (let i = 0; i < 4; i++) { vehicle.setWheelEngineForce(i, 0); vehicle.setWheelBrake(i, 500); }
    }
  }

  // aero drag + wing downforce, fan suction (only works with the floor near a surface)
  const vSq = speed * speed;
  if (speed > 0.1) chassis.addForce(vel.clone().multiplyScalar(-0.5 * T.rho * T.CdA * speed), true);
  const wingDown = 0.5 * T.rho * (S.track ? T.wingClA : 0.25) * vF * Math.abs(vF);
  if (onGround) chassis.addForce(up.clone().multiplyScalar(-(Math.max(0, wingDown) + fanF)), true);

  // thrusters
  let used = 0;
  const hasMain = S.trim !== 'Performance', hasLift = S.trim === 'Rocket';
  const boost = hasMain && down('ShiftLeft', 'ShiftRight') && S.air > 0 ? 1 : 0;
  S.mainT = boost;
  if (boost) {
    const F = T.mainThrust;
    const at = v3(chassis.translation()).add(fwd.clone().multiplyScalar(-2.0)).add(up.clone().multiplyScalar(0.3));
    chassis.addForceAtPoint(fwd.clone().multiplyScalar(F), at, true);
    used += F;
  }
  const lift = hasLift && down('Space') && S.air > 0 ? 1 : 0;
  // in the air the drive keys become attitude commands
  const pitchCmd = !onGround ? thr - rev : 0;   // W = nose down
  const rollCmd = !onGround ? -steerIn : 0;      // D = roll right
  const yawCmd = !onGround ? (down('KeyQ') ? 1 : 0) - (down('KeyE') ? 1 : 0) : 0;
  for (let i = 0; i < 4; i++) {
    const [sx, sz] = LIFT_PTS[i];
    let t = 0;
    if (hasLift && S.air > 0) t = THREE.MathUtils.clamp(lift + 0.5 * (-pitchCmd * Math.sign(sz) + rollCmd * Math.sign(sx)), 0, 1);
    if (lift === 0 && onGround) t = 0;
    S.liftT[i] = t;
    if (t > 0) {
      const F = (T.liftThrust / 4) * t;
      const at = v3(chassis.translation()).add(left.clone().multiplyScalar(sx)).add(fwd.clone().multiplyScalar(sz)).add(up.clone().multiplyScalar(0.3));
      chassis.addForceAtPoint(up.clone().multiplyScalar(F), at, true);
      used += F;
    }
  }
  if (hasLift && !onGround && S.air > 0 && (pitchCmd || rollCmd || yawCmd)) {
    const tq = new THREE.Vector3() // attitude jets on top of the corner-nozzle differential
      .addScaledVector(left, pitchCmd * T.attitudeTorque)
      .addScaledVector(fwd, rollCmd * T.attitudeTorque)
      .addScaledVector(up, yawCmd * T.attitudeTorque);
    chassis.addTorque(tq, true);
    used += 2000;
  }
  // flight stabiliser (FACT: electric nozzle actuators "stabilise the car in flight"): PD toward level
  // on whichever axes the pilot isn't commanding. Easy mode keeps it on for every trim, off the wall.
  if ((hasLift && S.air > 0 || S.easy && !nearWall) && contacts === 0) {
    const tilt = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0)); // axis·sin(angle) back to level
    const w = v3(chassis.angvel());
    const tq = tilt.multiplyScalar(22000).addScaledVector(w, -11000);
    if (pitchCmd) tq.addScaledVector(left, -tq.dot(left));
    if (rollCmd) tq.addScaledVector(fwd, -tq.dot(fwd));
    tq.addScaledVector(up, -tq.dot(up)); // yaw stays free
    if (tq.length() > 25000) tq.setLength(25000);
    chassis.addTorque(tq, true);
  }
  if (hasMain && !hasLift && !onGround && S.air > 0 && (pitchCmd || rollCmd)) { // Thrust trim: small attitude only
    chassis.addTorque(left.clone().multiplyScalar(pitchCmd * T.attitudeTorque * 0.4).addScaledVector(fwd, rollCmd * T.attitudeTorque * 0.4), true);
  }
  S.air = Math.max(0, S.air - (used / T.ve) * dt);
  if (onGround && used === 0) S.air = Math.min(T.airKg, S.air + T.refillKgS * dt);

  vehicle.updateVehicle(dt);
  world.step();

  // telemetry
  const nv = v3(chassis.linvel());
  const acc = nv.clone().sub(S.prevVel).divideScalar(dt).add(new THREE.Vector3(0, 9.81, 0));
  S.g += (acc.length() / 9.81 - S.g) * Math.min(1, dt * 6);
  S.prevVel.copy(nv);
  S.speed = nv.length();
  S.alt = Math.max(0, chassis.translation().y);
  S.t += dt;
  // 0-60 mph timer
  if (S.speed < 0.3 && onGround) { S.zeroT = -1; S.zeroDone = 0; }
  else if (S.zeroT < 0 && thr && !S.zeroDone) S.zeroT = S.t;
  if (S.zeroT >= 0 && !S.zeroDone && S.speed >= 26.82) {
    S.zeroDone = 1;
    const t = S.t - S.zeroT;
    if (!record('zero60', t)) toast(`0–60 mph in ${t.toFixed(2)} s`);
  }

  // five-car jump: cross the whole row without a wheel touching anything
  const pz = chassis.translation().z;
  if (pz < JUMP_ROW_Z - 1) { S.rowOk = true; S.rowClear = Infinity; }
  else if (pz < ROW.end) {
    if (contacts > 0) S.rowOk = false;
    if (pz > ROW.semi[0] && pz < ROW.semi[1]) S.rowClear = Math.min(S.rowClear, S.alt - ROW.semi[2]);
  } else if (S.rowOk && pz < ROW.end + 3) {
    S.rowOk = false;
    if (S.rowClear < Infinity && !record('jump', Math.max(0, S.rowClear))) toast(`Cleared all five Teslas · ${S.rowClear.toFixed(1)} m over the Semi`);
  }

  // wall: angle round the pipe while the wheels are on it
  const cp = chassis.translation();
  const r = Math.hypot(cp.z - RAMP.z0, cp.y - RAMP.R);
  if (contacts >= 2 && Math.abs(cp.x) < RAMP.width / 2 && r > RAMP.R - 2.5 && r < RAMP.R + 0.5 && cp.z >= RAMP.z0 - 1) {
    const a = THREE.MathUtils.radToDeg(Math.atan2(cp.z - RAMP.z0, RAMP.R - cp.y));
    S.wallMax = Math.max(S.wallMax, Math.min(a, 170)); // the pipe ends at 170°
  } else if (S.wallMax > 20 && contacts === 0 || S.wallMax > 20 && cp.z < RAMP.z0 - 5) {
    if (!record('wall', S.wallMax)) toast(`Wall climb · ${Math.round(S.wallMax)}°`);
    S.wallMax = 0;
  }

  // edge cases: fell out of the world / physics blew up -> start; stuck on roof or side -> right it
  if (!Number.isFinite(cp.y) || cp.y < -30 || Math.abs(cp.x) > 1900 || Math.abs(cp.z) > 1900) { resetCar(true); toast('Back to the start line'); return; }
  if (up.y < 0.35 && S.speed < 1.5 && S.alt < 4) {
    if ((S.flipT += dt) > (S.easy ? 1.5 : 4)) { S.flipT = 0; resetCar(false); toast('Car righted'); }
  } else S.flipT = 0;
  // airtime
  if (contacts === 0) { S.airborne += dt; S.maxAlt = Math.max(S.maxAlt, S.alt); S.maxG = 0; }
  else {
    if (contacts >= 3) S.maxG = Math.max(S.maxG, S.g);
    if (S.airborne > 0.8) {
      const upright = up.y > 0.6;
      const newAlt = record('alt', S.maxAlt), newAir = record('air', S.airborne);
      if (!newAlt && !newAir) toast(upright ? `Landed · ${S.airborne.toFixed(1)} s air · ${S.maxAlt.toFixed(1)} m high` : 'Rough landing. R to right the car');
    }
    S.airborne = 0; S.maxAlt = 0;
  }
}

// ---- smoke ----
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const puffs: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
for (let i = 0; i < 220; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, color: 0xdde3ea }));
  s.visible = false; scene.add(s); puffs.push({ s, v: new THREE.Vector3(), life: 0 });
}
let puffI = 0;
function emit(at: THREE.Vector3, dir: THREE.Vector3, speed: number) {
  const p = puffs[puffI++ % puffs.length];
  p.s.position.copy(at); p.v.copy(dir).multiplyScalar(speed).add(new THREE.Vector3((Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2));
  p.life = 1; p.s.visible = true; p.s.scale.setScalar(0.4);
}
function updateSmoke(dt: number) {
  for (const p of puffs) if (p.life > 0) {
    p.life -= dt * 0.7;
    p.v.multiplyScalar(1 - dt * 2.5); p.v.y += dt * 0.8;
    if (p.s.position.y < 0.2) { p.v.y = Math.abs(p.v.y) * 0.3; p.s.position.y = 0.2; }
    p.s.position.addScaledVector(p.v, dt);
    p.s.scale.setScalar(0.4 + (1 - p.life) * 4);
    (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life) * 0.45;
    if (p.life <= 0) p.s.visible = false;
  }
}

// ---- audio (synth: motor whine, thruster roar, wind) ----
const audio = {
  ctx: null as AudioContext | null, motor: null as OscillatorNode | null, motor2: null as OscillatorNode | null,
  mg: null as GainNode | null, tg: null as GainNode | null, wg: null as GainNode | null, out: null as GainNode | null,
  start() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    if (!window.AudioContext) return; // very old browser: silent game
    const ctx = this.ctx = new AudioContext();
    const out = this.out = ctx.createGain(); out.gain.value = S.muted ? 0 : 0.5; out.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.mg = ctx.createGain(); this.mg.gain.value = 0; lp.connect(this.mg).connect(out);
    this.motor = ctx.createOscillator(); this.motor.type = 'sawtooth'; this.motor.connect(lp); this.motor.start();
    this.motor2 = ctx.createOscillator(); this.motor2.type = 'sine'; this.motor2.connect(lp); this.motor2.start();
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type: BiquadFilterType, f: number) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = 0;
      src.connect(bf).connect(gn).connect(out); src.start(); return gn;
    };
    this.tg = mk('bandpass', 900); this.wg = mk('lowpass', 500);
  },
  update(throttle: number, speed: number, thrust: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out!.gain.setTargetAtTime(S.muted || S.mode !== "play" ? 0 : 0.5, t, 0.05);
    this.motor!.frequency.setTargetAtTime(60 + speed * 11, t, 0.05);
    this.motor2!.frequency.setTargetAtTime(120 + speed * 22, t, 0.05);
    this.mg!.gain.setTargetAtTime(0.03 + throttle * 0.07 + Math.min(speed / 100, 1) * 0.04, t, 0.08);
    this.tg!.gain.setTargetAtTime(thrust * 0.9, t, 0.03);
    this.wg!.gain.setTargetAtTime(Math.min(speed * speed / 6000, 0.6), t, 0.1);
  },
};

// ---- HUD ----
const $ = (id: string) => document.getElementById(id)!;
let toastTimer = 0;
function toast(msg: string) { $('toast').textContent = msg; $('toast').style.opacity = '1'; toastTimer = 3; }

// new personal best -> toast + one-tap share to X (the viral loop)
let shareTimer = 0;
function record(k: keyof Records, v: number) {
  if (!(v > 0) || !better(k, v, S.records)) return false;
  S.records[k] = v; saveRecords(S.records);
  const [name, fmt] = LABEL[k];
  toast(`New record · ${name} · ${fmt(v)}`);
  const a = $('share') as HTMLAnchorElement;
  a.href = shareUrl(`${name}: ${fmt(v)} in the Roadster sim 🚀 Beat it:`);
  a.classList.remove('hide'); shareTimer = 7;
  return true;
}

function setMode(m: Mode) {
  S.mode = m; keys.clear();
  $('menu').classList.toggle('hide', m !== 'menu');
  $('pause').classList.toggle('hide', m !== 'paused');
  document.body.classList.toggle('playing', m === 'play');
  if (m !== 'play') { renderRecords($('recs'), S.records); renderRecords($('recs2'), S.records); syncToggles(); }
}
function syncToggles() {
  $('t-easy').textContent = `Driving: ${S.easy ? 'Easy (assists on)' : 'Sim (no assists)'}`;
  $('t-mute').textContent = `Sound: ${S.muted ? 'Off' : 'On'}`;
  document.querySelectorAll<HTMLElement>('[data-trim]').forEach(b => b.classList.toggle('sel', b.dataset.trim === S.trim));
}
const play = () => { audio.start(); setMode('play'); };
$('b-play').onclick = play;
$('b-resume').onclick = play;
$('b-restart').onclick = () => { resetCar(true); play(); };
$('b-menu').onclick = () => { resetCar(true); setMode('menu'); };
$('t-easy').onclick = () => { S.easy = !S.easy; syncToggles(); };
$('t-mute').onclick = () => { S.muted = !S.muted; syncToggles(); };
$('b-pause').onclick = () => setMode('paused');
document.querySelectorAll<HTMLElement>('[data-trim]').forEach(b => b.onclick = () => { S.trim = b.dataset.trim as Trim; syncToggles(); });
if (touch) $('help').classList.add('hide');

function drawScreen() {
  const { canvas, tex } = car.screen, c = canvas.getContext('2d')!;
  c.fillStyle = '#0b0606'; c.fillRect(0, 0, 512, 192);
  c.strokeStyle = '#ff2a1a'; c.fillStyle = '#ff3b2a';
  c.font = 'bold 64px system-ui'; c.fillText(String(Math.round(S.speed * 3.6)), 24, 86);
  c.font = '20px system-ui'; c.fillText('km/h', 24, 112);
  c.fillText(`${S.trim.toUpperCase()}   FANS ${FAN_NAMES[S.fan]}   ${S.track ? 'TRACK' : 'ROAD'}`, 24, 160);
  c.fillText('THRUSTER', 300, 40); c.font = 'bold 34px system-ui';
  c.fillText(`${Math.round(T.psiFull * S.air / T.airKg)} psi`, 300, 80);
  c.strokeRect(300, 96, 180, 14); c.fillRect(300, 96, 180 * S.air / T.airKg, 14);
  tex.needsUpdate = true;
}

const CAMS = ['CHASE', 'COCKPIT', 'TRACKSIDE'];
function updateHud() {
  $('spd').textContent = String(Math.round(S.speed * 3.6));
  $('mph').textContent = `${Math.round(S.speed * 2.237)} mph`;
  $('g').textContent = S.g.toFixed(1);
  $('alt').textContent = S.alt.toFixed(1);
  $('air').style.width = `${(100 * S.air / T.airKg).toFixed(1)}%`;
  $('psi').textContent = `${Math.round(T.psiFull * S.air / T.airKg)} psi`;
  $('mode').textContent = `${S.trim} · Fans ${FAN_NAMES[S.fan]} · ${S.track ? 'Track' : 'Road'} · ${CAMS[S.cam]}`;
}

// ---- cameras ----
const camPos = new THREE.Vector3(0, 3, -8), camLook = new THREE.Vector3();
function updateCamera(dt: number) {
  const p = v3(chassis.translation()), q = new THREE.Quaternion().copy(chassis.rotation() as any);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  let view = (window as any).__view as number[] | undefined; // debug: [x,y,z] offset to look at the car from
  if (!view && S.mode === 'menu') { const a = performance.now() / 6000; view = [Math.sin(a) * 8.5, 1.8, Math.cos(a) * 8.5]; } // showroom turntable
  if (view) {
    camera.up.set(0, 1, 0); camera.position.copy(p).add(new THREE.Vector3(...view)); camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.6, 0)));
    if (S.mode === 'menu' && innerWidth > 700) { // push the car right of the menu text
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      camera.position.addScaledVector(right, -1.2);
    }
    camera.fov = 35; camera.updateProjectionMatrix(); return;
  }
  if (S.cam === 1) { // cockpit: driver's eye, left seat
    camera.position.copy(new THREE.Vector3(0.4, 1.0, -0.42).applyQuaternion(q).add(p));
    camera.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.08));
    camera.up.copy(up);
  } else if (S.cam === 0) { // chase, follows the car's frame so the wall climb stays readable
    const want = p.clone().addScaledVector(fwd, -7).addScaledVector(up, 2.3);
    camPos.lerp(want, 1 - Math.exp(-dt * 5));
    camLook.lerp(p.clone().addScaledVector(up, 0.9).addScaledVector(fwd, 2), 1 - Math.exp(-dt * 10));
    camera.up.lerp(up, 1 - Math.exp(-dt * 3)).normalize();
    camera.position.copy(camPos); camera.lookAt(camLook);
  } else { // trackside: fixed camera beside the strip, jumps ahead as the car passes
    const ahead = Math.round((p.z + 30) / 60) * 60;
    camPos.set(14, 2.5, ahead);
    camera.up.set(0, 1, 0);
    camera.position.copy(camPos); camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.6, 0)));
  }
  const fov = S.cam === 1 ? 75 : 60 + Math.min(S.speed / 103, 1) * 22;
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
  moon.position.copy(p).add(new THREE.Vector3(-40, 80, -30)); moon.target.position.copy(p);
}

// ---- sync visuals ----
function syncCar() {
  const p = chassis.translation(), q = chassis.rotation();
  car.root.position.set(p.x, p.y, p.z); car.root.quaternion.set(q.x, q.y, q.z, q.w);
  for (let i = 0; i < 4; i++) {
    const w = car.wheels[i];
    w.position.y = CONN_Y - (vehicle.wheelSuspensionLength(i) ?? REST);
    w.rotation.y = vehicle.wheelSteering(i) ?? 0;
    w.getObjectByName('spin')!.rotation.x = vehicle.wheelRotation(i) ?? 0;
  }
  car.starman.visible = S.cam !== 1;
  car.yoke.rotation.z = -S.steer * 2.2; // yoke turns with the front wheels
  const wingTarget = S.track || S.speed > 45 ? 1 : 0.05;
  car.wing.scale.y += (wingTarget - car.wing.scale.y) * 0.08;
  car.brakeLight.emissiveIntensity = S.brake ? 6 : 2.2;
  // plumes + smoke
  const q3 = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q3), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q3);
  let mi = 0;
  for (const pl of car.plumes) {
    const t = pl.kind === 'main' ? S.mainT : S.liftT[mi++];
    pl.mesh.visible = t > 0;
    pl.mesh.scale.y = t * (pl.kind === 'main' ? 2.2 : 1.6) * (0.85 + Math.random() * 0.3);
    if (t > 0 && Math.random() < 0.6) {
      const at = pl.mesh.getWorldPosition(new THREE.Vector3());
      emit(at, pl.kind === 'main' ? fwd.clone().negate() : up.clone().negate(), 14);
    }
  }
}

// ---- loop ----
let last = performance.now(), acc = 0, frame = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05); last = now;

  if (once.has('Escape') || once.has('KeyP')) { if (S.mode === 'play') setMode('paused'); else if (S.mode === 'paused') play(); }
  if (once.has('Enter') && S.mode !== 'play') play();
  if (once.has('KeyM')) { S.muted = !S.muted; syncToggles(); }
  if (once.has('KeyG')) { S.easy = !S.easy; toast(S.easy ? 'Easy driving: assists on' : 'Sim driving: assists off'); }
  if (once.has('KeyC')) S.cam = (S.cam + 1) % 3;
  if (once.has('KeyF')) S.fan = (S.fan + 1) % 3;
  if (once.has('KeyV')) S.track = !S.track;
  if (once.has('KeyR')) resetCar(false);
  if (once.has('KeyT') || once.has('Backspace')) resetCar(true);
  if (once.has('Digit1')) S.trim = TRIMS[0];
  if (once.has('Digit2')) S.trim = TRIMS[1];
  if (once.has('Digit3')) S.trim = TRIMS[2];
  if (once.has('KeyH')) $('help').classList.toggle('hide');
  once.clear();

  if (S.mode === 'play') {
    acc += dt;
    let n = 0; // cap catch-up steps so a slow frame never spirals
    while (acc >= world.timestep && n++ < 8) { step(world.timestep); acc -= world.timestep; }
    if (n >= 8) acc = 0;
  } else acc = 0;
  syncCar();
  updateSmoke(dt);
  updateCamera(dt);
  audio.update(down('KeyW', 'ArrowUp') ? 1 : 0, S.speed, Math.max(S.mainT, ...S.liftT));
  if (frame++ % 3 === 0) updateHud();
  if (frame % 6 === 0) drawScreen();
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').style.opacity = '0';
  if (shareTimer > 0 && (shareTimer -= dt) <= 0) $('share').classList.add('hide');
  composer.render();
});

setMode(new URLSearchParams(location.search).has('autoplay') ? 'play' : 'menu');
$('loading').remove();
