// Procedural 2028 Tesla Roadster, built from the 2026-10-15 reveal photos (ref/).
// Forward = +Z, up = +Y, origin on the ground between the axles. Driver's left = +X.
// Proportions are estimated from photos: Tesla published no dimensions.
import * as THREE from 'three';

export const DIM = {
  wheelbase: 2.65, frontZ: 1.32, rearZ: -1.33, track: 1.68, wheelR: 0.36, wheelW: 0.3,
};

// Half cross-sections (x, y) at key z stations. Point order:
// 0 centre bottom, 1 tub edge, 2 tub top (arch inner), 3 sill/arch outer, 4 belt crease, 5 shoulder, 6 centre top.
// Points 2/3 y gets replaced by the wheel-arch height near the axles.
type Sec = [number, [number, number][]];
const KEYS: Sec[] = [
  [2.2, [[0, .24], [.6, .24], [.6, .3], [.82, .3], [.9, .52], [.84, .6], [0, .62]]],
  [2.1, [[0, .16], [.62, .16], [.62, .22], [.92, .22], [.98, .56], [.92, .68], [0, .7]]],
  [1.85, [[0, .14], [.64, .14], [.64, .22], [.95, .22], [1.0, .6], [.94, .76], [0, .78]]],
  [1.0, [[0, .14], [.64, .14], [.64, .22], [.94, .22], [1.0, .62], [.94, .82], [0, .84]]],
  [-0.6, [[0, .14], [.64, .14], [.64, .22], [.93, .22], [.99, .64], [.95, .84], [0, .86]]],
  [-1.6, [[0, .16], [.64, .16], [.64, .24], [.95, .24], [1.0, .68], [.96, .9], [0, .93]]],
  [-1.98, [[0, .28], [.62, .28], [.62, .32], [.92, .32], [.97, .72], [.94, .92], [0, .95]]],
  [-2.1, [[0, .34], [.6, .34], [.6, .38], [.86, .38], [.92, .74], [.9, .9], [0, .92]]],
];

function sectionAt(z: number): [number, number][] {
  let i = 0;
  while (i < KEYS.length - 2 && z < KEYS[i + 1][0]) i++;
  const [z0, a] = KEYS[i], [z1, b] = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((z - z0) / (z1 - z0), 0, 1);
  const pts = a.map((p, k) => [p[0] + (b[k][0] - p[0]) * t, p[1] + (b[k][1] - p[1]) * t] as [number, number]);
  // wheel arch: raise the outer bottom over each axle
  for (const az of [DIM.frontZ, DIM.rearZ]) {
    const d = Math.abs(z - az), R = 0.44;
    if (d < R) {
      const y = DIM.wheelR + Math.sqrt(R * R - d * d);
      pts[2][1] = Math.max(pts[2][1], y); pts[3][1] = Math.max(pts[3][1], y);
    }
  }
  return pts;
}

// Lofts mirrored sections into one mesh; segment k of the profile goes to material group k.
function loft(zs: number[], sec: (z: number) => [number, number][], segMat: number[], skip?: (k: number, z0: number, z1: number) => boolean) {
  const pos: number[] = [];
  const groups: { start: number; count: number; mat: number }[] = [];
  const n = sec(zs[0]).length;
  for (let k = 0; k < n - 1; k++) {
    const start = pos.length / 3;
    for (const side of [1, -1]) {
      for (let s = 0; s < zs.length - 1; s++) {
        if (skip?.(k, zs[s], zs[s + 1])) continue;
        const A = sec(zs[s]), B = sec(zs[s + 1]);
        const p = (P: [number, number][], z: number, j: number) => [P[j][0] * side, P[j][1], z];
        const a0 = p(A, zs[s], k), a1 = p(A, zs[s], k + 1), b0 = p(B, zs[s + 1], k), b1 = p(B, zs[s + 1], k + 1);
        // winding so normals face outward on both mirrored sides
        const quad = side > 0 ? [a0, b0, b1, a0, b1, a1] : [a0, b1, b0, a0, a1, b1];
        for (const v of quad) pos.push(...v);
      }
    }
    groups.push({ start, count: pos.length / 3 - start, mat: segMat[k] });
  }
  // end caps (front + back), fan from centre
  for (const [z, dir] of [[zs[0], 1], [zs[zs.length - 1], -1]] as [number, number][]) {
    const start = pos.length / 3, P = sec(z);
    for (const side of [1, -1]) for (let j = 0; j < n - 1; j++) {
      const c = [0, (P[0][1] + P[n - 1][1]) / 2, z];
      const a = [P[j][0] * side, P[j][1], z], b = [P[j + 1][0] * side, P[j + 1][1], z];
      const tri = side * dir > 0 ? [c, b, a] : [c, a, b];
      for (const v of tri) pos.push(...v);
    }
    groups.push({ start, count: pos.length / 3 - start, mat: segMat[segMat.length - 1] });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.mat);
  g.computeVertexNormals();
  return g;
}

