#!/usr/bin/env node
// tool-gate-implementation (family 25) generator: emits the user-approved golden
// shape. Ruled invariants (2026-11-19): the implementation mirrors the FULL gate
// ABI (the raw first-method-only/Nil-params defect is never reproduced); every
// method body is a MANUAL block carrying a sealed-binding delegation
// (lift(runner.run(ProcessRequest(script, argument, timeoutMs))))(Owner.decode) —
// the raw no-helper ??? slot and free-form defaultBody strings are raw-only and
// rejected here; the runner is a supplied handwritten lib and is never emitted.
// Acceptance is byte comparison against the approved golden bundle, never a
// self-declared pass.
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('FORMAL_INPUT', `${what} must be nonempty text`);
  return value;
};
const fieldsOf = (record, names, what) => {
  const missing = names.filter(n => !(n in record));
  if (missing.length) fail('FORMAL_INPUT', `${what} missing fields: ${missing.join(', ')}`);
};
const bannedField = (record, name, what) => {
  if (name in record) fail('FORMAL_INPUT', `${what}.${name} is a raw-only slot and is not a target form (2026-11-19 ruling)`);
};
const pascal = (value, what) => {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) fail('FORMAL_INPUT', `${what} must be PascalCase`);
  return value;
};
const lowerCamel = (value, what) => {
  if (!/^[a-z][A-Za-z0-9]*$/.test(value)) fail('FORMAL_INPUT', `${what} must be lowerCamelCase`);
  return value;
};
const mechanismVocabulary = /script|command|process|binary|executable/i;

function checkInput(input) {
  fieldsOf(input, ['schemaVersion', 'basePackage', 'impl'], 'input');
  if (input.schemaVersion !== 'truthsrc.tool-gate-implementation-input/v1')
    {fail('FORMAL_INPUT', 'unsupported schemaVersion');}
  text(input.basePackage, 'basePackage');
  if (!input.basePackage.split('.').every(part => /^[a-z][a-zA-Z0-9]*$/.test(part)))
    {fail('FORMAL_INPUT', 'basePackage must be dotted lowercase-root segments');}
  const impl = input.impl;
  fieldsOf(impl, ['name', 'gate', 'runner', 'doc', 'methods'], 'impl');
  pascal(impl.name, 'impl.name');
  const gate = impl.gate;
  fieldsOf(gate, ['name'], 'impl.gate');
  pascal(gate.name, 'impl.gate.name');
  const runner = impl.runner;
  fieldsOf(runner, ['trait', 'request', 'runMethod', 'paramName'], 'impl.runner');
  pascal(runner.trait, 'impl.runner.trait');
  pascal(runner.request, 'impl.runner.request');
  text(runner.runMethod, 'impl.runner.runMethod');
  lowerCamel(runner.paramName, 'impl.runner.paramName');
  fieldsOf(impl.doc, ['title', 'notes'], 'impl.doc');
  if (!Array.isArray(impl.doc.notes) || impl.doc.notes.length === 0)
    {fail('FORMAL_INPUT', 'impl.doc.notes must be a nonempty array');}
  if (!Array.isArray(impl.methods) || impl.methods.length === 0)
    {fail('FORMAL_INPUT', 'impl.methods must be a nonempty array; the implementation mirrors the FULL gate ABI');}
  const paramNames = new Set();
  for (const method of impl.methods) {
    bannedField(method, 'defaultBody', `gate method ${method.name}`);
    bannedField(method, 'fallback', `gate method ${method.name}`);
    fieldsOf(method, ['name', 'params', 'resultType', 'manual'], 'gate method');
    text(method.name, 'gate method name');
    if (!Array.isArray(method.params)) fail('FORMAL_INPUT', 'gate method params must be an array');
    text(method.resultType, `gate method ${method.name} resultType`);
    const manual = method.manual;
    fieldsOf(manual, ['body'], `gate method ${method.name} manual`);
    if (manual.body !== 'sealed-binding')
      {fail('FORMAL_INPUT', `gate method ${method.name} manual.body must be "sealed-binding"; every other slot is raw-only`);}
    for (const param of method.params) {
      fieldsOf(param, ['name', 'typeRef'], 'gate method param');
      text(param.name, 'param name');
      if (mechanismVocabulary.test(param.name) || mechanismVocabulary.test(param.typeRef.name || ''))
        {fail('FORMAL_INPUT', `param ${param.name} carries mechanism vocabulary; the gate face is business-only (2026-11-19 ruling)`);}
      fieldsOf(param.typeRef, ['name', 'packageName'], 'param typeRef');
      text(param.typeRef.name, 'param typeRef name');
      text(param.typeRef.packageName, 'param typeRef packageName');
      if (paramNames.has(param.name)) fail('FORMAL_INPUT', `duplicate param name ${param.name}`);
      paramNames.add(param.name);
    }
    const binding = manual;
    fieldsOf(binding, ['script', 'argument', 'timeoutMs', 'vals', 'decoder'], `gate method ${method.name} manual`);
    text(binding.script, `gate method ${method.name} manual.script`);
    if (!Number.isInteger(binding.timeoutMs) || binding.timeoutMs <= 0)
      {fail('FORMAL_INPUT', `gate method ${method.name} needs a positive integer timeoutMs`);}
    fieldsOf(binding.vals, ['script', 'timeoutMs'], 'manual.vals');
    lowerCamel(binding.vals.script, 'manual.vals.script');
    lowerCamel(binding.vals.timeoutMs, 'manual.vals.timeoutMs');
    const argument = binding.argument;
    fieldsOf(argument, ['source'], 'manual.argument');
    if (argument.source === 'param') {
      fieldsOf(argument, ['param', 'field'], 'manual.argument');
      text(argument.param, 'manual.argument.param');
      text(argument.field, 'manual.argument.field');
      if (!paramNames.has(argument.param))
        {fail('FORMAL_INPUT', `manual.argument.param ${argument.param} is not a gate method parameter`);}
    } else if (argument.source !== 'empty') {
      fail('FORMAL_INPUT', 'manual.argument.source must be "param" or "empty"');
    }
    fieldsOf(binding.decoder, ['owner', 'method'], 'gate method decoder');
    text(binding.decoder.owner, 'decoder owner');
    text(binding.decoder.method, 'decoder method');
  }
}

