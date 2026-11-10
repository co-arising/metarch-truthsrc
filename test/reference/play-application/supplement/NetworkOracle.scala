package example.inventory.playreference.supplement

import java.net.{InetAddress, InetSocketAddress, DatagramSocket}
import java.nio.channels.{ServerSocketChannel, SocketChannel}
import java.nio.file.{Files, Paths}
import scala.util.Try

object NetworkOracle {
  def main(args: Array[String]): Unit = {
    require(args.length == 1)
    val server = ServerSocketChannel.open()
    try {
      server.bind(new InetSocketAddress("127.0.0.1", 0))
      val address = server.getLocalAddress.asInstanceOf[InetSocketAddress]
      assert(address.getAddress.getHostAddress == "127.0.0.1" && address.getPort > 0, "exact-loopback-listener")
      val client = SocketChannel.open(address)
      try { val accepted = server.accept(); accepted.close() } finally client.close()
      println("CASE exact-loopback-connect")
    } finally server.close()
    val denied = Try {
      val client = SocketChannel.open()
      try { client.socket().connect(new InetSocketAddress("192.0.2.1", 9), 300); () } finally client.close()
    }
    assert(denied.failed.toOption.exists(e => e.isInstanceOf[java.net.SocketException] && e.getMessage.contains("Operation not permitted")), "external-connect-denied")
    println("CASE external-connect-denied")
    val udp = Try {
      val socket = new DatagramSocket(null)
      try { socket.bind(new InetSocketAddress("127.0.0.1", 0)); () } finally socket.close()
    }
    assert(udp.failed.toOption.exists(e => e.isInstanceOf[java.net.SocketException] && e.getMessage.contains("Operation not permitted")), "udp-denied")
    println("CASE udp-denied")
    val ipv6 = Try {
      val socket = new java.net.ServerSocket()
      try { socket.bind(new InetSocketAddress(InetAddress.getByName("::1"), 0)); () } finally socket.close()
    }
    assert(ipv6.failed.toOption.exists(e => e.isInstanceOf[java.net.SocketException] &&
      (e.getMessage.contains("Operation not permitted") || e.getMessage.contains("Protocol family unavailable"))), "ipv6-disabled-or-denied")
    println("CASE ipv6-disabled-or-denied")
    val target = Paths.get(args(0))
    val write = Try(Files.write(target, Array[Byte](1, 2, 3)))
    assert(write.failed.toOption.exists {
      case e: java.nio.file.FileSystemException => e.isInstanceOf[java.nio.file.AccessDeniedException] || e.getReason == "Operation not permitted"
      case _ => false
    }, "protected-input-write-denied")
    println("CASE protected-input-write-denied")
    println("PLAY_NETWORK_ORACLE_PASSED assertions=5")
  }
}
