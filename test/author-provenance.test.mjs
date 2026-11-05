import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProvenance, validateSourceRefs, resolveSourceRefs } from '../lib/author-provenance.mjs';
import { STAGE_ORDER } from '../lib/shared-pure.mjs';

const VERSION = 'truthsrc.provenance/v1';
const session = (overrides = {}) => ({ id: 'workshop-a', stage: 'eventStorming', ...overrides });
const systemWith = (sessions = [session()]) => ({ provenance: { schemaVersion: VERSION, sessions } });
const docWith = (...sourceRefs) => ({ kind: 'note', sourceRefs });
const rejectRefs = (doc, system, pattern = /AUTHOR_PROVENANCE:/) => {
  assert.throws(() => validateSourceRefs(doc, system, 'notes/example.yaml'), pattern);
  assert.throws(() => resolveSourceRefs(doc, system), pattern);
};

test('legacy documents need no declaration and acquire no fabricated sources', () => {
  const system = { workshop: 'Legacy', sessionOrder: ['eventStorming'] };
  const doc = { kind: 'note', id: 'old-sticky', origin: { stage: 'eventStorming', board: 'board1', seq: 1 },
    payload: { sourceRefs: [{ sessionId: 'opaque-business-data' }], text: 'first line\nsecond line' } };
  const before = structuredClone({ system, doc });
  assert.equal(validateProvenance(system), undefined);
  assert.equal(validateSourceRefs(doc, system, 'legacy.yaml'), undefined);
  assert.deepEqual(resolveSourceRefs(doc, system), []);
  assert.deepEqual({ system, doc }, before);
  assert.equal(Object.hasOwn(system, 'provenance'), false);
  assert.equal(Object.hasOwn(doc, 'sourceRefs'), false);
  assert.equal(Object.isFrozen(system), false);
  assert.equal(Object.isFrozen(doc), false);
});

test('sessions are explicit identities, not unique stages or sessionOrder guesses', () => {
  const sessions = [session(), session({ id: 'workshop-b' }),
    ...STAGE_ORDER.map((stage, index) => session({ id: `meeting-${index}`, stage }))];
  const system = { ...systemWith(sessions), sessionOrder: ['eventStorming'] };
  assert.equal(validateProvenance(system), undefined);
  const doc = docWith({ sessionId: 'workshop-b' }, { sessionId: 'workshop-a' });
  assert.equal(validateSourceRefs(doc, system), undefined);
  assert.deepEqual(resolveSourceRefs(doc, system), [
    { sessionId: 'workshop-b', stage: 'eventStorming', specificity: 'identifier-only', navigation: 'unavailable' },
    { sessionId: 'workshop-a', stage: 'eventStorming', specificity: 'identifier-only', navigation: 'unavailable' },
  ]);
  rejectRefs(docWith({ sessionId: 'eventStorming' }), system, /undeclared session/);
  rejectRefs(docWith({ sessionId: 'workshop-a' }), { sessionOrder: ['eventStorming'] }, /undeclared session/);
  assert.equal(validateProvenance(systemWith([])), undefined);
  rejectRefs(docWith({ sessionId: 'workshop-a' }), systemWith([]), /undeclared session/);
});

test('sourceRefs validation is independent of atom family and domain payload', () => {
  for (const kind of ['note', 'slice', 'aggregate', 'policy', 'value-object', 'read-model', 'story',
    'domain-service', 'use-cases', 'pipeline', 'scenario', 'saga', 'formal-product']) {
    const doc = { kind, payload: { sourceRefs: 'opaque' }, sourceRefs: [{ sessionId: 'workshop-a' }] };
    assert.equal(validateSourceRefs(doc, systemWith(), `${kind}.yaml`), undefined);
    assert.equal(resolveSourceRefs(doc, systemWith()).length, 1);
  }
});

