// Audio-driven lip-sync: turns an AnalyserNode or an audio/video element into a 0..1 mouth level.

export interface LevelReader {
 read(): number;
 dispose(): void;
}

// createMediaElementSource may only be called once per element, so the graph is cached.
const graphs = new WeakMap<HTMLMediaElement, { ctx: AudioContext; analyser: AnalyserNode }>();

function rmsLevel(analyser: AnalyserNode, buf: Uint8Array): number {
 analyser.getByteTimeDomainData(buf as Uint8Array<ArrayBuffer>);
 let sum = 0;
 for (let i = 0; i < buf.length; i++) {
 const v = (buf[i]! - 128) / 128;
 sum += v * v;
 }
 return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}

export function createLevelReader(source: HTMLMediaElement | AnalyserNode): LevelReader {
 let analyser: AnalyserNode;
 if (typeof HTMLMediaElement !== 'undefined' && source instanceof HTMLMediaElement) {
 let g = graphs.get(source);
 if (!g) {
 const ctx = new AudioContext();
 let a: AnalyserNode;
 try {
 const node = ctx.createMediaElementSource(source);
 a = ctx.createAnalyser();
 a.fftSize = 512;
 node.connect(a);
 a.connect(ctx.destination);
 } catch (err) {
 void ctx.close();
 throw err;
 }
 g = { ctx, analyser: a };
 graphs.set(source, g);
 }
 if (g.ctx.state === 'suspended') g.ctx.resume().catch(() => {}); // autoplay policy may reject; level just stays 0
 analyser = g.analyser;
 } else {
 analyser = source as AnalyserNode;
 }
 const buf = new Uint8Array(analyser.fftSize);
 return { read: () => rmsLevel(analyser, buf), dispose: () => {} };
}
