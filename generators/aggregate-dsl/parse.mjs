#!/usr/bin/env node
// ═══ tree → AggregateSpec parser ═══
// Reads truth/aggregates/<name>/aggregate.yaml (v0.5) and emits AggregateSpec.

import { readFileSync, writeFileSync } from "fs";

const [yamlPath, bindingPath, outPath] = process.argv.slice(2);
const text = readFileSync(yamlPath, "utf8");
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));

// order.commands / order.events are single-line JSON arrays in YAML
function extractList(key) {
  const m = text.match(new RegExp(key + ":\\s*\\[([^\\]]+)\\]"));
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const cmdList = extractList("commands");
const evtList = extractList("events");

// payload is JSON after "payload:"
const pStart = text.indexOf("payload:") + 8;
const pText = text.slice(pStart).trim();
let depth = 0, pEnd = 0;
for (let i = 0; i < pText.length; i++) {
  if (pText[i] === "{") depth++;
  if (pText[i] === "}") { depth--; if (depth === 0) { pEnd = i + 1; break; } }
}
const payload = JSON.parse(pText.slice(0, pEnd));

const pascal = (s) => s.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const entityName = payload.entity;

const spec = {
  package: binding.package,
  name: payload.name,
  objectName: entityName,
  stateType: entityName + "State",
  commandType: entityName + "Command",
  eventType: entityName + "Event",
  stateFields: payload.stateFields || [],
  emptyState: binding.emptyState,
  commands: cmdList.map((c) => ({ name: pascal(c), fields: (binding.commandFields || {})[c] || [] })),
  events: evtList.map((e) => ({ name: pascal(e), fields: (binding.eventFields || {})[e] || [] })),
  statusTransitions: payload.statusTransitions || {},
  commandHandlers: binding.commandHandlers || [],
};

writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log("parsed aggregate " + payload.name + ": " + cmdList.length + " commands, " + evtList.length + " events");
