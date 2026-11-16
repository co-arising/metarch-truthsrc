#!/usr/bin/env node
// truthsrc — CLI dispatcher. No application imports before help/runtime preflight.
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertNodeRuntime, MIN_NODE_VERSION } from '../lib/node-runtime.mjs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? resolve(process.argv[i + 1]) : dflt;
};
const [cmd, ...args] = process.argv.slice(2);
const projectCommands = ['init', 'compile-project', 'generate-project', 'status-project', 'query-project', 'verify-project', 'view-project'];

const USAGE = `truthsrc ${version} — git-native knowledge → code → source
Requires Node >=${MIN_NODE_VERSION}. Start with: truthsrc init counter-lab --format human

  truthsrc --help | help [command] | <command> --help
  truthsrc --version
  Project commands accept --format human|json (default: existing JSON).
  Help and version do not import SQLite or write project files.


  truthsrc compile   --tree <dir> [--out canonical.json]   tree → canonical projection
  truthsrc compile-products --request <files-manifest> --out <new-product-set>
                                                           static reference/decision products; no code generation
  truthsrc generate-products --request <files-manifest> --generator <shipped-dir> --out <owned-dir>
                             --options-json <file> [--plan]
                                                           typed source plan; --plan never writes the target
  truthsrc compile-execution --tree <dir> | --in <canonical> [--binding <file>] --out <ir>
  truthsrc compile-sagas     --tree <dir> | --in <canonical> [--binding <file>] --out <ir>
                                                           strict contract compilation; never runtime certification
  truthsrc decompose --canonical <file> --tree <dir>       canonical → tree atoms
  truthsrc validate  [--tree <dir>]                        V* structure + R* relations + ES/CS/AG/RF/SM stage rules
  truthsrc roundtrip [--tree <dir>]                        compile∘decompose∘compile identity gate
  truthsrc graph     --tree <dir> | --canonical <file> --out <db>
                                                           build the local SQLite-class graph store
                                                           (node:sqlite single file; Node >= ${MIN_NODE_VERSION}; pure
                                                           cache — delete and rebuild any time; all
                                                           query verbs apply)
  truthsrc compact-yaml --tree <author-tree> [--plan | --out <new-tree> | --in-place]
                                                           opt-in lossless micro-grammar author migration
  truthsrc compact-author --tree <author-tree> --groups <selection.json> [--plan | --out <new-tree> | --in-place]
                                                           source-bound finite structural compression
  truthsrc init      <new-project-dir>                     scaffold tree + truthsrc.project.json; refuses existing directory
  truthsrc compile-project --project <config>                derive and compile locally; JSON result, no writes
  truthsrc generate-project --project <config> --out <owned-dir> [--plan] [--update]
                                                           formal source generation; update admits unchanged owned files
  truthsrc status-project --project <config> --out <owned-dir>
                                                           separate current inputs, code edits and missing evidence
  truthsrc query-project --project <config> --out <owned-dir> --knowledge <identity-or-source>
  truthsrc query-project --project <config> --out <owned-dir> --file <relative-file> [--symbol <name> | --line <n>]
                                                           knowledge ↔ source provenance; verified lines return exact spans
  truthsrc verify-project --project <config> --out <owned-dir> [--requirements <json>]
                                                           read-only anchor verification; passed=false exits 2
  truthsrc view-project --project <config> --out <owned-dir> --html <new-file>
                       [--tour <json>] [--knowledge <selector>]
                                                           export a local read-only snapshot view; not a live service
  truthsrc migrate-author --tree <legacy-tree> --format <truthsrc/v1|metarch.truth.v1>
                          --out <new-system-root> --system <id> --context <id>
                          --name <name> --responsibility <text> [--plan] [--ignore-os-metadata]
                          [--legacy-stage-policy bc-seven-legacy-carrier/v1]
                                                           explicit lossless author migration; blocked BC plan reports JSON/exit 2
  truthsrc export-metarch --tree <new-author-root> --out <new-product-bundle>
                                                           five source-bound BC products; no active-source switch
  truthsrc generate  --in <canonical> --generator <dir> --out <dir> [--option k=v]
                                                           run a generator (ledger + anchors emitted)
                     [--options-json <file>]                explicit producer options, including nested bindings/IR
                     [--concern <name>] [--families A,B] [--concerns <file>]
                                                           incremental regeneration: only the faces the
                                                           concern scope selects are rewritten (engine: core;
                                                           presets: project-level registry, default ./concerns.json)
  truthsrc init-generator <dir>                            scaffold a custom generator
  truthsrc mcp                                         MCP stdio server: query verbs as tools
                                                       (stdio JSON-RPC; configure your MCP client with
                                                       "command": "truthsrc", "args": ["mcp"])
`;

