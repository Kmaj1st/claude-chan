import { describe, expect, it } from 'vitest';
import { clampPosition, cornerVars } from '../src/host';

describe('clampPosition', () => {
 it('keeps a box that fits unchanged', () => {
 expect(clampPosition(100, 50, 200, 300, 1000, 800)).toEqual({ x: 100, y: 50 });
 });

 it('pulls a box back inside every edge', () => {
 expect(clampPosition(-40, -10, 200, 300, 1000, 800)).toEqual({ x: 0, y: 0 });
 expect(clampPosition(900, 700, 200, 300, 1000, 800)).toEqual({ x: 800, y: 500 });
 });

 it('pins to the origin when the box is larger than the viewport', () => {
 expect(clampPosition(50, 50, 500, 500, 300, 300)).toEqual({ x: 0, y: 0 });
 });
});

describe('cornerVars', () => {
 it('anchors bottom-left with the default offset', () => {
 const v = cornerVars('bottom-left');
 expect(v['--claude-chan-left']).toBe('16px');
 expect(v['--claude-chan-right']).toBe('auto');
 });

 it('anchors bottom-right with a custom offset', () => {
 const v = cornerVars('bottom-right', 8);
 expect(v['--claude-chan-right']).toBe('8px');
 expect(v['--claude-chan-left']).toBe('auto');
 });
});

describe('clampPosition non-finite input', () => {
 it('treats NaN and Infinity as the origin instead of propagating NaN', () => {
 expect(clampPosition(NaN, NaN, 200, 300, 1000, 800)).toEqual({ x: 0, y: 0 });
 expect(clampPosition(Infinity, -Infinity, 200, 300, 1000, 800)).toEqual({ x: 0, y: 0 });
 });
});
