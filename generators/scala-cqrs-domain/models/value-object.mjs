// Plain-data counterpart of the pinned domain/ValueObjectModel.scala.
// Scala Option values are null; immutable arrays represent Seq and Set values.
const sequence = values => Object.freeze([...values]);

export function ValueObjectModel(
  selfType, fields, dependencies, logicMethods = [], voNoteIds = [], voOwnNoteId = null,
) {
  const noteIds = sequence(voNoteIds);
  return Object.freeze({
    selfType,
    fields: sequence(fields),
    dependencies: sequence(dependencies),
    logicMethods: sequence(logicMethods),
    voNoteIds: noteIds,
    voOwnNoteId,
    noteIds,
    // ArtifactModel supplies these defaults, independently of TypeRef.fqn's
    // special handling of an empty package name.
    morphisms: sequence([]),
    fqn: `${selfType.packageName}.${selfType.name}`,
  });
}
