// Limited fixed-supply POM inspection, not Maven XML evaluation or resolution.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { absolutePath } from './compiler-tools.mjs';

export function artifactStem(cache, coordinate) {
  absolutePath(cache, '--maven-cache');
  assert(/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/.test(coordinate), 'Literal Maven coordinate required');
  const [group, artifact, version] = coordinate.split(':');
  return join(cache, ...group.split('.'), artifact, version, `${artifact}-${version}`);
}

// Extracted unchanged from the finite Actor supply reader. Profiles/build and
// dependencyManagement do not extend the explicitly selected compile supply.
export function declaredPom(text) {
  assert(typeof text === 'string' && Buffer.byteLength(text) < 512 * 1024, 'Bounded POM text required');
  assert(!/<!DOCTYPE|<!ENTITY/i.test(text), 'POM entity/DTD evaluation forbidden');
  const clean = text.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(build|profiles|dependencyManagement)>[\s\S]*?<\/\1>/g, '');
  const value = (block, tag) => {
    const hits = [...block.matchAll(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'g'))];
    assert(hits.length <= 1, `Ambiguous POM ${tag}`);
    return hits[0]?.[1].trim();
  };
  const parentBlock = clean.match(/<parent>([\s\S]*?)<\/parent>/)?.[1];
  const parent = parentBlock ? ['groupId', 'artifactId', 'version'].map(tag => value(parentBlock, tag)).join(':') : null;
  const header = clean.replace(/<parent>[\s\S]*?<\/parent>/, '').split(/<dependencies>|<licenses>|<name>|<properties>/)[0];
  const group = value(header, 'groupId') ?? parent?.split(':')[0];
  const artifact = value(header, 'artifactId');
  const version = value(header, 'version') ?? parent?.split(':')[2];
  const coordinate = [group, artifact, version].join(':');
  assert(/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/.test(coordinate), 'Literal POM identity required');
  const blocks = [...clean.matchAll(/<dependencies>([\s\S]*?)<\/dependencies>/g)];
  assert(blocks.length <= 1, 'Multiple POM dependency surfaces are outside finite supply');
  const dependencies = [...(blocks[0]?.[1] ?? '').matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map(match => {
    const block = match[1].replace(/<exclusions>[\s\S]*?<\/exclusions>/g, '');
    return { group: value(block, 'groupId'), artifact: value(block, 'artifactId'), version: value(block, 'version'),
      scope: value(block, 'scope') ?? 'compile', optional: value(block, 'optional') === 'true',
      type: value(block, 'type') ?? 'jar', classifier: value(block, 'classifier') };
  });
  return { coordinate, parent, dependencies };
}
