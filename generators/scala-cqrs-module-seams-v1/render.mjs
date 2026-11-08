import { array, at, detach, equal, fail } from '../../lib/products/request.mjs';
import { portableSeamsPath } from '../../lib/products/module-seams-composition.mjs';
import { moduleSeamsSourceEntry } from '../scala-cqrs-domain-kernel-v1/entry.mjs';
import { productFootprint, resolveBuildSourceRoots, sourcesOf } from './build-models.mjs';
import { valuesTemplate, portTemplate, bridgeTemplate, rootTemplate, buildTemplate,
  valueShapeTestTemplate, rootShapeTestTemplate } from './templates/scala.mjs';

/** Pure rendering of complete generated jobs. No filesystem, reference lookup or caller callback. */
export function render(rawModel, buildSourceRoots, footprint) {
  const model = detach(rawModel), roots = resolveBuildSourceRoots(model, buildSourceRoots);
  if (model.schemaVersion !== 'truthsrc.module-seams-render-model/v1' || !equal(footprint, productFootprint))
    fail('MODULE_SEAMS_RENDER', 'complete finite model and exact two-product footprint required');
  const jobs = model.artifacts.map(artifact => {
    let template;
    if (artifact.role === 'value') template = out => valuesTemplate(artifact, out);
    else if (artifact.role === 'port') template = out => portTemplate(artifact.port, out);
    else if (artifact.role === 'bridge') template = out => bridgeTemplate(artifact.bridge, out);
    else if (artifact.role === 'composition') template = out => rootTemplate(artifact.root, out);
    else fail('MODULE_SEAMS_RENDER', 'unknown generated production responsibility');
    return { artifact, template };
  });
  for (const artifact of model.support) {
    const template = artifact.role === 'build' ? out => buildTemplate(artifact, model, roots, out)
      : artifact.role === 'value-shape-test' ? out => valueShapeTestTemplate(artifact, out)
      : artifact.role === 'root-shape-test' ? out => rootShapeTestTemplate(artifact, out) : null;
    if (!template) fail('MODULE_SEAMS_RENDER', 'unknown finite support artifact');
    jobs.push({ artifact, template });
  }
  const kinds = { value: 'value-object', port: 'module-seams-port', bridge: 'module-seams-bridge',
    composition: 'module-seams-composition', build: 'build', 'value-shape-test': 'generated-test', 'root-shape-test': 'generated-test' };
  const byPath = new Map(), portable = new Set(), location = at('module-seams-render');
  for (const { artifact } of jobs) {
    portableSeamsPath(artifact.path, location);
    const key = artifact.path.normalize('NFC').toLowerCase();
    if (portable.has(key)) fail('MODULE_SEAMS_RENDER', 'duplicate portable rendered artifact path: ' + artifact.path, location);
    if (artifact.kind !== kinds[artifact.role]) fail('MODULE_SEAMS_RENDER', 'artifact kind conflicts with its responsibility', location);
    portable.add(key); byPath.set(artifact.path, artifact);
  }
  for (const { artifact } of jobs) for (const dep of array(artifact.directDeps, location)) {
    portableSeamsPath(dep, location);
    if (!byPath.has(dep)) fail('MODULE_SEAMS_RENDER', 'missing actual rendered dependency: ' + dep, location);
  }
  // Acyclic nominal types can share files that refer back to each other. Each
  // starting file therefore owns a visited set, not the family1 file-DAG cache.
  const complete = new Map();
  for (const { artifact } of jobs) {
    const seen = new Set([artifact.path]), deps = [], pending = [...artifact.directDeps].reverse();
    while (pending.length) {
      const dep = pending.pop();
      if (seen.has(dep)) continue;
      seen.add(dep); deps.push(dep);
      const direct = byPath.get(dep).directDeps;
      for (let i = direct.length - 1; i >= 0; i--) pending.push(direct[i]);
    }
    complete.set(artifact.path, deps);
  }
  return Object.freeze(jobs.map(({ artifact, template }) => moduleSeamsSourceEntry({ path: artifact.path,
    kind: artifact.kind, sources: sourcesOf(artifact.sources), footprint, deps: complete.get(artifact.path) }, template)));
}
