package net.imadz.meta.filesystem

import net.imadz.meta._
/** Adapter output: the generator-facing SystemMetadata plus the behavioral
  * semantic attachment both generators consume (formal-semantics.json). */
final case class AssembledFormal(system: SystemMetadata, semantics: FormalSemantics)


import scala.collection.mutable

/** Pure adapter: real truthsrc canonical + technical binding JSON -> full
  * SystemMetadata for the formal file-input entry.
  *
  * Bounded first-gate profile, front-loaded before any write: strict schema
  * keys, name/syntax/quantity bounds, duplicate/dangling/unsupported rejection,
  * no default type downgrades and no test-base reuse. Canonical `sagas`,
  * `pipelines` and `sessions` are deliberately NOT consumed here — strict
  * execution enters through the separately admitted v3 contract, whose base
  * re-check binds this assembled system to that contract at generation time.
  */
object SerialCanonicalAdapter {

  private val CanonicalSchema = "truthsrc/v1"
  private val MaxAggregates = 64
  private val MaxCommandsPerAggregate = 128
  private val MaxEventsPerAggregate = 512
  private val MaxMembers = 64
  private val MaxNameLength = 128

  /** dataType of a bound type, mirroring the strict admission dtype rules:
    * Id/Text -> String; Money -> StructRef(canonicalType). The P15 fab parity
    * adds the two saga-gate collection kinds (mirroring truthsrc
    * bounded-collection-args/args-anchored-manifest): Collection -> Vector of a
    * bounded id/text element; ManifestReference -> String with a declared
    * version anchor. ValueObject and Enumeration shapes remain outside. */
  private final case class BoundType(id: String, canonicalType: String, dataType: MetaType, kind: String)

