import { artifact, rawArtifact } from './assembly.mjs';

const kernel = new Set(['value-object', 'domain-entity', 'event-handler', 'invariant-rule', 'aggregate-root',
  'application-protocol', 'aggregate-behavior', 'command-helper', 'aggregate-repository-port',
  'projection-repository-port', 'projection-apply-event']);
const glue = new Set(['projection', 'projection-handler', 'projection-repository-implementation', 'bootstrap',
  'proto-converter', 'event-adapter', 'snapshot-adapter', 'aggregate-repository-implementation',
  'strict-saga-module', 'strict-fixture-host']);

/** The frozen writer's per-kind attribution determines physical module roots. */
export function classicSourcePath(selfType, kind, multiProject = false, sourceRoot = 'app') {
  const relative = selfType.packageName.replaceAll('.', '/') + '/' + selfType.name + '.scala';
  if (sourceRoot === 'test') return 'test/' + relative;
  const root = !multiProject ? 'app' : kernel.has(kind) ? 'modules/kernel/src/main/scala'
    : glue.has(kind) ? 'modules/glue/src/main/scala' : 'app';
  return root + '/' + relative;
}
export function classicArtifact(model, render, kind, source, ctx, references = [], sourceRoot = 'app') {
  if (!ctx.multiProject && sourceRoot === 'app') return artifact(model, render, kind, source, references);
  return rawArtifact(model, render, kind, source, {
    path: classicSourcePath(model.selfType, kind, ctx.multiProject, sourceRoot), stamp: 'scala', ownerType: model.selfType,
  }, references);
}
export function classicProtoArtifact(model, render, source, ctx, references = []) {
  const prefix = ctx.multiProject ? 'modules/glue/src/main/protobuf/' : 'app/protobuf/';
  return rawArtifact(model, render, 'protobuf-schema', source, {
    path: prefix + model.fileName, stamp: 'proto', ownerType: model.selfType ?? null,
  }, references);
}
