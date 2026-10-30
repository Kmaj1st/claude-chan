import { EXPRESSIONS, MOTIONS, type ActRequest, type ClaudeChanElement } from '../src/index';
import '../src/index';

const el = document.getElementById('cc') as unknown as ClaudeChanElement;
const log = document.getElementById('log') as HTMLElement;
const write = (line: string): void => {
 log.textContent += line + String.fromCharCode(10);
 log.scrollTop = log.scrollHeight;
};
const act = (req: ActRequest): void => {
 write('> claude_chan_act ' + JSON.stringify(req));
 el.controller?.act(req);
};

function buttons(id: string, names: readonly string[], make: (n: string) => ActRequest): void {
 const box = document.getElementById(id) as HTMLElement;
 for (const n of names) {
 const b = document.createElement('button');
 b.textContent = n;
 b.addEventListener('click', () => act(make(n)));
 box.appendChild(b);
 }
}
buttons('motions', MOTIONS, (n) => ({ motion: n as ActRequest['motion'], priority: 'high' }));
buttons('expressions', EXPRESSIONS, (n) => ({ expression: n as ActRequest['expression'] }));

const text = document.getElementById('text') as HTMLInputElement;
document.getElementById('say')?.addEventListener('click', () => act({ say: text.value }));
document.getElementById('stop')?.addEventListener('click', () => el.controller?.stop());
document.getElementById('run')?.addEventListener('click', () => {
 try {
 act(JSON.parse((document.getElementById('call') as HTMLInputElement).value) as ActRequest);
 } catch (e) {
 write('! invalid JSON: ' + String(e));
 }
});
