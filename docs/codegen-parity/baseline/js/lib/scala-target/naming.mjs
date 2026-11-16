import { copyImmutableData } from '../immutable-data.mjs';
import { array, at, fail, object, text } from '../products/request.mjs';
import { targetProfile } from './profiles.mjs';

const keywords = new Set(('abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait try true type val var while with yield macro').split(' '));
const spaces = new Set(['scala-type', 'scala-member', 'scala-package', 'knowledge', 'sql', 'protobuf', 'wire', 'persistence', 'operation', 'codec']);
const portableReserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const fields = ['knowledgeId', 'scope', 'space', 'spelling', 'binding', 'prefix', 'suffix'];
const portableKey = value => value.normalize('NFC').toLowerCase();
const ownLocation = spec => at('target', '/' + spec.space);

export function targetData(value) {
  return copyImmutableData(value, '', (pointer, message) => fail('TARGET_INPUT', message, at('target', pointer)));
}
function scalar(value, location) {
  text(value, location);
  if (!value.isWellFormed() || /[\x00-\x1f\x7f]/u.test(value)) fail('TARGET_TEXT', 'well-formed text without control characters is required', location);
  return value;
}
function packageName(value, location) {
  scalar(value, location);
  if (value.length > 240 || value.split('.').some(part => !/^[a-z][a-z0-9_]*$/.test(part) || keywords.has(part) || portableReserved.test(part)))
    fail('TARGET_PACKAGE', 'explicit lowercase, non-keyword, portable package segments are required', location);
  return value;
}
function scalaName(value, space, policy, location) {
  scalar(value, location);
  if (value.length > 160 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) || value === '_' ||
      policy === 'camel-ascii' && (space === 'scala-type' ? !/^[A-Z][A-Za-z0-9]*$/.test(value) : !/^[a-z][A-Za-z0-9]*$/.test(value)))
    fail('TARGET_SCALA_NAME', 'an unescaped target identifier matching the selected naming contract is required', location);
  if (portableReserved.test(value)) fail('TARGET_PORTABLE_NAME', 'identifier is reserved on portable filesystems', location);
  return value;
}
function words(value, location) {
  scalar(value, location);
  if (!/^[A-Za-z][A-Za-z0-9_ -]*$/.test(value))
    fail('TARGET_NAME_BINDING', 'unsupported automatic spelling requires an explicit ASCII Scala binding', location);
  return value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_ -]+/).filter(Boolean).map(word => word.toLowerCase());
}
function resolve(spec, profile) {
  object(spec, fields, at('target'));
  scalar(spec.knowledgeId, at('target', '/knowledgeId')); scalar(spec.scope, at('target', '/scope'));
  if (!spaces.has(spec.space)) fail('TARGET_NAME_SPACE', 'unknown target name space');
  const location = ownLocation(spec);
  scalar(spec.spelling, location);
  if (spec.binding !== null) scalar(spec.binding, location);
  for (const affix of [...array(spec.prefix, location), ...array(spec.suffix, location)]) scalar(affix, location);
  let name, identifier = null;
  if (profile.stableIdentities.includes(spec.space)) {
    if (spec.binding !== null || spec.prefix.length || spec.suffix.length || spec.space === 'knowledge' && spec.spelling !== spec.knowledgeId)
      fail('TARGET_STABLE_IDENTITY', 'stable values must be explicit and cannot be renamed or composed', location);
    name = spec.spelling;
  } else if (spec.space === 'scala-package') {
    if (spec.binding === null) fail('TARGET_BINDING_REQUIRED', 'package binding is required', location);
    if (spec.prefix.length || spec.suffix.length) fail('TARGET_BINDING_AFFIX', 'a package binding is complete', location);
    name = packageName(spec.binding, location); identifier = name;
  } else {
    if (spec.binding !== null) {
      if (spec.prefix.length || spec.suffix.length) fail('TARGET_BINDING_AFFIX', 'an explicit binding is the complete target name', location);
      name = spec.binding;
    } else {
      if (profile.naming === 'explicit-compatible') fail('TARGET_BINDING_REQUIRED', 'compatibility requires the existing complete Scala name', location);
      const base = words(spec.spelling, location), prefix = spec.prefix.flatMap(part => words(part, location)), suffix = spec.suffix.flatMap(part => words(part, location));
      if (prefix.length && base.slice(0, prefix.length).join(' ') === prefix.join(' ') ||
          suffix.length && base.slice(-suffix.length).join(' ') === suffix.join(' '))
        fail('TARGET_REDUNDANT_AFFIX', 'a repeated technical affix requires an explicit complete binding', location);
      const parts = [...prefix, ...base, ...suffix];
      name = parts.map((part, i) => i === 0 && spec.space === 'scala-member' ? part : part[0].toUpperCase() + part.slice(1)).join('');
    }
    scalaName(name, spec.space, profile.naming, location);
    identifier = keywords.has(name) ? '`' + name + '`' : name;
  }
  return targetData({ ...spec, profile: profile.id, name, identifier });
}

export function resolveName(raw) {
  const spec = targetData(raw);
  object(spec, ['profile', ...fields], at('target'));
  const { profile, ...value } = spec;
  return resolve(value, targetProfile(profile));
}
function collisionKey(value) {
  const spelling = ['scala-type', 'scala-package'].includes(value.space) ? portableKey(value.name) : value.name;
  return JSON.stringify([value.scope, value.space, spelling]);
}
export function resolveNameSet(raw) {
  const input = targetData(raw);
  object(input, ['profile', 'names', 'reserved'], at('target'));
  const profile = targetProfile(input.profile), seen = new Map(), reserved = new Map();
  for (const value of array(input.reserved, at('target', '/reserved'))) {
    object(value, ['scope', 'space', 'name', 'reason'], at('target', '/reserved'));
    scalar(value.scope, at('target')); scalar(value.name, at('target')); scalar(value.reason, at('target'));
    if (!spaces.has(value.space)) fail('TARGET_NAME_SPACE', 'unknown reserved name space');
    if (['scala-type', 'scala-member'].includes(value.space)) scalaName(value.name, value.space, profile.naming, at('target', '/reserved'));
    if (value.space === 'scala-package') packageName(value.name, at('target', '/reserved'));
    const key = collisionKey(value);
    if (reserved.has(key)) fail('TARGET_NAME_RESERVED', 'duplicate reserved target name');
    reserved.set(key, value);
  }
  const result = array(input.names, at('target', '/names')).map(value => resolve(value, profile));
  for (const value of result) {
    const key = collisionKey(value), prior = seen.get(key), reservation = reserved.get(key);
    if (reservation) fail('TARGET_NAME_RESERVED', reservation.reason, ownLocation(value), [value, reservation]);
    if (prior) fail('TARGET_NAME_COLLISION', 'distinct declarations resolve to the same scoped or portable name', ownLocation(value), [prior, value]);
    seen.set(key, value);
  }
  return targetData(result);
}

export function resolveArtifactPath(raw) {
  const spec = targetData(raw);
  object(spec, ['profile', 'module', 'packageName', 'typeName'], at('target'));
  const profile = targetProfile(spec.profile), module = profile.modules.find(module => module.id === spec.module);
  if (!module) fail('TARGET_MODULE', 'module is not part of the selected target contract');
  packageName(spec.packageName, at('target', '/packageName'));
  scalaName(spec.typeName, 'scala-type', profile.naming, at('target', '/typeName'));
  return module.sourceRoot + '/' + spec.packageName.replaceAll('.', '/') + '/' + spec.typeName + '.scala';
}
