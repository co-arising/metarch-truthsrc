import { detach, equal, fail } from '../../lib/products/request.mjs';
import { moduleSeamsSourceEntry } from '../scala-cqrs-domain-kernel-v1/entry.mjs';
import { renderJobs } from '../scala-cqrs-domain-kernel-v1/render.mjs';
import { productFootprint, resolveBuildSourceRoots } from './build-models.mjs';
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
  return renderJobs(jobs, footprint, moduleSeamsSourceEntry);
}
