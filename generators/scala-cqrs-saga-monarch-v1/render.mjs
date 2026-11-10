import { renderJobs } from '../scala-cqrs-domain-kernel-v1/render.mjs';
import { sagaMonarchSourceEntry } from '../scala-cqrs-domain-kernel-v1/entry.mjs';
import { productFootprint } from './build-models.mjs';
import { kernelTemplate } from './templates/kernel.mjs';
import { codecsTemplate } from './templates/codecs.mjs';
import { sagaTemplate } from './templates/saga.mjs';
import { runtimeTemplate } from './templates/runtime.mjs';
import { workflowTemplate } from './templates/workflow.mjs';
import { rootTemplate } from './templates/root.mjs';
import { buildArtifacts, buildRoots, buildTemplate, serializationConfigTemplate } from './templates/build.mjs';

const templates = { protocol: kernelTemplate, codecs: codecsTemplate, saga: sagaTemplate, runtime: runtimeTemplate, workflow: workflowTemplate, root: rootTemplate };

/** Pure rendering; handwritten sources are build inputs, never entries or template inputs. */
export function render(model, capturedBuildRoots, footprint = productFootprint) {
  const roots = buildRoots(model, capturedBuildRoots);
  const jobs = model.artifacts.map(artifact => ({ artifact, template: out => templates[artifact.role](model, out) }));
  for (const artifact of buildArtifacts(model)) jobs.push({ artifact, template: out => artifact.role === 'serialization-config'
    ? serializationConfigTemplate(model, out) : buildTemplate(model, artifact, roots, out) });
  // Every artifact-level provenance anchor maps to actual text. Fine-grained
  // fields/phases/areas receive their own additional mapped fragments in templates.
  const mapped = jobs.map(job => ({ ...job, template: out => {
    let first = true;
    job.template({ append(content, sources = []) {
      out.append(content, first ? [...job.artifact.sources, ...sources] : sources);
      if (content.length) first = false;
    } });
  } }));
  return renderJobs(mapped, footprint, sagaMonarchSourceEntry);
}
