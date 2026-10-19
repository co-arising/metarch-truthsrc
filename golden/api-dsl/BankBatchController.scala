package goldens.apidsl

import play.api.mvc._

class BankBatchController extends BaseController {
  def listBatches = Action { Ok("listBatches") } // TODO: wire to Batch Chain Run
  def createBatch = Action { Ok("createBatch") } // TODO: wire to Batch Chain Run
}
