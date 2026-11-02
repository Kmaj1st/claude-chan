// Pure geometry for the free (draggable) mascot position. No DOM access here, so it is unit-testable.

export interface Box { x: number; y: number }
export interface Area { left: number; top: number; width: number; height: number }
// Position stored as fractions of the free space: 0 = left/top edge, 1 = right/bottom edge (inside the margin).
export interface Fraction { fx: number; fy: number }

const fin = (v: number, d = 0): number => (Number.isFinite(v) ? v : d);
const unit = (v: number): number => Math.max(0, Math.min(1, fin(v)));

// Keep a w x h box inside area, at least margin px from every edge when it fits.
// A box larger than the area is pinned to its top-left corner (plus margin).
export function clampToArea(x: number, y: number, w: number, h: number, a: Area, margin = 0): Box {
 const lx = a.left + margin;
 const ly = a.top + margin;
 const hx = a.left + a.width - w - margin;
 const hy = a.top + a.height - h - margin;
 return {
 x: Math.max(lx, Math.min(fin(x, lx), Math.max(lx, hx))),
 y: Math.max(ly, Math.min(fin(y, ly), Math.max(ly, hy))),
 };
}

// Fraction of the free range along one axis; the inverse is fromFraction.
export function toFraction(p: number, size: number, view: number, margin = 0): number {
 const range = view - size - 2 * margin;
 return range > 0 ? unit((p - margin) / range) : 0;
}

export function fromFraction(f: number, size: number, view: number, margin = 0): number {
 return margin + unit(f) * Math.max(0, view - size - 2 * margin);
}

// Edge snapping: an edge closer than threshold px is pulled flush to the margin.
export function snapToEdges(b: Box, w: number, h: number, a: Area, margin: number, threshold: number): Box {
 const lx = a.left + margin;
 const ly = a.top + margin;
 const hx = a.left + a.width - w - margin;
 const hy = a.top + a.height - h - margin;
 let { x, y } = b;
 if (Math.abs(x - lx) <= threshold) x = lx;
 else if (Math.abs(x - hx) <= threshold) x = hx;
 if (Math.abs(y - ly) <= threshold) y = ly;
 else if (Math.abs(y - hy) <= threshold) y = hy;
 return { x, y };
}

// Reads a stored position: { v: 2, fx, fy } (fractions) or the legacy { x, y } (px) written before v2.
export function parseStored(raw: unknown, w: number, h: number, vw: number, vh: number, margin = 0): Fraction | null {
 if (!raw || typeof raw !== 'object') return null;
 const o = raw as Record<string, unknown>;
 if (typeof o.fx === 'number' && typeof o.fy === 'number' && Number.isFinite(o.fx) && Number.isFinite(o.fy)) {
 return { fx: unit(o.fx), fy: unit(o.fy) };
 }
 if (typeof o.x === 'number' && typeof o.y === 'number' && Number.isFinite(o.x) && Number.isFinite(o.y)) {
 return { fx: toFraction(o.x, w, vw, margin), fy: toFraction(o.y, h, vh, margin) };
 }
 return null;
}
