#!/usr/bin/env node
// external-connector-port (v2 toolgate) generator: emits the user-approved v2
// golden shape. Ruled invariants (2026-11-19): business-only gate signatures —
// script/process vocabulary never reaches the gate face; every method carries a
// sealed binding (pinned script, argument source, timeout budget); the runner is
// a supplied handwritten lib and is never emitted; result types are supplied
// handwritten classes per the traditional contract. Acceptance is byte
// comparison against the approved golden bundle, never a self-declared pass.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { scalaDirPath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('FORMAL_INPUT', `${what} must be nonempty text`);
  return value;
};
const fieldsOf = (record, names, what) => {
  const missing = names.filter(n => !(n in record));
  if (missing.length) fail('FORMAL_INPUT', `${what} missing fields: ${missing.join(', ')}`);
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
  fieldsOf(input, ['schemaVersion', 'basePackage', 'gate', 'supplied'], 'input');
  if (input.schemaVersion !== 'truthsrc.external-tool-gate-input/v1')
    fail('FORMAL_INPUT', 'unsupported schemaVersion');
  text(input.basePackage, 'basePackage');
  if (!input.basePackage.split('.').every(part => /^[a-z][a-zA-Z0-9]*$/.test(part)))
    fail('FORMAL_INPUT', 'basePackage must be dotted lowercase-root segments');
  const gate = input.gate;
  fieldsOf(gate, ['traitName', 'implName', 'moduleName', 'doc', 'runner', 'methods'], 'gate');
  pascal(gate.traitName, 'gate.traitName');
  pascal(gate.implName, 'gate.implName');
  pascal(gate.moduleName, 'gate.moduleName');
  fieldsOf(gate.doc, ['title', 'notes'], 'gate.doc');
  if (!Array.isArray(gate.doc.notes) || gate.doc.notes.length === 0)
    fail('FORMAL_INPUT', 'gate.doc.notes must be a nonempty array');
  const runner = gate.runner;
  fieldsOf(runner, ['trait', 'request', 'runMethod', 'paramName'], 'gate.runner');
  pascal(runner.trait, 'gate.runner.trait');
  pascal(runner.request, 'gate.runner.request');
  text(runner.runMethod, 'gate.runner.runMethod');
  lowerCamel(runner.paramName, 'gate.runner.paramName');
  if (!Array.isArray(gate.methods) || gate.methods.length === 0)
    fail('FORMAL_INPUT', 'gate.methods must be a nonempty array');
  const paramNames = new Set();
  for (const method of gate.methods) {
    fieldsOf(method, ['name', 'params', 'resultType', 'intent', 'binding', 'decoder'], 'gate method');
    text(method.name, 'gate method name');
    if (!Array.isArray(method.params)) fail('FORMAL_INPUT', 'gate method params must be an array');
    text(method.resultType, `gate method ${method.name} resultType`);
    text(method.intent, `gate method ${method.name} intent`);
    for (const param of method.params) {
      fieldsOf(param, ['name', 'typeRef'], 'gate method param');
      text(param.name, 'param name');
      if (mechanismVocabulary.test(param.name) || mechanismVocabulary.test(param.typeRef.name || ''))
        fail('FORMAL_INPUT', `param ${param.name} carries mechanism vocabulary; the gate face is business-only (2026-11-19 ruling)`);
      fieldsOf(param.typeRef, ['name', 'packageName'], 'param typeRef');
      text(param.typeRef.name, 'param typeRef name');
      text(param.typeRef.packageName, 'param typeRef packageName');
      if (paramNames.has(param.name)) fail('FORMAL_INPUT', `duplicate param name ${param.name}`);
      paramNames.add(param.name);
    }
    const binding = method.binding;
    fieldsOf(binding, ['script', 'argument', 'timeoutMs', 'vals'], `gate method ${method.name} binding`);
    text(binding.script, `gate method ${method.name} binding.script`);
    if (!Number.isInteger(binding.timeoutMs) || binding.timeoutMs <= 0)
      fail('FORMAL_INPUT', `gate method ${method.name} needs a positive integer timeoutMs`);
    fieldsOf(binding.vals, ['script', 'timeoutMs'], 'binding.vals');
    lowerCamel(binding.vals.script, 'binding.vals.script');
    lowerCamel(binding.vals.timeoutMs, 'binding.vals.timeoutMs');
    const argument = binding.argument;
    fieldsOf(argument, ['source'], 'binding.argument');
    if (argument.source === 'param') {
      fieldsOf(argument, ['param', 'field'], 'binding.argument');
      text(argument.param, 'binding.argument.param');
      text(argument.field, 'binding.argument.field');
      if (!paramNames.has(argument.param))
        fail('FORMAL_INPUT', `binding.argument.param ${argument.param} is not a gate method parameter`);
    } else if (argument.source !== 'empty') {
      fail('FORMAL_INPUT', 'binding.argument.source must be "param" or "empty"');
    }
    fieldsOf(method.decoder, ['owner', 'method'], 'gate method decoder');
    text(method.decoder.owner, 'decoder owner');
    text(method.decoder.method, 'decoder method');
  }
  if (!Array.isArray(input.supplied))
    fail('FORMAL_INPUT', 'supplied must be an array of external frozen inputs');
  for (const row of input.supplied) {
    fieldsOf(row, ['role', 'path', 'sha256'], 'supplied entry');
    if (!/^[0-9a-f]{64}$/.test(row.sha256)) fail('FORMAL_INPUT', `supplied ${row.role} needs a sha256`);
  }
}

