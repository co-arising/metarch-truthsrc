#!/usr/bin/env node
// Legacy saga-core 0.2 source emitter. Pure exports never read/write or exit.
// CLI compatibility: node emit.mjs <spec.json> <out.scala> [--legacy]
// Scala fragments in a legacy spec are explicit trusted source, never evaluated.
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { types } from 'node:util';
import { fileURLToPath } from 'node:url';

const phases = ['prepare', 'commit', 'compensate'];
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const qualified = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const reserved = new Set('abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait try true type val var while with yield macro'.split(' '));
const inheritedMembers = new Set('getClass wait notify notifyAll clone finalize equals hashCode toString productArity productElement productIterator productPrefix canEqual copy'.split(' '));
const runtimeNames = new Set('ActorRef RecipientRef Scheduler SagaResult SagaDefinition SagaStep SagaRegistry ArgsCodec ResiliencePolicy ExecutionContext'.split(' '));
const fail = (path, message) => { throw new Error(`legacySagaSpec ${path}: ${message}`); };

// Shared by the local producer/parser: inspect descriptors, never execute getters.
export function assertJsonData(value, path = 'input', ancestors = new Set()) {
  if (ancestors.size > 128) throw new Error(`${path}: JSON nesting exceeds 128`);
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (value !== null && typeof value === 'object' && types.isProxy(value)) throw new Error(`${path}: Proxy input is not plain JSON data`);
  const array = Array.isArray(value);
  if (!value || typeof value !== 'object' || !(array
    ? Object.getPrototypeOf(value) === Array.prototype
    : [Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
    throw new Error(`${path}: expected plain JSON data`);
  }
  if (ancestors.has(value)) throw new Error(`${path}: cyclic JSON data`);
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors).filter((key) => !(array && key === 'length'));
  if (array && (keys.length !== value.length || keys.some((key, i) => key !== String(i)))) {
    throw new Error(`${path}: sparse or non-JSON array`);
  }
  for (const key of keys) {
    const entry = descriptors[key];
    if (typeof key !== 'string' || !entry.enumerable || !Object.hasOwn(entry, 'value')) {
      throw new Error(`${path}: only enumerable JSON data properties are supported`);
    }
    assertJsonData(entry.value, `${path}/${key}`, ancestors);
  }
  ancestors.delete(value);
}

export function stableJson(value) {
  assertJsonData(value);
  return JSON.stringify(stable(value), null, 2) + '\n';
}
function stable(value) {
  return Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
}
function shape(value, path, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected object');
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}/${key}`, 'required field missing');
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail(`${path}/${key}`, 'unsupported field');
}
function text(value, path, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim())) fail(path, 'expected explicit string');
  if (value.includes('???') || /\bTODO\b/.test(value) || /\\u+[0-9a-fA-F]{4}/.test(value)) fail(path, 'unimplemented placeholder or Unicode source escape is not supported');
}
function symbol(value, path, dotted = false) {
  text(value, path);
  if (!(dotted ? qualified : identifier).test(value) || value.split('.').some((part) => reserved.has(part) || part === '_')) fail(path, 'expected Scala identifier');
}
function scalaType(value, path) {
  text(value, path);
  if (value.length > 16384 || /[^\x20-\x7e\t\r\n]/.test(value)) fail(path, 'unsupported Scala type character or length');
  // A deliberately bounded nominal type grammar, not arbitrary Scala syntax.
  const tokens = value.match(/[A-Za-z_][A-Za-z0-9_]*|[.\[\],]/g) ?? [];
  if (tokens.join('') !== value.replace(/\s/g, '')) fail(path, 'unsupported Scala type syntax');
  let i = 0;
  function nominal(depth = 0) {
    if (depth > 128) fail(path, 'Scala type nesting exceeds 128');
    symbol(tokens[i++], path);
    while (tokens[i] === '.') { i++; symbol(tokens[i++], path); }
    if (tokens[i] === '[') {
      i++; nominal(depth + 1);
      while (tokens[i] === ',') { i++; nominal(depth + 1); }
      if (tokens[i++] !== ']') fail(path, 'unclosed Scala type arguments');
    }
  }
  nominal();
  if (i !== tokens.length) fail(path, 'unsupported Scala type syntax');
}
function integer(value, path, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 2147483647) fail(path, `expected integer ${minimum}..2147483647`);
}
function list(value, path, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) fail(path, 'expected explicit array');
}

export function validateLegacySagaSpec(input) {
  assertJsonData(input, 'legacySagaSpec');
  shape(input, '', ['name', 'version', 'package', 'objectName', 'errorType', 'contextType', 'argsType',
    'argsFields', 'mapReply', 'preCheck', 'preCheckError', 'errorCode', 'prelude', 'helpers', 'steps'],
  ['participantRef', 'protocolType']);
  const spec = structuredClone(input);
  for (const key of ['name', 'errorCode']) {
    text(spec[key], `/${key}`);
    if ([...spec[key]].some((ch) => [10, 13, 8232, 8233].includes(ch.codePointAt(0)))) fail(`/${key}`, 'must be single-line');
  }
  integer(spec.version, '/version', 1);
  symbol(spec.package, '/package', true);
  for (const key of ['objectName', 'contextType', 'argsType']) {
    symbol(spec[key], `/${key}`);
    if (runtimeNames.has(spec[key])) fail(`/${key}`, 'generated declaration shadows a runtime API');
  }
  if (new Set([spec.objectName, spec.contextType, spec.argsType]).size !== 3) fail('/', 'generated object/context/args declarations must have distinct names');
  scalaType(spec.errorType, '/errorType');
  symbol(spec.mapReply, '/mapReply', true);
  for (const key of ['preCheck', 'preCheckError', 'prelude', 'helpers']) text(spec[key], `/${key}`, ['prelude', 'helpers'].includes(key));
  if (Object.hasOwn(spec, 'participantRef')) symbol(spec.participantRef, '/participantRef');
  if (Object.hasOwn(spec, 'protocolType')) scalaType(spec.protocolType, '/protocolType');
  list(spec.argsFields, '/argsFields', true);
  const fields = new Set();
  spec.argsFields.forEach((field, i) => {
    const at = `/argsFields/${i}`;
    shape(field, at, ['name', 'type']); symbol(field.name, `${at}/name`); scalaType(field.type, `${at}/type`);
    if (inheritedMembers.has(field.name)) fail(`${at}/name`, 'args field conflicts with an inherited case-class member');
    if (fields.has(field.name)) fail(`${at}/name`, 'duplicate args field');
    fields.add(field.name);
  });
  list(spec.steps, '/steps');
  const ids = new Set(), participants = new Map();
  spec.steps.forEach((step, i) => {
    const at = `/steps/${i}`;
    shape(step, at, ['id', 'group', 'maxRetries', 'phases'], ['participantRef', 'protocolType']);
    text(step.id, `${at}/id`);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(step.id) || ids.has(step.id)) fail(`${at}/id`, 'invalid or duplicate step id');
    ids.add(step.id);
    integer(step.group, `${at}/group`, 1); integer(step.maxRetries, `${at}/maxRetries`, 0);
    // Only explicitly declared defaults are inherited. Never pick the first ref/group.
    step.participantRef = Object.hasOwn(step, 'participantRef') ? step.participantRef
      : Object.hasOwn(spec, 'participantRef') ? spec.participantRef : undefined;
    step.protocolType = Object.hasOwn(step, 'protocolType') ? step.protocolType
      : Object.hasOwn(spec, 'protocolType') ? spec.protocolType : undefined;
    symbol(step.participantRef, `${at}/participantRef`); scalaType(step.protocolType, `${at}/protocolType`);
    if (inheritedMembers.has(step.participantRef)) fail(`${at}/participantRef`, 'context member conflicts with an inherited API');
    if (participants.has(step.participantRef) && participants.get(step.participantRef).replace(/\s/g, '') !== step.protocolType.replace(/\s/g, '')) {
      fail(`${at}/protocolType`, 'conflicting protocol for participantRef');
    }
    participants.set(step.participantRef, step.protocolType);
    shape(step.phases, `${at}/phases`, phases);
    for (const phase of phases) {
      const p = step.phases[phase], pat = `${at}/phases/${phase}`;
      shape(p, pat, ['command', 'replyType', 'commandArgs']);
      symbol(p.command, `${pat}/command`, true); scalaType(p.replyType, `${pat}/replyType`);
      list(p.commandArgs, `${pat}/commandArgs`);
      p.commandArgs.forEach((arg, n) => text(arg, `${pat}/commandArgs/${n}`));
    }
  });
  return spec;
}

export function emitLegacySagaSpec(input) {
  const spec = validateLegacySagaSpec(input);
  const emitPhase = (phase, p, step) => `            .${phase}
              .ref(ctx => ctx.${step.participantRef})
              .command[${p.replyType}]((txId, replyTo) =>
                ${p.command}(${p.commandArgs.join(', ')}))
              .mapReply(${spec.mapReply})`;
  const emitStep = (step) => `          SagaStep
            .builder[${spec.errorType}, ${spec.contextType}](${JSON.stringify(step.id)})
            .inGroup(${step.group})
            .withResilience(ResiliencePolicy(maxRetries = ${step.maxRetries}))
${phases.map((phase) => emitPhase(phase, step.phases[phase], step)).join('\n')}
            .build()`;
  const refs = new Map(spec.steps.map((step) => [step.participantRef, step.protocolType]));
  const typedName = (name) => name.endsWith('_') ? `${name} :` : `${name}:`;
  const context = [...refs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([ref, protocol]) => `  def ${typedName(ref)} RecipientRef[${protocol}]`).join('\n');
  const fields = spec.argsFields.map((f) => `${typedName(f.name)} ${f.type}`).join(', ');
  return `package ${spec.package}

import akka.actor.typed.{ActorRef, RecipientRef, Scheduler}
import net.imadz.infra.saga.SagaParticipant.SagaResult
import net.imadz.infra.saga.dsl._

import scala.concurrent.ExecutionContext

// Generated legacy SagaSpec: ${spec.name} v${spec.version} (not strict runtime certification).
// Generator: generators/saga-dsl/emit.mjs. Do not hand-edit.

final case class ${spec.argsType}(${fields})
object ${spec.argsType} {
  implicit val format: play.api.libs.json.Format[${spec.argsType}] =
    play.api.libs.json.Json.format[${spec.argsType}]
}

${spec.prelude}
/** Context the steps resolve participant refs from. Wired by the app. */
trait ${spec.contextType} {
${context}
}

object ${spec.objectName} {

${spec.helpers}
  /** Built where an ActorSystem is in scope (it provides both implicits). */
  def definition(implicit
      ec: ExecutionContext,
      scheduler: Scheduler
  ): SagaDefinition[${spec.errorType}, ${spec.contextType}, ${spec.argsType}] =
    SagaDefinition[${spec.errorType}, ${spec.contextType}, ${spec.argsType}](
      name = ${JSON.stringify(spec.name)},
      version = ${spec.version},
      argsCodec = ArgsCodec.playJson[${spec.argsType}],
      steps = args =>
        Seq(
${spec.steps.map(emitStep).join(',\n')}
        ),
      preCheck = args =>
        if (${spec.preCheck}) Right(args) else Left(${spec.preCheckError}),
      errorText = e => (${JSON.stringify(spec.errorCode)}, e),
      onResult = (_, _) => Seq.empty
    )

  /** Call once at node startup, before cluster sharding recovers entities. */
  def register()(implicit ec: ExecutionContext, scheduler: Scheduler): Unit =
    SagaRegistry.register(definition)
}
`;
}

export function writeCliOutput(output, content, inputs) {
  const target = resolve(output);
  if (inputs.some(input => resolve(input) === target)) throw new Error('output cannot overwrite a source input');
  for (let path = target; ; path = dirname(path)) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`output crosses a symbolic link: ${path}`);
    if (dirname(path) === path) break;
  }
  if (existsSync(target)) {
    if (!lstatSync(target).isFile() || readFileSync(target, 'utf8') !== content) {
      throw new Error(`output already exists with different content: ${target}`);
    }
  } else writeFileSync(target, content, { flag: 'wx' });
}

export function emitCli(argv = process.argv.slice(2)) {
  if (![2, 3].includes(argv.length) || (argv.length === 3 && argv[2] !== '--legacy') || argv.slice(0, 2).some((arg) => arg.startsWith('--'))) {
    throw new Error('usage: node emit.mjs <spec.json> <out.scala> [--legacy]');
  }
  const [specPath, outPath] = argv;
  const input = JSON.parse(readFileSync(specPath, 'utf8'));
  if (input.schemaVersion === 'truthsrc.saga-ir/v1') {
    throw new Error('SAGA_RUNTIME_BINDING_UNVERIFIED: strict IR is contract-only; no verified runtime API shape is implemented. Use generate(ctx) in strict-contract mode.');
  }
  const out = emitLegacySagaSpec(input); // validate everything before writing
  writeCliOutput(outPath, out, [specPath]);
  console.log(`emitted legacy SagaSpec ${outPath}`);
}

export function isDirectCli(metaUrl) {
  if (!process.argv[1]) return false;
  try { return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(metaUrl)); }
  catch { return false; }
}

if (isDirectCli(import.meta.url)) {
  try { emitCli(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
