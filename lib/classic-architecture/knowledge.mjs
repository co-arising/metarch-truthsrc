import { scalaIdentifier } from './naming.mjs';

// KnowledgeAnchorDoc with the classic profile's empty elementHashById. Literal
// note IDs and descriptions are retained; no hash attachment is inferred.
export function conceptLine(noteId) {
  return noteId === null ? [] : [`@knowledge ${noteId}`];
}

export function paramLines(fields) {
  return fields.filter(field => field.noteId !== null).map(field => {
    const description = field.description.length === 0 ? '' : ` ${field.description}`;
    return `@param ${scalaIdentifier(field.name)}${description}  @knowledge ${field.noteId}`;
  });
}

export function commentBlock(lines, indent = '') {
  if (lines.length === 0) return '';
  return [`${indent}/**`, ...lines.map(line => `${indent} * ${line}`), `${indent} */`].join('\n') + '\n';
}

export function fieldDoc(fields, indent = '') {
  return commentBlock(paramLines(fields), indent);
}