test('declarations reject malformed versions, shapes and unknown fields', () => {
  for (const provenance of [null, [], {}, { sessions: [] }, { schemaVersion: VERSION },
    { schemaVersion: 'truthsrc.provenance/v2', sessions: [] },
    { schemaVersion: 1, sessions: [] }, { schemaVersion: VERSION, sessions: {} },
    { schemaVersion: VERSION, sessions: [], capture: 'invented' }]) {
    assert.throws(() => validateProvenance({ provenance }), /AUTHOR_PROVENANCE:/);
  }
  for (const entry of [null, [], {}, { id: 'workshop-a' }, { stage: 'eventStorming' },
    session({ stage: 'es' }), session({ stage: 'EventStorming' }), session({ stage: 1 }),
    session({ firstTime: true }), session({ uri: 'https://boards.example.invalid/board' })]) {
    assert.throws(() => validateProvenance(systemWith([entry])), /AUTHOR_PROVENANCE:/);
  }
  for (const sites of [null, {}, [], [null], [[]], [{}], [{ provider: 'miro' }],
    [{ boardId: 'board-a' }], [{ provider: 'miro', boardId: 'board-a', itemId: 'sticky-a' }]]) {
    assert.throws(() => validateProvenance(systemWith([session({ sites })])), /AUTHOR_PROVENANCE:/);
  }
  for (const value of [null, [], 'system', 12, false]) {
    assert.throws(() => validateProvenance(value), /AUTHOR_PROVENANCE:/);
    rejectRefs(value, {});
  }
});

test('all authored text fields require nonempty strings without invisible controls', () => {
  const controls = [0, 9, 10, 13, 0x7f, 0x85, 0x200b, 0x200e, 0x2028, 0x2029, 0x202e, 0x2066, 0xfeff];
  const bad = ['', '   ', null, 1, true, {}, [], ...controls.map(code => `a${String.fromCodePoint(code)}b`)];
  for (const value of bad) {
    for (const field of ['id', 'label']) {
      assert.throws(() => validateProvenance(systemWith([session({ [field]: value })])), /AUTHOR_PROVENANCE:/);
    }
    for (const field of ['provider', 'boardId']) {
      const site = { provider: 'miro', boardId: 'board-a', [field]: value };
      assert.throws(() => validateProvenance(systemWith([session({ sites: [site] })])), /AUTHOR_PROVENANCE:/);
    }
    rejectRefs(docWith({ sessionId: value }), systemWith());
    rejectRefs(docWith({ sessionId: 'workshop-a', itemId: value }), systemWith());
  }
});

test('session IDs and per-session site tuples must be unique without global site deduplication', () => {
  assert.throws(() => validateProvenance(systemWith([session(), session({ stage: 'refining' })])), /duplicate session id/);
  const site = { provider: 'miro', uri: 'https://boards.example.invalid/board', boardId: 'board-a' };
  assert.throws(() => validateProvenance(systemWith([session({ sites: [site,
    { boardId: site.boardId, uri: site.uri, provider: site.provider }] })])), /duplicate site/);
  assert.throws(() => validateProvenance(systemWith([session({ sites: [
    { provider: 'miro', boardId: 'board-a' }, { boardId: 'board-a', provider: 'miro' },
  ] })])), /duplicate site/);
  assert.equal(validateProvenance(systemWith([session({ sites: [site, { ...site, boardId: 'board-b' },
    { ...site, provider: 'archive' }, { provider: site.provider, uri: site.uri }] }),
  session({ id: 'workshop-b', sites: [site] })])), undefined);
});

