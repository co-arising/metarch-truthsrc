import { realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { copyImmutableData } from '../immutable-data.mjs';
import { captureProductJson, captureProductRequest } from './cli.mjs';
import { compileProductSet } from './compile.mjs';
import { fail } from './request.mjs';
import { applyEntries } from '../../src/core/generate.mjs';
import { generate as generateDomain } from '../../generators/scala-cqrs-domain/generate.mjs';
import { generate as generateApplication } from '../../generators/scala-cqrs-application/generate.mjs';
import { generate as generateChildApplication } from '../../generators/scala-cqrs-child-application/generate.mjs';
import { generate as generateDesignReview } from '../../generators/product-design-review/generate.mjs';
import { generate as generateEffectApplication } from '../../generators/scala-cqrs-effect-application/generate.mjs';
import { generate as generateDomainV2 } from '../../generators/scala-cqrs-domain-v2/generate.mjs';
import { generate as generateApplicationV2 } from '../../generators/scala-cqrs-application-v2/generate.mjs';
import { generate as generateChildApplicationV2 } from '../../generators/scala-cqrs-child-application-v2/generate.mjs';
import { generate as generateEffectApplicationV2 } from '../../generators/scala-cqrs-effect-application-v2/generate.mjs';
import { generate as generatePlayService } from '../../generators/scala-cqrs-play-service/generate.mjs';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const domain = new URL('../../generators/scala-cqrs-domain/', import.meta.url);
const application = new URL('../../generators/scala-cqrs-application/', import.meta.url);
const childApplication = new URL('../../generators/scala-cqrs-child-application/', import.meta.url);
const designReview = new URL('../../generators/product-design-review/', import.meta.url);
const effectApplication = new URL('../../generators/scala-cqrs-effect-application/', import.meta.url);
const domainV2 = new URL('../../generators/scala-cqrs-domain-v2/', import.meta.url);
const applicationV2 = new URL('../../generators/scala-cqrs-application-v2/', import.meta.url);
const childApplicationV2 = new URL('../../generators/scala-cqrs-child-application-v2/', import.meta.url);
const playService = new URL('../../generators/scala-cqrs-play-service/', import.meta.url);
const effectApplicationV2 = new URL('../../generators/scala-cqrs-effect-application-v2/', import.meta.url);
/** File capture and target I/O adapter. No generator code is imported from caller JSON. */
export async function generateProductCli(args) {
  const values = new Map(); let planOnly = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--plan') {
      if (planOnly) fail('PRODUCT_CLI', 'duplicate --plan');
      planOnly = true; continue;
    }
    if (!['--request', '--generator', '--out', '--options-json'].includes(flag) || values.has(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      fail('PRODUCT_CLI', 'unknown, duplicate or incomplete generation flag');
    values.set(flag, resolve(args[++i]));
  }
  for (const flag of ['--request', '--generator', '--out', '--options-json']) if (!values.has(flag)) fail('PRODUCT_CLI', 'explicit ' + flag + ' required');
  const options = captureProductJson(values.get('--options-json'));
  const captured = captureProductRequest(values.get('--request'));
  const planned = planCapturedProducts({ request: captured.request, generatorDir: values.get('--generator'), options: options.value, outDir: values.get('--out') });
  const sources = [...captured.sources, ...planned.sources,
    { role: 'generator-options', file: options.file, sha256: options.sha256, bytes: options.bytes }];
  if (planOnly) return copyImmutableData({ plan: planned.plan, sources, applied: false });
  const applied = await applyEntries({ entries: planned.plan.entries, outDir: values.get('--out'), generator: planned.plan.generator, anchorPolicy: 'written-only' });
  return copyImmutableData({ applied: true, result: applied, sources });
}

/** Shared admission for captured file requests and locally derived project requests. */
export function registeredProductProducer(generatorDir) {
  const directory = realpathSync(generatorDir);
  const generate = [[domain, generateDomain], [application, generateApplication], [childApplication, generateChildApplication],
    [designReview, generateDesignReview], [effectApplication, generateEffectApplication], [domainV2, generateDomainV2],
    [applicationV2, generateApplicationV2], [childApplicationV2, generateChildApplicationV2], [effectApplicationV2, generateEffectApplicationV2], [playService, generatePlayService]]
    .find(([path]) => directory === realpathSync(path))?.[1];
  if (!generate) fail('PRODUCT_PRODUCER', 'generator must be a shipped registered source producer');
  return { directory, generate };
}

export function planCapturedProducts({ request, generatorDir, options, outDir }) {
  const compilation = compileProductSet(request);
  if (!compilation.result) fail('PRODUCT_COMPILATION', JSON.stringify(compilation.diagnostics));
  return planCompiledProducts({ compilation, generatorDir, options, outDir });
}

export function planCompiledProducts({ compilation, generatorDir, options, outDir }) {
  const { directory, generate } = registeredProductProducer(generatorDir);
  const manifest = captureProductJson(join(directory, 'generator.json'));
  if (!compilation?.result || compilation.diagnostics?.length) fail('PRODUCT_COMPILATION', 'complete successful graph AST compilation required');
  if ([generateApplication, generateChildApplication, generateEffectApplication, generateApplicationV2, generateChildApplicationV2, generateEffectApplicationV2, generatePlayService].includes(generate)) {
    const binding = options.runtimeArtifact;
    if (!binding || !binding.repository?.startsWith('file:///')) fail('APPLICATION_ARTIFACT', 'explicit local runtime repository required');
    const jar = join(fileURLToPath(binding.repository), 'net/imadz/saga-core_2.13/0.2.1-p23.20261027.1/saga-core_2.13-0.2.1-p23.20261027.1.jar');
    const stat = lstatSync(jar);
    if (!stat.isFile() || stat.isSymbolicLink() || createHash('sha256').update(readFileSync(jar)).digest('hex') !== binding.sha256) fail('APPLICATION_ARTIFACT', 'actual frozen runtime artifact bytes do not match the explicit pin');
    if (compilation.result.products.find(p=>p.id==='execution-contract')?.payload.pipelines.length) {
      for (const [artifact, sha] of [['monarch-core','046ce5a54d4900674b9d87396bd57aefd93070e74e00b90820147c043c506b09'], ['monarch-persistence','5cf3dd2784fad05fe42102b1c5df16685bc814318e2a21121c458eb26e8205bd']]) {
        const file=join(fileURLToPath(binding.repository), 'net/imadz/'+artifact+'_2.13/0.2.1-p23.20261027.1/'+artifact+'_2.13-0.2.1-p23.20261027.1.jar');
        const s=lstatSync(file);
        if (!s.isFile() || s.isSymbolicLink() || createHash('sha256').update(readFileSync(file)).digest('hex')!==sha) fail('APPLICATION_ARTIFACT', 'actual frozen Monarch artifact bytes differ from selected finite execution profile');
      }
    }
  }
  if (generate === generatePlayService) {
    const roots = options.service?.externalSourceRoots;
    if (!Array.isArray(roots)) fail('SERVICE_OPTIONS', 'explicit external source roots required');
    const target = outDir;
    for (const root of roots) {
      if (typeof root !== 'string' || resolve(root) !== root || root.includes('\\') || root.includes('\0')) fail('SERVICE_OPTIONS', 'canonical absolute external source root required');
      let stat;
      try { stat = lstatSync(root); }
      catch { fail('SERVICE_OPTIONS', 'existing external source directory required'); }
      if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(root) !== root) fail('SERVICE_OPTIONS', 'existing non-symlink external source directory required');
      if (target === root || target.startsWith(root + '/') || root.startsWith(target + '/')) fail('SERVICE_OPTIONS', 'external sources must be disjoint from generated target');
    }
  }
  const planned = generate({ compilation, manifest: manifest.value, options });
  if (!planned.plan) fail('PRODUCT_PLAN', JSON.stringify(planned.diagnostics));
  const sources = [{ role: 'generator-manifest', file: manifest.file, sha256: manifest.sha256, bytes: manifest.bytes }];
  return copyImmutableData({ plan: planned.plan, sources });
}