const methodImports = gate => {
  const imports = new Set();
  for (const method of gate.methods)
    for (const param of method.params) imports.add(`${param.typeRef.packageName}.${param.typeRef.name}`);
  imports.add('scala.concurrent.Future');
  return [...imports].sort();
};

function renderGate(input) {
  const { basePackage, gate } = input;
  const docNotes = gate.doc.notes.map(line => ` * ${line}`).join('\n');
  const methods = gate.methods.map(method => {
    const params = method.params.map(p => `${p.name}: ${p.typeRef.name}`).join(', ');
    return `  def ${method.name}(${params}): Future[${method.resultType}]\n  // Logic: ${method.intent}`;
  }).join('\n\n');
  return `package ${basePackage}.application.toolgates

import ${methodImports(gate).join('\nimport ')}

/**
 * ${gate.traitName}: ${gate.doc.title}
${docNotes}
 */
trait ${gate.traitName} {

${methods}

}
`;
}

const braceNames = members => members.length > 1 ? `{${members.join(', ')}}` : members[0];

const implImportBlock = (input, resultTypes, paramTypes) => {
  const appMembers = [...new Set([...resultTypes, input.gate.traitName])].sort();
  const domainMembers = [...new Set(paramTypes.map(t => t.name))].sort();
  const lines = ['import javax.inject.{Inject, Singleton}'];
  lines.push(`import ${input.basePackage}.application.toolgates.${braceNames(appMembers)}`);
  if (domainMembers.length > 0)
    lines.push(`import ${input.basePackage}.domain.values.${braceNames(domainMembers)}`);
  lines.push(`import ${input.basePackage}.infrastructure.process.{${input.gate.runner.trait}, ${input.gate.runner.request}}`);
  lines.push('import scala.concurrent.{ExecutionContext, Future}');
  lines.push('import scala.util.Try');
  return lines.join('\n');
};