test('sourceRefs reject malformed rows, unknown keys, missing sessions and duplicate full triples', () => {
  for (const sourceRefs of [null, {}, [], 'workshop-a', [null], [[]], [{}],
    [{ sessionId: 'absent' }], [{ sessionId: 'workshop-a', stage: 'eventStorming' }],
    [{ sessionId: 'workshop-a', provider: 'miro' }], [{ sessionId: 'workshop-a', firstTime: true }]]) {
    rejectRefs({ sourceRefs }, systemWith());
  }
  const ref = { sessionId: 'workshop-a', itemId: 'sticky-a', uri: 'https://boards.example.invalid/item/a' };
  rejectRefs(docWith(ref, { uri: ref.uri, itemId: ref.itemId, sessionId: ref.sessionId }), systemWith(), /duplicate source reference/);
  rejectRefs(docWith({ sessionId: 'workshop-a' }, { sessionId: 'workshop-a' }), systemWith(), /duplicate source reference/);
  const distinct = docWith({ sessionId: 'workshop-a' }, { sessionId: 'workshop-a', itemId: 'sticky-a' },
    { sessionId: 'workshop-a', uri: ref.uri }, ref, { ...ref, itemId: 'sticky-b' },
    { ...ref, uri: ref.uri + '?revision=2' }, { ...ref, sessionId: 'workshop-b' });
  const system = systemWith([session(), session({ id: 'workshop-b' })]);
  assert.equal(validateSourceRefs(distinct, system), undefined);
  assert.equal(resolveSourceRefs(distinct, system).length, distinct.sourceRefs.length);
  assert.throws(() => validateSourceRefs(docWith({ sessionId: 'absent' }), system, 'sagas/example.saga.yaml'),
    /sagas\/example\.saga\.yaml\.sourceRefs\[0\]\.sessionId/);
});

test('both URI carriers reject unsafe schemes, userinfo and parser-repaired inputs', () => {
  const bad = ['', ' ', null, 1, 'javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/board',
    'ftp://boards.example.invalid/board', 'mailto:someone@example.invalid', '/relative', '//boards.example.invalid/board',
    'https://', 'https://[invalid', 'https:boards.example.invalid/board', 'https:/boards.example.invalid/board',
    'https:///boards.example.invalid/board', 'urn:', 'urn:example', 'urn:example:',
    'https://user@boards.example.invalid/board', 'https://user:password@boards.example.invalid/board',
    'https://:password@boards.example.invalid/board', 'https://@boards.example.invalid/board',
    'https://%75ser@boards.example.invalid/board', 'urn://user:password@boards.example.invalid/board',
    ' https://boards.example.invalid/board', 'https://boards.example.invalid/board ',
    'https://boards.example.invalid/a b', 'https://boards.example.invalid/a\\b',
    'https://boards.example.invalid/%', 'https://boards.example.invalid/%xy'];
  for (const code of [0, 9, 10, 13, 0x7f, 0x85, 0x200b, 0x2028, 0x202e, 0x2066, 0xfeff]) {
    bad.push(`https://boards.example.invalid/a${String.fromCodePoint(code)}b`);
  }
  for (const uri of bad) {
    assert.throws(() => validateProvenance(systemWith([session({ sites: [{ provider: 'miro', uri }] })])),
      /AUTHOR_PROVENANCE:/, String(uri));
    rejectRefs(docWith({ sessionId: 'workshop-a', uri }), systemWith());
  }
});

test('HTTP, HTTPS and URN text stays verbatim rather than normalized or fetched', () => {
  for (const uri of ['HTTPS://BOARDS.EXAMPLE.INVALID:443/a/../Board?item=%2f#Sticky',
    'http://boards.example.invalid:80/board?x=1&y=2', 'urn:example:board:original']) {
    const system = systemWith([session({ sites: [{ provider: 'declared-provider', uri }] })]);
    assert.equal(validateProvenance(system), undefined);
    const board = resolveSourceRefs(docWith({ sessionId: 'workshop-a' }), system);
    assert.equal(board[0].uri, uri);
    assert.equal(board[0].specificity, 'board');
    assert.equal(board[0].navigation, 'available');
    const point = resolveSourceRefs(docWith({ sessionId: 'workshop-a', uri }), systemWith());
    assert.deepEqual(point, [{ sessionId: 'workshop-a', stage: 'eventStorming', uri,
      specificity: 'item', navigation: 'available' }]);
  }
});

