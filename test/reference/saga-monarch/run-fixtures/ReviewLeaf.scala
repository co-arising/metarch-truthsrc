package reference.inventory.ext

import reference.inventory.kernel.PureReviewRunProtocol.Review
import scala.concurrent.Future

final class ReviewLeaf extends Review.Leaf {
  def apply(args: Review.Args): Future[Review.Outcome] = Future.successful(
    if (args.request.requestId.value == "reject") Review.Outcome.Rejected("review rejected")
    else Review.Outcome.Done(Review.Values(args.request)))
}
