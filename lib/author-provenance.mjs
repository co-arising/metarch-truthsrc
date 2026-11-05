import { copyImmutableData } from './immutable-data.mjs';
import { STAGE_ORDER } from './shared-pure.mjs';

const VERSION = 'truthsrc.provenance/v1';
const fail = message => { throw new Error('AUTHOR_PROVENANCE: ' + message); };
const copy = (value, label) => copyImmutableData(value, label, (at, message) => fail(at + ': ' + message));
const object = (value, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(label + ': object required');
};
const exact = (value, required, optional, label) => {
  object(value, label);
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
    fail(label + ': unknown or missing field');
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
    fail(label + ': nonempty text without control characters required');
};
function uri(value, label) {
  text(value, label);
  // URL parsing must not silently repair whitespace, backslashes or userinfo.
  if (/[\s\\]/u.test(value) || /%(?![0-9a-f]{2})/i.test(value)) fail(label + ': unsafe or malformed URI');
  let parsed;
  try { parsed = new URL(value); } catch { fail(label + ': absolute HTTP, HTTPS or URN URI required'); }
  if (!['https:', 'http:', 'urn:'].includes(parsed.protocol) || parsed.username || parsed.password)
    fail(label + ': unsafe URI scheme or userinfo');
  if (parsed.protocol === 'urn:') {
    if (!/^urn:[a-z0-9][a-z0-9-]*:[^?#]+/i.test(value)) fail(label + ': URN namespace and identifier required');
  } else {
    const authority = /^https?:\/\/([^/?#]+)/i.exec(value)?.[1];
    if (!authority || !parsed.hostname || authority.includes('@')) fail(label + ': HTTP authority without userinfo required');
  }
}
function readSessions(system) {
  const data = copy(system, 'system');
  object(data, 'system');
  const sessions = new Map();
  if (!Object.hasOwn(data, 'provenance')) return sessions;
  const declaration = data.provenance;
  exact(declaration, ['schemaVersion', 'sessions'], [], 'system.provenance');
  if (declaration.schemaVersion !== VERSION) fail('system.provenance: unsupported schemaVersion');
  if (!Array.isArray(declaration.sessions)) fail('system.provenance.sessions: array required');
  declaration.sessions.forEach((session, index) => {
    const at = `system.provenance.sessions[${index}]`;
    exact(session, ['id', 'stage'], ['label', 'sites'], at);
    text(session.id, at + '.id');
    if (!STAGE_ORDER.includes(session.stage)) fail(at + '.stage: known stage required');
    if (sessions.has(session.id)) fail(at + '.id: duplicate session id');
    if (Object.hasOwn(session, 'label')) text(session.label, at + '.label');
    if (Object.hasOwn(session, 'sites')) {
      if (!Array.isArray(session.sites) || !session.sites.length) fail(at + '.sites: nonempty array required');
      const seen = new Set();
      session.sites.forEach((site, index) => {
        const location = `${at}.sites[${index}]`;
        exact(site, ['provider'], ['uri', 'boardId'], location);
        text(site.provider, location + '.provider');
        if (!Object.hasOwn(site, 'uri') && !Object.hasOwn(site, 'boardId')) fail(location + ': uri or boardId required');
        if (Object.hasOwn(site, 'uri')) uri(site.uri, location + '.uri');
        if (Object.hasOwn(site, 'boardId')) text(site.boardId, location + '.boardId');
        const key = JSON.stringify([site.provider, site.uri ?? null, site.boardId ?? null]);
        if (seen.has(key)) fail(location + ': duplicate site');
        seen.add(key);
      });
    }
    sessions.set(session.id, session);
  });
  return sessions;
}
function readRefs(doc, system, file) {
  const data = copy(doc, file);
  object(data, file);
  const sessions = readSessions(system);
  if (!Object.hasOwn(data, 'sourceRefs')) return { refs: [], sessions };
  const refs = data.sourceRefs, at = file + '.sourceRefs';
  if (!Array.isArray(refs) || !refs.length) fail(at + ': nonempty array required');
  const seen = new Set();
  refs.forEach((ref, index) => {
    const location = `${at}[${index}]`;
    exact(ref, ['sessionId'], ['itemId', 'uri'], location);
    text(ref.sessionId, location + '.sessionId');
    if (!sessions.has(ref.sessionId)) fail(location + '.sessionId: undeclared session ' + ref.sessionId);
    if (Object.hasOwn(ref, 'itemId')) text(ref.itemId, location + '.itemId');
    if (Object.hasOwn(ref, 'uri')) uri(ref.uri, location + '.uri');
    const key = JSON.stringify([ref.sessionId, ref.itemId ?? null, ref.uri ?? null]);
    if (seen.has(key)) fail(location + ': duplicate source reference');
    seen.add(key);
  });
  return { refs, sessions };
}

export function validateProvenance(system) {
  readSessions(system);
}

export function validateSourceRefs(doc, system, file = '<atom>') {
  readRefs(doc, system, file);
}

export function resolveSourceRefs(doc, system) {
  const { refs, sessions } = readRefs(doc, system, '<atom>');
  const rows = refs.flatMap(ref => {
    const session = sessions.get(ref.sessionId);
    const base = { sessionId: ref.sessionId, stage: session.stage };
    if (Object.hasOwn(session, 'label')) base.label = session.label;
    if (Object.hasOwn(ref, 'itemId')) base.itemId = ref.itemId;
    const sites = session.sites || [];
    // An explicit point is one row; never infer its provider from the URI or
    // associate it with an arbitrary board when the session has several sites.
    if (Object.hasOwn(ref, 'uri')) {
      const providers = new Set(sites.map(site => site.provider));
      return [{ ...base, uri: ref.uri, ...(providers.size === 1 ? { provider: sites[0].provider } : {}),
        specificity: 'item', navigation: 'available' }];
    }
    if (!sites.length) return [{ ...base, specificity: 'identifier-only', navigation: 'unavailable' }];
    // itemId alone does not turn a board URI into a direct item link.
    return sites.map(site => ({ ...base, ...site,
      specificity: Object.hasOwn(site, 'uri') ? 'board' : 'identifier-only',
      navigation: Object.hasOwn(site, 'uri') ? 'available' : 'unavailable' }));
  });
  return copy(rows, 'resolvedSourceRefs');
}
