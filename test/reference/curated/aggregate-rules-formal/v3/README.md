# aggregate-rules-formal v3 — guard 对象形状（OCP 版本）

## 与 v2 的唯一差异

`ReserveUnitsRule` 从 if 链（4 卫语句 CC=5 顶格）改为 **guard 对象形状 B**：

```scala
private sealed trait ReserveGuard {
  def rejection(state: StockReservationState, p: ReserveUnitsParams): Option[ReservationRejection]
}
private object QuantityGuard extends ReserveGuard { ... }        // CC=2
private object FreshRequestGuard extends ReserveGuard { ... }
private object RegisteredLocationsGuard extends ReserveGuard { ... }
private object SufficientStockGuard extends ReserveGuard { ... }

private val reserveGuards: Vector[ReserveGuard] = Vector(...)    // 顺序是声明数据

override def apply(...) =                                        // CC=2，恒定
  reserveGuards.iterator.map(_.rejection(state, p))
    .collectFirst { case Some(r) => Left(r.toError) }
    .getOrElse(Right(reserve(state, p)))
```

OCP 结构：新增卫语句＝新 guard 对象＋列表追加，`apply` 机器不改一字。
该形状与生成器 `GuardModel`（name/cond/onFail/errCode 列表）一一平移，
是 JS 生成器的发射模板。

其余 12 个文件与 v2 字节相同（含 ConfirmReservationRule 的 match 形状、
全部 79 性质、19 负对照、AST 度量器与质量入口）。

## 质量状态

- v2 已在窗口 20261118-02 通过完整质量门（编译＋AST＋三 seed，见
  `../v2/review-status.json`）。
- v3 源码已改，**同等质量门尚未对 v3 字节执行**；不把 v2 的通过
  转签给 v3。
- 用户在 v2 讲解后裁定采用形状 B，本版本待重跑质量门后交认可。
