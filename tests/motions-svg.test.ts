import { describe, expect, it } from 'vitest';
import { MOTION_DEFS } from '../src/motions';
import { PALETTE, PUPPET_SVG } from '../src/puppet-svg';

describe('MOTION_DEFS', () => {
 const names = Object.keys(MOTION_DEFS) as (keyof typeof MOTION_DEFS)[];

 it('defines a good number of motions including idle', () => {
 expect(names.length).toBeGreaterThan(10);
 expect(names).toContain('idle');
 });

 it.each(names)('%s has a positive duration', (name) => {
 expect(MOTION_DEFS[name].durationMs).toBeGreaterThan(0);
 });

 it.each(names)('%s returns finite pose values over 0..1', (name) => {
 for (let i = 0; i <= 20; i++) {
 const pose = MOTION_DEFS[name].pose(i / 20);
 for (const [key, value] of Object.entries(pose)) {
 expect(Number.isFinite(value), name + ' ' + key + ' at ' + i).toBe(true);
 }
 }
 });

 it.each(names.filter((n) => n !== 'idle'))('%s starts and ends near the rest pose', (name) => {
 for (const t of [0, 1]) {
 for (const value of Object.values(MOTION_DEFS[name].pose(t))) {
 expect(Math.abs(value as number)).toBeLessThan(0.5);
 }
 }
 });
});

describe('PUPPET_SVG', () => {
 it('is one svg document', () => {
 expect(PUPPET_SVG.startsWith('<svg')).toBe(true);
 expect(PUPPET_SVG.endsWith('</svg>')).toBe(true);
 });

 it('has no unreplaced palette or side tokens', () => {
 for (const name of Object.keys(PALETTE)) expect(PUPPET_SVG).not.toContain('@' + name);
 expect(PUPPET_SVG).not.toContain('#S');
 expect(PUPPET_SVG).not.toContain('#X');
 });

 it('exposes the parts the puppet animates', () => {
 for (const part of ['root', 'head', 'body', 'mouth', 'eyeL', 'eyeR', 'lidL', 'lidR', 'irisL', 'irisR', 'armL', 'armR', 'browL', 'browR', 'cheekL', 'cheekR', 'hairBack', 'hairFront']) {
 expect(PUPPET_SVG).toContain('data-part="' + part + '"');
 }
 });

 it('contains no script or event handler', () => {
 expect(PUPPET_SVG).not.toContain('<script');
 expect(PUPPET_SVG).not.toContain(' on');
 });
});
