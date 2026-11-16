import { applicationRegistry } from './produce.mjs';
import { renderEffectHosts } from './render-effect-hosts.mjs';
import { effectConfig, renderEffectSupport } from './render-effect-support.mjs';
import { renderEffectVerification } from './render-effect-verification.mjs';

export function createEffectRegistry(version = '1') {
const inherited = Object.fromEntries(Object.entries(applicationRegistry(version)).map(([id, implementation]) => [id, {
  version: implementation.version,
  produce(context) {
    const entries = implementation.produce(context);
    if (id !== 'finite-execution-dsl' && id !== 'proto-dsl' && id !== 'finite-host-dsl') return entries;
    const footprint = context.products['effect-host-contract'].hosts.length ? { id: 'effect-host-contract', version: '1' } : null;
    return entries.map(e => {
      const entry = { ...e, productFootprint: [...e.productFootprint, ...(footprint ? [footprint] : [])] };
      if (e.path === 'src/main/resources/application.conf') entry.content += '\n' + effectConfig(context);
      return entry;
    });
  }
}]));
const effectInputs = ['reference-layout', 'effect-host-contract', 'execution-contract'];
const effectFootprint = effectInputs.map(id => ({ id, version: '1' }));
return Object.freeze({ ...inherited,
  'durable-effect-host-dsl': Object.freeze({ version, produce: context => [
    ...renderEffectHosts(context, effectFootprint), ...renderEffectSupport(context, effectFootprint), ...renderEffectVerification(context, effectFootprint)
  ] }),
});
}
export const effectRegistry = createEffectRegistry();
export const effectRegistryV2 = createEffectRegistry('2');
