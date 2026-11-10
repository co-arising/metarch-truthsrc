import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The scaffold's author tree is the only example knowledge edit surface.
export function sagaMonarchAuthorFixture() {
  const root = fileURLToPath(new URL('../../scaffold/saga-monarch-project/', import.meta.url));
  const project = JSON.parse(readFileSync(join(root, 'truthsrc.project.json'), 'utf8'));
  const files = [];
  function visit(directory, relative = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) visit(join(directory, entry.name), file);
      else if (entry.isFile()) files.push({ file, content: readFileSync(join(directory, entry.name), 'utf8') });
      else throw new Error('ordinary fixture files required');
    }
  }
  visit(join(root, project.tree));
  const documents = project.documents.map(doc => {
    const value = JSON.parse(readFileSync(join(root, doc.file), 'utf8'));
    return { id: doc.id, schemaVersion: value.schemaVersion, value };
  });
  return { system: 'saga-monarch', context: project.context, files, project, documents };
}
