package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{
  ApplicationServiceMethodModel,
  ApplicationServiceModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext}
import net.imadz.meta._

// --- Builder 实现 ---

object ApplicationServiceBuilder {

  def build(
      meta: ApplicationServiceMetadata,
      ctx: GeneratorContext
  ): ApplicationServiceModel = {
    // 1. 类型解析
    val pkg = ctx.layout.application.services.root
    val selfType = ctx.typeResolver.applicationService(meta.name)

    // 2. 依赖解析 (Repository Refs and other TypeRefs)
    val resolvedDeps = meta.dependencies.map(ctx.typeResolver.resolve(_))

    // 3. 方法转换
    val methods = meta.methods.map { m =>
      // a. 参数
      val parameters = m.parameters.map(p =>
        FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType), noteId = p.noteId, description = p.description)
      )

      // b. 返回类型
      val returnType = ctx.typeResolver.resolve(m.returnType)

      // c. 调用命令 (用于生成 Ask 逻辑)
      val invokedCommands = m.invokes.map(ctx.typeResolver.resolve(_))

      ApplicationServiceMethodModel(
        name = m.name,
        parameters = parameters,
        returnType = returnType,
        bodyLogic =
          m.logic.referenceCode.getOrElse(s"// TODO: ${m.logic.intent}"),
        invokesCommands = invokedCommands
      )
    }

    // 4. 依赖收集
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++
        m.parameters.flatMap(_.typeRef.collectAllDependencies) ++
        m.invokesCommands.flatMap(_.collectAllDependencies)
    }

    // 注入核心框架依赖
    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("Singleton")
    )

    val allDeps =
      (resolvedDeps.toSet ++ methodDeps.toSet ++ frameworkDeps).toSet

    val dependencies = allDeps.filter(_.shouldImport(pkg)).toList.distinct

    ApplicationServiceModel(selfType, methods, dependencies.toSet)
  }
}
