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

// Extracted unchanged from the finite Actor supply reader. Profiles/build/
// dependencyManagement/reporting do not extend the explicitly selected compile
// supply. Family refinements (2026-11-20, strict-saga-module): the reporting strip
// (commons-dbcp2's japicmp plugin configuration inside <reporting> carries a
// <dependencies> block that is not a compile surface), the ${project.*} identity
// substitution for netty-style sibling references, and the dependencyManagement
// scope inheritance — a dependency that omits its own scope inherits the managed
// scope per Maven semantics (netty poms declare mockito test-scoped this way).
// All three refinements only REMOVE false compile surfaces or resolve to the
// declaring pom's own identity; the parsed compile set of every previously
// validated POM is unchanged.
export function declaredPom(text) {
  assert(typeof text === 'string' && Buffer.byteLength(text) < 512 * 1024, 'Bounded POM text required');
  assert(!/<!DOCTYPE|<!ENTITY/i.test(text), 'POM entity/DTD evaluation forbidden');
  const value = (block, tag) => {
    const hits = [...block.matchAll(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'g'))];
    assert(hits.length <= 1, `Ambiguous POM ${tag}`);
    return hits[0]?.[1].trim();
  };
  const managedScopes = new Map();
  for (const managed of text.replace(/<!--[\s\S]*?-->/g, '')
      .matchAll(/<dependencyManagement>\s*<dependencies>([\s\S]*?)<\/dependencies>\s*<\/dependencyManagement>/g)) {
    for (const match of managed[1].matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
      const block = match[1].replace(/<exclusions>[\s\S]*?<\/exclusions>/g, '');
      const group = value(block, 'groupId');
      const artifact = value(block, 'artifactId');
      const scope = value(block, 'scope');
      if (group && artifact && scope) managedScopes.set(`${group}:${artifact}`, scope);
    }
  }
  const clean = text.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(build|profiles|dependencyManagement|reporting)>[\s\S]*?<\/\1>/g, '');
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
    // netty-style poms reference sibling artifacts through the declaring pom's own
    // coordinates; the substitution is purely mechanical (same identity, no mediation).
    const resolve = field => (value(block, field) ?? '')
      .replace(/\$\{project\.groupId\}/g, group ?? '')
      .replace(/\$\{project\.artifactId\}/g, artifact ?? '')
      .replace(/\$\{project\.version\}/g, version ?? '') || undefined;
    return { group: resolve('groupId'), artifact: resolve('artifactId'), version: resolve('version'),
      scope: value(block, 'scope') ?? managedScopes.get(`${resolve('groupId')}:${resolve('artifactId')}`) ?? 'compile',
      optional: value(block, 'optional') === 'true',
      type: value(block, 'type') ?? 'jar', classifier: value(block, 'classifier') };
  });
  return { coordinate, parent, dependencies };
}