test('site identifiers and item IDs alone never acquire navigable or direct-item URIs', () => {
  const system = systemWith([
    session({ label: 'Initial discussion' }),
    session({ id: 'workshop-b', sites: [{ provider: 'miro', boardId: 'board-b' }] }),
    session({ id: 'workshop-c', stage: 'refining', sites: [
      { provider: 'miro', boardId: 'board-c', uri: 'https://boards.example.invalid/c' },
    ] }),
  ]);
  const rows = resolveSourceRefs(docWith({ sessionId: 'workshop-a', itemId: 'sticky-a' },
    { sessionId: 'workshop-b', itemId: 'sticky-b' }, { sessionId: 'workshop-c', itemId: 'sticky-c' }), system);
  assert.deepEqual(rows, [
    { sessionId: 'workshop-a', stage: 'eventStorming', label: 'Initial discussion', itemId: 'sticky-a',
      specificity: 'identifier-only', navigation: 'unavailable' },
    { sessionId: 'workshop-b', stage: 'eventStorming', itemId: 'sticky-b', provider: 'miro', boardId: 'board-b',
      specificity: 'identifier-only', navigation: 'unavailable' },
    { sessionId: 'workshop-c', stage: 'refining', itemId: 'sticky-c', provider: 'miro', boardId: 'board-c',
      uri: 'https://boards.example.invalid/c', specificity: 'board', navigation: 'available' },
  ]);
});

test('multiple refs and sites return every location in authored order without precedence', () => {
  const sites = [
    { provider: 'archive', boardId: 'offline' },
    { provider: 'miro', uri: 'https://boards.example.invalid/a', boardId: 'board-a' },
    { provider: 'archive', uri: 'urn:example:archived-board' },
  ];
  const system = systemWith([session({ sites }), session({ id: 'workshop-b', stage: 'refining' })]);
  const refs = [{ sessionId: 'workshop-b' }, { sessionId: 'workshop-a', itemId: 'sticky-b' },
    { sessionId: 'workshop-a', itemId: 'sticky-a' }, { sessionId: 'workshop-a' }];
  const expected = [{ sessionId: 'workshop-b', stage: 'refining', specificity: 'identifier-only', navigation: 'unavailable' }];
  for (const ref of refs.slice(1)) for (const site of sites) expected.push({ ...ref, stage: 'eventStorming', ...site,
    specificity: site.uri ? 'board' : 'identifier-only', navigation: site.uri ? 'available' : 'unavailable' });
  const rows = resolveSourceRefs(docWith(...refs), system);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows, expected);
});

test('explicit reference URIs produce one row with only unambiguous provider metadata', () => {
  const uri = 'https://independent.example.invalid/point';
  const ref = { sessionId: 'workshop-a', itemId: 'sticky-a', uri };
  const base = { ...ref, stage: 'eventStorming', label: 'Review', specificity: 'item', navigation: 'available' };
  for (const sites of [
    [{ provider: 'miro', boardId: 'board-a' }],
    [{ provider: 'miro', boardId: 'board-a' }, { provider: 'miro', uri: 'https://boards.example.invalid/b' }],
  ]) {
    assert.deepEqual(resolveSourceRefs(docWith(ref), systemWith([session({ label: 'Review', sites })])),
      [{ ...base, provider: 'miro' }]);
  }
  assert.deepEqual(resolveSourceRefs(docWith(ref), systemWith([session({ label: 'Review', sites: [
    { provider: 'miro', uri }, { provider: 'archive', boardId: 'other-board' },
  ] })])), [base]);
  assert.deepEqual(resolveSourceRefs(docWith(ref), systemWith([session({ label: 'Review' })])), [base]);
});

