export function generate({canonical, options}) {
  const knowledgeId = `saga:${canonical.sagas[0].id}`;
  const entries = ['one', 'two'].map(name => ({
    path: `fixture/${name}.txt`, kind: 'fixture', families: [], knowledgeId,
    content: `Fixture only, not runnable Saga code: ${knowledgeId} / ${name}\n`
  }));
  if (options.collision === 'yes') entries.push({...entries[0], path: 'fixture/ONE.txt'});
  return entries;
}
