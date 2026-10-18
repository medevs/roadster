// Menus, records, sharing, touch controls. DOM lives in index.html.
export const SITE = 'https://roadster-azure.vercel.app'; // swap for the real domain once bought

export type Mode = 'menu' | 'play' | 'paused';

// ---- records (localStorage; survives reloads, never throws in private mode) ----
export type Records = { zero60: number; jump: number; wall: number; alt: number; air: number };
const KEY = 'roadster.records.v1';
const EMPTY: Records = { zero60: 0, jump: 0, wall: 0, alt: 0, air: 0 };
export function loadRecords(): Records {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...EMPTY }; }
}
export function saveRecords(r: Records) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage off */ } }

// lower is better only for 0-60
export function better(k: keyof Records, v: number, r: Records) { return k === 'zero60' ? (r.zero60 === 0 || v < r.zero60) : v > r[k]; }

export const LABEL: Record<keyof Records, [string, (v: number) => string]> = {
  zero60: ['0–60 mph', v => `${v.toFixed(2)} s`],
  jump: ['Clear the five Teslas', v => `${v.toFixed(1)} m over the Semi`],
  wall: ['Wall climb', v => `${Math.round(v)}°`],
  alt: ['Highest flight', v => `${v.toFixed(1)} m`],
  air: ['Longest airtime', v => `${v.toFixed(1)} s`],
};

export function renderRecords(el: HTMLElement, r: Records) {
  const rows = (Object.keys(LABEL) as (keyof Records)[]).filter(k => r[k]).map(k => {
    const [name, fmt] = LABEL[k];
    return `<li><span>${name}</span><b>${fmt(r[k])}</b></li>`;
  });
  el.innerHTML = rows.join('') || '<li>None yet. Hit 0–60, clear the jump lane, climb the wall.</li>';
}

export function shareUrl(text: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE)}`;
}

// ---- touch: on-screen buttons press the same key codes the keyboard does ----
export function bindTouch(keys: Set<string>, once: Set<string>) {
  const root = document.getElementById('touch')!;
  if (!matchMedia('(pointer: coarse)').matches) return false;
  root.classList.remove('hide');
  root.querySelectorAll<HTMLElement>('[data-key]').forEach(b => {
    const code = b.dataset.key!;
    const on = (e: Event) => { e.preventDefault(); if (!keys.has(code)) once.add(code); keys.add(code); b.classList.add('on'); };
    const off = (e: Event) => { e.preventDefault(); keys.delete(code); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  });
  return true;
}