const die = (msg) => { console.error(msg); process.exit(2); };
const commands = new Set([...USAGE.matchAll(/^  truthsrc ([a-z][a-z-]*)/gm)].map(match => match[1]));
commands.delete('help');
function help(command) {
  if (!command) return USAGE;
  if (!commands.has(command)) die(`Unknown command: ${command}. Run truthsrc --help.`);
  const lines = USAGE.split('\n'), selected = [];
  let include = false;
  for (const line of lines) {
    if (line.startsWith('  truthsrc ')) include = line.startsWith(`  truthsrc ${command} `);
    if (include) selected.push(line);
  }
  return `truthsrc ${version}\n\n${selected.join('\n')}\n`
    + (projectCommands.includes(command) ? '\n  --format human|json    Presentation only; default JSON stays unchanged.\n' : '')
    + (command === 'init' ? '\nCreates and validates a Counter author project; does not generate code.\nUse an absent destination. Next: generate-project --project <dir>/truthsrc.project.json --out <dir>/generated --plan\n' : '');
}
if (!cmd || (['--help', '-h', 'help'].includes(cmd) && args.length === 0)) {
  process.stdout.write(help()); process.exit(0);
}
if (cmd === 'help') {
  if (args.length !== 1) die('usage: truthsrc help [command]');
  process.stdout.write(help(args[0])); process.exit(0);
}
if (['--version', '-v'].includes(cmd)) {
  if (args.length) die('usage: truthsrc --version');
  console.log(version); process.exit(0);
}
if (!commands.has(cmd)) die(`Unknown command: ${cmd}. Run truthsrc --help.`);
if (args.includes('--help') || args.includes('-h')) {
  if (args.length !== 1) die('Use <command> --help by itself; other arguments were not executed.');
  process.stdout.write(help(cmd)); process.exit(0);
}
try { assertNodeRuntime(); } catch (error) { die(`[FAIL] ${error.message}`); }

// Legacy tree defaults are intentionally retained, but evaluated only after preflight.
const strictCompilation = [...projectCommands, 'compact-yaml', 'compact-author', 'migrate-author', 'export-metarch', 'generate-products', 'compile-products', 'compile-execution', 'compile-sagas', 'generate'].includes(cmd);
const TREE = strictCompilation ? undefined : arg('--tree', resolve('tree'));
const OUT = strictCompilation ? undefined : arg('--out', resolve('canonical.json'));