  def assemble(canonical: ujson.Value, bindings: ujson.Value): Either[Vector[String], AssembledFormal] = {
    val errors = mutable.ListBuffer.empty[String]
    def err(message: String): Unit = errors += message

    def str(v: ujson.Value, at: String): Option[String] = v match {
      case ujson.Str(s) if s.nonEmpty && s.length <= MaxNameLength => Some(s)
      case _ => err(s"$at must be a non-empty string of at most $MaxNameLength chars"); None
    }
    def ident(v: ujson.Value, at: String): Option[String] = str(v, at).filter { s =>
      val ok = s.matches("[A-Za-z][A-Za-z0-9_]*")
      if (!ok) err(s"$at \"$s\" is not a valid Scala identifier")
      ok
    }
    /** Truthsrc atom names (completion events like "result-succeeded") allow
      * hyphens; only names that become generated Scala symbols need `ident`. */
    def truthName(v: ujson.Value, at: String): Option[String] = str(v, at).filter { s =>
      val ok = s.matches("[A-Za-z][A-Za-z0-9_-]*")
      if (!ok) err(s"$at \"$s\" is not a valid truthsrc atom name")
      ok
    }
    def arr(v: ujson.Value, at: String, max: Int): Option[Vector[ujson.Value]] = v match {
      case ujson.Arr(xs) if xs.length <= max => Some(xs.toVector)
      case ujson.Arr(_) => err(s"$at exceeds the bounded profile of $max entries"); None
      case _ => err(s"$at must be an array"); None
    }
    def emptyArray(v: ujson.Value, at: String, kind: String): Unit = v match {
      case ujson.Arr(xs) if xs.isEmpty => ()
      case ujson.Arr(_) => err(s"$at: non-empty $kind are outside this gate's supported profile")
      case _ => err(s"$at must be an array")
    }

    // ---- bindings: bounded type surface used for canonical dtype resolution ----
    // P15: the type surface is PER-SAGA (the fab double-lot tree declares the
    // same seven types on both sagas). Within one saga an id is unique; across
    // sagas an identical redeclaration merges and a differing one is rejected.
    val bound = mutable.LinkedHashMap.empty[String, BoundType]
    val declaredIn = mutable.Map.empty[String, Int]
    val moneyTypes = mutable.LinkedHashSet.empty[String]
    for {
      sagas <- bindings.obj.get("sagas").flatMap(arr(_, "/bindings/sagas", 1024))
      (saga, si) <- sagas.zipWithIndex
      types <- saga.obj.get("types").flatMap(arr(_, s"/bindings/sagas/$si/types", 1024))
      (t, ti) <- types.zipWithIndex
    } {
      val at = s"/bindings/sagas/$si/types/$ti"
      for {
        id <- str(t.obj.getOrElse("id", ujson.Null), s"$at/id")
        ct <- str(t.obj.getOrElse("canonicalType", ujson.Null), s"$at/canonicalType")
        kind = t.obj.get("kind").map(_.str).getOrElse("")
      } {
        if (declaredIn.get(id).contains(si)) err(s"$at duplicates bound type \"$id\"")
        val dtype: Option[MetaType] = kind match {
          case "id" | "text" =>
            val lo = t.obj.get("minLength").flatMap(v => v match { case ujson.Num(n) if n.isValidInt && n.toInt > 0 => Some(n.toInt); case _ => None })
            val hi = t.obj.get("maxLength").flatMap(v => v match { case ujson.Num(n) if n.isValidInt && n.toInt > 0 => Some(n.toInt); case _ => None })
            if (lo.isEmpty || hi.isEmpty || lo.get > hi.get) { err(s"$at \"$id\" has invalid length bounds"); None }
            else Some(StringType)
          case "money" =>
            val scale = t.obj.get("scale").flatMap(v => v match { case ujson.Num(n) if n.isValidInt => Some(n.toInt); case _ => None })
            val precision = t.obj.get("precision").flatMap(v => v match { case ujson.Num(n) if n.isValidInt => Some(n.toInt); case _ => None })
            if (scale.isEmpty || precision.isEmpty || scale.get < 0 || precision.get < 1 || scale.get > precision.get) {
              err(s"$at \"$id\" has invalid money scale/precision"); None
            } else { moneyTypes += ct; Some(StructRef(ct)) }
          case "collection" =>
            def positiveBound(key: String): Option[Int] =
              t.obj.get(key).flatMap(v => v match { case ujson.Num(n) if n.isValidInt && n.toInt >= 1 => Some(n.toInt); case _ => None })
            val elementId = t.obj.get("elementType").flatMap(_.strOpt)
            val lo = positiveBound("minItems"); val hi = positiveBound("maxItems")
            val element = elementId.flatMap(bound.get)
            (lo, hi, element) match {
              case (Some(loV), Some(hiV), Some(elem)) if loV <= hiV && (elem.kind == "id" || elem.kind == "text") =>
                Some(CustomType("Vector", "scala.collection.immutable", Seq(elem.dataType)))
              case _ =>
                err(s"$at \"$id\": collection requires positive minItems<=maxItems and an already-declared id/text elementType"); None
            }
          case "manifest-reference" =>
            if (t.obj.get("version").exists(v => v.strOpt.exists(_.nonEmpty))) Some(StringType)
            else { err(s"$at \"$id\": manifest-reference requires a declared version anchor"); None }
          case other =>
            err(s"$at \"$id\": binding type kind \"$other\" is outside this gate's supported profile (id/text/money/collection/manifest-reference)"); None
        }
        dtype.foreach { d =>
          val entry = BoundType(id, ct, d, kind)
          bound.get(id) match {
            case Some(existing) if declaredIn.get(id).exists(_ != si) && existing != entry =>
              err(s"$at redeclares bound type \"$id\" with a different shape than an earlier saga")
            case Some(_) => () // same-saga duplicate already recorded; identical cross-saga merge
            case None => bound += id -> entry; declaredIn += id -> si
          }
        }
      }
    }
    if (bound.isEmpty) err("/bindings/sagas/types: at least one bound type is required")

    /** Canonical dataType names resolve only through the bound types or the
      * explicit primitive whitelist — never a silent default. P4 state
      * deepening adds the Map[K, V] compound form (golden-master state shape:
      * accountBalance/reservedAmount/incomingCredits are keyed money maps). */
    def dtype(name: String, at: String): Option[MetaType] = {
      def primitive(s: String): Option[MetaType] = s match {
        case "String" => Some(StringType)
        case "Int" => Some(IntType)
        case "Long" => Some(LongType)
        case "Boolean" => Some(BooleanType)
        case "BigDecimal" => Some(BigDecimalType)
        case _ => None
      }
      name match {
        case _ if primitive(name).isDefined => primitive(name)
        case _ if name.startsWith("Map[") && name.endsWith("]") =>
          val inner = name.substring(name.indexOf('[') + 1, name.lastIndexOf(']'))
          val parts = inner.split(',').map(_.trim).toVector
          if (parts.length != 2 || parts.exists(_.isEmpty)) {
            err(s"$at: Map dataType \"$name\" must be \"Map[K, V]\" with exactly two member types"); None
          } else (dtype(parts(0), at), dtype(parts(1), at)) match {
            case (Some(k), Some(v)) => Some(CustomType("Map", "scala.collection.immutable", Seq(k, v)))
            case _ => None // member error already recorded by the nested dtype call
          }
        case other =>
          bound.get(other).map(_.dataType).orElse {
            err(s"$at: dataType \"$other\" is neither a bound type nor a whitelisted primitive"); None
          }
      }
    }

    // ---- canonical: bounded aggregate-only profile ----
    if (canonical.obj.getOrElse("schemaVersion", ujson.Null).strOpt.getOrElse("") != CanonicalSchema)
      err(s"/canonical/schemaVersion must be \"$CanonicalSchema\"")
    val workshop = str(canonical.obj.getOrElse("workshop", ujson.Null), "/canonical/workshop")
    for (k <- Vector("readModels", "stories", "domainServices"))
      emptyArray(canonical.obj.getOrElse(k, ujson.Arr()), s"/canonical/$k", s"$k")
    val aggregateValues = canonical.obj.get("aggregates").flatMap(arr(_, "/canonical/aggregates", MaxAggregates)).getOrElse(Vector.empty)
    if (aggregateValues.isEmpty) err("/canonical/aggregates: at least one aggregate is required")

    case class EventMeta(name: String, fields: Vector[FieldMetadata], producedBy: Vector[CommandRef])
    val builtAggregates = mutable.ListBuffer.empty[AggregateRootMetadata]
    val builtEntities = mutable.ListBuffer.empty[DomainEntityMetadata]
    val builtBehaviors = mutable.ListBuffer.empty[EntityBehaviorMetadata]
    val builtSemantics = mutable.ListBuffer.empty[FormalAggregateSemantics]

    for ((a, ai) <- aggregateValues.zipWithIndex) {
      val at = s"/canonical/aggregates/$ai"
      val nameO = ident(a.obj.getOrElse("name", ujson.Null), s"$at/name")
      val entityNameO = ident(a.obj.getOrElse("entity", ujson.Null), s"$at/entity")
      nameO.filter(n => builtAggregates.exists(_.name == n)).foreach(n => err(s"$at: duplicate aggregate \"$n\""))
      def members(key: String, max: Int): Vector[ujson.Value] =
        a.obj.get(key).flatMap(arr(_, s"$at/$key", max)).getOrElse(Vector.empty)

      val stateFields = members("stateFields", MaxMembers).flatMap { f =>
        for {
          fn <- ident(f.obj.getOrElse("name", ujson.Null), s"$at/stateFields/name")
          ft <- f.obj.get("dataType").map(_.str).flatMap(dtype(_, s"$at/stateFields/${fn}/dataType"))
          // S3 writtenBy lineage: carried verbatim, never parsed here — the
          // path grammar's only implementation is Node-side writtenby_lib.mjs.
          wb = f.obj.get("writtenBy").flatMap(arr(_, s"$at/stateFields/$fn/writtenBy", MaxMembers))
            .getOrElse(Vector.empty)
            .flatMap(p => str(p, s"$at/stateFields/$fn/writtenBy"))
        } yield FieldMetadata(fn, ft, writtenBy = wb)
      }
      // Generated-state convention (AssemblyEngine 同款)：聚合标识符并入 state
      // 首字段——实体 empty() 工厂与 bootstrap 的空状态表达式都按首字段签名生成。
      val stateVo = ValueObjectMetadata(nameO.map(_ + "State").getOrElse("UnnamedState"),
        (for {
          idn <- a.obj.get("identifier").flatMap(_.obj.get("name")).flatMap(ident(_, s"$at/identifier/name"))
          idt <- a.obj.get("identifier").flatMap(_.obj.get("dataType").map(_.str)).flatMap(dtype(_, s"$at/identifier/dataType"))
        } yield FieldMetadata(idn, idt)).toVector ++ stateFields,
        "Aggregate state from truth source (identifier folded first per generated-state convention)")

      val commandNames = mutable.LinkedHashSet.empty[String]
      val commands = members("commands", MaxCommandsPerAggregate).flatMap { c =>
        ident(c.obj.getOrElse("name", ujson.Null), s"$at/commands/name").flatMap { cn =>
          if (!commandNames.add(cn)) { err(s"$at/commands: duplicate command \"$cn\""); None }
          else {
            val params = c.obj.get("parameters").flatMap(arr(_, s"$at/commands/$cn/parameters", MaxMembers)).getOrElse(Vector.empty).flatMap { p =>
              for {
                pn <- ident(p.obj.getOrElse("name", ujson.Null), s"$at/commands/$cn/parameters/name")
                pt <- p.obj.get("dataType").map(_.str).flatMap(dtype(_, s"$at/commands/$cn/parameters/$pn/dataType"))
              } yield ParameterMetadata(pn, pt)
            }
            // P4 Slice 2 query-command convention (SCHEMA.md): a guard-less,
            // produce-less command is a read-only state query — the durable
            // evidence read path saga participant queries ask through.
            val guardsEmpty = c.obj.get("guards").flatMap(arr(_, s"$at/commands/$cn/guards", MaxMembers)).forall(_.isEmpty)
            val producesEmpty = c.obj.get("produces").flatMap(arr(_, s"$at/commands/$cn/produces", MaxMembers)).forall(_.isEmpty)
            Some((cn, params, guardsEmpty && producesEmpty))
          }
        }
      }
      val eventNames = mutable.LinkedHashSet.empty[String]
      val events = members("events", MaxEventsPerAggregate).flatMap { e =>
        truthName(e.obj.getOrElse("name", ujson.Null), s"$at/events/name").flatMap { en =>
          if (!eventNames.add(en)) { err(s"$at/events: duplicate event \"$en\""); None }
          else {
            val fields = e.obj.get("payloads").flatMap(arr(_, s"$at/events/$en/payloads", MaxMembers)).getOrElse(Vector.empty).flatMap { p =>
              for {
                pn <- ident(p.obj.getOrElse("name", ujson.Null), s"$at/events/$en/payloads/name")
                pt <- p.obj.get("dataType").map(_.str).flatMap(dtype(_, s"$at/events/$en/payloads/$pn/dataType"))
              } yield FieldMetadata(pn, pt)
            }
            Some((en, fields))
          }
        }
      }
      val eventByName = events.toMap
      // P2 semantic attachment: emissions (bindings), folds (foldAssignments)
      // and slice guards ride beside the AST for both generators. receipt.<slot>
      // resolves against the event's own payload (V13 rule, fail closed here).
      val eventRaw: Map[String, ujson.Value] =
        members("events", MaxEventsPerAggregate).flatMap(e => e.obj.get("name").map(_.str -> e)).toMap
      val emissions = eventNames.toVector.flatMap { en =>
        val ev = eventRaw.getOrElse(en, ujson.Null)
        val payloadNames = (ev.obj.getOrElse("payloads", ujson.Arr()).asInstanceOf[ujson.Arr].value.toVector
          .flatMap(_.obj.get("name").map(_.str))).toSet
        val rows = ev.obj.get("bindings").flatMap(arr(_, s"$at/events/$en/bindings", MaxMembers)).getOrElse(Vector.empty)
          .flatMap { r =>
            for {
              slot <- str(r.obj.getOrElse("slot", ujson.Null), s"$at/events/$en/bindings/slot")
              expr <- r.obj.get("expr").map(_.str)
            } yield {
              expr match {
                case t if t.startsWith("receipt.") =>
                  if (!payloadNames.contains(t.stripPrefix("receipt.")))
                    err(s"$at/events/$en/bindings: \"receipt.\" slot does not resolve to this event's payload")
                case _ => ()
              }
              Some((slot, expr))
            }
          }
        if (rows.exists(_.nonEmpty)) Some(FormalEmission(en, rows.flatten)) else None
      }
      val folds = eventNames.toVector.flatMap { en =>
        val ev = eventRaw.getOrElse(en, ujson.Null)
        val fat = s"$at/events/$en/foldAssignments"
        val rows = ev.obj.get("foldAssignments").flatMap(arr(_, fat, MaxMembers)).getOrElse(Vector.empty)
          .flatMap { r =>
            val slotO = str(r.obj.getOrElse("slot", ujson.Null), s"$fat/slot")
            val op = r.obj.get("op").map(_.str).getOrElse("set")
            def field(name: String): Option[String] = r.obj.get(name).map(_.str)
            op match {
              case "set" => for { slot <- slotO; expr <- field("expr") } yield FormalFoldRow(slot, op, expr = Some(expr))
              case "put" => for { slot <- slotO; key <- field("key"); value <- field("value") } yield FormalFoldRow(slot, op, key = Some(key), value = Some(value))
              case "remove" => for { slot <- slotO; key <- field("key") } yield FormalFoldRow(slot, op, key = Some(key))
              // P13 collection-migration folds (truthsrc lib/validate.mjs FOLD_OPS):
              // put-all merges a keyed wafer collection, remove-all drops one.
              case "put-all" => for { slot <- slotO; key <- field("key"); value <- field("value") } yield FormalFoldRow(slot, op, key = Some(key), value = Some(value))
              case "remove-all" => for { slot <- slotO; key <- field("key") } yield FormalFoldRow(slot, op, key = Some(key))
              case "money-apply" =>
                val sign = r.obj.get("sign").flatMap {
                  case ujson.Num(n) if n == 1 || n == -1 => Some(n.toInt)
                  case _ => None
                }
                (field("delta"), sign) match {
                  case (Some(delta), Some(s)) => slotO.map(FormalFoldRow(_, op, delta = Some(delta), sign = Some(s)))
                  case (Some(_), None) => err(s"$fat slot: op \"money-apply\" requires sign 1 or -1"); None
                  case (None, _) => err(s"$fat slot: op \"money-apply\" requires \"delta\""); None
                }
              case other =>
                err(s"$fat slot: unknown fold op \"$other\" (set|put|remove|money-apply|put-all|remove-all)"); None
            }
          }
        if (rows.nonEmpty) Some(FormalFold(en, rows)) else None
      }
      val guardDecls = members("commands", MaxCommandsPerAggregate).flatMap { c =>
        c.obj.get("guards").flatMap(arr(_, s"$at/commands/guards", MaxMembers)) match {
          case Some(gs) if gs.nonEmpty => Some(FormalGuards(c.obj("name").str, gs))
          case _ => None
        }
      }
      // Base event symbols are the explicit hyphen->underscore image of the
      // truthsrc atom name (the strict admission looks base symbols up through
      // the same image); two distinct atoms mapping to one symbol collide.
      val baseEventName = mutable.LinkedHashMap.empty[String, String]
      eventNames.foreach { en =>
        val bn = en.replace('-', '_')
        if (baseEventName.values.toSet.contains(bn)) err(s"$at/events: base symbol collision at \"$bn\"")
        else baseEventName += en -> bn
      }
      // produces -> producedBy wiring (dangling produce names are rejected)
      members("commands", MaxCommandsPerAggregate).foreach { c =>
        val cn = c.obj.get("name").map(_.str).getOrElse("")
        c.obj.get("produces").flatMap(arr(_, s"$at/commands/$cn/produces", MaxMembers)).getOrElse(Vector.empty).foreach { p =>
          str(p, s"$at/commands/$cn/produces").foreach { en =>
            if (!eventByName.contains(en)) err(s"$at/commands/$cn/produces: dangling event \"$en\"")
          }
        }
      }
      val eventMetas: Vector[EventMeta] = events.map { case (en, fields) =>
        val producers = members("commands", MaxCommandsPerAggregate).flatMap { c =>
          val cn = c.obj.get("name").map(_.str).getOrElse("")
          val produces = c.obj.get("produces").map(_.arr.map(_.str).toVector).getOrElse(Vector.empty)
          if (produces.contains(en)) Some(CommandRef(cn)) else None
        }
        EventMeta(en, fields, producers.distinct)
      }

      for {
        name <- nameO
        entityName <- entityNameO
        idf <- a.obj.get("identifier")
        idName <- ident(idf.obj.getOrElse("name", ujson.Null), s"$at/identifier/name")
        idType <- idf.obj.get("dataType").map(_.str).flatMap(dtype(_, s"$at/identifier/dataType"))
      } {
        val replyName = name + "Reply"
        val eventFamilyName = name + "Events"
        val commandFamilyName = name + "Commands"
        val behaviorName = name + "Behavior"
        // Generator-side implicit reply contract (same shape as bankingSystem
        // and the AssemblyEngine staging replies): every reply carries
        // error: Option[iMadzError]; the aggregate factory template reads it.
        val errorOption = CustomType("Option", "scala",
          Seq(CustomType("iMadzError", "net.imadz.common.CommonTypes")))
        // P4 Slice 2 query-command convention: guard-less, produce-less commands
        // are read-only state queries answering the whole entity state — the
        // reply field rides EntityStateRef so protocol and behavior resolve the
        // identical state type. No query command ⇒ reply family unchanged.
        val stateReplyName = s"Get${name}StateReply"
        val queryCommands = commands.collect { case (cn, _, true) => cn }.toSet
        val replyFamily = CommandReplyFamilyMetadata(name + "Replies",
          Vector(SubordinateCommandReplyMetadata(replyName, Vector(ParameterMetadata("error", errorOption)))) ++
            (if (queryCommands.nonEmpty) Vector(SubordinateCommandReplyMetadata(stateReplyName,
              Vector(ParameterMetadata("state", EntityStateRef(stateVo.name))))) else Vector.empty))
        val commandFamily = CommandFamilyMetadata(commandFamilyName, s"$name commands from truth source",
          commands.map { case (cn, params, isQuery) =>
            SubordinateCommandMetadata(cn, params, Some(CommandReplyRef(if (isQuery) stateReplyName else replyName)), isReadOnly = isQuery) })
        val eventFamily = EventFamilyMetadata(eventFamilyName, s"$name events from truth source",
          eventMetas.map(e => SubordinateDomainEventMetadata(baseEventName.getOrElse(e.name, e.name), e.fields,
            producedBy = e.producedBy)))
        val entity = DomainEntityMetadata(entityName, stateVo, eventFamily)
        val aggregate = AggregateRootMetadata(
          name = name,
          identifier = FieldMetadata(idName, idType),
          entityRef = EntityRef(entityName),
          stateRef = EntityStateRef(stateVo.name),
          eventFamilyRef = EventFamilyRef(eventFamilyName),
          commandFamily = commandFamily,
          replyFamily = replyFamily,
          behaviorRef = AggregateBehaviorRef(behaviorName),
          persistenceConfig = PersistenceConfig(name, ShardedTags(name.toLowerCase, 1)))
        builtEntities += entity
        builtAggregates += aggregate
        builtSemantics += FormalAggregateSemantics(name, emissions, folds, guardDecls)
        // The bootstrap wires one entity event handler per entity. The AST
        // mutation stays the declared identity fallback; real fold logic rides
        // the formal-semantics attachment (FormalFold rows) the behavior
        // generator consumes — declared shape, not invented logic.
        val handlerName = entityName.stripSuffix("Entity") + "EventHandler"
        val mutations = eventMetas.map(e =>
          EventStateMutation(EventRef(baseEventName.getOrElse(e.name, e.name)),
            BusinessLogic(s"Fold logic for ${e.name} rides the formal-semantics attachment; this AST mutation is the declared identity fallback",
              referenceCode = Some("state"))))
        builtBehaviors += EntityBehaviorMetadata(handlerName, EventFamilyRef(eventFamilyName), mutations)
      }
    }

    if (errors.nonEmpty) Left(errors.toVector)
    else {
      val moneyVos = moneyTypes.toVector.sorted.map(ct =>
        ValueObjectMetadata(ct, Vector(FieldMetadata("minorUnits", StringType), FieldMetadata("currency", StringType)),
          "Strict minor-unit-string money base required by the strict admission dtype contract"))
      // contextName feeds generated package/proto identifiers: derive a
      // proto-safe PascalCase identifier, never the raw hyphenated workshop
      // string (protobuf package segments reject '-').
      val context = workshop.map { w =>
        val pascal = w.split("-").filter(_.nonEmpty).map(s => s.charAt(0).toUpper + s.tail).mkString
        if (pascal.nonEmpty && pascal.matches("[A-Za-z][A-Za-z0-9_]*")) pascal
        else "TruthSourceDesign"
      }
      val systemName = context.map(_ + "System").getOrElse("TruthSourceSystem")
      Right(AssembledFormal(
        SystemMetadata(
          name = systemName,
          contextName = context,
          domain = DomainLayer(valueObjects = moneyVos, behaviors = builtBehaviors.toVector, entities = builtEntities.toVector, services = Nil, invariants = Nil),
          application = ApplicationLayer(
            behaviors = builtAggregates.toVector.map(a => AggregateBehaviorMetadata(a.behaviorRef.targetName, Nil)),
            aggregates = builtAggregates.toVector, services = Nil, queries = Nil, sagas = Nil, repositories = Nil),
          infrastructure = InfrastructureLayer(repositories = Nil, projections = Nil),
          interfaces = InterfaceLayer(controllers = Nil)),
        FormalSemantics(systemName, builtSemantics.toVector)))
    }
  }
}
