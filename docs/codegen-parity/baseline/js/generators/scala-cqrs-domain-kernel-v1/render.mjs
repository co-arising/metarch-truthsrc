import { sourceEntry } from './entry.mjs';
import { valueTemplate } from './templates/values.mjs';
import { protocolTemplate } from './templates/protocol.mjs';
import { stateTemplate } from './templates/state.mjs';
import { computationsTemplate, paramsTemplate } from './templates/params.mjs';
import { exactCodecsTemplate } from './templates/exact-codecs.mjs';
import { protobufTemplate } from './templates/protobuf.mjs';
import { convertersTemplate } from './templates/converters.mjs';
import { buildArtifacts, buildTemplate } from './templates/build.mjs';
import { generatedTestArtifacts, generatedTestsTemplate } from './templates/generated-tests.mjs';

const kinds = { value: 'value-object', protocol: 'protocol', state: 'state', computations: 'computation-port',
  'rule-params': 'rule-parameters', 'exact-codecs': 'exact-value-codec', protobuf: 'proto', converter: 'converter' };
const unique = rows => [...new Set(rows)];
const sourcesOf = rows => [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];

/** Pure finite rendering. No author/reference reads, model mutation, writes or compiler calls. */
export function productionJobs(model, serialization) {
  const jobs = [];
  function add(artifact, template, directDeps = artifact.directDeps ?? []) {
    jobs.push({ artifact: { ...artifact, sources: sourcesOf(artifact.sources), directDeps: unique(directDeps) }, template });
  }
  for (const value of model.values) add(value, out => valueTemplate(value, out));
  for (const aggregate of model.aggregates) {
    add(aggregate.protocol, out => protocolTemplate(aggregate.protocol, out));
    add(aggregate.state, out => stateTemplate(aggregate.state, model, out));
    add(aggregate.computations, out => computationsTemplate(aggregate.computations, out));
    add(aggregate.ruleParams, out => paramsTemplate(aggregate, out));
  }
  for (const context of model.contexts) {
    const codecs = model.codecs.filter(codec => codec.domain.ref.context === context.context);
    let codecArtifact = null;
    if (codecs.length) {
      codecArtifact = model.artifacts.find(row => row.role === 'exact-codecs' && row.package === context.package + '.infrastructure.serialization');
      if (!codecArtifact) throw new TypeError('complete combined codec artifact is missing');
      add(codecArtifact, out => exactCodecsTemplate(context, codecArtifact.codecs, model, out));
    }
    const pbContext = serialization.contexts.find(row => row.context === context.context);
    if (!pbContext) throw new TypeError('serialization context is missing');
    const proto = serialization.artifacts.find(row => row.role === 'protobuf' && row.path === pbContext.protoPath);
    if (!proto) throw new TypeError('protobuf output artifact is missing');
    const serializationSources = sourcesOf(serialization.nodes.filter(node => node.context === context.context).flatMap(node => node.sources));
    add({ ...proto, sources: serializationSources }, out => protobufTemplate(pbContext, serialization, out));
    add({ ...context.converter, sources: serializationSources }, out => convertersTemplate(pbContext, serialization, model, out),
      [...context.converter.directDeps, ...(codecArtifact ? [codecArtifact.path] : [])]);
  }
  return jobs;
}

/** Resolve all jobs together; no template runs until the complete graph is valid. */
export function renderJobs(rawJobs, footprint, entry = sourceEntry) {
  const jobs = rawJobs.map(job => ({ ...job, artifact: { ...job.artifact,
    sources: sourcesOf(job.artifact.sources), directDeps: unique(job.artifact.directDeps ?? []) } }));
  const byPath = new Map(), portable = new Set();
  for (const job of jobs) {
    const path = job.artifact.path;
    const normalized = path.normalize('NFC').toLowerCase();
    if (portable.has(normalized)) throw new TypeError('duplicate portable rendered artifact path: ' + path);
    portable.add(normalized); byPath.set(path, job);
  }
  const complete = new Map(), pending = new Set();
  function dependencies(job) {
    const path = job.artifact.path;
    if (complete.has(path)) return complete.get(path);
    if (pending.has(path)) throw new TypeError('rendered artifact dependency cycle: ' + path);
    pending.add(path);
    const deps = unique(job.artifact.directDeps.flatMap(dep => {
      const target = byPath.get(dep);
      if (!target) throw new TypeError('missing actual rendered dependency: ' + dep);
      return [dep, ...dependencies(target)];
    }));
    pending.delete(path); complete.set(path, deps); return deps;
  }
  jobs.forEach(dependencies);
  return Object.freeze(jobs.map(job => entry({ path: job.artifact.path,
    kind: kinds[job.artifact.role] ?? job.artifact.kind, sources: job.artifact.sources,
    footprint, deps: complete.get(job.artifact.path) }, job.template)));
}

export function render(model, serialization, footprint) {
  const jobs = productionJobs(model, serialization);
  for (const artifact of buildArtifacts(model)) jobs.push({ artifact, template: out => buildTemplate(artifact, out) });
  for (const artifact of generatedTestArtifacts(model, serialization))
    jobs.push({ artifact: { ...artifact, kind: 'generated-test' }, template: out => generatedTestsTemplate(artifact, out) });
  return renderJobs(jobs, footprint);
}
