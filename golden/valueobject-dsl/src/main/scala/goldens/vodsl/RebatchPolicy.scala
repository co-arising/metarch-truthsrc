package goldens.vodsl

/** Value object: Policy for rebatching failed items */
final case class RebatchPolicy(maxRetries: Int, retryDelayMs: Long)
