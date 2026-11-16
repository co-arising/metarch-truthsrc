#!/usr/bin/env node
// Pure Saga atom -> strict contract IR. No regex phase parsing or inferred defaults.
// Existing positional CLI: node parse.mjs <saga.yaml> <binding.json> <out.spec.json>
// Strict input additionally requires --canonical <canonical.json> for owned refs.
// Explicit legacy adapter: node parse.mjs <legacy.spec.json> <out.spec.json> --legacy
import { readFileSync } from 'node:fs';
import { parseDoc } from '../../lib/shared.mjs';
import { compileSagas as strictCompileSagas } from '../../lib/saga/compile.mjs';
import { assertJsonData, isDirectCli, stableJson, validateLegacySagaSpec, writeCliOutput } from './emit.mjs';

export function compileSagaContract(canonical, binding) {
  if (binding === undefined) throw new Error('SAGA_BINDING_REQUIRED: provide the closed technical binding document explicitly');
  assertJsonData(canonical, 'canonical');
  assertJsonData(binding, 'binding');
  const { ir, diagnostics } = strictCompileSagas(canonical, binding);
  if (!ir || diagnostics.length) {
    const error = new Error(diagnostics.map((d) => `${d.code} ${d.source.document}${d.source.pointer}: ${d.message}`).join('\n') || 'Saga compilation failed');
    error.diagnostics = diagnostics;
    throw error;
  }
  return ir;
}

export function parseSagaAtom(text, context = {}) {
  assertJsonData(context, 'SagaAtomContext');
  const canonical = Object.hasOwn(context, 'canonical') ? context.canonical : undefined;
  const binding = Object.hasOwn(context, 'binding') ? context.binding : undefined;
  const file = Object.hasOwn(context, 'file') ? context.file : '<saga.atom>';
  if (typeof text !== 'string') throw new Error('Saga atom must be text');
  const doc = parseDoc(text, file);
  assertJsonData(doc, file);
  if (!Object.hasOwn(doc, 'kind') || doc.kind !== 'saga') throw new Error(`${file}: expected kind: saga; legacySagaSpec requires the explicit legacy adapter`);
  if (canonical === undefined) throw new Error('SAGA_CANONICAL_REQUIRED: Saga atoms need the closed canonical owned-command/event projection');
  // Compile the entire supplied closure first; never discard other Saga contracts.
  const ir = compileSagaContract(canonical, binding);
  const { kind, ...definition } = doc;
  const declared = canonical.sagas?.find((saga) => saga.id === definition.id);
  if (!declared || stableJson(definition) !== stableJson(declared)) {
    throw new Error(`${file}: atom must exactly match its whole canonical Saga definition (including version, seq and payload)`);
  }
  return ir;
}

export function adaptLegacySagaSpec(spec) {
  // No conversion from design-only YAML: caller supplies every legacy field.
  return validateLegacySagaSpec(spec);
}

export function parseCli(argv = process.argv.slice(2)) {
  let output, result;
  if (argv.length === 3 && argv[2] === '--legacy' && !argv[0].startsWith('--') && !argv[1].startsWith('--')) {
    output = argv[1];
    result = adaptLegacySagaSpec(JSON.parse(readFileSync(argv[0], 'utf8')));
  } else if (argv.length === 5 && argv[3] === '--canonical' && argv.slice(0, 3).every((arg) => !arg.startsWith('--'))) {
    const [sagaPath, bindingPath, outPath, , canonicalPath] = argv;
    output = outPath;
    result = parseSagaAtom(readFileSync(sagaPath, 'utf8'), {
      canonical: JSON.parse(readFileSync(canonicalPath, 'utf8')),
      binding: JSON.parse(readFileSync(bindingPath, 'utf8')), file: sagaPath,
    });
  } else {
    throw new Error('usage: node parse.mjs <saga.yaml> <binding.json> <out.spec.json> --canonical <canonical.json>\nlegacy: node parse.mjs <legacy.spec.json> <out.spec.json> --legacy\nDesign-only legacy YAML is not an executable contract; no inferred groups, expressions or TODOs.');
  }
  const bytes = stableJson(result); // no write until all contracts pass
  writeCliOutput(output, bytes, argv.length === 3 ? [argv[0]] : [argv[0], argv[1], argv[4]]);
  console.log(`parsed ${result.schemaVersion ?? 'legacySagaSpec'} -> ${output}`);
}

if (isDirectCli(import.meta.url)) {
  try { parseCli(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
