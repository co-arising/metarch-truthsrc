// Multi-language deterministic codegen plugin registry for co-arising Canonical Model v2.

const codegenRegistry = new Map();

export function registerCodegenPlugin(plugin) {
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('V2_CODEGEN_INVALID: plugin must be an object');
  }
  if (typeof plugin.target !== 'string' || plugin.target.length === 0) {
    throw new Error('V2_CODEGEN_INVALID: plugin must declare non-empty target');
  }
  if (typeof plugin.generate !== 'function') {
    throw new Error('V2_CODEGEN_INVALID: plugin must implement generate(canonicalV2, options)');
  }
  codegenRegistry.set(plugin.target, plugin);
  return plugin;
}

export function getCodegenPlugin(target) {
  return codegenRegistry.get(target) ?? null;
}

export function listCodegenPlugins() {
  return [...codegenRegistry.keys()].sort();
}
