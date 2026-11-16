package net.imadz.codegen.scaffolding.cqrs

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, LinkOption, Path, StandardCopyOption}
import java.nio.file.attribute.BasicFileAttributes
import java.security.MessageDigest
import scala.collection.JavaConverters._

/** Generator-owned truthsrc.anchors/v1 file evidence. Knowledge keys come from
  * admitted models; only accepted application writes declare new locations.
  * Other generators and untouched paths are retained, not recertified here. */
object SagaAnchorIndex {
  val Version = "truthsrc.anchors/v1"
  val GeneratorId = "codegen-main"
  private val Hash = "sha256:[a-f0-9]{64}".r

  private[codegen] final case class TestHooks(
      afterVerification: () => Unit = () => (),
      beforeMove: () => Unit = () => ())

  /** Compatibility entry: the existing admitted Saga API uses unprefixed ids. */
  def write(
      root: Path,
      declarations: collection.Map[String, Iterable[Path]],
      definitionDigests: Map[String, String],
      generatorVersion: String
  ): Path = {
    require(declarations.nonEmpty, "saga anchor emission requires at least one declaration")
    writeKnowledgeKeys(root, declarations.map { case (id, paths) => s"saga:$id" -> paths }.toMap,
      definitionDigests.map { case (id, digest) => s"saga:$id" -> digest }, generatorVersion,
      declarations.valuesIterator.flatten.map(p => p.normalize -> fingerprint(Files.readAllBytes(p))).toMap)
  }

  private[codegen] def fingerprint(bytes: Array[Byte]): String =
    "sha256:" + MessageDigest.getInstance("SHA-256").digest(bytes).map(b => f"${b & 0xff}%02x").mkString

