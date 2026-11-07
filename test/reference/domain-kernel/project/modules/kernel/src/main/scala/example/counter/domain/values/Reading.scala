package example.counter.domain.values

final case class Reading(
  label: String,
  note: String,
  ratio: Ratio,
  distance: Distance,
  maybe: Option[Option[String]],
  samples: Vector[Option[Long]],
  ratios: Map[String, Ratio]
)
