import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { variantIds } from './contract.mjs';
import { replaceOnce } from './controls.mjs';

const ref = (kind, id) => ({ context: 'parcel', kind, owner: [], id });
export async function createVariant(producerRoot, variant) {
  assert(variantIds.includes(variant) && variant !== 'main', 'Explicit finite layout/direct variant required');
  const api = await import(pathToFileURL(join(producerRoot, 'lib/project/cli.mjs')));
  const { emitAuthorDoc } = await import(pathToFileURL(join(producerRoot, 'lib/author-surface.mjs')));
  const { slug } = await import(pathToFileURL(join(producerRoot, 'lib/shared.mjs')));
  const parent = mkdtempSync(join(realpathSync(tmpdir()), 'module-seams-' + variant + '-'));
  const projectDir = join(parent, 'project'); cpSync(join(producerRoot, 'scaffold/module-seams-project'), projectDir, { recursive: true });
  const project = join(projectDir, 'truthsrc.project.json'), config = JSON.parse(readFileSync(project));
  if (['split-parcel', 'all-separate'].includes(variant))
    for (const f of config.options.valueFiles) if (variant === 'all-separate' || f.ref.id === 'Parcel') f.fileStem = f.ref.id;
  if (variant === 'same-name-sum') {
    const name = 'ModuleSeamsValueShapeSpec';
    writeFileSync(join(projectDir, config.tree, 'contexts/parcel/value-objects/' + slug(name) + '.vo.yaml'), emitAuthorDoc({
      kind: 'value-object', name, seq: 9, payload: { schemaVersion: 'truthsrc.signature-value/v1', name, shape: 'sum', variants: [{ name: 'Present', fields: [] }] },
    }), { flag: 'wx' });
    config.options.valueFiles.push({ ref: ref('type', name), fileStem: name });
  }
  if (variant === 'same-name-root') config.options.names.find(n => n.role === 'composition').name = 'ModuleSeamsRootShapeSpec';
  if (variant === 'direct') {
    const file = join(projectDir, 'bindings/module-seams.json'), binding = JSON.parse(readFileSync(file));
    binding.bridges = []; binding.implementations[0].implements = ref('port', 'CapacityPolicy');
    binding.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' };
    writeFileSync(file, JSON.stringify(binding, null, 2) + '\n');
    config.options.names = config.options.names.filter(n => n.role !== 'bridge');
    const implementation = join(projectDir, 'handwritten/kernel/CapacityRule.scala');
    writeFileSync(implementation, replaceOnce(readFileSync(implementation, 'utf8'), 'object CapacityRule {',
      'object CapacityRule extends example.parcel.domain.ports.CapacityPolicy {'));
  }
  writeFileSync(project, JSON.stringify(config, null, 2) + '\n');
  const captured = api.captureProject(project); assert.deepEqual(captured.validation.hard, []); assert(captured.validation.roundtrip.ok); api.assertUnchanged(captured);
  const source = join(parent, 'generated'), sourceReceipt = join(parent, 'writer.json');
  const plan = await api.projectCli('generate-project', ['--project', project, '--out', source, '--plan']);
  writeFileSync(join(parent, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  const result = await api.projectCli('generate-project', ['--project', project, '--out', source]);
  writeFileSync(sourceReceipt, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return { variant, parent, source, sourceReceipt, project, producerRoot };
}
