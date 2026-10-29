import { copyImmutableData } from '../immutable-data.mjs';
import { compileReferences } from '../domain-products/references.mjs';
import { compileDecisions } from '../domain-products/decision.mjs';
import { at, detach, fail, ProductError, validateRequest, array, equal, escape, object, text, unique } from './request.mjs';
import { assembleDocuments } from './assemblies.mjs';
import { COMPILER, ENVELOPE, PRODUCT_SET, profileFor, READINESS } from './registry.mjs';
import { compileExactTypes } from '../value-products/exact-types.mjs';
import { compileExactCodecs } from '../value-products/exact-codecs.mjs';
import { compileDependencies } from '../domain-products/dependencies.mjs';
import { compileFolds } from '../domain-products/folds.mjs';
import { compileContract } from './contracts.mjs';
import { compileExternalEvents } from '../domain-products/external-events.mjs';
import { compileArtifacts } from './artifacts.mjs';
import { compileSagaHosts } from './saga-hosts.mjs';
import { compileChildPlans } from './child-plans.mjs';

/** No I/O and no caller-provided compiler/registry. All-or-nothing static products. */
export function compileProductSet(raw) {
  try {
    const input = validateRequest(raw);
    const assembled = assembleDocuments(input.documents, input.assemblies, { array, at, equal, escape, fail, object, text, unique });
    const request = { ...input, documents: assembled.documents, assemblies: assembled.assemblies };
    const documents = new Map(request.documents.map(d => [d.id, d]));
    const requirements = new Map(request.requirements.map(r => [r.id, r]));
    const products = new Map();
    const layoutRequirement = requirements.get('reference-layout');
    if (layoutRequirement) {
      products.set('reference-layout', compileReferences(documents.get(layoutRequirement.inputRoles.referenceBinding),
        documents.get(layoutRequirement.inputRoles.canonical), request.documents));
    }
    for (const id of ['exact-value-types', 'exact-value-codecs']) {
      const requirement = requirements.get(id);
      if (requirement) {
        if (requirement.inputRoles.canonical !== layoutRequirement.inputRoles.canonical) fail('PRODUCT_ROLE', 'exact products and layout must use the same canonical');
        const profile = profileFor(id, requirement.version), binding = documents.get(requirement.inputRoles[profile.bindingRole]);
        const canonical = documents.get(requirement.inputRoles.canonical), layout = products.get('reference-layout');
        products.set(id, id === 'exact-value-types' ? compileExactTypes(binding, canonical, layout) :
          compileExactCodecs(binding, canonical, layout, products.get('exact-value-types')));
      }
    }
    const decisionRequirement = requirements.get('domain-decision');
    const exactTypesForDecisions = requirements.has('exact-value-types') ? { types: products.get('exact-value-types') } : null;
    if (decisionRequirement) {
      if (decisionRequirement.inputRoles.canonical !== layoutRequirement.inputRoles.canonical) fail('PRODUCT_ROLE', 'decision and layout must use the same canonical');
      products.set('domain-decision', compileDecisions(documents.get(decisionRequirement.inputRoles.semanticBinding),
        documents.get(decisionRequirement.inputRoles.canonical), products.get('reference-layout'),
        decisionRequirement.version !== '1' ? exactTypesForDecisions : null, decisionRequirement.version));
    }
    const externalRequirement = requirements.get('domain-external-events');
    if (externalRequirement) {
      if (externalRequirement.inputRoles.canonical !== layoutRequirement.inputRoles.canonical) fail('PRODUCT_ROLE', 'external producers must share the layout canonical');
      products.set('domain-external-events', compileExternalEvents(documents.get(externalRequirement.inputRoles.externalEventBinding),
        documents.get(externalRequirement.inputRoles.canonical), products.get('reference-layout')));
    }
    for (const id of ['domain-dependencies', 'domain-folds']) {
      const r = requirements.get(id);
      if (!r) continue;
      if (r.inputRoles.canonical !== layoutRequirement.inputRoles.canonical) fail('PRODUCT_ROLE', 'dataflow products must share the layout canonical');
      const profile = profileFor(id, r.version), binding = documents.get(r.inputRoles[profile.bindingRole]), canonical = documents.get(r.inputRoles.canonical);
      products.set(id, id === 'domain-dependencies' ? compileDependencies(binding, canonical, products.get('reference-layout'), products.get('domain-decision'), r.version !== '1' ? products.get('exact-value-types') : [], ['4', '5'].includes(r.version) ? products.get('domain-external-events') : null) :
        compileFolds(binding, canonical, products.get('reference-layout'), products.get('domain-dependencies'), products.get('exact-value-types')));
    }
    const artifactRequirement = requirements.get('artifact-contract');
    if (artifactRequirement) {
      if (artifactRequirement.inputRoles.canonical !== layoutRequirement.inputRoles.canonical) fail('PRODUCT_ROLE', 'artifact product must share layout canonical');
      products.set('artifact-contract', compileArtifacts(documents.get(artifactRequirement.inputRoles.artifactBinding),
        documents.get(artifactRequirement.inputRoles.canonical), products.get('reference-layout')));
    }
    for (const id of ['saga-contract', 'execution-contract', 'saga-runtime-contract']) {
      const requirement = requirements.get(id);
      if (requirement) products.set(id, compileContract(id, requirement, documents, products, requirements));
    }
    const childRequirement = requirements.get('child-plan-contract');
    if (childRequirement) {
      for (const id of childRequirement.requires.map(r => r.id)) if (requirements.get(id).inputRoles.canonical !== childRequirement.inputRoles.canonical) fail('PRODUCT_ROLE', 'child plans must share the exact canonical source with all dependencies');
      products.set('child-plan-contract', compileChildPlans(documents.get(childRequirement.inputRoles.childPlanBinding), documents.get(childRequirement.inputRoles.canonical), products.get('reference-layout'), products.get('execution-contract')));
    }
    const hostRequirement = requirements.get('saga-host-contract');
    if (hostRequirement) {
      const canonicalId = hostRequirement.inputRoles.canonical;
      for (const id of hostRequirement.requires.map(r => r.id)) if (requirements.get(id).inputRoles.canonical !== canonicalId) fail('PRODUCT_ROLE', 'host and all required products must share the exact explicit canonical');
      products.set('saga-host-contract', compileSagaHosts(documents.get(hostRequirement.inputRoles.hostBinding), documents.get(canonicalId),
        products.get('reference-layout'), products.get('saga-contract'), products.get('saga-runtime-contract'), products.get('execution-contract'), products.get('domain-external-events'), products.get('artifact-contract'), products.get('exact-value-types')));
    }
    const result = {
      schemaVersion: PRODUCT_SET, compiler: COMPILER, documents: request.documents, assemblies: request.assemblies,
      requirements: request.requirements,
      products: [...requirements.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(r => ({
        ...r, schemaVersion: ENVELOPE,
        sources: [at(r.inputRoles[profileFor(r.id, r.version).bindingRole], profileFor(r.id, r.version).pointer)], payload: products.get(r.id),
      })), readiness: READINESS,
    };
    return copyImmutableData({ result: detach(result), diagnostics: [] });
  } catch (error) {
    if (!(error instanceof ProductError)) throw error;
    return copyImmutableData({ result: null, diagnostics: error.diagnostics ?? [error.diagnostic] });
  }
}
