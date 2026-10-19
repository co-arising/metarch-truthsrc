#!/usr/bin/env node
// === converter-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>ProtoConverters trait with per-type Conv objects
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const pkg = spec.package || "net.imadz.infrastructure.persistence.converters";
const name = spec.name;
const traitName = `${name}ProtoConverters`;

const imports = [
  `import net.imadz.common.serialization.PrimitiveConverter`,
  ...(spec.domainImports || []),
  ...(spec.protoImports || []),
].join("\n");

const converters = (spec.converters || []).map(c => {
  const toFields = (c.toProtoFields || []).map(f => `      ${f}`).join(",\n");
  const fromFields = (c.fromProtoFields || []).map(f => `      ${f}`).join(",\n");
  return `  object ${c.name}Conv extends ProtoConverter[${c.domainType}, ${c.protoType}] {
    override def toProto(d: ${c.domainType}): ${c.protoType} = ${c.protoType}(
${toFields}
    )

    override def fromProto(p: ${c.protoType}): ${c.domainType} = ${c.domainType}(
${fromFields}
    )
  }`;
}).join("\n\n\n");

const out = `package ${pkg}

${imports}

trait ${traitName} extends PrimitiveConverter {

${converters}

}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath}`);
