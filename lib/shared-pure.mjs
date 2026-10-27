// Pure vocabulary shared by the snapshot compiler and tree adapters.
export const STAGE_ORDER = Object.freeze([
  'eventStorming', 'commandStorming', 'aggregateDiscovery', 'subdomainExploration',
  'contextMapping', 'refining', 'storyMapping',
]);

// Keep the reference filename shape: non-ASCII characters and repeated dashes
// are not collapsed or trimmed.
export const slug = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
