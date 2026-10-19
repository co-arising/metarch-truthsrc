package goldens.authdsl

import net.imadz.common.auth.Roles

/** Role policy: Bank Auth Policy */
object BankAuthPolicy {
  val policy: Map[String, Set[String]] = Map(
    "GET /api/batches" -> Set(Roles.User),
    "POST /api/batches" -> Set(Roles.SystemOperator)
  )
  def requires(path: String): Set[String] = policy.getOrElse(path, Set(Roles.User))
}
