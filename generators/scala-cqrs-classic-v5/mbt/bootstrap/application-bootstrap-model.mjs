import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

/** Guice class assembly, not the formal JS object-loader bootstrap.
 * initCalls contains ordered structural StartupModels; the template owns calls.
 * strictEntries retains the original Seq[String] (empty for the sealed F1).
 */
export function ClassicApplicationBootstrapModel({
  selfType,
  traits,
  initCalls,
  injectedFields,
  strictEntries = [],
  dependencies,
  noteIds = [],
  references = [],
  retained = null,
}) {
  return copyImmutableData({
    selfType, traits, initCalls, injectedFields, strictEntries,
    dependencies, noteIds, references, retained,
  });
}
