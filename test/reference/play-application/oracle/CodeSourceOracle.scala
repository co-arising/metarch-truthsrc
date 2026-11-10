package example.inventory.playreference.oracle

import java.nio.file.{Files, Paths}
import java.security.MessageDigest
import play.api.libs.json._

object CodeSourceOracle {
  def main(args: Array[String]): Unit = {
    require(args.length == 1)
    val entries = Json.parse(Files.readAllBytes(Paths.get(args(0)))).as[JsArray].value
    entries.foreach { entry =>
      val name = (entry \ "className").as[String]
      val expected = Paths.get((entry \ "file").as[String]).toRealPath()
      val loaded = Class.forName(name).getProtectionDomain.getCodeSource.getLocation.toURI
      val actual = Paths.get(loaded).toRealPath()
      assert(actual == expected, "loaded-source:" + name)
      if (Files.isRegularFile(actual)) {
        val digest = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(actual)).map(b => f"${b & 255}%02x").mkString
        assert(digest == (entry \ "sha256").as[String], "loaded-bytes:" + name)
      }
      val resources = Thread.currentThread().getContextClassLoader.getResources(name.replace('.', '/') + ".class")
      var count = 0
      while (resources.hasMoreElements) { resources.nextElement(); count += 1 }
      assert(count == 1, "class-shadow:" + name)
      println("CASE codesource:" + name)
    }
    println("PLAY_CODESOURCE_ORACLE_PASSED assertions=" + entries.size)
  }
}
