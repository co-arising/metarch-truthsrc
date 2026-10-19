#!/usr/bin/env node
// === adapter-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>SnapshotAdapter + <Name>EventAdapter
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.infrastructure.persistence";
const name = spec.name;
const stateType = spec.stateType || `${name}State`;
const eventType = spec.eventType || `${name}Event`;
const convertersTrait = `${name}ProtoConverters`;

// SnapshotAdapter
const snapshot = `package ${pkg}

import akka.persistence.typed.SnapshotAdapter
import ${spec.entityPackage || "net.imadz.domain.entities"}.${name}Entity.${stateType}
import ${spec.convertersPackage || "net.imadz.infrastructure.persistence.converters"}.${convertersTrait}
import ${spec.protoPackage || "net.imadz.infrastructure.proto"}.${spec.protoStateType || stateType + "PO"}

/**
 * ${name}SnapshotAdapter: 快照适配器，负责在领域快照和protobuf快照之间进行转换
 */
class ${name}SnapshotAdapter extends SnapshotAdapter[${stateType}] with ${convertersTrait} {

  override def toJournal(state: ${stateType}): Any = {
    ${stateType}Conv.toProto(state)
  }

  override def fromJournal(from: Any): ${stateType} = {
    val proto = from.asInstanceOf[${spec.protoStateType || stateType + "PO"}]
    ${stateType}Conv.fromProto(proto)
  }

}
`;

// EventAdapter
const eventCases = (spec.events || []).map(e =>
  `      case evt: ${e.name} =>
        ${spec.protoEventType || eventType + "PO"}.Event.${e.name}(${e.name}Conv.toProto(evt))`
).join("\n\n\n");

const fromCases = (spec.events || []).map(e =>
  `      case ${spec.protoEventType || eventType + "PO"}.Event.${e.name}(po) =>
        EventSeq.single(${e.name}Conv.fromProto(po))`
).join("\n\n\n");

const eventAdapter = `package ${pkg}

import akka.persistence.typed.EventAdapter
import akka.persistence.typed.EventSeq
${(spec.events || []).map(e => `import ${spec.entityPackage || "net.imadz.domain.entities"}.${name}Entity.${e.name}`).join("\n")}
import ${spec.convertersPackage || "net.imadz.infrastructure.persistence.converters"}.${convertersTrait}
import ${spec.protoPackage || "net.imadz.infrastructure.proto"}.${spec.protoEventType || eventType + "PO"}

/**
 * ${name}EventAdapter: 事件适配器，负责在领域事件和protobuf事件之间进行转换
 */
class ${name}EventAdapter extends EventAdapter[${eventType}, ${spec.protoEventType || eventType + "PO"}.Event] with ${convertersTrait} {

  override def manifest(event: ${eventType}): String = event.getClass.getName

  override def toJournal(e: ${eventType}): ${spec.protoEventType || eventType + "PO"}.Event = {
    val eventUnion = e match {

${eventCases}

    }
    eventUnion
  }

  override def fromJournal(p: ${spec.protoEventType || eventType + "PO"}.Event, manifest: String): EventSeq[${eventType}] = {
    p match {

${fromCases}

      case ${spec.protoEventType || eventType + "PO"}.Event.Empty =>
        EventSeq.empty
    }
  }

}
`;

writeFileSync(join(outDir, `${name}SnapshotAdapter.scala`), snapshot);
writeFileSync(join(outDir, `${name}EventAdapter.scala`), eventAdapter);
console.log(`emitted ${name}SnapshotAdapter.scala, ${name}EventAdapter.scala`);