switch (cmd) {
  case 'compact-yaml':
  case 'compact-author': {
    try {
      const { compactAuthorCli } = await import('../lib/author-compact-cli.mjs');
      console.log(JSON.stringify(compactAuthorCli(process.argv.slice(3), { micro: cmd === 'compact-yaml' })));
    } catch (error) { die(`[FAIL] ${error.message}`); }
    break;
  }
  case 'export-metarch': {
    try {
      const flags = new Map(), args = process.argv.slice(3);
      for (let i = 0; i < args.length; i += 2) {
        if (!['--tree', '--out'].includes(args[i]) || flags.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('explicit unique --tree and --out required');
        flags.set(args[i], args[i + 1]);
      }
      if (flags.size !== 2) throw new Error('explicit --tree and --out required');
      const { writeMetarchBundle } = await import('../lib/compat/metarch-bundle.mjs');
      console.log(JSON.stringify(writeMetarchBundle({ treeDir: flags.get('--tree'), outDir: flags.get('--out') })));
    } catch (error) { die(`[FAIL] ${error.message}`); }
    break;
  }
  case 'migrate-author': {
    try {
      const { migrateAuthorCli } = await import('../lib/author-migrate.mjs');
      const result = await migrateAuthorCli(process.argv.slice(3));
      console.log(JSON.stringify(result));
      if (result.status === 'blocked') process.exitCode = 2;
    } catch (error) { die(`[FAIL] ${error.message}`); }
    break;
  }
  case 'init':
  case 'query-project':
  case 'status-project':
  case 'compile-project':
  case 'generate-project':
  case 'verify-project':
  case 'view-project': {
    const { projectFormatArgs, renderProjectResult, renderProjectError } = await import('../lib/cli-presentation.mjs');
    let format = 'json';
    try {
      const parsed = projectFormatArgs(args);
      format = parsed.format;
      let result;
      if (cmd === 'init') {
        const { initProject } = await import('../lib/project/init.mjs');
        result = initProject(parsed.args);
      } else if (cmd === 'verify-project') {
        const { verifyProjectCli } = await import('../lib/project/verify.mjs');
        result = await verifyProjectCli(parsed.args);
      } else if (cmd === 'view-project') {
        const { viewProjectCli } = await import('../lib/project/view.mjs');
        result = await viewProjectCli(parsed.args);
      } else if (cmd === 'query-project' || cmd === 'status-project') {
        const { projectQueryCli } = await import('../lib/project/query.mjs');
        result = await projectQueryCli(cmd, parsed.args);
      } else {
        const { projectCli } = await import('../lib/project/cli.mjs');
        result = await projectCli(cmd, parsed.args);
      }
      console.log(format === 'json' ? JSON.stringify(result) : renderProjectResult(cmd, result, parsed.args));
      if (cmd === 'verify-project' && result.passed === false) process.exitCode = 2;
    } catch (error) { die(format === 'human' ? renderProjectError(cmd, error) : `[FAIL] ${error.message}`); }
    break;
  }
  case 'generate-products': {
    try {
      const { generateProductCli } = await import('../lib/products/generate-cli.mjs');
      console.log(JSON.stringify(await generateProductCli(process.argv.slice(3))));
    } catch (error) { die(`[FAIL] ${error.message}`); }
    break;
  }
  case 'compile-products': {
    try {
      const { compileProductCli } = await import('../lib/products/cli.mjs');
      console.log(JSON.stringify(compileProductCli(process.argv.slice(3))));
    } catch (error) { die(`[FAIL] ${error.message}`); }
    break;
  }
  case 'compile-execution':
  case 'compile-sagas': {
    try {
      const { compileContractCli } = await import('../lib/execution/cli.mjs');
      const result = await compileContractCli(cmd === 'compile-execution' ? 'execution' : 'saga', process.argv.slice(3));
      console.log(`✅ ${cmd} → ${result.output} (contract-only; runtime not verified)`);
    } catch (error) {
      die(`[FAIL] ${error.message}`);
    }
    break;
  }
  case 'compile': {
    const { compileTree } = await import('../lib/compile.mjs');
    writeFileSync(OUT, compileTree(TREE));
    console.log(`✅ ${TREE} → ${OUT}`);
    break;
  }
  case 'decompose': {
    const { decomposeCanonical } = await import('../lib/decompose.mjs');
    const c = arg('--canonical', OUT);
    if (!existsSync(c)) die(`canonical not found: ${c}`);
    const n = decomposeCanonical(readFileSync(c, 'utf8'), TREE);
    console.log(`✅ ${c} → ${TREE} (${n} atoms)`);
    break;
  }
  case 'validate': {
    const { validateTree } = await import('../lib/validate.mjs');
    const { hard, notices } = validateTree(TREE);
    for (const h of hard) console.error('🔴 ' + h);
    for (const n of notices) console.warn('🟡 ' + n);
    console.log(hard.length ? `❌ ${hard.length} hard · ${notices.length} notice` : `✅ 0 hard · ${notices.length} notice`);
    process.exit(hard.length ? 1 : 0);
    break;
  }
  case 'roundtrip': {
    const { roundtrip } = await import('../lib/roundtrip.mjs');
    const r = roundtrip(TREE);
    if (!r.ok) die(`❌ roundtrip red (${r.stage}): ${r.msg}`);
    console.log(`✅ roundtrip identity — ${r.atoms} atoms, canonical byte-stable`);
    break;
  }
  case 'graph': {
    // graph --tree <dir> | --canonical <file> --out <db> — local embedded graph store.
    // Pure cache: the db is derivable from canonical bytes and carries no truth of its own.
    const source = arg('--canonical', arg('--tree', null));
    const out = process.argv.includes('--out') ? resolve(process.argv[process.argv.indexOf('--out') + 1]) : null;
    if (!source) die('usage: truthsrc graph --tree <dir> | --canonical <file> --out <db>');
    if (!out) die('truthsrc graph requires an explicit --out <db> (never write canonical.json by accident)');
    try {
      const { compileTree } = await import('../lib/compile.mjs');
      const canonical = process.argv.includes('--canonical')
        ? JSON.parse(readFileSync(source, 'utf8'))
        : JSON.parse(compileTree(source));
      const { buildGraphStore } = await import('../lib/graphstore.mjs');
      const s = buildGraphStore(canonical, { file: out });
      console.log(`✅ graph store ${s.file} — ${s.nodeCount} nodes · ${s.edgeCount} edges · workshop ${s.workshop} · canonical ${s.canonicalSha256.slice(0, 19)}…`);
    } catch (error) {
      die(`[FAIL] ${error.message}`);
    }
    break;
  }
  case 'generate': {
    // generate --in <canonical.json> --generator <dir> --out <target> [--option k=v ...]
    //          [--concern <name>] [--families A,B] [--concerns <file>]
    let parsed;
    try {
      const { generatorCliArgs } = await import('../lib/execution/generate-cli.mjs');
      parsed = generatorCliArgs(process.argv.slice(3));
    } catch (error) { die(`[FAIL] ${error.message}`); }
    const { values, options } = parsed;
    const gen = values['--generator'];
    const c = values['--in'];
    const o = values['--out'];
    const CONCERN = values['--concern'] ?? null;
    const FAMILIES = values['--families'] ?? null;
    const concern = CONCERN ? { name: CONCERN, families: FAMILIES, registryFile: values['--concerns'] ?? resolve('concerns.json') } : null;
    if (concern && !existsSync(concern.registryFile)) die(`concerns registry not found: ${concern.registryFile} (--concerns <file>; default ./concerns.json)`);
    if (process.argv.includes('--plan')) {
      const { plan, mergedRows, scopeOf } = await import('../src/core/generate.mjs');
      let planResult;
      try { planResult = await plan({ canonicalFile: c, generatorDir: gen, options }); }
      catch (error) { die(`[FAIL] ${error.message}`); }
      const { manifest, entries } = planResult;
      if (concern) {
        const rows = mergedRows(o ?? resolve('.'), entries);
        const s = scopeOf(rows, concern);
        console.log(`  🎛 concern=${CONCERN}（families: ${FAMILIES ?? 'all'}｜in-scope ${s.set.size} = predicate ${s.base.size} + closure ${s.set.size - s.base.size}）`);
      }
      for (const e of entries) console.log(`  ${e.kind.padEnd(16)} ${e.path}`);
      console.log(`✅ plan [${manifest.name}] — ${entries.length} files (nothing written)`);
      break;
    }
    let r;
    try {
      const { apply } = await import('../src/core/generate.mjs');
      r = await apply({ canonicalFile: c, generatorDir: gen, outDir: o, options, concern });
    } catch (e) {
      die(`[FAIL] ${e.message}`);
    }
    console.log(`✅ generate [${r.name}] — ${r.total} planned · ${r.written} written · ${r.identical} identical`
      + (r.merged ? ` · ${r.merged} merged (MANUAL blocks preserved)` : '')
      + (r.routesNoTarget ? ` · ${r.routesNoTarget} routes block awaiting a target conf/routes` : '')
      + (concern ? ` · ${r.kept} kept (out-of-scope) · in-scope ${r.inScope} (closure +${r.closureAdded})` + (r.globalFlowed ? ` · ${r.globalFlowed} global flowed` : '') : ''));
    console.log(`   ledger → ${r.ledger}\n   anchors → ${r.anchors}`);
    break;
  }
  case 'init-generator': {
    const dir = process.argv[3];
    if (!dir) die('usage: truthsrc init-generator <dir>');
    const root = resolve(dir);
    mkdirSync(root, { recursive: true });
    for (const f of ['generator.json', 'generate.mjs'])
      copyFileSync(new URL(`../generators/_template/${f}`, import.meta.url), join(root, f));
    writeFileSync(join(root, 'generator.json'),
      readFileSync(join(root, 'generator.json'), 'utf8').replace('"name": "_template"', `"name": "${root.split('/').pop()}"`));
    console.log(`✅ generator scaffolded at ${root} — edit generate.mjs, then: truthsrc generate --generator ${root} --in <canonical> --out <dir>`);
    break;
  }
  case 'mcp': {
    const { runMcpServer } = await import('../mcp/server.mjs');
    runMcpServer();
    break;
  }
  default:
    process.stdout.write(USAGE);
    process.exit(cmd ? 2 : 0);
}
