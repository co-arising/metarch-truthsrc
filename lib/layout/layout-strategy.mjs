// Orthogonal layout strategies for code generation:
//   1. PackageLayoutStrategy — logical namespace (Scala `package` & `import`)
//   2. FileLayoutStrategy    — physical module & file path (e.g. single-module
//                              Play `app/...` vs multi-module `domain/src/main/scala/...`)
//
// Emitters and derivations must resolve logical packages and physical file paths
// through this module rather than hardcoding `app/` or concatenating package
// segments directly. Switching FileLayoutStrategy changes physical module paths
// while keeping every Scala `package` declaration and `import` unchanged.

const fail = message => { throw new Error('LAYOUT_STRATEGY: ' + message); };

const normalizeSegments = value => {
  if (typeof value !== 'string' || !value.trim()) fail('nonempty package or path segment required');
  return value.trim().split('.').filter(Boolean);
};

export const packageToRelativeDir = packageName =>
  normalizeSegments(packageName).join('/');

export function resolvePackage(basePackage, subpackage = '') {
  const base = normalizeSegments(basePackage).join('.');
  if (!subpackage) return base;
  const sub = normalizeSegments(subpackage).join('.');
  return `${base}.${sub}`;
}

export function workflowSubpackageSlug(pipelineId) {
  if (typeof pipelineId !== 'string' || !pipelineId.trim()) fail('nonempty pipelineId required');
  const stripped = pipelineId.trim().replace(/-v\d+$/u, '');
  const parts = stripped.split(/[-_]+/u).filter(Boolean);
  const body = parts.length >= 2 ? parts.slice(1) : parts;
  return body.join('_').toLowerCase();
}

export function readmodelSubpackageSlug(storeId) {
  if (typeof storeId !== 'string' || !storeId.trim()) fail('nonempty storeId required');
  const stripped = storeId.trim().replace(/(?:Readside|Projection|View|Store)$/u, '') || storeId.trim();
  return stripped
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1_$2')
    .replace(/[-\s]+/gu, '_')
    .toLowerCase();
}

export function inferLayer(packageOrSubpackage) {
  if (typeof packageOrSubpackage !== 'string' || !packageOrSubpackage) return 'application';
  const segs = packageOrSubpackage.split('.').filter(Boolean);
  if (segs.includes('domain')) return 'domain';
  if (segs.includes('interfaces')) return 'interfaces';
  if (segs.includes('modules')) return 'modules';
  if (segs.includes('infrastructure')) return 'infrastructure';
  if (segs.includes('application')) return 'application';
  return 'application';
}

export function inferModule(layer, subpackage = '') {
  if (layer === 'domain') return 'domain';
  if (layer === 'interfaces') return 'interfaces';
  if (layer === 'modules') return 'bootstrap';
  if (layer === 'infrastructure') {
    const segs = typeof subpackage === 'string' ? subpackage.split('.') : [];
    if (segs.includes('bootstrap')) return 'bootstrap';
    return 'infrastructure';
  }
  return 'application';
}

export const DEFAULT_PACKAGE_LAYOUT = Object.freeze({
  id: 'three-layer-problem-space',
  resolvePackage,
  inferLayer,
});

export const SINGLE_MODULE_PLAY_LAYOUT = Object.freeze({
  id: 'single-module-play',
  scalaSourceRoot: () => 'app',
  protoDir: () => 'app/protobuf',
  testScalaRoot: () => 'src/test/scala',
  testResourceRoot: () => 'src/test/resources',
  configRoot: () => 'conf',
  resolveScalaPath({ packageName, fileName }) {
    return `app/${packageToRelativeDir(packageName)}/${fileName}`;
  },
  resolveScalaDir({ packageName }) {
    return `app/${packageToRelativeDir(packageName)}`;
  },
  resolveProtoPath({ fileName }) {
    return `app/protobuf/${fileName}`;
  },
  resolveTestScalaPath({ fileName }) {
    return `src/test/scala/${fileName}`;
  },
  resolveTestResourcePath({ fileName }) {
    return `src/test/resources/${fileName}`;
  },
  resolveConfigPath({ fileName }) {
    return `conf/${fileName}`;
  },
});

export function createMultiModuleLayout(config = {}) {
  const modules = {
    domain: 'domain',
    application: 'application',
    interfaces: 'interfaces',
    infrastructure: 'infrastructure',
    bootstrap: 'bootstrap',
    ...(config.modules ?? {}),
  };
  const scalaSourceDir = config.scalaSourceDir ?? 'src/main/scala';
  const protoDir = config.protoDir ?? `${modules.infrastructure}/src/main/protobuf`;
  const testScalaDir = config.testScalaDir ?? `${modules.bootstrap}/src/test/scala`;
  const testResourceDir = config.testResourceDir ?? `${modules.bootstrap}/src/test/resources`;
  const configDir = config.configDir ?? `${modules.bootstrap}/src/main/resources`;

  const moduleFor = ({ layer, subpackage, module, packageName }) => {
    if (module && modules[module]) return modules[module];
    const resolvedLayer = layer ?? inferLayer(subpackage || packageName);
    const key = inferModule(resolvedLayer, subpackage || packageName);
    return modules[key] ?? modules.application;
  };

  return Object.freeze({
    id: config.id ?? 'multi-module-layered',
    modules: Object.freeze({ ...modules }),
    scalaSourceRoot(meta) {
      return `${moduleFor(meta)}/${scalaSourceDir}`;
    },
    protoDir: () => protoDir,
    testScalaRoot: () => testScalaDir,
    testResourceRoot: () => testResourceDir,
    configRoot: () => configDir,
    resolveScalaPath(meta) {
      const root = `${moduleFor(meta)}/${scalaSourceDir}`;
      return `${root}/${packageToRelativeDir(meta.packageName)}/${meta.fileName}`;
    },
    resolveScalaDir(meta) {
      const root = `${moduleFor(meta)}/${scalaSourceDir}`;
      return `${root}/${packageToRelativeDir(meta.packageName)}`;
    },
    resolveProtoPath({ fileName }) {
      return `${protoDir}/${fileName}`;
    },
    resolveTestScalaPath({ fileName }) {
      return `${testScalaDir}/${fileName}`;
    },
    resolveTestResourcePath({ fileName }) {
      return `${testResourceDir}/${fileName}`;
    },
    resolveConfigPath({ fileName }) {
      return `${configDir}/${fileName}`;
    },
  });
}