function range(a: number, b: number, step: number) {
  const out: number[] = [];
  for (let z = a; z > b; z -= step) out.push(z);
  out.push(b);
  return out;
}

// Canopy: gold-visor glass from windshield base to the fastback tail.
const CAB: [number, number, number, number][] = [ // z, baseHalfWidth, baseY, roofY
  [0.95, .9, .84, .85], [0.15, .86, .85, 1.12], [-0.45, .86, .86, 1.16], [-1.05, .88, .88, 1.08], [-1.75, .9, .92, .95],
];
function cabinAt(z: number): [number, number][] {
  let i = 0;
  while (i < CAB.length - 2 && z < CAB[i + 1][0]) i++;
  const a = CAB[i], b = CAB[i + 1];
  const t = THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1);
  const L = (k: number) => a[k] + (b[k] - a[k]) * t;
  const w = L(1), y0 = L(2), y1 = L(3);
  return [[w, y0], [w * 0.68, y1 - 0.02], [0, y1]];
}

export type RoadsterModel = {
  root: THREE.Group;
  wheels: THREE.Group[]; // FL, FR, RL, RR
  yoke: THREE.Object3D;
  wing: THREE.Object3D;
  screen: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  plumes: { mesh: THREE.Mesh; kind: 'main' | 'lift' }[];
  brakeLight: THREE.MeshStandardMaterial;
};

