// Curated per-aggregate Proto3 & PO model (aligned with playAkkaCQRS /
// ingested-app standards). Replaces the legacy monolithic f0/f1 serialization
// graph with:
//   - shared_value_objects.proto + per-aggregate <snake_agg>.proto
//   - real business field names (zero f0/f1 positional fields)
//   - deduplicated *PO message names (zero SipPlanSip... stutter)
//   - per-aggregate <Agg>EventPO with `oneof event { ... }`
//   - native proto3 optional, repeated, and map<K, V> (zero artificial wrappers)
import { key, packageFor, symbol } from '../../generators/scala-cqrs-domain/naming.mjs';

const fail = message => { throw new Error('PROTO_MODEL: ' + message); };

const PRIMITIVE_PROTO = Object.freeze({
  string: 'string',
  boolean: 'bool',
  integer: 'sint64',
  decimal: 'string',
});

export const toSnake = name =>
  name.replace(/([a-z0-9])([A-Z])/gu, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/gu, '$1_$2').toLowerCase();

export const lowerFirst = name => name ? name[0].toLowerCase() + name.slice(1) : name;

export const poNameForType = id => (id.endsWith('PO') ? id.slice(0, -2) + 'StoragePO' : id + 'PO');

export const poNameForEvent = eventId => eventId + 'PO';

export const poNameForState = aggId => aggId + 'StatePO';

export const poNameForEventUnion = aggId => aggId + 'EventPO';

const dedupSources = sources => {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    const k = s.document + '#' + s.pointer;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ document: s.document, pointer: s.pointer });
  }
  return out;
};

/**
 * Resolve whether a nominal type is a single-field string wrapper (e.g. TxId,
 * AccountId, RevisionId) so Map[TxId, V] can use native proto3 map<string, V>.
 */
function unwrapStringNominal(ref, declByKey, seen = new Set()) {
  const k = key(ref);
  if (seen.has(k)) return null;
  const d = declByKey.get(k);
  if (!d) return null;
  if (d.valueType.form === 'primitive' && d.valueType.name === 'string') return { depth: 1, typeId: ref.id };
  if (d.valueType.form === 'nominal') {
    const inner = unwrapStringNominal(d.valueType.ref, declByKey, new Set([...seen, k]));
    if (inner) return { depth: inner.depth + 1, typeId: ref.id, inner };
  }
  return null;
}

function classifyFieldType(type, context, declByKey) {
  if (type.form === 'primitive') {
    const protoType = PRIMITIVE_PROTO[type.name];
    if (!protoType) fail('unsupported primitive: ' + type.name);
    return { kind: 'primitive', primitive: type.name, protoType, modifier: '' };
  }
  if (type.form === 'nominal') {
    if (type.ref.context !== context) fail('cross-context proto ref unsupported: ' + type.ref.context);
    return { kind: 'nominal', typeId: type.ref.id, poName: poNameForType(type.ref.id), protoType: poNameForType(type.ref.id), modifier: '' };
  }
  if (type.form === 'optional') {
    const elem = classifyFieldType(type.element, context, declByKey);
    if (elem.kind === 'primitive') {
      return { kind: 'optional-primitive', primitive: elem.primitive, protoType: elem.protoType, modifier: 'optional' };
    }
    if (elem.kind === 'nominal') {
      return { kind: 'optional-nominal', typeId: elem.typeId, poName: elem.poName, protoType: elem.protoType, modifier: '' };
    }
    fail('nested optional container unsupported: ' + elem.kind);
  }
  if (type.form === 'sequence') {
    const elem = classifyFieldType(type.element, context, declByKey);
    if (elem.kind === 'primitive') {
      return { kind: 'repeated-primitive', primitive: elem.primitive, protoType: elem.protoType, modifier: 'repeated' };
    }
    if (elem.kind === 'nominal') {
      return { kind: 'repeated-nominal', typeId: elem.typeId, poName: elem.poName, protoType: elem.protoType, modifier: 'repeated' };
    }
    fail('nested sequence container unsupported: ' + elem.kind);
  }
  if (type.form === 'map') {
    let keyInfo;
    if (type.key.form === 'primitive' && (type.key.name === 'string' || type.key.name === 'integer')) {
      keyInfo = { kind: 'primitive', primitive: type.key.name, protoKeyType: PRIMITIVE_PROTO[type.key.name] };
    } else if (type.key.form === 'nominal') {
      const unwrapped = unwrapStringNominal(type.key.ref, declByKey);
      if (!unwrapped) fail('map key nominal type must wrap string: ' + type.key.ref.id);
      keyInfo = { kind: 'nominal-string', typeId: type.key.ref.id, protoKeyType: 'string' };
    } else {
      fail('unsupported map key type: ' + type.key.form);
    }
    const val = classifyFieldType(type.value, context, declByKey);
    if (val.kind !== 'primitive' && val.kind !== 'nominal') {
      fail('unsupported map value container: ' + val.kind);
    }
    return {
      kind: 'map',
      keyInfo,
      valueInfo: val,
      protoType: `map<${keyInfo.protoKeyType}, ${val.protoType}>`,
      modifier: '',
    };
  }
  fail('unsupported valueType form: ' + type.form);
}

