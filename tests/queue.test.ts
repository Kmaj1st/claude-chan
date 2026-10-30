import { describe, expect, it } from 'vitest';
import { MotionQueue, MAX_PENDING, type QueueItem } from '../src/queue';

const item = (motion: QueueItem['motion'], priority: QueueItem['priority'] = 'normal'): QueueItem => ({ motion, priority, durationMs: 1000 });

describe('MotionQueue', () => {
 it('starts immediately when empty', () => {
 const q = new MotionQueue();
 const r = q.push(item('wave'));
 expect(r.start?.motion).toBe('wave');
 expect(r.interrupted).toBeNull();
 });

 it('queues equal priority in FIFO order', () => {
 const q = new MotionQueue();
 q.push(item('wave'));
 q.push(item('nod'));
 q.push(item('bow'));
 expect(q.finish()?.motion).toBe('nod');
 expect(q.finish()?.motion).toBe('bow');
 expect(q.finish()).toBeNull();
 });

 it('interrupts lower priority and reports it', () => {
 const q = new MotionQueue();
 q.push(item('sleepy', 'low'));
 const r = q.push(item('surprised', 'high'));
 expect(r.start?.motion).toBe('surprised');
 expect(r.interrupted?.motion).toBe('sleepy');
 });

 it('does not interrupt on equal priority', () => {
 const q = new MotionQueue();
 q.push(item('wave'));
 const r = q.push(item('nod'));
 expect(r.start).toBeNull();
 expect(r.queued).toBe(true);
 });

 it('orders pending by priority then arrival', () => {
 const q = new MotionQueue();
 q.push(item('wave', 'urgent'));
 q.push(item('nod', 'low'));
 q.push(item('bow', 'high'));
 q.push(item('pout', 'low'));
 expect(q.finish()?.motion).toBe('bow');
 expect(q.finish()?.motion).toBe('nod');
 expect(q.finish()?.motion).toBe('pout');
 });

 it('bounds the pending list and drops low items first', () => {
 const q = new MotionQueue();
 q.push(item('wave', 'urgent'));
 for (let i = 0; i < MAX_PENDING; i++) q.push(item('nod', 'low'));
 expect(q.push(item('pout', 'low')).queued).toBe(false);
 expect(q.push(item('bow', 'high')).queued).toBe(true);
 expect(q.pending.length).toBe(MAX_PENDING);
 expect(q.pending[0]?.motion).toBe('bow');
 });

 it('clear empties everything', () => {
 const q = new MotionQueue();
 q.push(item('wave'));
 q.push(item('nod'));
 expect(q.clear()?.motion).toBe('wave');
 expect(q.current).toBeNull();
 expect(q.pending.length).toBe(0);
 });
});
