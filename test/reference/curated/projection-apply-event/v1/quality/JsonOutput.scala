package example.stockreservation.projections.quality

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path}

object JsonOutput {
  private def escape(character: Char): String = character match {
    case '"' => "\\\""
    case '\\' => "\\\\"
    case '\n' => "\\n"
    case '\r' => "\\r"
    case '\t' => "\\t"
    case value if value < ' ' => f"\\u${value.toInt}%04x"
    case value => value.toString
  }

  def string(value: String): String = "\"" + value.flatMap(escape) + "\""

  def obj(fields: (String, String)*): String =
    fields.map { case (key, value) => string(key) + ":" + value }.mkString("{", ",", "}")

  def array(values: Iterable[String]): String = values.mkString("[", ",", "]")

  def save(path: Path, content: String): Unit = {
    require(!Files.exists(path), "Result path must be exclusive")
    Files.write(path, (content + "\n").getBytes(StandardCharsets.UTF_8), java.nio.file.StandardOpenOption.CREATE_NEW)
  }
}
