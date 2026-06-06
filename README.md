# Todo List AI

复古手账风待办事项应用，使用 Next.js、React、Tailwind CSS、Supabase 和 DeepSeek AI。

## 功能

- 添加、完成、删除任务
- 支持父子任务层级
- AI 自动拆解任务为 3-5 个子任务
- Supabase 数据库持久化
- React + Tailwind CSS 前端页面

## 本地运行

```bash
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
```

## 数据库

在 Supabase SQL Editor 执行：

```text
supabase/schema.sql
```

如果已有 `tasks` 表，只需要补父子任务字段，可执行：

```text
supabase/add-task-parent-id.sql
```

## 验证

```bash
npm run typecheck
npm run test:api
npm run test:breakdown
npm run build
```
