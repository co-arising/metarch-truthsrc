import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { variantInventory } from './reference/module-seams-mixed/contract.mjs';
import { createVariant } from './reference/module-seams-mixed/variants.mjs';
import { admitMixedInputs } from './reference/module-seams-mixed/inputs.mjs';
import { main } from './reference/module-seams-mixed/verify-variants.mjs';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
for (const [variant, count] of [['split-parcel', 8], ['all-separate', 13], ['same-name-sum', 8], ['same-name-root', 7], ['direct', 6]]) {
  test('actual author and writer admit finite variant: ' + variant, async t => {
    const v = await createVariant(root, variant);
    t.after(() => rmSync(v.parent, { recursive: true, force: true }));
    const a = await admitMixedInputs(v);
    const inventory = variantInventory(variant);
    assert.equal(Object.values(inventory.production).flat().length, count);
    assert.equal(a.plan.entries.filter(e => /src\/main\/scala/.test(e.path)).length, count);
    if (variant === 'direct') assert(!a.plan.entries.some(e => e.path.endsWith('/CapacityPolicyBridge.scala')));
    a.close();
  });
}
test('layout/direct JVM runner is blocked by Node discovery', async () => {
  await assert.rejects(() => main({}), /NODE_TEST_CONTEXT/);
  assert.throws(() => variantInventory('unknown'), /Unknown finite/);
});