const braceNames = members => members.length > 1 ? `{${members.join(', ')}}` : members[0];

function importBlock(input) {
  const impl = input.impl;
  const resultTypes = impl.methods.map(m => m.resultType);
  const paramTypes = impl.methods.flatMap(m => m.params.map(p => p.typeRef));
  const appMembers = [...new Set([...resultTypes, impl.gate.name])].sort();
  const domainMembers = [...new Set(paramTypes.map(t => t.name))].sort();
  const lines = ['import javax.inject.{Inject, Singleton}'];
  lines.push(`import ${input.basePackage}.application.toolgates.${braceNames(appMembers)}`);
  if (domainMembers.length > 0)
    {lines.push(`import ${input.basePackage}.domain.values.${braceNames(domainMembers)}`);}
  lines.push(`import ${input.basePackage}.infrastructure.process.{${impl.runner.trait}, ${impl.runner.request}}`);
  lines.push('import scala.concurrent.{ExecutionContext, Future}');
  lines.push('import scala.util.Try');
  return lines.join('\n');
}

function renderImpl(input) {
  const { basePackage, impl } = input;
  const docNotes = impl.doc.notes.map(line => `  * ${line}`).join('\n');
  const bindings = impl.methods.map(method => [
    `  private val ${method.manual.vals.script} = ${JSON.stringify(method.manual.script)}`,
    `  private val ${method.manual.vals.timeoutMs} = ${method.manual.timeoutMs}L`,
  ]).flat().join('\n');
  const overrides = impl.methods.map(method => {
    const params = method.params.map(p => `${p.name}: ${p.typeRef.name}`).join(', ');
    const argument = method.manual.argument.source === 'param'
      ? `${method.manual.argument.param}.${method.manual.argument.field}`
      : '""';
    return [
      `  override def ${method.name}(${params}): Future[${method.resultType}] = {`,
      `    // ==== BEGIN MANUAL ====`,
      `    lift(${impl.runner.paramName}.${impl.runner.runMethod}(${impl.runner.request}(${method.manual.vals.script}, ${argument}, ${method.manual.vals.timeoutMs})))(${method.manual.decoder.owner}.${method.manual.decoder.method})`,
      `    // ==== END MANUAL ====`,
      `  }`,
    ].join('\n');
  }).join('\n\n');
  const rendered = `package ${basePackage}.infrastructure.toolgates

${importBlock(input)}

/** ${impl.name}: ${impl.doc.title}
${docNotes} */
@Singleton
class ${impl.name} @Inject()(${impl.runner.paramName}: ${impl.runner.trait}, ec: ExecutionContext)
    extends ${impl.gate.name} {

${bindings}

${overrides}

  private def lift[T](pending: Future[String])(decode: String => Try[T]): Future[T] =
    pending.flatMap(raw => Future.fromTry(decode(raw)))(ec)
}
`;
  const lines = rendered.split('\n');
  const begins = lines.filter(line => line.trim() === '// ==== BEGIN MANUAL ====').length;
  const ends = lines.filter(line => line.trim() === '// ==== END MANUAL ====').length;
  const overridesCount = lines.filter(line => line.trim().startsWith('override def')).length;
  if (begins !== overridesCount || ends !== begins)
    {fail('FORMAL_RENDER', 'rendered MANUAL markers are not one paired block per override');}
  return rendered;
}

export function generateToolGateImplementation(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  return { [scalaSubpackagePath(input.basePackage, 'infrastructure.toolgates', `${input.impl.name}.scala`)]: renderImpl(input) };
}

// ---------- unified-emitter family registration (emitter-unification Phase 1) ----------
// Ported verbatim from tools/gen-tool-gate-implementation.mjs, the byte-parity
// reference (family #25 connector-implementation; the reference generator and
// its input schema carry the historical tool-gate naming). runNegatives is
// null: registered debt, as with the other pre-battery curated modules.

export const family = {
  id: 'connector-implementation',
  familyNumber: 25,
  inputSchema: 'truthsrc.tool-gate-implementation-input/v1',
  goldenRoot: 'test/reference/curated/connector-implementation/v1',
  fixtureDir: 'test/fixtures/tool-gate-implementation-v1',
  toolsRef: 'tools/gen-tool-gate-implementation.mjs',
  toolsExport: 'generateToolGateImplementation',
  checkInput,
  renderAll: generateToolGateImplementation,
  runNegatives: null,
};
