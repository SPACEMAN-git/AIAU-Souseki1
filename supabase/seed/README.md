# seed — mock 房源数据

- `generate_seed.mjs`：确定性生成器（固定随机种子），8 个东京车站 × 各 10 套 = 80 套。
- `seed.sql`：生成结果（已提交，可直接执行）。重新生成：`node generate_seed.mjs > seed.sql`。

## 导入方式

先应用 migrations，再执行 seed：

```bash
supabase db push                      # 应用 supabase/migrations/
psql "$DATABASE_URL" -f seed.sql      # 或在 Supabase Dashboard SQL Editor 中粘贴执行
```

注意：`seed.sql` 开头会 `truncate` properties 表后重新插入，可重复执行。
