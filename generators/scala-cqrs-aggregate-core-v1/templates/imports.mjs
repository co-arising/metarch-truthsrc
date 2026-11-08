// Keep ordinary imports readable, but never let a target binding shadow a
// framework name, generated companion or method type parameter.
export function importsFor(artifact, groups, reserved = []) {
  const rows = groups.flat();
  const blocked = new Set([artifact.name, ...reserved]);
  const names = {}, lines = [];
  const qualifyImport = fqn => artifact.package.split('.').slice(1).includes(fqn.split('.')[0]) ? '_root_.' + fqn : fqn;
  for (const row of rows) {
    const name = row.fqn.split('.').at(-1);
    const collision = blocked.has(name) || rows.some(other => other.fqn !== row.fqn && other.fqn.split('.').at(-1) === name);
    names[row.key] = collision ? '_root_.' + row.fqn : name;
  }
  for (const group of groups) {
    const included = [...new Set(group.filter(row => !names[row.key].startsWith('_root_.')).map(row => row.fqn))];
    if (!included.length) continue;
    const packages = included.map(fqn => fqn.slice(0, fqn.lastIndexOf('.')));
    if (included.length > 1 && packages.every(pkg => pkg === packages[0]))
      lines.push('import ' + qualifyImport(packages[0]) + '.{' + included.map(fqn => fqn.split('.').at(-1)).join(', ') + '}');
    else lines.push(...included.map(fqn => 'import ' + qualifyImport(fqn)));
  }
  return { names, text: lines.join('\n') };
}

export const named = (key, artifact) => ({ key, fqn: artifact.fqn });
export const library = (key, fqn) => ({ key, fqn });
