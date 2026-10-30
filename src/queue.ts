import { PRIORITY_RANK, type Motion, type Priority } from './types';

// Pure priority queue for motions. Timing lives in the engine, not here.

export interface QueueItem {
 motion: Motion;
 priority: Priority;
 durationMs: number;
}

export interface PushResult {
 // Item that must start now (null when it was only queued or dropped).
 start: QueueItem | null;
 // Item that was playing and got interrupted by start.
 interrupted: QueueItem | null;
 queued: boolean;
}

export const MAX_PENDING = 8;

export class MotionQueue {
 current: QueueItem | null = null;
 readonly pending: QueueItem[] = [];

 push(item: QueueItem): PushResult {
 if (!this.current) {
 this.current = item;
 return { start: item, interrupted: null, queued: false };
 }
 if (PRIORITY_RANK[item.priority] > PRIORITY_RANK[this.current.priority]) {
 const interrupted = this.current;
 this.current = item;
 return { start: item, interrupted, queued: false };
 }
 // Same or lower rank: wait behind items of equal or higher rank (FIFO per rank).
 if (this.pending.length >= MAX_PENDING) {
 const lowest = this.pending[this.pending.length - 1]!;
 if (PRIORITY_RANK[item.priority] <= PRIORITY_RANK[lowest.priority]) {
 return { start: null, interrupted: null, queued: false };
 }
 this.pending.pop();
 }
 let i = this.pending.length;
 while (i > 0 && PRIORITY_RANK[this.pending[i - 1]!.priority] < PRIORITY_RANK[item.priority]) i--;
 this.pending.splice(i, 0, item);
 return { start: null, interrupted: null, queued: true };
 }

 // Current item ended; returns the next item to start, if any.
 finish(): QueueItem | null {
 this.current = this.pending.shift() ?? null;
 return this.current;
 }

 // Drop everything; returns the item that was playing.
 clear(): QueueItem | null {
 const was = this.current;
 this.current = null;
 this.pending.length = 0;
 return was;
 }
}