function renderImpl(input) {
  const { basePackage, gate } = input;
  const resultTypes = gate.methods.map(m => m.resultType);
  const paramTypes = gate.methods.flatMap(m => m.params.map(p => p.typeRef));
  const bindings = gate.methods.map(method => [
    `  private val ${method.binding.vals.script} = ${JSON.stringify(method.binding.script)}`,
    `  private val ${method.binding.vals.timeoutMs} = ${method.binding.timeoutMs}L`,
  ]).flat().join('\n');
  const overrides = gate.methods.map(method => {
    const params = method.params.map(p => `${p.name}: ${p.typeRef.name}`).join(', ');
    const argument = method.binding.argument.source === 'param'
      ? `${method.binding.argument.param}.${method.binding.argument.field}`
      : '""';
    return [
      `  override def ${method.name}(${params}): Future[${method.resultType}] =`,
      `    lift(${gate.runner.paramName}.${gate.runner.runMethod}(${gate.runner.request}(${method.binding.vals.script}, ${argument}, ${method.binding.vals.timeoutMs})))(${method.decoder.owner}.${method.decoder.method})`,
    ].join('\n');
  }).join('\n\n');
  return `package ${basePackage}.infrastructure.toolgates

${implImportBlock(input, resultTypes, paramTypes)}

/** Sample-support reference implementation (the production implementation contract
  * belongs to the tool-gate-implementation family): seals one tool binding per gate
  * method — pinned script, timeout budget, typed lifting. Exactly one runner call
  * per gate call, the sealed binding and the business argument passed through
  * verbatim — no retry, no swallowing, no synthesized verdict. */
@Singleton
class ${gate.implName} @Inject()(${gate.runner.paramName}: ${gate.runner.trait}, ec: ExecutionContext)
    extends ${gate.traitName} {

${bindings}

${overrides}

  private def lift[T](pending: Future[String])(decode: String => Try[T]): Future[T] =
    pending.flatMap(raw => Future.fromTry(decode(raw)))(ec)
}
`;
}

function renderModule(input) {
  const { basePackage, gate } = input;
  return `package ${basePackage}.infrastructure.bootstrap

import com.google.inject.AbstractModule
import ${basePackage}.application.toolgates.${gate.traitName}
import ${basePackage}.infrastructure.toolgates.${gate.implName}

/** Infrastructure owns assembly: the kernel-facing gate face carries no
  * implementation reference, so the gate-to-implementation binding lives here,
  * in the layer that can see both sides. */
final class ${gate.moduleName} extends AbstractModule {
  override def configure(): Unit =
    bind(classOf[${gate.traitName}]).to(classOf[${gate.implName}])
}
`;
}

const RENDERERS = [
  { suffix: 'application/toolgates/GateFace.scala', render: renderGate, rename: gate => `${gate.traitName}.scala` },
  { suffix: 'infrastructure/toolgates/GateImpl.scala', render: renderImpl, rename: gate => `${gate.implName}.scala` },
  { suffix: 'infrastructure/bootstrap/GateModule.scala', render: renderModule, rename: gate => `${gate.moduleName}.scala` },
];

export function generateExternalToolGate(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  const appRoot = scalaDirPath(input.basePackage);
  const outputs = {};
  for (const entry of RENDERERS) {
    const relative = `${appRoot}/${entry.suffix.replace(/[^/]*\.scala$/, entry.rename(input.gate))}`;
    outputs[relative] = entry.render(input);
  }
  return outputs;
}

// ---------- unified-emitter family registration (emitter-unification Phase 1) ----------
// Ported verbatim from tools/gen-external-tool-gate.mjs, the byte-parity
// reference (family #13 external-connector-port; the reference generator and
// its input schema carry the historical tool-gate naming). runNegatives is
// null: registered debt, as with the other pre-battery curated modules.

export const family = {
  id: 'external-connector-port',
  familyNumber: 13,
  inputSchema: 'truthsrc.external-tool-gate-input/v1',
  goldenRoot: 'test/reference/curated/external-connector-port/v2',
  fixtureDir: 'test/fixtures/external-connector-port-v2',
  toolsRef: 'tools/gen-external-tool-gate.mjs',
  toolsExport: 'generateExternalToolGate',
  checkInput,
  renderAll: generateExternalToolGate,
  runNegatives: null,
};
