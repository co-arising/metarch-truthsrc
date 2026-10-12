// models.mjs — rules-face builders (V4-3). Canonical (+ augment-rules-canonical slots) → pure model.
// All ordering/semantic decisions live here; templates/scala.mjs only renders text.
import { computeParamDefs, scalaRef } from './rules.mjs';

// A command is a query fragment (no helper, no behaviors wiring) when it is readOnly. The canonical
// marks the synthesized Get<Name>State query readOnly; everything else is a write command.
const isQuery = (c) => c.readOnly === true;

// commandHelpersModel — the glue trait: each write command projects its params into <Cmd>Params in
// paramDefs (union-discovered) order, with fixed failure/success replies. Query commands contribute
// to the import block (both <Cmd> and <Cmd>Reply) but get no helper object (rules_domain_gen lines
// 1922-1960).
export function commandHelpersModel(a, env) {
  const commands = a.commands ?? [];
  const helpers = commands.filter((c) => !isQuery(c)).map((c) => {
    const params = c.parameters ?? [];
    const fields = computeParamDefs(c.name, params, c.preconditionRules, c.behaviorModel);
    return {
      name: c.name,
      replyType: `${c.name}Reply`,
      paramsName: `${c.name}Params`,
      args: fields.map((f) => `command.${scalaRef(f)}`),
    };
  });
  return {
    header: env.header,
    pkg: a.pkg ?? 'net.imadz',
    ctx: a.ctxPackage,
    agg: a.name,
    commandNames: commands.map((c) => c.name), // import block iterates ALL commands, declared order
    helpers,
  };
}
