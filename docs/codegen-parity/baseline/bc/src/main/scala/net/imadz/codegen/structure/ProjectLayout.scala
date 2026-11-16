package net.imadz.codegen.structure

import java.io.File

/**
 * [The Territory]
 * 定义物理文件系统布局，涵盖 Scala 源码和 Conf 资源。
 */
case class ProjectLayout(basePackage: String, rootDir: File) {

  val scalaSource = new File(rootDir, "app")
  val resources = new File(rootDir, "conf")

  object conf {
    val root = resources

    // Main Entry
    val application = new File(root, "application.conf")
    
    // Web
    val routes = new File(root, "routes")

    // Akka & Split Configs
    val cluster = new File(root, "cluster.conf")
    val persistence = new File(root, "persistence.conf")
    val serialization = new File(root, "serialization.conf") // Auto-generated
    val projection = new File(root, "projection.conf")

    // Database Evolutions
    object sql {
      val dir = new File(root, "sql")
      def evolution(version: Int) = new File(dir, s"$version.sql")
    }
  }
}
