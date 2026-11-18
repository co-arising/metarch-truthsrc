// Only builder-level metadata operations live here. Type resolution, original
// metadata FQNs and Scala collection iteration are Main-owned context services.
export function requireMetadata(ctx, kind, ref, label) {
  const meta = ctx.metaRegistry.resolveByName(kind, ref.targetName);
  if (meta === null || meta === undefined) {
    throw new Error(`Critical Error: Cannot resolve ${label} Metadata for ${ref.targetName}`);
  }
  return meta;
}

export function absoluteDomainPackage(meta, ctx) {
  // DomainDrivenMetadata.fullQualifiedName is a derived Scala member, not a
  // constructor field in the exported input. Never infer it from a TypeRef.
  const path = ctx.metadataFqn(meta);
  const end = path.lastIndexOf('.');
  return end < 0 ? ctx.basePackage : `${ctx.basePackage}.${path.slice(0, end)}`;
}

export function aggregateNoteIds(meta) {
  return meta.noteId === null || meta.noteId === undefined ? [] : [meta.noteId];
}

export function fieldComment(introducedIn) {
  if (introducedIn === null || introducedIn === undefined) return null;
  // Java String.trim, not JS Unicode whitespace normalization.
  const trimmed = introducedIn.replace(/^[\x00-\x20]+|[\x00-\x20]+$/gu, '');
  return trimmed.length === 0 ? null : trimmed;
}
