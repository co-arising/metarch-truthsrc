package net.imadz.codegen.structure

import net.imadz.codegen.structure.NamingConventions

/** [The Map] 定义整个应用的分层架构包结构。 任何 Builder 都禁止拼接字符串，必须引用此对象。
  */
case class PackageLayout(base: String) {

  // --- 1. Domain Layer (业务核心) ---
  object domain {
    val root = s"$base.domain"

    object values {
      val root =
        s"${domain.root}.values" // e.g. net.imadz.banking.domain.values
    }

    object entities {
      val root = s"${domain.root}.entities" // e.g. CreditBalanceEntity
      val behaviors = s"${root}.behaviors" // e.g. EventHandler
    }

    object services {
      val root = s"${domain.root}.services" // e.g. TransferDomainService
    }

    object invariants {
      val root = s"${domain.root}.invariant" // e.g. ReserveFundsRule
    }

    object policies {
      val root = s"${domain.root}.policy" // e.g. ReserveInventoryPolicy
    }

    object events {
      val root = s"${domain.root}.events"
    }
  }

  // --- 2. Application Layer (应用编排) ---
  object application {
    val root = s"$base.application"

    // [重要] Aggregate 在 Application 层 (符合 Golden Sample)
    object aggregates {
      val root = s"${application.root}.aggregates"
      val behaviors =
        s"${application.root}.aggregates.behaviors" // CommandHelpers, Behaviors
      val factories = s"${application.root}.aggregates.factories"
      val repository =
        s"${application.root}.aggregates.repository" // Repository Interface
    }

    object services {
      val root = s"${application.root}.services"

      // Saga 相关
      object transactor {
        val root = s"${services.root}.transactor" // SagaTransactor
        val context =
          s"${services.root}.transactor" // Context (Golden Sample 中同包)
        val behaviors = s"${services.root}.transactor.behaviors"
        val repository =
          s"${services.root}.transactor" // Repository Interface (Golden Sample 中同包)
      }
    }

    object projection {
      val root = s"${application.root}.projection" // Projection, Handler, DTO
      val handlers =
        s"${application.root}.projection.handlers" // Projection Handlers
      object repository {
        val root = s"${projection.root}.repository"
      }
    }

    object queries {
      val root = s"${application.root}.queries"
    }

    // 2026-09-20 EP_Improvement_Engine：Connector 能力面（调外部工具·@ImplementedBy 形态）
    object connectors {
      val root = s"${application.root}.connectors"
    }
  }

  // --- 3. Infrastructure Layer (技术实现) ---
  object infrastructure {
    val root = s"$base.infrastructure"
    val bootstrap = s"${root}.bootstrap"

    object persistence {
      val root = s"${infrastructure.root}.persistence" // Adapters
      val converters = s"${root}.converters"
      val strategies = s"${root}.strategies"

      object repositories {
        val aggregate = s"${infrastructure.root}.repositories.aggregate"
        val projection = s"${infrastructure.root}.repositories.projection"
        val saga =
          s"${infrastructure.root}.repositories.saga" // Saga Repository Impl 在这里
      }
    }

    // 2026-09-20 EP_Improvement_Engine：Connector 实现面 + 手写子进程基建外域
    object connectors {
      val root = s"${infrastructure.root}.connectors"
    }
    object process {
      val root = s"${infrastructure.root}.process" // 手写 NodeSubprocessRunner 所在（生成器物理不可进）
    }

    object api {
      val root = "controllers" // Play Controller 通常在根包下的 controllers
    }

    object proto {
      val root = s"$base.infrastructure.proto"
      val sagaParticipant = s"${root}.saga_participant"
      val transactions = s"${root}.transactions"

      /** 生成聚合事件的 proto 包路径
        * @param aggregateName
        *   聚合名称
        * @return
        *   proto 包路径
        */
      def eventPackage(aggregateName: String): String = {
        val segment = NamingConventions
          .getAggregateBaseName(aggregateName)
          .replaceAll("([A-Z])", "_$1")
          .toLowerCase
          .stripPrefix("_")
        s"${root}.$segment"
      }
    }
  }

  // --- 4. Modules ---
  object modules {
    val root = s"$base.modules" // Guice Modules
  }
}
