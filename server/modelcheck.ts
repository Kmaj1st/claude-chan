import fs from 'node:fs';
import path from 'node:path';
import { EXPRESSIONS, MOTIONS, PARAMS } from '../src/types';

export interface CheckResult {
 errors: string[];
 warnings: string[];
}

function readJson(file: string, res: CheckResult): any {
 try {
 return JSON.parse(fs.readFileSync(file, 'utf8'));
 } catch (e) {
 res.errors.push('cannot read JSON ' + path.basename(file) + ': ' + (e as Error).message);
 return undefined;
 }
}

// Validates an artist-delivered model folder against docs/ART-PIPELINE.md.
export function checkModel(dir: string): CheckResult {
 const res: CheckResult = { errors: [], warnings: [] };
 if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
 res.errors.push('not a directory: ' + dir);
 return res;
 }
 const m3 = fs.readdirSync(dir).find((f) => f.endsWith('.model3.json'));
 if (!m3) {
 res.errors.push('no *.model3.json found');
 return res;
 }
 const model = readJson(path.join(dir, m3), res);
 if (!model) return res;
 if (model.Version !== 3) res.errors.push('model3.json Version must be 3 (Cubism 4)');
 const refs = model.FileReferences ?? {};
 const need = (rel: unknown, what: string, optional = false): void => {
 if (typeof rel !== 'string' || !rel) {
 if (!optional) res.errors.push('model3.json missing ' + what);
 return;
 }
 if (!fs.existsSync(path.join(dir, rel))) res.errors.push(what + ' not found: ' + rel);
 };
 need(refs.Moc, 'Moc');
 for (const t of refs.Textures ?? []) need(t, 'texture');
 if (!(refs.Textures ?? []).length) res.errors.push('model3.json has no Textures');
 need(refs.Physics, 'Physics', true);
 if (!refs.Physics) res.warnings.push('no physics3.json (hair and frill will not move)');
 need(refs.DisplayInfo, 'DisplayInfo', true);
 const expIds = new Set<string>();
 for (const e of refs.Expressions ?? []) {
 expIds.add(e.Name);
 need(e.File, 'expression ' + e.Name);
 }
 const groups: Record<string, unknown[]> = refs.Motions ?? {};
 for (const [g, list] of Object.entries(groups)) {
 for (const mo of list as Array<{ File?: string }>) need(mo.File, 'motion ' + g);
 }
 const mapFile = path.join(dir, 'motions.json');
 if (!fs.existsSync(mapFile)) {
 res.warnings.push('no motions.json; defaults (src/model/motions.default.json) will be used');
 } else {
 const map = readJson(mapFile, res);
 for (const e of EXPRESSIONS) {
 const id = map?.expressions?.[e];
 if (!id) res.errors.push('motions.json missing expression ' + e);
 else if (!expIds.has(id)) res.errors.push('expression ' + e + ' -> ' + id + ' not in model3.json');
 }
 for (const mo of MOTIONS) {
 const ent = map?.motions?.[mo];
 if (!ent) {
 res.warnings.push('motions.json missing motion ' + mo);
 continue;
 }
 const list = groups[ent.group];
 if (!list) res.errors.push('motion ' + mo + ': group ' + ent.group + ' not in model3.json');
 else if (!Number.isInteger(ent.index) || ent.index < 0 || ent.index >= list.length)
 res.errors.push('motion ' + mo + ': index ' + ent.index + ' out of range for group ' + ent.group);
 }
 }
 if (refs.DisplayInfo && fs.existsSync(path.join(dir, refs.DisplayInfo))) {
 const cdi = readJson(path.join(dir, refs.DisplayInfo), res);
 const ids = new Set<string>((cdi?.Parameters ?? []).map((p: { Id: string }) => p.Id));
 for (const p of PARAMS) if (!ids.has(p)) res.warnings.push('cdi3.json lacks parameter ' + p);
 }
 return res;
}
