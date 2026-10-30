import { describe, expect, it } from 'vitest';
import { spriteStateFor } from '../src/sprite';

describe('spriteStateFor', () => {
 it('shows the expression sprite while the eyes are open', () => {
 expect(spriteStateFor('neutral', 1)).toBe('neutral');
 expect(spriteStateFor('sad', 1)).toBe('sad');
 });

 it('swaps to the blink sprite for neutral and smile when the eyes close', () => {
 expect(spriteStateFor('neutral', 0.1)).toBe('blink');
 expect(spriteStateFor('smile', 0)).toBe('blink');
 });

 it('keeps other expressions while blinking', () => {
 expect(spriteStateFor('angry', 0)).toBe('angry');
 expect(spriteStateFor('blush', 0.2)).toBe('blush');
 });
});
