import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { emitAtom } from '../lib/shared.mjs';

const atom = (type, name, seq, payload, stage = 'eventStorming') =>
  emitAtom({ kind: 'note', type, name, origin: { stage, board: 'board1', seq }, payload });

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-test-'));
  mkdirSync(join(dir, 'inbox', 'eventStorming'), { recursive: true });
  return dir;
}

test('golden example: roundtrip identity holds', () => {
  const r = roundtrip(join(import.meta.dirname, '..', 'example', 'tree'));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.atoms, 8); // 7 notes + workshop.yaml is not an atom; 7 notes → walk counts yaml in inbox only
});

test('canonical is deterministic and orders by seq', () => {
  const dir = scratch();
  const p = (n) => ({ type: 'event', name: n, stage: 'eventStorming', description: `desc of ${n}`, info: { timeline: 'T' }, links: [] });
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-bsecond-1.yaml'), atom('event', 'BSecond', 1, p('BSecond')));
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-afirst-0.yaml'), atom('event', 'AFirst', 0, p('AFirst')));
  const c = JSON.parse(compileTree(dir));
  assert.deepEqual(c.sessions[0].scopes[0].notes.map((n) => n.name), ['AFirst', 'BSecond']);
  const again = compileTree(dir);
  assert.equal(compileTree(dir), again); // I1 byte-deterministic
});

test('roundtrip: regenerating the tree from canonical is byte-identical (I2)', () => {
  const dir = scratch();
  writeFileSync(join(dir, 'workshop.yaml'), 'schemaVersion: truthsrc/v0\nname: demo\n');
  const payload = { type: 'event', name: 'X', stage: 'eventStorming', description: 'd', info: { timeline: 'T', sequence: 0, step: 0 }, links: [], nested: { a: [1, 2, { b: 'c' }] } };
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-x-0.yaml'), atom('event', 'X', 0, payload));
  const canonical = compileTree(dir);
  const dir2 = scratch();
  decomposeCanonical(canonical, dir2);
  assert.equal(readFileSync(join(dir2, 'inbox/eventStorming/event-es-x-0.yaml'), 'utf8'),
              readFileSync(join(dir, 'inbox/eventStorming/event-es-x-0.yaml'), 'utf8'));
  assert.equal(compileTree(dir2), canonical);
});

test('rules fire: ES1/ES2/ES5 hard, ES3/ES4 notice', () => {
  const dir = scratch();
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-bad1-0.yaml'),
    atom('event', 'Bad1', 0, { type: 'event', name: 'Bad1', stage: 'eventStorming', description: '', info: {}, links: [] }));
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-updatedthing-1.yaml'),
    atom('event', 'UpdatedThing', 1, { type: 'event', name: 'UpdatedThing', stage: 'eventStorming', description: 'has desc', info: { timeline: 'T' }, links: [] }));
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-bad1-2.yaml'),
    atom('event', 'Bad1', 2, { type: 'event', name: 'Bad1', stage: 'eventStorming', description: 'dup name', info: { timeline: 'T' }, links: [] }));
  writeFileSync(join(dir, 'inbox/eventStorming/question-es-dangling-3.yaml'),
    atom('question', 'Dangling', 3, { type: 'question', name: 'Dangling', stage: 'eventStorming', description: 'q', info: {}, links: ['command:DoSomething'] }));
  const { hard, notices } = validateTree(dir);
  const rules = hard.map((h) => h.slice(1, 4));
  assert.ok(rules.includes('ES1'), 'ES1 fires on empty description');
  assert.ok(rules.includes('ES2'), 'ES2 fires on missing timeline');
  assert.ok(rules.includes('ES5'), 'ES5 fires on question without event link');
  assert.equal(hard.filter((h) => h.startsWith('[ES3]')).length, 0, 'ES3 is notice, not hard');
  assert.ok(notices.some((n) => n.startsWith('[ES3]')), 'ES3 notice on duplicate name');
  assert.ok(notices.some((n) => n.startsWith('[ES4]')), 'ES4 notice on solution verb');
});

test('structure: seq collision and non-contiguous seqs are hard', () => {
  const dir = scratch();
  const p = (n) => ({ type: 'event', name: n, stage: 'eventStorming', description: 'd', info: { timeline: 'T' }, links: [] });
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-a-0.yaml'), atom('event', 'A', 0, p('A')));
  writeFileSync(join(dir, 'inbox/eventStorming/event-es-a-0-dup.yaml'), atom('event', 'A', 0, p('A')));
  const { hard } = validateTree(dir);
  assert.ok(hard.some((h) => h.startsWith('[V2]') && h.includes('collision')));
  const dir2 = scratch();
  writeFileSync(join(dir2, 'inbox/eventStorming/event-es-a-1.yaml'), atom('event', 'A', 1, p('A')));
  const r2 = validateTree(dir2);
  assert.ok(r2.hard.some((h) => h.startsWith('[V2]') && h.includes('contiguous')));
});

test('decompose is a total inverse: unknown stage rejected', () => {
  const dir = scratch();
  assert.throws(() => decomposeCanonical(JSON.stringify({ schemaVersion: 'truthsrc/v0', workshop: 'w', sessions: [{ session: 'nope', scopes: [] }] }), dir));
  const atoms = readdirSync(join(dir, 'inbox', 'eventStorming'));
  assert.equal(atoms.length, 0, 'no atom written for unknown stage');
});
