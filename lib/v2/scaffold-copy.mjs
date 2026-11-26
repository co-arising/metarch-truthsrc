// Copies static v2 project scaffolds (`scaffold-v2/ts` and/or `scaffold-v2/scala-play`)
// into a target project root and expands template tokens deterministically.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveStoryHttpRoutes, toCamel, toPascal, toSlug } from './codegen/onion-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAFFOLD_V2_ROOT = resolve(__dirname, '../../scaffold-v2');

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function renderTemplate(raw, vars) {
  return raw
    .replaceAll('{{SYSTEM}}', vars.system)
    .replaceAll('{{CONTEXT}}', vars.context)
    .replaceAll('{{PACKAGE}}', vars.packageName)
    .replaceAll('{{PLAY_ROUTES}}', vars.playRoutes);
}

function buildTsServerEntry(canonicalV2) {
  const appStories = (canonicalV2.behaviors ?? []).filter(b => b.layer === 'application');
  const lines = [
    `// Handwritten runnable HTTP server entrypoint for ${canonicalV2.system}/${canonicalV2.context}`,
    '// Wires bounded @cloze handlers into the generated Onion Architecture bootstrap module.',
    'import { startServer } from "../generated-scaffold/ts/modules/bootstrap.ts";',
  ];
  for (const beh of appStories) {
    const slug = toSlug(beh.target);
    const varName = `${toCamel(toPascal(beh.target))}Handler`;
    lines.push(`import { ${varName} } from "./${slug}.cloze.ts";`);
  }
  lines.push('');
  lines.push('const port = Number(process.env.PORT ?? 3000);');
  lines.push('const handlers = {');
  for (const beh of appStories) {
    const varName = `${toCamel(toPascal(beh.target))}Handler`;
    lines.push(`  ${JSON.stringify(beh.target)}: ${varName},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('const server = startServer({ port, handlers });');
  lines.push('server.on("listening", () => {');
  lines.push('  const addr = server.address();');
  lines.push('  const boundPort = typeof addr === "object" && addr ? addr.port : port;');
  lines.push(`  process.stdout.write(${JSON.stringify(`[co-arising] ${canonicalV2.system}/${canonicalV2.context} listening on http://127.0.0.1:`)} + boundPort + "\\n");`);
  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

export function copyV2Scaffold({
  targetDir,
  canonicalV2,
  targets = ['typescript'],
  packageName = 'example.v2',
  force = false,
} = {}) {
  const absRoot = resolve(targetDir);
  const routes = deriveStoryHttpRoutes(canonicalV2);
  const playRoutes = routes
    .map(r => `${r.method.padEnd(7)} ${r.path.padEnd(43)} controllers.PlayHttpBridge.dispatch(path = ${JSON.stringify(r.path)})`)
    .join('\n');

  const vars = {
    system: canonicalV2.system || 'app',
    context: canonicalV2.context || 'core',
    packageName,
    playRoutes: playRoutes || '# No application routes declared yet',
  };

  const copied = [];
  const skipped = [];

  const copyTree = (srcSubdir, destBase = absRoot) => {
    const srcRoot = join(SCAFFOLD_V2_ROOT, srcSubdir);
    for (const srcFile of walkFiles(srcRoot)) {
      const rel = relative(srcRoot, srcFile).split(sep).join('/');
      const destRel = rel.endsWith('.tmpl') ? rel.slice(0, -5) : rel;
      const destAbs = join(destBase, destRel);
      if (existsSync(destAbs) && !force) {
        skipped.push(relative(absRoot, destAbs).split(sep).join('/'));
        continue;
      }
      mkdirSync(dirname(destAbs), { recursive: true });
      const raw = readFileSync(srcFile, 'utf8');
      const rendered = rel.endsWith('.tmpl') ? renderTemplate(raw, vars) : raw;
      writeFileSync(destAbs, rendered, 'utf8');
      copied.push(relative(absRoot, destAbs).split(sep).join('/'));
    }
  };

  if (targets.includes('typescript')) {
    copyTree('ts');
    const serverAbs = join(absRoot, 'handwritten/server.ts');
    if (!existsSync(serverAbs) || force) {
      mkdirSync(dirname(serverAbs), { recursive: true });
      writeFileSync(serverAbs, buildTsServerEntry(canonicalV2), 'utf8');
      copied.push('handwritten/server.ts');
    } else {
      skipped.push('handwritten/server.ts');
    }
  }

  if (targets.includes('scala')) {
    copyTree('scala-play', join(absRoot, 'play-scaffold'));
  }

  return {
    schemaVersion: 'co-arising.scaffold-copy-v2/v1',
    rootDir: absRoot,
    targets,
    copied,
    skipped,
  };
}
