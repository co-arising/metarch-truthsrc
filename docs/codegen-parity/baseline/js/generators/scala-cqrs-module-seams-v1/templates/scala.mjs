// Syntax only: all signature types, names, bindings and call arguments come from the finite model.
export function scalaString(value) {
  return JSON.stringify(value).replaceAll(' ', '\\u2028').replaceAll(' ', '\\u2029');
}
export function scalaSymbol(s) { return '_root_.' + s.packageName + '.' + s.identifier; }
export function scalaType(t) {
  switch (t.form) {
    case 'primitive': return { string: '_root_.java.lang.String', boolean: '_root_.scala.Boolean', integer: '_root_.scala.Long' }[t.name];
    case 'technical': return '_root_.scala.concurrent.ExecutionContext';
    case 'nominal': case 'port': return scalaSymbol(t.symbol);
    case 'component': return scalaSymbol(t.symbol) + (t.singleton ? '.type' : '');
    case 'optional': return '_root_.scala.Option[' + scalaType(t.element) + ']';
    case 'sequence': return '_root_.scala.collection.immutable.Vector[' + scalaType(t.element) + ']';
    case 'map': return '_root_.scala.collection.immutable.Map[' + scalaType(t.key) + ', ' + scalaType(t.value) + ']';
    case 'either': return '_root_.scala.util.Either[' + scalaType(t.left) + ', ' + scalaType(t.right) + ']';
    default: throw new TypeError('unknown admitted signature type');
  }
}
const resultType = r => r.effect === 'future' ? '_root_.scala.concurrent.Future[' + scalaType(r.type) + ']' : scalaType(r.type);
const packageLine = (pkg, out) => out.append('package ' + pkg + '\n\n');
function fields(rows, out) {
  out.append('(');
  rows.forEach((f, i) => {
    if (i) out.append(', ');
    out.append(f.identifier + ': ' + scalaType(f.type), [f.source]);
  });
  out.append(')');
}
function method(m, out, override = false) {
  out.append('  ' + (override ? 'override ' : '') + 'def ');
  out.append(m.identifier, [m.source, ...(m.mappingSource ? [m.mappingSource] : [])]);
  fields(m.parameters, out);
  out.append(': '); out.append(resultType(m.result), [m.result.source]);
}
export function valuesTemplate(artifact, out) {
  packageLine(artifact.packageName, out);
  for (const value of artifact.values) {
    if (value.shape === 'record') {
      out.append('final case class '); out.append(value.identifier, [value.source]); fields(value.fields, out); out.append('\n');
    } else {
      out.append('sealed trait '); out.append(value.identifier, [value.source]); out.append('\n\nobject ');
      out.append(value.identifier, [value.source]); out.append(' {\n');
      for (const variant of value.variants) {
        out.append(variant.fields.length ? '  final case class ' : '  case object ');
        out.append(variant.identifier, [variant.source]);
        if (variant.fields.length) fields(variant.fields, out);
        out.append(' extends '); out.append(scalaSymbol(value), [value.source, variant.source]); out.append('\n');
      }
      out.append('}\n');
    }
  }
}
export function portTemplate(port, out) {
  packageLine(port.packageName, out); out.append('trait '); out.append(port.identifier, [port.source]); out.append(' {\n');
  for (const m of port.methods) { method(m, out); out.append('\n'); }
  out.append('}\n');
}
export function bridgeTemplate(bridge, out) {
  packageLine(bridge.packageName, out); out.append('final class '); out.append(bridge.identifier, [bridge.source]);
  if (bridge.delegate.injected) {
    out.append('('); out.append('private val ' + bridge.delegate.identifier + ': ' + scalaSymbol(bridge.delegate.symbol), [bridge.delegate.mappingSource, bridge.delegate.source]); out.append(')');
  }
  out.append(' extends '); out.append(scalaSymbol(bridge.port), [bridge.source]); out.append(' {\n');
  for (const m of bridge.methods) {
    method(m, out, true); out.append(' =\n    ');
    out.append(bridge.delegate.injected ? 'this.' + bridge.delegate.identifier : scalaSymbol(bridge.delegate.symbol), [bridge.delegate.mappingSource, bridge.delegate.source]);
    out.append('.' + m.delegateMember, [m.mappingSource, m.source]); out.append('(');
    m.parameters.forEach((p, i) => { if (i) out.append(', '); out.append(p.identifier, [p.source, m.mappingSource]); });
    out.append(')\n');
  }
  out.append('}\n');
}
function factoryGroups(groups, out) {
  for (const g of groups) {
    out.append(g.implicit ? '(implicit ' : '(', [g.source]);
    g.inputs.forEach((i, n) => { if (n) out.append(', '); out.append(i.identifier + ': ' + scalaType(i.type), [i.source]); });
    out.append(')');
  }
}
function callGroups(groups, out) {
  for (const g of groups) {
    out.append('(', [g.source]);
    g.arguments.forEach((a, n) => { if (n) out.append(', '); out.append(a.identifier, [a.source, a.fromSource]); });
    out.append(')');
  }
}
export function rootTemplate(root, out) {
  packageLine(root.packageName, out); out.append('object '); out.append(root.identifier, [root.source]); out.append(' {\n  def ');
  out.append(root.method, [root.methodSource]); factoryGroups(root.parameterGroups, out);
  out.append(': '); out.append(scalaType(root.result.type), [root.result.source]); out.append(' = {\n');
  for (const i of root.initializations) {
    out.append('    val '); out.append(i.identifier, [i.source, ...i.bindingSources]); out.append(' = ');
    if (i.construction === 'class') out.append('new ');
    out.append(scalaSymbol(i.symbol), [i.source, ...i.bindingSources]); callGroups(i.constructor, out); out.append('\n');
  }
  out.append('    '); out.append(root.resultIdentifier, [root.result.source, root.resultBindingSource]); out.append('\n  }\n}\n');
}
export function buildTemplate(artifact, model, roots, out) {
  if (artifact.path === 'project/build.properties') { out.append('sbt.version=1.4.9\n', artifact.sources); return; }
  out.append('ThisBuild / scalaVersion := "2.13.14"\nThisBuild / organization := ' + scalaString(model.packageName) + '\n' +
    'ThisBuild / version := "0.1.0-candidate"\nThisBuild / Test / parallelExecution := false\n' +
    'Global / concurrentRestrictions += Tags.limit(Tags.Test, 1)\n\n' +
    'lazy val ' + model.buildSettingsIdentifier + ' = Seq(\n' +
    '  scalacOptions ++= Seq("-encoding", "UTF-8", "-deprecation", "-feature", "-unchecked"),\n' +
    '  libraryDependencies += "org.scalatest" %% "scalatest-funsuite" % "3.2.15" % Test\n)\n', artifact.sources);
  for (const m of model.modules) {
    out.append('\nlazy val ' + m.identifier + ' = (project in file(' + scalaString(m.id === 'root' ? '.' : 'modules/' + m.id) + '))\n');
    if (m.dependsOn.length) out.append('  .dependsOn(' + m.dependsOn.map(id => model.modules.find(m => m.id === id).identifier).join(', ') + ')\n');
    if (m.id === 'root') out.append('  .aggregate(' + model.modules.filter(m => m.id !== 'root').map(m => m.identifier).join(', ') + ')\n');
    out.append('  .settings(' + model.buildSettingsIdentifier + ')');
    const external = roots.filter(r => r.module === m.id);
    if (external.length) {
      out.append('\n  .settings(Compile / unmanagedSourceDirectories ++= Seq(');
      external.forEach((r, n) => {
        if (n) out.append(', ');
        out.append('file(' + scalaString(r.absolutePath) + ')', model.lowered.handwritten.filter(h => h.sourceRootKey === r.id).map(h => h.source));
      });
      out.append('))');
    }
    out.append('\n');
  }
}
export function valueShapeTestTemplate(artifact, out) {
  packageLine(artifact.packageName, out);
  out.append('// Mechanical signature shape checks only; no business values or behavioral oracle.\nfinal class ' + artifact.identifier +
    ' extends _root_.org.scalatest.funsuite.AnyFunSuite {\n  test("declared value signature shape") {\n', artifact.sources);
  for (const v of artifact.values) {
    if (v.shape === 'record') {
      out.append('    assert(classOf[_root_.scala.Product].isAssignableFrom(classOf[' + scalaSymbol(v) + ']))\n', [v.source]);
      for (const f of v.fields) out.append('    assert(classOf[' + scalaSymbol(v) + '].getDeclaredMethods.exists(_.getName == ' + scalaString(f.name) + '))\n', [f.source]);
    } else {
      for (const variant of v.variants) {
        const variantSymbol = scalaSymbol(v) + '.' + variant.identifier;
        if (variant.fields.length) out.append('    assert(classOf[' + scalaSymbol(v) + '].isAssignableFrom(classOf[' + variantSymbol + ']))\n', [v.source, variant.source]);
        else out.append('    assert(' + variantSymbol + '.isInstanceOf[' + scalaSymbol(v) + '])\n', [v.source, variant.source]);
      }
    }
  }
  out.append('  }\n}\n');
}
export function rootShapeTestTemplate(artifact, out) {
  const root = artifact.root;
  packageLine(artifact.packageName, out);
  out.append('// Compile-time factory binding shape only; this suite never invokes the business flow.\nfinal class ' + artifact.identifier +
    ' extends _root_.org.scalatest.funsuite.AnyFunSuite {\n  private def ' + artifact.shapeMethod, artifact.sources);
  factoryGroups(root.parameterGroups, out); out.append(': '); out.append(scalaType(root.result.type), [root.result.source]);
  out.append(' =\n    ' + scalaSymbol(root) + '.'); out.append(root.method, [root.methodSource]);
  for (const g of root.parameterGroups) {
    out.append('(');
    g.inputs.forEach((i, n) => { if (n) out.append(', '); out.append(i.identifier, [i.source]); });
    out.append(')');
  }
  out.append('\n\n  test("root binding signature shape") {\n    assert(_root_.scala.Option(' + scalaSymbol(root) + ').nonEmpty)\n  }\n}\n', [root.source]);
}
