
## Protected Regions 契约（2026-10-19 用户亲定）

生成器遵循 protected regions 模式：

1. **首次生成**：落地文件骨架，MANUAL 区内放 `???`
   ```
   // ==== BEGIN MANUAL ====
   ???
   // ==== END MANUAL ====
   ```

2. **再次生成**：只更新骨架部分（MANUAL 区之外），MANUAL 区内人/agent 已填的内容**永不覆盖**

3. **AI_PROMPT 块**：`>>> AI_PROMPT_START ... <<< AI_PROMPT_END` 标记需要 agent 迭代的意图，同样受保护

4. **ext/ 手写区**：生成器永不写入 `ext/` 目录，那是纯手写区