export function buildCuratedProtoModel(products, options) {
  const layout = products?.['reference-layout'];
  const deps = products?.['domain-dependencies'];
  const folds = products?.['domain-folds'];
  const exactTypes = products?.['exact-value-types'] ?? [];
  const exactCodecs = products?.['exact-value-codecs'] ?? [];
  if (!layout || !deps || !folds) fail('reference-layout, domain-dependencies, and domain-folds required');

  const declByKey = new Map(layout.declarations.map(d => [key(d.ref), d]));
  const contexts = [];

  for (const context of layout.contexts) {
    const pkg = packageFor(context, options);
    const valueObjects = [];
    for (const d of layout.declarations.filter(x => x.ref.kind === 'type' && x.ref.context === context)) {
      const id = d.ref.id;
      const poName = poNameForType(id);
      const exactDesc = exactTypes.find(t => key(t.domain) === key(d.ref));
      const exactCodec = exactCodecs.find(c => key(c.domain) === key(d.ref));
      if (exactDesc) {
        if (!exactCodec) fail('missing exact codec for ' + id);
        const amountRaw = exactDesc.amountMember?.id ?? 'value';
        const unitRaw = exactDesc.unitMember ? exactDesc.unitMember.id : null;
        const amountField = symbol(amountRaw);
        const unitField = unitRaw ? symbol(unitRaw) : null;
        const fields = [
          { name: amountField, protoName: amountRaw, number: 1, typeInfo: { kind: 'primitive', primitive: 'string', protoType: 'string', modifier: '' } },
          ...(unitField ? [{ name: unitField, protoName: unitRaw, number: 2, typeInfo: { kind: 'primitive', primitive: 'string', protoType: 'string', modifier: '' } }] : []),
        ];
        valueObjects.push({
          kind: 'exact',
          typeId: id,
          poName,
          fields,
          sources: dedupSources([d.source]),
          exact: {
            domainName: symbol(id),
            scale: exactDesc.scale,
            minor: exactCodec.format === 'minor-units-text',
            amountField,
            unitField,
            representations: ['wire', 'po'].map(rep => {
              const r = exactCodec[rep];
              return {
                capital: rep === 'wire' ? 'Wire' : 'PO',
                typeName: symbol(r.ref.id),
                amountField: r.amountMember ? symbol(r.amountMember.id) : null,
                unitField: r.unitMember ? symbol(r.unitMember.id) : null,
              };
            }),
          },
        });
      } else if (d.valueType.form === 'record') {
        const fields = d.valueType.members.map((mRef, idx) => {
          const mDecl = declByKey.get(key(mRef));
          if (!mDecl) fail('undeclared member ' + mRef.id);
          return {
            name: symbol(mRef.id),
            protoName: mRef.id,
            number: idx + 1,
            typeInfo: classifyFieldType(mDecl.valueType, context, declByKey),
            source: mDecl.source,
          };
        });
        valueObjects.push({
          kind: 'record',
          typeId: id,
          poName,
          fields,
          sources: dedupSources([d.source, ...fields.map(f => f.source)]),
        });
      } else {
        valueObjects.push({
          kind: 'wrapper',
          typeId: id,
          poName,
          fields: [{ name: 'value', protoName: 'value', number: 1, typeInfo: classifyFieldType(d.valueType, context, declByKey) }],
          sources: dedupSources([d.source]),
        });
      }
    }

    const aggregates = [];
    for (const agg of layout.declarations.filter(x => x.ref.kind === 'aggregate' && x.ref.context === context)) {
      const aggId = agg.ref.id;
      const defaults = folds.defaults.filter(f => f.target.context === context && f.target.owner[0] === aggId);
      const stateFields = defaults.map((f, idx) => ({
        name: symbol(f.target.id),
        protoName: f.target.id,
        number: idx + 1,
        typeInfo: classifyFieldType(f.valueType, context, declByKey),
        source: f.source,
      }));
      const events = deps.events
        .filter(e => e.event.context === context && e.event.owner[0] === aggId)
        .map((e, eIdx) => {
          const eventId = e.event.id;
          const fields = e.declaredSlots.map((s, idx) => ({
            name: symbol(s.ref.id),
            protoName: s.ref.id,
            number: idx + 1,
            typeInfo: classifyFieldType(s.valueType, context, declByKey),
          }));
          return {
            eventId,
            poName: poNameForEvent(eventId),
            oneofField: lowerFirst(eventId),
            oneofNumber: eIdx + 1,
            fields,
            source: e.source,
          };
        });
      aggregates.push({
        aggId,
        protoFile: 'app/protobuf/' + toSnake(aggId) + '.proto',
        statePoName: poNameForState(aggId),
        eventUnionPoName: poNameForEventUnion(aggId),
        stateFields,
        stateSources: dedupSources([agg.source, ...stateFields.map(f => f.source)]),
        events,
        source: agg.source,
      });
    }

    contexts.push({
      context,
      package: pkg,
      sharedProtoFile: 'app/protobuf/shared_value_objects.proto',
      valueObjects,
      aggregates,
    });
  }

  return contexts;
}