export function createRoadsterModel(): RoadsterModel {
  const root = new THREE.Group();
  root.name = 'roadster';

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xeceeee, metalness: 0.15, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, flatShading: true, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.55, metalness: 0.2, flatShading: true, side: THREE.DoubleSide });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x2a1c0c, metalness: 0.85, roughness: 0.05, transparent: true, opacity: 0.78, envMapIntensity: 1.6, side: THREE.DoubleSide, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 1, roughness: 0.25 });

  // body: [underbody, tub side, sill, lower panel, upper panel, top] -> materials
  // the top panel stays open under the canopy so the cockpit is visible and the driver can see out
  const openTop = (k: number, z0: number, z1: number) => k === 5 && z0 <= 0.95 && z1 >= -1.75;
  const body = new THREE.Mesh(loft(range(2.2, -2.1, 0.04), sectionAt, [1, 1, 1, 0, 0, 0], openTop), [paint, black]);
  body.name = 'body';
  body.castShadow = body.receiveShadow = true;
  root.add(body);

  const cabin = new THREE.Mesh(loft(range(0.95, -1.75, 0.05), cabinAt, [0, 0]), [glass]);
  cabin.name = 'canopy';
  root.add(cabin);

  // white A-pillar/roof edge strips (reference: white frame around gold glass)
  const edgePts = range(0.95, -1.75, 0.1).map(z => { const c = cabinAt(z)[1]; return new THREE.Vector3(c[0], c[1] + 0.005, z); });
  for (const s of [1, -1]) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts.map(p => p.clone().setX(p.x * s))), 40, 0.018, 5), paint);
    root.add(tube);
  }

  // front: full-width light bar, black splitter
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.018, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 3 }));
  lightBar.position.set(0, 0.56, 2.205);
  root.add(lightBar);
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.25), carbon);
  splitter.position.set(0, 0.16, 2.08);
  root.add(splitter);

  // rear: full-width tail light, plate, diffuser with gold-ringed thrusters
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x500000, emissive: 0xff0000, emissiveIntensity: 2.2 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.025, 0.02), tailMat);
  tail.position.set(0, 0.86, -2.105);
  root.add(tail);
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 256; plateCanvas.height = 64;
  const pc = plateCanvas.getContext('2d')!;
  pc.fillStyle = '#e8e8e8'; pc.fillRect(0, 0, 256, 64);
  pc.fillStyle = '#222'; pc.font = 'bold 44px sans-serif'; pc.textAlign = 'center'; pc.fillText('RDSTR', 128, 48);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.11), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(plateCanvas), roughness: 0.4 }));
  plate.position.set(0, 0.62, -2.115); plate.rotation.y = Math.PI;
  root.add(plate);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.3), carbon);
  diffuser.position.set(0, 0.3, -2.0);
  root.add(diffuser);

  const plumes: RoadsterModel['plumes'] = [];
  const plumeMat = () => new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const plumeGeo = new THREE.ConeGeometry(0.07, 1, 12, 1, true);
  plumeGeo.translate(0, -0.5, 0); // tip at origin, extends along -Y
  for (const x of [-0.54, -0.18, 0.18, 0.54]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 8, 20), gold);
    ring.position.set(x, 0.3, -2.155);
    root.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), black);
    hole.position.set(x, 0.3, -2.152); hole.rotation.y = Math.PI;
    root.add(hole);
    const p = new THREE.Mesh(plumeGeo, plumeMat());
    p.position.set(x, 0.3, -2.16); p.rotation.x = -Math.PI / 2; // points backward
    p.scale.set(1, 0.001, 1); p.visible = false;
    root.add(p); plumes.push({ mesh: p, kind: 'main' });
  }
  // corner lift thrusters (Rocket trim), firing down
  for (const [x, z] of [[0.82, 1.85], [-0.82, 1.85], [0.82, -1.8], [-0.82, -1.8]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), gold);
    ring.position.set(x, 0.135, z); ring.rotation.x = Math.PI / 2;
    root.add(ring);
    const p = new THREE.Mesh(plumeGeo, plumeMat());
    p.position.set(x, 0.13, z);
    p.scale.set(1.3, 0.001, 1.3); p.visible = false;
    root.add(p); plumes.push({ mesh: p, kind: 'lift' });
  }

  // active rear wing on two struts (raised in track mode)
  const wing = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.025, 0.3), carbon);
  blade.position.y = 0.22; blade.rotation.x = -0.12;
  wing.add(blade);
  for (const x of [-0.45, 0.45]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.12), carbon);
    strut.position.set(x, 0.11, 0); wing.add(strut);
  }
  wing.position.set(0, 0.9, -1.9);
  wing.scale.y = 0.05;
  root.add(wing);

  // side marker lights + mirrors-free (camera pods): small black pods on doors
  for (const s of [1, -1]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.12), new THREE.MeshStandardMaterial({ color: 0x401000, emissive: 0xff5a00, emissiveIntensity: 1.2 }));
    marker.position.set(0.995 * s, 0.6, 1.62); root.add(marker);
  }

  // wheels: black tyre, white aero face with six black spokes (reference r10)
  const tyreGeo = new THREE.CylinderGeometry(DIM.wheelR, DIM.wheelR, DIM.wheelW, 40, 1, true);
  tyreGeo.rotateZ(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const faceGeo = new THREE.CircleGeometry(DIM.wheelR * 0.78, 40);
  const wheelWhite = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 0.3, roughness: 0.35 });
  const sidewall = new THREE.RingGeometry(DIM.wheelR * 0.78, DIM.wheelR, 40);
  const wheels: THREE.Group[] = [];
  for (const [x, z] of [[DIM.track / 2, DIM.frontZ], [-DIM.track / 2, DIM.frontZ], [DIM.track / 2, DIM.rearZ], [-DIM.track / 2, DIM.rearZ]]) {
    const w = new THREE.Group();
    const spin = new THREE.Group(); spin.name = 'spin';
    const tyre = new THREE.Mesh(tyreGeo, tyreMat); tyre.castShadow = true;
    spin.add(tyre);
    for (const s of [1, -1]) {
      const face = new THREE.Mesh(faceGeo, wheelWhite);
      face.position.x = s * DIM.wheelW / 2; face.rotation.y = s * Math.PI / 2;
      const wall = new THREE.Mesh(sidewall, tyreMat);
      wall.position.x = s * DIM.wheelW / 2; wall.rotation.y = s * Math.PI / 2;
      spin.add(face, wall);
      for (let k = 0; k < 6; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.01, DIM.wheelR * 0.72, 0.045), black);
        spoke.position.set(s * (DIM.wheelW / 2 + 0.004), 0, 0);
        spoke.rotation.x = (k / 6) * Math.PI * 2;
        spoke.translateY(DIM.wheelR * 0.36);
        spin.add(spoke);
      }
    }
    w.add(spin);
    w.position.set(x, DIM.wheelR, z);
    root.add(w); wheels.push(w);
  }

  // ---- interior (2 white seats moulded into the chassis, yoke, screens) ----
  const suede = new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 1 });
  const ultraWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.7 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 2.9), carbon);
  floor.position.set(0, 0.24, -0.35); root.add(floor);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 1.9), carbon);
  tunnel.position.set(0, 0.38, -0.2); root.add(tunnel);
  for (const x of [0.4, -0.4]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.55), ultraWhite);
    base.position.set(x, 0.32, -0.45); root.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.1), ultraWhite);
    back.position.set(x, 0.62, -0.78); back.rotation.x = -0.32; root.add(back);
    for (const s of [1, -1]) { // side bolsters
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.5), ultraWhite);
      b.position.set(x + s * 0.24, 0.42, -0.45); root.add(b);
    }
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.5), suede);
  dash.position.set(0, 0.72, 0.78); dash.rotation.x = 0.12; root.add(dash);
  const ambient = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 1.5 }));
  ambient.position.set(0, 0.66, 0.52); root.add(ambient);

  // yoke: rounded-rect ring with open top (steer-by-wire)
  const yoke = new THREE.Group();
  const yShape = new THREE.Shape();
  yShape.moveTo(-0.17, -0.1); yShape.lineTo(0.17, -0.1); yShape.quadraticCurveTo(0.2, -0.1, 0.2, -0.06);
  yShape.lineTo(0.2, 0.08); yShape.lineTo(0.15, 0.08); yShape.lineTo(0.15, -0.05); yShape.lineTo(-0.15, -0.05);
  yShape.lineTo(-0.15, 0.08); yShape.lineTo(-0.2, 0.08); yShape.lineTo(-0.2, -0.06); yShape.quadraticCurveTo(-0.2, -0.1, -0.17, -0.1);
  const grip = new THREE.Mesh(new THREE.ExtrudeGeometry(yShape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), ultraWhite);
  grip.position.z = -0.018; yoke.add(grip);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.05, 20), black);
  hub.rotation.x = Math.PI / 2; yoke.add(hub);
  yoke.position.set(0.4, 0.8, 0.3); yoke.scale.setScalar(0.85);
  yoke.rotation.x = -0.35;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 10), black);
  column.position.set(0.4, 0.76, 0.44); column.rotation.x = Math.PI / 2 - 0.35;
  root.add(yoke, column);

  // horizontal centre screen right of the yoke (canvas texture driven by the game)
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 192;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.set(0.02, 0.88, 0.54); screen.rotation.set(-0.25, Math.PI, 0);
  // plane faces +Z by default; flip so it faces the driver (looking +Z means screen must face -Z)
  root.add(screen);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.015), black);
  bezel.position.set(0.02, 0.88, 0.55); bezel.rotation.x = 0.25; root.add(bezel);

  root.traverse(o => { if ((o as THREE.Mesh).isMesh && o !== cabin) o.castShadow = true; });
  return { root, wheels, yoke, wing, screen: { canvas, tex }, plumes, brakeLight: tailMat };
}
