import { copyImmutableData } from '../immutable-data.mjs';
import { fail } from '../products/request.mjs';

export const TARGET_SCHEMA = 'truthsrc.scala-target/v1';
export const LEGACY_COMPATIBLE = 'scala-cqrs-legacy-compatible-v1';
export const MODULAR_CANDIDATE = 'scala-cqrs-modular-candidate-v1';

const profiles = copyImmutableData({
  [LEGACY_COMPATIBLE]: {
    schemaVersion: TARGET_SCHEMA, id: LEGACY_COMPATIBLE, status: 'compatibility-contract', approval: null,
    generator: null, naming: 'explicit-compatible',
    modules: [{ id: 'root', sourceRoot: 'app', dependsOn: [] }],
    compatibility: ['explicit-complete-scala-names', 'domain-actor-facade', 'legacy-carrier-aliases', 'concrete-local-repository'],
    stableIdentities: ['knowledge', 'sql', 'protobuf', 'wire', 'persistence', 'operation', 'codec']
  },
  [MODULAR_CANDIDATE]: {
    schemaVersion: TARGET_SCHEMA, id: MODULAR_CANDIDATE, status: 'candidate', approval: null,
    generator: null, naming: 'camel-ascii',
    modules: [
      { id: 'kernel', sourceRoot: 'modules/kernel/src/main/scala', dependsOn: [] },
      { id: 'glue', sourceRoot: 'modules/glue/src/main/scala', dependsOn: ['kernel'] },
      { id: 'ext', sourceRoot: 'modules/ext/src/main/scala', dependsOn: ['kernel', 'glue'] },
      { id: 'root', sourceRoot: 'src/main/scala', dependsOn: ['kernel', 'glue', 'ext'] }
    ],
    compatibility: [],
    stableIdentities: ['knowledge', 'sql', 'protobuf', 'wire', 'persistence', 'operation', 'codec']
  }
});

export function targetProfile(id) {
  if (typeof id !== 'string' || !Object.hasOwn(profiles, id))
    fail('TARGET_PROFILE', 'an explicit supported target contract is required');
  return profiles[id];
}