test('validation and resolution reject non-JSON data before executing accessors or proxy traps', () => {
  const invalid = [() => undefined, () => new Date(), () => new Map(), () => new Set(),
    () => Object.create({ inherited: true }), () => ({ other: undefined }), () => ({ other: NaN }),
    () => ({ other: Infinity }), () => ({ other: 1n }), () => ({ other() {} }),
    () => ({ [Symbol('secret')]: true }), () => Object.defineProperty({}, 'hidden', { value: true }),
    () => ({ other: new Array(2) }), () => { const value = {}; value.cycle = value; return value; }];
  for (const build of invalid) {
    assert.throws(() => validateProvenance(build()), /AUTHOR_PROVENANCE:/);
    rejectRefs(build(), {});
  }
  let executed = 0;
  const getterSystem = Object.defineProperty({}, 'provenance', { enumerable: true, get() { executed++; return {}; } });
  const getterDoc = Object.defineProperty({}, 'sourceRefs', { enumerable: true, get() { executed++; return []; } });
  assert.throws(() => validateProvenance(getterSystem), /enumerable data properties/);
  rejectRefs({}, getterSystem, /enumerable data properties/);
  rejectRefs(getterDoc, {}, /enumerable data properties/);
  const proxy = new Proxy({}, {
    get() { executed++; throw new Error('get trap'); },
    ownKeys() { executed++; throw new Error('ownKeys trap'); },
    getPrototypeOf() { executed++; throw new Error('prototype trap'); },
  });
  assert.throws(() => validateProvenance(proxy), /plain JSON data/);
  rejectRefs(proxy, {}, /plain JSON data/);
  rejectRefs({}, { provenance: proxy }, /plain JSON data/);
  assert.equal(executed, 0);
});

test('null-prototype JSON records are accepted and reserved-looking IDs are not object keys', () => {
  const system = Object.assign(Object.create(null), systemWith([
    Object.assign(Object.create(null), session({ id: '__proto__' })), session({ id: 'constructor' }),
  ]));
  const doc = Object.assign(Object.create(null), docWith(
    Object.assign(Object.create(null), { sessionId: '__proto__' }), { sessionId: 'constructor' }));
  assert.equal(validateProvenance(system), undefined);
  assert.equal(validateSourceRefs(doc, system), undefined);
  assert.deepEqual(resolveSourceRefs(doc, system).map(row => row.sessionId), ['__proto__', 'constructor']);
});

test('inputs stay mutable and unchanged; returned rows are detached immutable JSON data', () => {
  const system = systemWith([session({ label: 'Original', sites: [
    { provider: 'miro', boardId: 'board-a', uri: 'https://boards.example.invalid/a' },
  ] })]);
  const doc = docWith({ sessionId: 'workshop-a', itemId: 'sticky-a' });
  const before = structuredClone({ system, doc });
  validateProvenance(system);
  validateSourceRefs(doc, system);
  const rows = resolveSourceRefs(doc, system);
  assert.deepEqual({ system, doc }, before);
  for (const value of [system, system.provenance, system.provenance.sessions, system.provenance.sessions[0],
    system.provenance.sessions[0].sites, system.provenance.sessions[0].sites[0], doc, doc.sourceRefs, doc.sourceRefs[0]]) {
    assert.equal(Object.isFrozen(value), false);
  }
  assert.equal(Object.isFrozen(rows), true);
  assert.equal(Object.isFrozen(rows[0]), true);
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), rows);
  system.provenance.sessions[0].label = 'Changed';
  system.provenance.sessions[0].sites[0].uri = 'https://boards.example.invalid/changed';
  doc.sourceRefs[0].itemId = 'changed';
  assert.equal(rows[0].label, 'Original');
  assert.equal(rows[0].uri, 'https://boards.example.invalid/a');
  assert.equal(rows[0].itemId, 'sticky-a');
  assert.throws(() => { rows[0].uri = 'changed'; }, TypeError);
});
