// Recursive-descent parser for co-arising EARS 1.0 (Style A + Style C, EN + CN isomorphic).
import { tokenizeEars, EarsSyntaxError } from './lexer.mjs';

const ACTION_STARTERS = new Set([
  'KW_REJECT', 'KW_REJECT_REQUEST', 'KW_EMIT', 'KW_TRANSITION',
  'KW_SUCCEED_EMPTY', 'KW_KEEP', 'KW_PIN', 'KW_DISPATCH',
  'KW_RESPOND', 'KW_EXPOSE',
]);

const COMPARISON_TOKENS = new Map([
  ['OP_EQ', '=='],
  ['OP_NEQ', '!='],
  ['OP_GT', '>'],
  ['OP_GTE', '>='],
  ['OP_LT', '<'],
  ['OP_LTE', '<='],
]);

function derivePattern(clauses) {
  const hasOpt = Boolean(clauses.whereOpt);
  const hasWhile = Boolean(clauses.whileExpr);
  const hasWhen = Boolean(clauses.whenEvent);
  const hasIf = Boolean(clauses.ifExpr);
  if (clauses.always) return 'ubiquitous';
  const count = [hasOpt, hasWhile, hasWhen, hasIf].filter(Boolean).length;
  if (count > 1) return 'complex';
  if (hasIf) return 'unwanted';
  if (hasWhile) return 'state-driven';
  if (hasWhen) return 'event-driven';
  if (hasOpt) return 'optional';
  return 'ubiquitous';
}

function mergeBool(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { kind: 'binary', op: 'and', left: a, right: b };
}

