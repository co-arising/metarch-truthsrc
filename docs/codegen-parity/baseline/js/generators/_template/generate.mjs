// _template generator — the smallest contract-compliant generator. Fork this.
export function generate({ canonical }) {
  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    const cmds = (a.commands ?? []).map((c) => c?.name).filter(Boolean);
    entries.push({
      path: `aggregates/${a.name}.md`,
      content: `# ${a.name}\n\ncommands: ${cmds.join(', ') || '(none)'}\nevents: ${(a.events ?? []).map((e) => e?.name).filter(Boolean).join(', ') || '(none)'}\n`,
      kind: 'summary',
      schemaCategory: 'aggregate',
      families: [a.name],
      deps: [],
    });
  }
  return entries;
}
