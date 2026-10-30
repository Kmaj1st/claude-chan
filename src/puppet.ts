import { PUPPET_SVG } from './puppet-svg';
import type { Expression, Pose, Puppet } from './types';

// Procedural SVG renderer. Maps the shared Live2D-style parameters onto SVG transforms.
// Units: angles in degrees (about +-30), eyes/mouth 0..1, form/brows/arms -1..1.

const ARM_DEGREES = 120;

const EXPRESSION_CHEEK: Partial<Record<Expression, number>> = { blush: 0.85, smile: 0.2 };
const EXPRESSION_BROW: Partial<Record<Expression, number>> = { sad: 0.6, angry: -0.7, surprised: -0.8 };
const EXPRESSION_FORM: Partial<Record<Expression, number>> = { smile: 0.7, sad: -0.7, angry: -0.3, blush: 0.4, surprised: 0 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const f = (n: number): string => n.toFixed(2);
const move = (x: number, y: number): string => 'translate(' + f(x) + ' ' + f(y) + ')';
const turn = (deg: number, cx = 0, cy = 0): string => 'rotate(' + f(deg) + ' ' + cx + ' ' + cy + ')';

export class ProceduralPuppet implements Puppet {
 readonly element: HTMLElement;
 private parts: Record<string, SVGElement> = {};

 constructor() {
 this.element = document.createElement('div');
 this.element.style.cssText = 'width:100%;height:100%;';
 }

 async init(): Promise<void> {
 // PUPPET_SVG is a static constant (no user text), so innerHTML is safe here.
 this.element.innerHTML = PUPPET_SVG;
 for (const el of Array.from(this.element.querySelectorAll<SVGElement>('[data-part]'))) {
 this.parts[el.getAttribute('data-part') ?? ''] = el;
 }
 }

 private set(name: string, attr: string, value: string): void {
 this.parts[name]?.setAttribute(attr, value);
 }

 render(pose: Pose, expression: Expression): void {
 this.set('root', 'transform', move(0, -pose.ParamBreath * 2) + ' ' + turn(pose.ParamBodyAngleZ, 100, 270));
 this.set('body', 'transform', move(pose.ParamBodyAngleX * 0.4, 0));
 this.set('head', 'transform',
 move(pose.ParamAngleX * 0.6, -pose.ParamAngleY * 0.4) + ' ' + turn(pose.ParamAngleZ, 100, 150));
 this.set('hairBack', 'transform', turn(pose.ParamHairSway * 4, 100, 90));
 this.set('hairFront', 'transform', move(pose.ParamHairSway * 1.5, 0));

 this.set('armL', 'transform', move(62, 150) + ' ' + turn(pose.ParamArmLA * ARM_DEGREES));
 this.set('armR', 'transform', move(138, 150) + ' ' + turn(-pose.ParamArmRA * ARM_DEGREES));

 for (const side of ['L', 'R'] as const) {
 const open = clamp(side === 'L' ? pose.ParamEyeLOpen : pose.ParamEyeROpen, 0, 1);
 this.set('lid' + side, 'height', f((1 - open) * 30));
 this.set('iris' + side, 'transform', move(pose.ParamEyeBallX * 3, -pose.ParamEyeBallY * 3));
 const brow = clamp((side === 'L' ? pose.ParamBrowLY : pose.ParamBrowRY) + (EXPRESSION_BROW[expression] ?? 0), -1, 1);
 this.set('brow' + side, 'transform', move(0, -brow * 5));
 const cheek = clamp(pose.ParamCheek + (EXPRESSION_CHEEK[expression] ?? 0), 0, 1);
 this.set('cheek' + side, 'opacity', f(cheek * 0.8));
 }

 const form = clamp(pose.ParamMouthForm + (EXPRESSION_FORM[expression] ?? 0), -1, 1);
 const open = clamp(pose.ParamMouthOpenY, 0, 1);
 const upper = 'M90 138 Q100 ' + f(138 + form * 8) + ' 110 138';
 const lower = open > 0.05 ? ' Q100 ' + f(138 + open * 16 + Math.max(form, 0) * 4) + ' 90 138' : '';
 this.set('mouth', 'd', upper + lower);
 this.set('mouth', 'fill-opacity', open > 0.05 ? '1' : '0');
 }

 destroy(): void {
 this.element.replaceChildren();
 this.parts = {};
 }
}