class EarsParser {
  constructor(tokens, file) {
    this.tokens = tokens;
    this.file = file;
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1];
  }

  next() {
    const tok = this.peek(0);
    if (tok.type !== 'EOF') this.pos += 1;
    return tok;
  }

  error(message, tok = this.peek()) {
    return new EarsSyntaxError(message, { line: tok.line, col: tok.col, file: this.file });
  }

  expect(type, label = type) {
    const tok = this.peek();
    if (tok.type !== type) {
      throw this.error(`expected ${label}, got ${tok.type}(${JSON.stringify(tok.raw)})`, tok);
    }
    return this.next();
  }

  accept(type) {
    if (this.peek().type === type) return this.next();
    return null;
  }

  expectIdentLike(label = 'identifier') {
    const tok = this.peek();
    if (tok.type === 'IDENT' || tok.type === 'KW_REQUEST' || tok.type === 'KW_DOMAIN' || tok.type === 'KW_APP') {
      return this.next().value;
    }
    throw this.error(`expected ${label}, got ${tok.type}(${JSON.stringify(tok.raw)})`, tok);
  }

  parseQualifiedName() {
    const parts = [this.expectIdentLike('qualified name')];
    while (this.accept('DOT')) {
      parts.push(this.expectIdentLike('qualified name segment'));
    }
    return parts.join('.');
  }

  parseRuleId() {
    this.expect('LBRACKET', '[');
    const id = this.expectIdentLike('RuleId');
    this.expect('RBRACKET', ']');
    return id;
  }

  parseSpecFile() {
    const headerTok = this.peek();
    if (headerTok.type !== 'KW_SLICE' && headerTok.type !== 'KW_STORY') {
      throw this.error('expected slice/story (切片/故事) header', headerTok);
    }
    this.next();
    const kind = headerTok.type === 'KW_SLICE' ? 'slice' : 'story';
    const target = this.parseQualifiedName();
    let layer = kind === 'story' ? 'application' : 'domain';
    if (this.accept('KW_LAYER')) {
      const layerTok = this.next();
      if (layerTok.type === 'KW_DOMAIN') layer = 'domain';
      else if (layerTok.type === 'KW_APP') layer = 'application';
      else throw this.error('expected domain/application (领域/应用) after layer', layerTok);
    }

    const style = this.peek().type === 'LBRACE' ? 'C' : 'A';
    const spec = {
      schemaVersion: 'co-arising.ears-ast/v1',
      kind,
      target,
      layer,
      style,
      where: [],
      externs: [],
      axioms: [],
      rules: [],
      span: { line: headerTok.line, col: headerTok.col },
    };

    if (style === 'C') {
      this.parseStyleCBody(spec);
    } else {
      this.parseStyleABody(spec);
    }
    this.expect('EOF', 'end of file');
    return spec;
  }

  parseStyleCBody(spec) {
    this.expect('LBRACE', '{');
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      const tok = this.peek();
      if (tok.type === 'KW_DEFINE' || tok.type === 'KW_WHERE_OR_DEFINE') {
        this.next();
        spec.where.push(this.parsePredDef());
      } else if (tok.type === 'KW_EXTERN') {
        spec.externs.push(this.parseExternDef());
      } else if (tok.type === 'KW_AXIOMS') {
        this.next();
        this.expect('LBRACE', '{');
        while (this.peek().type !== 'RBRACE') spec.axioms.push(this.parseAxiomEntry());
        this.expect('RBRACE', '}');
      } else if (tok.type === 'KW_RULE' || tok.type === 'KW_RULES_OR_RULE') {
        this.next();
        const id = this.parseRuleId();
        this.expect('LBRACE', '{');
        const stmt = this.parseStatement({ allowThenAsModality: true });
        const post = this.isPostHeader() ? this.parsePostSection() : [];
        this.expect('RBRACE', '}');
        spec.rules.push({ id, ...stmt, post });
      } else {
        throw this.error(`unexpected token ${tok.type}(${JSON.stringify(tok.raw)}) inside block`, tok);
      }
    }
    this.expect('RBRACE', '}');
  }

  parseStyleABody(spec) {
    if (this.isWhereSectionHeader()) {
      this.next();
      this.expect('COLON', ':');
      while (!this.isTopSectionStart() && this.peek().type !== 'EOF') {
        if (this.peek().type === 'KW_EXTERN') {
          spec.externs.push(this.parseExternDef());
        } else {
          spec.where.push(this.parsePredDef());
        }
      }
    }
    if (this.isAxiomsSectionHeader()) {
      this.next();
      this.expect('COLON', ':');
      while (this.peek().type === 'LBRACKET') {
        spec.axioms.push(this.parseAxiomEntry());
      }
    }
    if (this.isRulesSectionHeader()) {
      this.next();
      this.expect('COLON', ':');
      while (this.peek().type === 'LBRACKET') {
        spec.rules.push(this.parseRuleEntry());
      }
    }
  }

  isWhereSectionHeader() {
    const t = this.peek().type;
    return (t === 'KW_WHERE' || t === 'KW_WHERE_OR_DEFINE') && this.peek(1).type === 'COLON';
  }

  isAxiomsSectionHeader() {
    return this.peek().type === 'KW_AXIOMS' && this.peek(1).type === 'COLON';
  }

  isRulesSectionHeader() {
    const t = this.peek().type;
    return (t === 'KW_RULES' || t === 'KW_RULES_OR_RULE') && this.peek(1).type === 'COLON';
  }

  isPostHeader() {
    return this.peek().type === 'KW_POST' && this.peek(1).type === 'COLON';
  }

  isTopSectionStart() {
    return this.isWhereSectionHeader() || this.isAxiomsSectionHeader() || this.isRulesSectionHeader();
  }

  parsePredDef() {
    const start = this.peek();
    const name = this.expectIdentLike('predicate name');
    this.expect('ASSIGN', '=');
    const expr = this.parseBoolExpr();
    let label = null;
    if (this.accept('KW_AS')) {
      label = this.expect('STRING_LIT', 'string label').value;
    }
    return { name, expr, label, span: { line: start.line, col: start.col } };
  }

  parseExternDef() {
    const start = this.expect('KW_EXTERN', 'extern');
    const name = this.expectIdentLike('extern predicate name');
    const params = [];
    if (this.accept('LPAREN')) {
      if (this.peek().type !== 'RPAREN') {
        params.push(this.expectIdentLike('extern param'));
        while (this.accept('COMMA')) params.push(this.expectIdentLike('extern param'));
      }
      this.expect('RPAREN', ')');
    }
    let label = null;
    if (this.accept('KW_AS')) {
      label = this.expect('STRING_LIT', 'string label').value;
    }
    return { name, params, label, span: { line: start.line, col: start.col } };
  }

  parseAxiomEntry() {
    const start = this.peek();
    const id = this.parseRuleId();
    this.expect('KW_ALWAYS', 'ALWAYS/恒成立');

    // Form 1 (CN inverted): 恒成立 禁止 Subject 携带 field1, field2
    if (this.peek().type === 'KW_SHALL' || this.peek().type === 'KW_SHALL_NOT') {
      const modality = this.next().type === 'KW_SHALL' ? 'SHALL' : 'SHALL_NOT';
      if (ACTION_STARTERS.has(this.peek().type)) {
        const actions = this.parseActionList(modality);
        return { id, kind: 'action', subject: null, modality, actions, span: { line: start.line, col: start.col } };
      }
      const subject = this.parseQualifiedName();
      const action = this.parseSubjectAction(modality, subject);
      return { id, kind: 'action', subject, modality, actions: [action], span: { line: start.line, col: start.col } };
    }

    // Form 2 (EN subject-first): ALWAYS Subject SHALL NOT supply field1, field2
    if (this.peek().type === 'IDENT' && (this.peek(1).type === 'KW_SHALL' || this.peek(1).type === 'KW_SHALL_NOT')) {
      const subject = this.next().value;
      const modality = this.next().type === 'KW_SHALL' ? 'SHALL' : 'SHALL_NOT';
      const action = this.parseSubjectAction(modality, subject);
      return { id, kind: 'action', subject, modality, actions: [action], span: { line: start.line, col: start.col } };
    }

    // Form 3: ALWAYS BoolExpr
    const expr = this.parseBoolExpr();
    return { id, kind: 'invariant', expr, span: { line: start.line, col: start.col } };
  }

  parseSubjectAction(modality, subject) {
    if (this.accept('KW_SUPPLY') || this.accept('KW_WITH')) {
      const fields = [this.expectIdentLike('field name')];
      while (this.accept('COMMA')) fields.push(this.expectIdentLike('field name'));
      return { kind: 'supply', modality, subject, fields };
    }
    const action = this.parseAction(modality);
    return { ...action, subject };
  }

  parseRuleEntry() {
    const start = this.peek();
    const id = this.parseRuleId();
    const stmt = this.parseStatement({ allowThenAsModality: false });
    const post = this.isPostHeader() ? this.parsePostSection() : [];
    return { id, ...stmt, post, span: { line: start.line, col: start.col } };
  }

  parseStatement({ allowThenAsModality }) {
    const start = this.peek();
    if (this.accept('KW_ALWAYS')) {
      const modality = this.parseModality(allowThenAsModality);
      const actions = this.parseActionList(modality);
      return {
        pattern: 'ubiquitous',
        clauses: { always: true, whereOpt: null, whileExpr: null, whenEvent: null, whenCond: null, ifExpr: null },
        modality,
        actions,
        span: { line: start.line, col: start.col },
      };
    }

    let whereOpt = null;
    let whileExpr = null;
    let ifExpr = null;
    let whenEvent = null;
    let whenCond = null;

    if (this.accept('KW_OPT')) {
      whereOpt = this.parseBoolExpr();
    }
    if (this.accept('KW_WHILE')) {
      whileExpr = mergeBool(whileExpr, this.parseBoolExpr());
    }
    if (this.accept('KW_IF')) {
      ifExpr = this.parseBoolExpr();
      if (this.accept('KW_WHILE')) {
        whileExpr = mergeBool(whileExpr, this.parseBoolExpr());
      }
      if (this.accept('KW_WHEN')) {
        whenEvent = this.parseQualifiedName();
        if (this.accept('KW_AND')) whenCond = this.parseBoolExpr();
      }
      this.expect('KW_THEN', 'THEN/则');
      const modality = this.parseModality(true);
      const actions = this.parseActionList(modality);
      const clauses = { always: false, whereOpt, whileExpr, whenEvent, whenCond, ifExpr };
      return { pattern: derivePattern(clauses), clauses, modality, actions, span: { line: start.line, col: start.col } };
    }

    if (this.accept('KW_WHEN')) {
      whenEvent = this.parseQualifiedName();
      if (this.accept('KW_AND')) {
        whenCond = this.parseBoolExpr();
      }
      if (this.peek().type === 'KW_THEN' && allowThenAsModality) {
        this.next();
        const modality = this.peek().type === 'KW_SHALL' || this.peek().type === 'KW_SHALL_NOT'
          ? this.parseModality(false)
          : 'SHALL';
        const actions = this.parseActionList(modality);
        const clauses = { always: false, whereOpt, whileExpr, whenEvent, whenCond, ifExpr };
        return { pattern: derivePattern(clauses), clauses, modality, actions, span: { line: start.line, col: start.col } };
      }
      const modality = this.parseModality(allowThenAsModality);
      const actions = this.parseActionList(modality);
      const clauses = { always: false, whereOpt, whileExpr, whenEvent, whenCond, ifExpr };
      return { pattern: derivePattern(clauses), clauses, modality, actions, span: { line: start.line, col: start.col } };
    }

    throw this.error('expected EARS clause (ALWAYS / WHERE / WHILE / WHEN / IF)', this.peek());
  }

  parseModality(optionalShall) {
    if (this.accept('KW_SHALL')) return 'SHALL';
    if (this.accept('KW_SHALL_NOT')) return 'SHALL_NOT';
    if (optionalShall && ACTION_STARTERS.has(this.peek().type)) return 'SHALL';
    throw this.error('expected SHALL / SHALL NOT (必须 / 禁止)', this.peek());
  }

  parseActionList(defaultModality) {
    const actions = [this.parseAction(defaultModality)];
    while (this.accept('KW_AND')) {
      let itemModality = defaultModality;
      if (this.accept('KW_SHALL')) itemModality = 'SHALL';
      else if (this.accept('KW_SHALL_NOT')) itemModality = 'SHALL_NOT';
      actions.push(this.parseAction(itemModality));
    }
    return actions;
  }

  parseAction(modality) {
    const tok = this.peek();
    if (tok.type === 'KW_REJECT_REQUEST') {
      this.next();
      this.accept('COMMA');
      this.expect('KW_RETURN', '返回');
      const code = this.expectIdentLike('error code');
      return { kind: 'reject', modality, target: 'request', code };
    }
    if (tok.type === 'KW_REJECT') {
      this.next();
      let target = 'request';
      if (this.peek().type === 'KW_REQUEST') {
        this.next();
        target = 'request';
      } else if (this.peek().type === 'IDENT' && (this.peek(1).type === 'KW_WITH' || this.peek(1).type === 'COMMA' || this.peek(1).type === 'KW_RETURN')) {
        target = this.next().value;
      }
      if (this.accept('KW_WITH')) {
        const code = this.expectIdentLike('error code');
        return { kind: 'reject', modality, target, code };
      }
      this.accept('COMMA');
      this.expect('KW_RETURN', '返回');
      const code = this.expectIdentLike('error code');
      return { kind: 'reject', modality, target, code };
    }
    if (tok.type === 'KW_EMIT') {
      this.next();
      const event = this.expectIdentLike('event name');
      return { kind: 'emit', modality, event };
    }
    if (tok.type === 'KW_TRANSITION') {
      this.next();
      const path = this.parsePathExpr();
      this.expect('ARROW', '->');
      const value = this.parseAddExpr();
      return { kind: 'transition', modality, path, value };
    }
    if (tok.type === 'KW_SUCCEED_EMPTY') {
      this.next();
      return { kind: 'succeed-empty', modality };
    }
    if (tok.type === 'KW_KEEP') {
      this.next();
      const expr = this.parseBoolExpr();
      return { kind: 'keep', modality, expr };
    }
    if (tok.type === 'KW_PIN') {
      this.next();
      const artifact = this.expectIdentLike('pinned artifact');
      this.expect('KW_FROM', 'from/来自');
      this.expect('LPAREN', '(');
      const inputs = [this.expectIdentLike('input identifier')];
      while (this.accept('COMMA')) inputs.push(this.expectIdentLike('input identifier'));
      this.expect('RPAREN', ')');
      return { kind: 'pin', modality, artifact, inputs };
    }
    if (tok.type === 'KW_DISPATCH') {
      this.next();
      const target = this.parseQualifiedName();
      return { kind: 'dispatch', modality, target };
    }
    if (tok.type === 'KW_RESPOND') {
      this.next();
      const response = this.expectIdentLike('response type');
      let constraint = null;
      if (this.accept('KW_WITH')) {
        constraint = this.parseActionConstraintExpr();
      }
      return { kind: 'respond', modality, response, constraint };
    }
    if (tok.type === 'KW_EXPOSE') {
      this.next();
      const view = this.expectIdentLike('read model view');
      this.expect('KW_AS', 'as/作为');
      const constraint = this.parseActionConstraintExpr();
      return { kind: 'expose', modality, view, constraint };
    }
    throw this.error(`expected action, got ${tok.type}(${JSON.stringify(tok.raw)})`, tok);
  }

  // Inside `respond X with <expr>` or `expose X as <expr>`, stop `AND` if the next clause begins an action or modality!
  parseActionConstraintExpr() {
    return this.parseAndExpr();
  }

  parsePostSection() {
    this.expect('KW_POST', 'post/变更后');
    this.expect('COLON', ':');
    const assignments = [];
    while (this.isPostAssignmentStart()) {
      const target = this.parsePrimedTarget();
      this.expect('ASSIGN', '=');
      const value = this.parseAddExpr();
      assignments.push({ target, value });
    }
    return assignments;
  }

  isPostAssignmentStart() {
    if (this.peek().type !== 'IDENT') return false;
    // Scan ahead on the same line for PRIME before ASSIGN
    const line = this.peek().line;
    for (let k = 0; k < 16; k += 1) {
      const t = this.peek(k);
      if (t.type === 'EOF' || t.line !== line) return false;
      if (t.type === 'PRIME') return true;
      if (t.type === 'ASSIGN') return false;
    }
    return false;
  }

  parsePrimedTarget() {
    const start = this.peek();
    const segments = [this.expectIdentLike('post target')];
    while (this.accept('DOT')) {
      segments.push(this.expectIdentLike('post field'));
    }
    this.expect('PRIME', "'");
    let index = null;
    if (this.accept('LBRACKET')) {
      index = this.parseAddExpr();
      this.expect('RBRACKET', ']');
    }
    return { kind: 'primed-path', segments, index, span: { line: start.line, col: start.col } };
  }

  parseBoolExpr() {
    return this.parseOrExpr();
  }

  parseOrExpr() {
    let left = this.parseAndExpr();
    while (this.accept('KW_OR')) {
      const right = this.parseAndExpr();
      left = { kind: 'binary', op: 'or', left, right };
    }
    return left;
  }

  parseAndExpr() {
    let left = this.parseNotExpr();
    while (this.peek().type === 'KW_AND') {
      const look = this.peek(1).type;
      if (look === 'KW_SHALL' || look === 'KW_SHALL_NOT' || ACTION_STARTERS.has(look)) break;
      this.next();
      const right = this.parseNotExpr();
      left = { kind: 'binary', op: 'and', left, right };
    }
    return left;
  }

  parseNotExpr() {
    if (this.accept('KW_NOT')) {
      return { kind: 'not', argument: this.parseNotExpr() };
    }
    return this.parseAtomPred();
  }

  parseAtomPred() {
    // Disambiguate `(BoolExpr)` vs `(ArithExpr) * ...`
    if (this.peek().type === 'LPAREN') {
      const saved = this.pos;
      this.next();
      try {
        const inner = this.parseBoolExpr();
        if (this.peek().type === 'RPAREN') {
          const afterParen = this.peek(1);
          const isArithFollow = ['PLUS', 'MINUS', 'STAR', 'OP_EQ', 'OP_NEQ', 'OP_GT', 'OP_GTE', 'OP_LT', 'OP_LTE', 'KW_IN'].includes(afterParen.type);
          if (!isArithFollow) {
            this.next();
            return inner;
          }
        }
      } catch (_err) {
        // Fall through to parse as arithmetic primary expression.
      }
      this.pos = saved;
    }

    const left = this.parseAddExpr();
    const nextTok = this.peek();

    if (COMPARISON_TOKENS.has(nextTok.type)) {
      this.next();
      const right = this.parseAddExpr();
      return { kind: 'compare', op: COMPARISON_TOKENS.get(nextTok.type), left, right };
    }

    if (nextTok.type === 'KW_NOT' && this.peek(1).type === 'KW_IN') {
      this.next();
      this.next();
      const collection = this.parseMembershipTarget();
      return { kind: 'not', argument: { kind: 'in', element: left, target: collection } };
    }

    if (this.accept('KW_IN')) {
      const collection = this.parseMembershipTarget();
      return { kind: 'in', element: left, target: collection };
    }

    if (this.accept('KW_IS')) {
      const negated = Boolean(this.accept('KW_NOT'));
      const stateTok = this.next();
      if (stateTok.type !== 'KW_EMPTY' && stateTok.type !== 'KW_NON_EMPTY') {
        throw this.error('expected empty/non-empty (空/非空) after is/为', stateTok);
      }
      const isEmptyCheck = stateTok.type === 'KW_EMPTY';
      const pred = { kind: 'emptiness', target: left, check: isEmptyCheck ? 'empty' : 'non-empty' };
      return negated ? { kind: 'not', argument: pred } : pred;
    }

    return left;
  }

  parseMembershipTarget() {
    const tok = this.peek();
    if (tok.type === 'LBRACE') {
      this.next();
      const elements = [];
      if (this.peek().type !== 'RBRACE') {
        elements.push(this.parseAddExpr());
        while (this.accept('COMMA')) elements.push(this.parseAddExpr());
      }
      this.expect('RBRACE', '}');
      return { kind: 'set', elements };
    }
    if (tok.type === 'LBRACKET' || tok.type === 'LPAREN') {
      const leftInclusive = tok.type === 'LBRACKET';
      this.next();
      const min = this.parseAddExpr();
      this.expect('DOTDOT', '..');
      const max = this.parseAddExpr();
      const closeTok = this.next();
      if (closeTok.type !== 'RBRACKET' && closeTok.type !== 'RPAREN') {
        throw this.error('expected ] or ) to close interval', closeTok);
      }
      return { kind: 'interval', min, max, leftInclusive, rightInclusive: closeTok.type === 'RBRACKET' };
    }
    return this.parsePathExpr();
  }

  parseAddExpr() {
    let left = this.parseMulExpr();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.next().value;
      const right = this.parseMulExpr();
      left = { kind: 'arith', op, left, right };
    }
    return left;
  }

  parseMulExpr() {
    let left = this.parseUnaryExpr();
    while (this.peek().type === 'STAR') {
      this.next();
      const right = this.parseUnaryExpr();
      left = { kind: 'arith', op: '*', left, right };
    }
    return left;
  }

  parseUnaryExpr() {
    if (this.accept('MINUS')) {
      const operand = this.parseUnaryExpr();
      if (operand.kind === 'number') {
        return { ...operand, value: `-${operand.value}` };
      }
      return { kind: 'neg', argument: operand };
    }
    return this.parsePrimaryExpr();
  }

  parsePrimaryExpr() {
    const tok = this.peek();
    if (tok.type === 'STRING_LIT') {
      this.next();
      return { kind: 'string', value: tok.value };
    }
    if (tok.type === 'NUMBER_LIT') {
      this.next();
      return { kind: 'number', value: tok.value, scale: tok.scale };
    }
    if (tok.type === 'BOOL_LIT') {
      this.next();
      return { kind: 'boolean', value: tok.value };
    }
    if (tok.type === 'AT_HOST') {
      this.next();
      this.expect('LPAREN', '(');
      const name = this.expectIdentLike('host computation name');
      const args = [];
      while (this.accept('COMMA')) args.push(this.parseAddExpr());
      this.expect('RPAREN', ')');
      return { kind: 'host', name, args };
    }
    if (tok.type === 'LPAREN') {
      this.next();
      const inner = this.parseAddExpr();
      this.expect('RPAREN', ')');
      return inner;
    }
    return this.parsePathExpr();
  }

  parsePathExpr() {
    const startTok = this.peek();
    const baseName = this.expectIdentLike('identifier');
    let lastLine = startTok.line;
    if (this.peek().type === 'LPAREN' && this.peek().line === lastLine) {
      this.next();
      const args = [];
      if (this.peek().type !== 'RPAREN') {
        args.push(this.parseAddExpr());
        while (this.accept('COMMA')) args.push(this.parseAddExpr());
      }
      this.expect('RPAREN', ')');
      return { kind: 'call', name: baseName, args };
    }

    let node = { kind: 'var', name: baseName };
    while (true) {
      if (this.accept('DOT')) {
        const fieldTok = this.peek();
        const field = this.expectIdentLike('member field');
        lastLine = fieldTok.line;
        node = { kind: 'member', object: node, field };
        continue;
      }
      if (this.peek().type === 'LBRACKET' && this.peek().line === lastLine) {
        this.next();
        const index = this.parseAddExpr();
        const closeTok = this.expect('RBRACKET', ']');
        lastLine = closeTok.line;
        node = { kind: 'index', collection: node, index };
        continue;
      }
      break;
    }
    return node;
  }
}

export function parseEars(source, { file = '<input>' } = {}) {
  const tokens = tokenizeEars(source, { file });
  const parser = new EarsParser(tokens, file);
  return parser.parseSpecFile();
}