export const MULTI_MODULE_LAYERED_LAYOUT = createMultiModuleLayout();

const PRESETS = Object.freeze({
  'single-module-play': SINGLE_MODULE_PLAY_LAYOUT,
  'multi-module-layered': MULTI_MODULE_LAYERED_LAYOUT,
});

export function resolveFileLayout(layoutOrOptions) {
  const candidate = layoutOrOptions && typeof layoutOrOptions === 'object' && 'fileLayout' in layoutOrOptions
    ? layoutOrOptions.fileLayout
    : layoutOrOptions;
  if (!candidate) return SINGLE_MODULE_PLAY_LAYOUT;
  if (typeof candidate === 'string') {
    const preset = PRESETS[candidate];
    if (!preset) fail(`unknown fileLayout preset ${JSON.stringify(candidate)}; known: ${Object.keys(PRESETS).join(', ')}`);
    return preset;
  }
  if (typeof candidate === 'object' && typeof candidate.resolveScalaPath === 'function' && typeof candidate.resolveProtoPath === 'function') {
    return candidate;
  }
  fail('fileLayout must be a preset name or a FileLayoutStrategy object');
}

export function scalaSourcePath(packageName, fileName, options = {}) {
  const layout = resolveFileLayout(options.layout ?? options.fileLayout);
  return layout.resolveScalaPath({
    packageName,
    fileName,
    layer: options.layer ?? inferLayer(options.subpackage || packageName),
    subpackage: options.subpackage ?? '',
    module: options.module,
  });
}

export function scalaSubpackagePath(basePackage, subpackage, fileName, options = {}) {
  const packageName = resolvePackage(basePackage, subpackage);
  return scalaSourcePath(packageName, fileName, {
    ...options,
    subpackage,
    layer: options.layer ?? inferLayer(subpackage),
  });
}

export function scalaDirPath(packageName, options = {}) {
  const layout = resolveFileLayout(options.layout ?? options.fileLayout);
  return layout.resolveScalaDir({
    packageName,
    layer: options.layer ?? inferLayer(options.subpackage || packageName),
    subpackage: options.subpackage ?? '',
    module: options.module,
  });
}

export function protoSchemaPath(fileName, options = {}) {
  const layout = resolveFileLayout(options.layout ?? options.fileLayout);
  return layout.resolveProtoPath({ fileName });
}

// Project a plan's physical paths (and internal deps) from single-module Play
// layout to any target FileLayoutStrategy while preserving 100% identical file
// content (Scala `package` and `import` lines remain untouched).
export function remapPlanEntries(entries, targetLayout) {
  const layout = resolveFileLayout(targetLayout);
  if (layout.id === SINGLE_MODULE_PLAY_LAYOUT.id) return entries;
  const pathMap = new Map();
  const remapPath = filePath => {
    if (filePath.startsWith('app/protobuf/')) {
      return layout.resolveProtoPath({ fileName: filePath.slice('app/protobuf/'.length) });
    }
    if (filePath.startsWith('app/') && filePath.endsWith('.scala')) {
      const rel = filePath.slice('app/'.length);
      const slash = rel.lastIndexOf('/');
      if (slash > 0) {
        const pkgDir = rel.slice(0, slash);
        const fileName = rel.slice(slash + 1);
        const packageName = pkgDir.replaceAll('/', '.');
        return layout.resolveScalaPath({
          packageName,
          fileName,
          layer: inferLayer(packageName),
          subpackage: packageName,
        });
      }
    }
    if (filePath.startsWith('src/test/scala/')) {
      return layout.resolveTestScalaPath({ fileName: filePath.slice('src/test/scala/'.length) });
    }
    if (filePath.startsWith('src/test/resources/')) {
      return layout.resolveTestResourcePath({ fileName: filePath.slice('src/test/resources/'.length) });
    }
    if (filePath.startsWith('conf/')) {
      return layout.resolveConfigPath({ fileName: filePath.slice('conf/'.length) });
    }
    return filePath;
  };
  for (const entry of entries) pathMap.set(entry.path, remapPath(entry.path));
  return entries.map(entry => ({
    ...entry,
    path: pathMap.get(entry.path) ?? entry.path,
    ...(Array.isArray(entry.deps)
      ? { deps: entry.deps.map(dep => pathMap.get(dep) ?? remapPath(dep)) }
      : {}),
  }));
}
