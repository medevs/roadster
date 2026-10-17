// Test site modelled on the reveal: night salt flat, launch strip, the curved
// "wall climb" ramp (goes past vertical to ~170°), and a row of Teslas to jump.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export const RAMP = { z0: 260, R: 11, width: 12, maxAngle: THREE.MathUtils.degToRad(170) };
export const JUMP_ROW_Z = 120;
export const ROW = { end: 0, semi: [0, 0, 0] as number[] }; // filled by buildWorld
// Paid slots. Empty slots advertise themselves; a buyer replaces one entry.
export const SPONSORS = [
  { title: "YOUR BRAND", sub: "on this billboard · roadster ads in menu", bg: "#111", fg: "#fff" },
  { title: "AD SPACE", sub: "seen by every driver · see menu", bg: "#c8102e", fg: "#fff" },
  { title: "SPONSOR ME", sub: "one slot left on the strip", bg: "#f4f4f4", fg: "#111" },
];

function saltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5d5a55'; g.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) { // grain
    const v = 80 + rnd() * 30;
    g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.35)`;
    g.fillRect(rnd() * 512, rnd() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(40,38,35,0.55)'; g.lineWidth = 1.4; // dried-mud cracks
  for (let i = 0; i < 70; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 90; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(300, 300);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildWorld(scene: THREE.Scene, world: RAPIER.World) {
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.Fog(0x05070c, 120, 900);

  // stars
  const starPos: number[] = [];
  for (let i = 0; i < 2500; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48;
    starPos.push(1400 * Math.cos(th) * Math.sin(ph + 0.05), 1400 * Math.cos(ph + 0.05), 1400 * Math.sin(th) * Math.sin(ph + 0.05));
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
  scene.add(stars);

  scene.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 0.6));
  const moon = new THREE.DirectionalLight(0xc8d4ff, 1.6);
  moon.position.set(-40, 80, -30);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 250 });
  scene.add(moon, moon.target);

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: saltTexture(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, -1, 0).setFriction(1));

  // launch strip: dark asphalt with white edge lines and red runway lights
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(16, RAMP.z0 + 40), new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.8 }));
  strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.01, RAMP.z0 / 2 - 20); strip.receiveShadow = true;
  scene.add(strip);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
  for (const x of [-7.6, 7.6]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, RAMP.z0 + 40), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, RAMP.z0 / 2 - 20); scene.add(l);
  }
  const lampGeo = new THREE.BoxGeometry(0.3, 0.15, 0.3);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 3 });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 2 * Math.ceil((RAMP.z0 + 40) / 10));
  let n = 0;
  const m = new THREE.Matrix4();
  for (let z = -20; z < RAMP.z0 + 20; z += 10) for (const x of [-8.5, 8.5]) lamps.setMatrixAt(n++, m.makeTranslation(x, 0.08, z));
  lamps.count = n;
  scene.add(lamps);

  // start line
  const start = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  start.rotation.x = -Math.PI / 2; start.position.set(0, 0.02, 3); scene.add(start);

  // curved wall-climb ramp: quarter-pipe that keeps curling to 170° (inverted)
  const { z0, R, width, maxAngle } = RAMP;
  const seg = 60, verts: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * maxAngle;
    const y = R - R * Math.cos(a), z = z0 + R * Math.sin(a);
    verts.push(-width / 2, y, z, width / 2, y, z);
    if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const rampGeo = new THREE.BufferGeometry();
  rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  rampGeo.setIndex(idx); rampGeo.computeVertexNormals();
  const ramp = new THREE.Mesh(rampGeo, new THREE.MeshStandardMaterial({ color: 0xbfc3c9, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }));
  ramp.receiveShadow = ramp.castShadow = true;
  scene.add(ramp);
  // solid 1 m-thick box per segment: a zero-thickness trimesh lets the fan-loaded car punch through
  const T = 1;
  for (let i = 0; i < seg; i++) {
    const a = ((i + 0.5) / seg) * maxAngle, len = (maxAngle / seg) * R * 1.04;
    const n = new THREE.Vector3(0, Math.cos(a), -Math.sin(a)); // surface normal, pointing into the pipe
    const c = new THREE.Vector3(0, R - R * Math.cos(a), z0 + R * Math.sin(a)).addScaledVector(n, -T / 2);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -a);
    world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, T / 2, len / 2).setTranslation(c.x, c.y, c.z).setRotation(q).setFriction(1.1));
  }
  // red edge strips + support pillars
  for (const x of [-width / 2, width / 2]) {
    const pts = [];
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * maxAngle; pts.push(new THREE.Vector3(x, R - R * Math.cos(a), z0 + R * Math.sin(a))); }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.12, 6), lampMat));
    // steel truss tower behind each edge, like the rig at the McGregor reveal
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.8, roughness: 0.4 });
    const H = 2 * R + 2, zb = z0 + R + 1.5, s = x > 0 ? 1 : -1;
    const bar = (len: number) => new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 6), steel);
    for (const dz of [-1.5, 1.5]) for (const dx of [0, 1.6]) {
      const leg = bar(H); leg.position.set(x + s * (0.6 + dx), H / 2, zb + dz); scene.add(leg);
    }
    for (let y = 1.5; y < H; y += 2) {
      for (const dz of [-1.5, 1.5]) { const b = bar(1.6); b.rotation.z = Math.PI / 2; b.position.set(x + s * 1.4, y, zb + dz); scene.add(b); }
      const d = bar(3.4); d.rotation.x = 0.55 * (y % 4 < 2 ? 1 : -1); d.position.set(x + s * 0.6, y + 1, zb); scene.add(d);
    }
    const beam = bar(width + 4); beam.rotation.z = Math.PI / 2; beam.position.set(0, H, zb); if (s > 0) scene.add(beam);
  }

  // the five-car jump row as low-poly stand-ins, parked broadside one after another (like the demo)
  // [width, height, length, color, cabin height share, cabin length share]
  const cars: [number, number, number, number, number, number][] = [
    [1.85, 1.44, 4.7, 0x1d3a8a, 0.42, 0.5],  // Model 3
    [1.92, 1.62, 4.75, 0x9b1b1b, 0.45, 0.6], // Model Y
    [2.5, 3.9, 6.0, 0xe8e8e8, 0.55, 0.38],   // Semi tractor
    [2.2, 1.9, 5.7, 0xb8bcc2, 0.4, 0.55],    // Cybertruck
    [1.9, 1.15, 4.2, 0xd2b45a, 0.45, 0.55],  // Cybercab
  ];
  const tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18).rotateX(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.6, roughness: 0.15 });
  let z = JUMP_ROW_Z;
  for (const [w, h, l, color, ch, cl] of cars) {
    z += w / 2;
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 });
    const lowH = h * (1 - ch);
    const low = new THREE.Mesh(new THREE.BoxGeometry(l, lowH - 0.25, w), paint);
    low.position.y = 0.25 + (lowH - 0.25) / 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(l * cl, h * ch, w * 0.86), glassMat);
    cab.position.set(color === 0xe8e8e8 ? l * 0.28 : -l * 0.05, lowH + h * ch / 2, 0);
    g.add(low, cab);
    for (const [tx, tz] of [[l * 0.33, w / 2 - 0.1], [-l * 0.33, w / 2 - 0.1], [l * 0.33, -w / 2 + 0.1], [-l * 0.33, -w / 2 + 0.1]]) {
      const t = new THREE.Mesh(tyre, tyreMat); t.position.set(tx, 0.36, tz); g.add(t);
    }
    g.traverse(o => { o.castShadow = o.receiveShadow = true; });
    g.position.set(0, 0.02, z);
    scene.add(g);
    world.createCollider(RAPIER.ColliderDesc.cuboid(l / 2, h / 2, w / 2).setTranslation(0, h / 2 + 0.05, z));
    if (h > 3) ROW.semi = [z - w / 2, z + w / 2, h + 0.05];
    z += w / 2 + 0.6;
  }
  ROW.end = z;

  // sponsor billboards along the strip (one line in SPONSORS = one paying slot)
  SPONSORS.forEach((s, i) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = s.bg; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = s.fg; g.textAlign = 'center';
    g.font = 'bold 120px system-ui'; g.fillText(s.title, 512, 250);
    g.font = '52px system-ui'; g.fillText(s.sub, 512, 360);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: tex }));
    const side = i % 2 ? 1 : -1;
    board.position.set(side * 22, 7, 60 + i * 55);
    board.rotation.y = side * -0.5 + Math.PI; // faces the oncoming car
    scene.add(board);
    for (const dx of [-4, 4]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      pole.position.copy(board.position).add(new THREE.Vector3(dx * Math.cos(board.rotation.y), -5, -dx * Math.sin(board.rotation.y)));
      scene.add(pole);
    }
  });

  // cones every 20 m for speed sense
  const coneGeo = new THREE.ConeGeometry(0.2, 0.5, 10);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0x401000 });
  for (let z = 20; z < RAMP.z0 - 20; z += 20) for (const x of [-10, 10]) {
    const c = new THREE.Mesh(coneGeo, coneMat); c.position.set(x, 0.25, z); scene.add(c);
  }
  return { moon };
}
