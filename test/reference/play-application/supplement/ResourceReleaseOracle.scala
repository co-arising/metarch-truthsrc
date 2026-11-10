package example.inventory.playreference.supplement

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import com.typesafe.config.ConfigFactory
import example.inventory.composition.WarehouseResourceLifecycle
import java.nio.channels.FileChannel
import java.nio.file.{Paths, StandardOpenOption}
import scala.concurrent.{Await, Future}
import scala.concurrent.duration._

object ResourceReleaseOracle {
  def main(args: Array[String]): Unit = {
    require(args.length == 1)
    val system = ActorSystem[Nothing](Behaviors.empty, "ResourceReleaseOracle", ConfigFactory.parseString("akka.actor.provider=local\nakka.loglevel=WARNING"))
    val channel = FileChannel.open(Paths.get(args(0)), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
    try {
      val lifecycle = new WarehouseResourceLifecycle(system)
      lifecycle.register("file-channel") { _ => channel.close(); Future.successful(()) }
      val result = Await.result(lifecycle.close(), 11.seconds)
      assert(result.drained && !channel.isOpen, "owned-resource-must-be-closed")
      println("PLAY_RESOURCE_RELEASE_ORACLE_PASSED")
    } finally {
      channel.close()
      system.terminate()
      Await.result(system.whenTerminated, 8.seconds)
    }
  }
}