  private[codegen] def preflightPath(root: Path, path: Path, required: Boolean = false): Path = {
    require(root.isAbsolute && root.normalize == root, "absolute normalized anchor root required")
    val absolute = path.toAbsolutePath.normalize
    require(absolute.startsWith(root) && absolute != root, s"anchor escapes root: $path")
    var current = root.toRealPath()
    val components = root.relativize(absolute).iterator().asScala.toVector
    for ((part, index) <- components.zipWithIndex) {
      if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
        require(Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS), s"non-directory anchor path: $path")
        val stream = Files.list(current)
        val names = try stream.iterator().asScala.map(_.getFileName.toString).toVector finally stream.close()
        val aliases = names.filter(_.equalsIgnoreCase(part.toString))
        require(aliases.isEmpty || aliases == Vector(part.toString), s"case-fold anchor alias: $path")
      }
      current = current.resolve(part.toString)
      require(!Files.isSymbolicLink(current), s"symlink anchor path: $path")
      if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
        if (index == components.size - 1) {
          require(Files.isRegularFile(current, LinkOption.NOFOLLOW_LINKS), s"anchor is not a file: $path")
          require(Files.getAttribute(current, "unix:nlink").asInstanceOf[Number].longValue == 1L,
            s"hardlink anchor path: $path")
        } else require(Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS), s"non-directory anchor path: $path")
      }
    }
    require(!required || Files.isRegularFile(current, LinkOption.NOFOLLOW_LINKS), s"missing anchor source: $path")
    current
  }

  /** expectedFingerprints are captured from the final application write (including
    * MANUAL merge), not the pre-merge template. This boundary never writes source.
    * Rechecks detect ordinary drift; they are not a hostile concurrent-FS transaction. */
  def writeKnowledgeKeys(
      root: Path,
      declarations: collection.Map[String, Iterable[Path]],
      definitionDigests: Map[String, String],
      generatorVersion: String,
      expectedFingerprints: Map[Path, String]
  ): Path = writeChecked(root, declarations, definitionDigests, generatorVersion, expectedFingerprints, TestHooks())

  private[codegen] def writeChecked(
      root: Path,
      declarations: collection.Map[String, Iterable[Path]],
      definitionDigests: Map[String, String],
      generatorVersion: String,
      expectedFingerprints: Map[Path, String],
      hooks: TestHooks
  ): Path = {
    require(declarations.nonEmpty, "file anchor emission requires at least one declaration")
    require(root.isAbsolute && root.normalize == root, "absolute normalized anchor root required")
    require(generatorVersion != null && generatorVersion.nonEmpty, "generator version required")
    val realRoot = root.toRealPath()
    val target = root.resolve("anchors.json")

    def checked(path: Path, required: Boolean): Path = preflightPath(root, path, required)

    def indexBytes(): Option[Vector[Byte]] = {
      val path = checked(target, required = false)
      if (Files.exists(path)) Some(Files.readAllBytes(path).toVector) else None
    }
    val priorBytes = indexBytes()
    val index = priorBytes.map(bytes => ujson.read(new String(bytes.toArray, StandardCharsets.UTF_8)))
      .getOrElse(ujson.Obj("version" -> Version, "anchors" -> ujson.Obj()))
    require(index.objOpt.isDefined && index.obj.get("version").contains(ujson.Str(Version)), "unsupported anchor index")
    val prior = index.obj.getOrElse("anchors", throw new IllegalArgumentException("missing anchors object"))
    require(prior.objOpt.isDefined, "anchors must be an object")
    for ((key, rows) <- prior.obj) {
      require(key.nonEmpty && rows.arrOpt.isDefined, "invalid prior anchor group")
      for (row <- rows.arr) {
        require(row.objOpt.isDefined, "invalid prior anchor location")
        for (field <- Vector("repo", "file", "generator", "generatorVersion", "status"))
          require(row.obj.get(field).flatMap(_.strOpt).exists(_.nonEmpty), s"invalid prior anchor $field")
        require(Set("planned", "source-verified", "stale", "unmapped").contains(row("status").str), "invalid prior status")
        val file = row("file").str
        require(!file.startsWith("/") && !file.contains("\\") &&
          file.split("/", -1).forall(p => p.nonEmpty && p != "." && p != ".."), "unsafe prior anchor file")
        require(row.obj.get("verification").exists(_.objOpt.isDefined), "invalid prior verification")
        if (row("status").str == "source-verified") {
          require(row.obj.get("fingerprint").flatMap(_.strOpt).exists(s => Hash.pattern.matcher(s).matches()), "invalid prior fingerprint")
          require(row("verification").obj.get("fileVerified").contains(ujson.Bool(true)), "invalid prior certificate")
        }
      }
    }

    val paths = declarations.valuesIterator.flatten.map(_.normalize).toVector.distinct
    val observed = paths.map { path =>
      require(path != target && !Set("anchors.json", "truthsrc.ledger.json").contains(path.getFileName.toString), "derived artifact cannot anchor itself")
      val bytes = Files.readAllBytes(checked(path, required = true))
      val actual = fingerprint(bytes)
      require(expectedFingerprints.get(path).contains(actual), s"source changed since application: $path")
      path -> actual
    }.toMap
    val replaced = paths.map(p => root.relativize(p).toString).toSet
    val anchors = ujson.Obj()
    for ((key, rows) <- prior.obj) {
      val retained = rows.arr.filterNot(row => row("generator").str == GeneratorId &&
        row("repo").str == root.toString && replaced.contains(row("file").str))
      if (retained.nonEmpty) anchors(key) = ujson.Arr.from(retained)
    }
    for (key <- declarations.keysIterator.toVector.sorted) {
      require(key.nonEmpty && key.contains(":"), "full knowledge key required")
      val digest = definitionDigests.get(key)
      require(!key.startsWith("saga:") || digest.isDefined, s"missing definition digest: $key")
      digest.foreach(d => require(Hash.pattern.matcher(d).matches(), "invalid definition digest"))
      val locations = anchors.obj.get(key).map(_.arr.toVector).getOrElse(Vector.empty)
      val fresh = declarations(key).toVector.map(_.normalize).distinct.map { path =>
        val location = ujson.Obj(
          "repo" -> root.toString, "file" -> root.relativize(path).toString,
          "module" -> ujson.Null, "symbol" -> ujson.Null, "span" -> ujson.Null,
          "generator" -> GeneratorId, "generatorVersion" -> generatorVersion,
          "fingerprint" -> observed(path), "status" -> "source-verified",
          "verification" -> ujson.Obj("method" -> "sha256-bytes", "level" -> "file",
            "fileVerified" -> true, "symbolVerified" -> false, "spanVerified" -> false))
        digest.foreach(d => location("definitionDigest") = ujson.Str(d))
        location
      }
      anchors(key) = ujson.Arr.from(locations ++ fresh)
    }
    index("anchors") = ujson.Obj.from(anchors.obj.toVector.sortBy(_._1))
    hooks.afterVerification()
    def assertFresh(): Unit = {
      require(indexBytes() == priorBytes, "anchor index changed during verification")
      observed.foreach { case (path, expected) =>
        require(fingerprint(Files.readAllBytes(checked(path, required = true))) == expected,
          s"source changed after verification: $path")
      }
    }
    assertFresh()
    val temporary = Files.createTempFile(realRoot, ".anchors.json-", ".tmp")
    val ownedKey = Files.readAttributes(temporary, classOf[BasicFileAttributes], LinkOption.NOFOLLOW_LINKS).fileKey()
    var committed = false
    try {
      Files.write(temporary, (ujson.write(index, indent = 2) + "\n").getBytes(StandardCharsets.UTF_8))
      hooks.beforeMove()
      assertFresh()
      require(!Files.isSymbolicLink(temporary) &&
        Files.readAttributes(temporary, classOf[BasicFileAttributes], LinkOption.NOFOLLOW_LINKS).fileKey() == ownedKey,
        "temporary anchor index changed")
      Files.move(temporary, checked(target, required = false), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      committed = true
      target
    } finally {
      if (!committed) {
        try {
          if (Files.exists(temporary, LinkOption.NOFOLLOW_LINKS) && !Files.isSymbolicLink(temporary) &&
            Files.readAttributes(temporary, classOf[BasicFileAttributes], LinkOption.NOFOLLOW_LINKS).fileKey() == ownedKey)
            Files.delete(temporary)
        } catch { case scala.util.control.NonFatal(_) => () }
      }
    }
  }
}
