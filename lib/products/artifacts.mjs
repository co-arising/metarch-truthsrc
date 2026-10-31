import { array, at, equal, fail, object, resolve, text, unique } from './request.mjs';
import { canonicalType, declaration } from '../domain-products/values.mjs';
import { refKey, typeRefs } from '../domain-products/references.mjs';
import { validateServiceDeployment } from './service-deployment.mjs';

/** Authored status remains authored; this product never grants approval or installs a port. */
export function compileArtifacts(binding, canonical, layout) {
  const serviceVersion = binding.schemaVersion === 'truthsrc.artifact-binding/v3';
  const portType = (raw, context, source) => (serviceVersion || binding.schemaVersion === 'truthsrc.artifact-binding/v2') && typeof raw === 'string' ? canonicalType(raw, context, layout, source) : raw;
  const artifacts = array(canonical.value.artifactContracts, at(canonical.id, '/artifactContracts')).map((a, i) => {
    const source = at(canonical.id, '/artifactContracts/' + i);
    object(a, ['id', 'version', 'artifact', 'status', 'provenance', 'references', 'ports', 'deployment', 'implementations'], source);
    text(a.id, source); text(a.version, source);
    if (!['selected', 'proposal', 'historical'].includes(a.status)) fail('ARTIFACT_STATUS', 'explicit authored selection status required', source);
    const artifact = declaration(a.artifact, layout, source);
    if (artifact.ref.kind !== 'artifact' || !equal(artifact.source, source)) fail('ARTIFACT_SOURCE', 'artifact reference must identify its complete canonical row', source);
    const origins = array(a.provenance, source);
    if (!origins.length) fail('ARTIFACT_SOURCE', 'nonempty provenance required', source);
    for (const origin of origins) {
      object(origin, ['document', 'pointer'], source);
      if (origin.document !== canonical.id) fail('ARTIFACT_SOURCE', 'provenance must resolve in the declared canonical document', source);
      resolve(canonical.value, origin.pointer, origin);
    }
    unique(origins.map(o => JSON.stringify([o.document, o.pointer])), 'ARTIFACT_SOURCE', source);
    const references = array(a.references, source);
    references.forEach(r => declaration(r, layout, source)); unique(references.map(refKey), 'ARTIFACT_REFERENCE', source);
    const ports = array(a.ports, source);
    for (const p of ports) {
      object(p, ['ref', 'version', 'inputType', 'outputType', 'required'], source);
      const d = declaration(p.ref, layout, source);
      if (d.ref.kind !== 'port' || d.ref.context !== artifact.ref.context || d.source.document !== canonical.id || !/^\/ports\/(0|[1-9][0-9]*)$/u.test(d.source.pointer)) fail('ARTIFACT_PORT', 'artifact port must identify an explicit canonical port', source);
      text(p.version, source);
      if (p.required !== true) fail('ARTIFACT_PORT', 'declared port obligation must be explicitly required', source);
      const body = resolve(canonical.value, d.source.pointer, d.source);
      if (body.name !== p.ref.id || body.version !== p.version || !equal(portType(body.inputType, p.ref.context, source), p.inputType) || !equal(portType(body.outputType, p.ref.context, source), p.outputType)) fail('ARTIFACT_PORT', 'port type and version pins differ from canonical', source);
      for (const type of [p.inputType, p.outputType]) {
        const refs = typeRefs(type, source);
        refs.forEach(r => { if (r.kind !== 'type') fail('ARTIFACT_TYPE', 'port nominal references must identify types', source); declaration(r, layout, source); });
        if (type.form === 'record') fail('ARTIFACT_TYPE', 'port records require an explicit nominal type', source);
      }
    }
    unique(ports.map(p => refKey(p.ref)), 'ARTIFACT_PORT', source);
    const implementations = array(a.implementations, source);
    for (const p of implementations) {
      object(p, ['port', 'id', 'version'], source); text(p.id, source); text(p.version, source);
      if (!ports.some(port => equal(port.ref, p.port))) fail('ARTIFACT_IMPLEMENTATION', 'implementation obligation must name a declared required port', source);
    }
    unique(implementations.map(p => refKey(p.port)), 'ARTIFACT_IMPLEMENTATION', source);
    if (implementations.length !== ports.length) fail('ARTIFACT_IMPLEMENTATION', 'every port needs an explicit implementation obligation', source);
    const hasService = serviceVersion && Object.hasOwn(a.deployment ?? {}, 'service');
    object(a.deployment, ['id', 'version', 'secretRefs', ...(hasService ? ['service'] : [])], source); text(a.deployment.id, source); text(a.deployment.version, source);
    for (const secret of array(a.deployment.secretRefs, source)) {
      object(secret, ['id', 'provider'], source); text(secret.id, source);
      if (!['environment', 'keystore'].includes(secret.provider)) fail('ARTIFACT_SECRET', 'symbolic secret reference only; no secret value', source);
    }
    unique(a.deployment.secretRefs.map(s => s.id), 'ARTIFACT_SECRET', source);
    if (hasService) validateServiceDeployment(a.deployment.service, a, layout, source);
    return { ...a, source };
  });
  unique(artifacts.map(a => a.id), 'ARTIFACT_DUPLICATE', at(canonical.id, '/artifactContracts'));
  unique(artifacts.map(a => refKey(a.artifact)), 'ARTIFACT_DUPLICATE', at(canonical.id, '/artifactContracts'));
  const result = { artifacts };
  if (!equal(result, binding.value.artifacts)) fail('PRODUCT_PAYLOAD_MISMATCH', 'artifact product differs from complete canonical source', at(binding.id, '/artifacts'));
  return result;
}
