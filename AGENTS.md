# 项目协作与开发规范

## 项目概览

这是一个基于 Next.js Pages Router 的待办事项应用，包含前端页面、任务 API、Supabase 数据库持久化，以及 DeepSeek AI 自动拆解任务能力。

当前正式前端入口是 `http://localhost:3000`，对应 `pages/index.tsx`。根目录下的 `index.html` 是早期静态页面遗留文件，不再作为主功能入口使用。

## 项目结构规范

```text
.
├── pages/
│   ├── index.tsx                  # React + Tailwind 前端页面
│   ├── _app.tsx                   # 全局样式入口
│   └── api/
│       └── tasks/
│           ├── index.ts           # GET/POST 任务集合接口
│           ├── [id].ts            # PATCH/DELETE 单任务接口
│           └── breakdown.ts       # AI 自动拆解任务接口
├── lib/
│   ├── database.types.ts          # Supabase 数据库类型
│   ├── deepseek.ts                # DeepSeek/OpenAI SDK 客户端
│   ├── supabaseAdmin.ts           # Supabase 服务端客户端
│   └── tasks.ts                   # 任务类型、请求校验、通用响应工具
├── styles/
│   └── globals.css                # Tailwind 入口与复古手账视觉样式
├── scripts/
│   ├── test-api.mjs               # CRUD 与父子任务接口测试
│   └── test-breakdown-api.mjs     # AI 拆解接口测试
├── supabase/
│   ├── schema.sql                 # 完整建表 SQL
│   └── add-task-parent-id.sql     # 为已有表补充 parent_id 的迁移 SQL
├── tailwind.config.ts             # Tailwind 配置
├── postcss.config.js              # PostCSS 配置
├── package.json                   # 依赖与脚本
└── AGENTS.md                      # 本协作规范
```

新增文件时遵循以下归属：

- 前端页面与路由放在 `pages/`。
- API 路由放在 `pages/api/`，按业务资源分目录。
- 可复用类型、数据库客户端、请求校验、第三方服务客户端放在 `lib/`。
- 自动化验证脚本放在 `scripts/`。
- 数据库初始化或迁移 SQL 放在 `supabase/`。
- 全局样式和 Tailwind 组件样式放在 `styles/globals.css`。

## 环境变量规范

本地运行需要以下变量：

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
```

规范：

- 真实密钥只放在 `.env.local`。
- `.env.example` 只能放占位值，不能放真实 key。
- 修改 `.env.local` 后必须重启 `npm run dev`，Next.js 才会重新读取。
- `NEXT_PUBLIC_SUPABASE_URL` 必须是 Supabase 项目根地址，例如 `https://xxx.supabase.co`，不能带 `/rest/v1`。

## 数据库结构规范

当前任务表为 `public.tasks`，核心字段：

```text
id uuid primary key
title text not null
completed boolean not null default false
parent_id uuid null references public.tasks(id) on delete cascade
created_at timestamptz not null default now()
```

业务含义：

- `parent_id = null` 表示主任务。
- `parent_id = 某任务 id` 表示该任务是子任务。
- 删除父任务时，数据库会级联删除其子任务。
- AI 拆解生成的子任务会设置 `parent_id`，并按步骤顺序写入稳定递增的 `created_at`。

## 代码风格规范

### TypeScript

- API、工具函数、前端状态都应尽量使用明确类型。
- 外部输入必须先校验再使用，例如请求体使用 `parseCreateTaskInput`、`parseUpdateTaskInput`。
- 不直接信任 `req.body`、`req.query`、AI 返回内容或数据库外部输入。
- 错误响应保持 JSON 结构：`{ error: string, details?: string }`。

### React

- 页面状态集中在 `pages/index.tsx` 中，当前包括任务列表、输入框、加载态、保存态、AI 拆解态和错误态。
- 所有 API 调用通过本页面内的 `apiRequest` 封装，统一解析错误。
- 前端先乐观更新时，失败必须回滚，例如完成状态和删除任务。
- 父子层级不要依赖 DOM 位置保存，必须依赖数据库中的 `parent_id`。

### API Routes

- 每个接口必须处理非法 HTTP 方法，并返回 `405`。
- 浏览器可能从静态页面或本地环境访问 API，因此当前接口统一设置 CORS 响应头。
- 服务端第三方 key 只能在 API Route 或服务端工具中读取，不能暴露给前端。
- DeepSeek 调用使用 OpenAI Node.js SDK，并设置 `baseURL: "https://api.deepseek.com"`。

### 样式

- 使用 Tailwind CSS 作为主要样式方式。
- 复古手账风格集中在 `styles/globals.css`：
  - 纸质纹理背景
  - 模拟手写字体
  - 手绘复选框
  - 完成任务的图钉/胶带装饰
- 移动端必须保证按钮和任务标题不重叠。
- 子任务必须有明显缩进，当前通过 `ml-7 sm:ml-14` 等类实现。

## 功能实现规范

### 添加任务

流程：

1. 前端读取输入框标题。
2. 调用 `POST /api/tasks`。
3. 请求体包含 `title` 和 `parent_id`。
4. 主任务传 `parent_id: null`。
5. 成功后将新任务加入前端状态。

### 切换完成状态

流程：

1. 点击手绘复选框。
2. 前端乐观切换 `completed`。
3. 调用 `PATCH /api/tasks/[id]`。
4. 请求体为 `{ completed: boolean }`。
5. 如果接口失败，前端恢复原状态并显示错误。

### 删除任务

流程：

1. 点击删除按钮。
2. 前端先移除该任务及其子任务。
3. 调用 `DELETE /api/tasks/[id]`。
4. 如果接口失败，恢复删除前状态。
5. 父任务的子任务由数据库 `on delete cascade` 兜底清理。

### AI 拆解任务

流程：

1. 点击父任务或任意任务的“拆解”按钮。
2. 前端调用 `POST /api/tasks/breakdown`。
3. 请求体为 `{ id, title }`。
4. API 调用 DeepSeek，要求返回 3-5 个可执行步骤。
5. API 将步骤逐条写入数据库，`parent_id` 设置为原任务 id。
6. API 返回 `{ steps, subtasks }`。
7. 前端将返回的子任务合并进状态，并按 `parent_id` 渲染缩进层级。

排序要求：

- 主任务按 `created_at` 倒序。
- 子任务按 `created_at` 正序。
- AI 拆解接口必须保证子任务的 `created_at` 按步骤顺序递增，避免刷新后顺序变化。

## 常用命令

```bash
npm run dev
npm run typecheck
npm run test:api
npm run test:breakdown
npm run build
```

用途：

- `npm run dev`：启动本地开发服务器。
- `npm run typecheck`：检查 TypeScript 类型。
- `npm run test:api`：测试任务 CRUD、父子任务保存、删除。
- `npm run test:breakdown`：测试真实 DeepSeek AI 拆解与数据库写入。
- `npm run build`：验证生产构建和 Tailwind 编译。

## 问题定位规范

业务负责人或开发者遇到问题时，按下面顺序定位：

### 页面无法打开

1. 确认访问的是 `http://localhost:3000`，不是旧的 `index.html`。
2. 确认 `npm run dev` 正在运行。
3. 查看终端是否有 Next.js 编译错误。
4. 运行 `npm run build` 检查生产编译。

### 任务刷新后丢失

1. 检查浏览器是否调用了 `POST /api/tasks`。
2. 运行 `npm run test:api`。
3. 检查 Supabase 表是否存在 `tasks`。
4. 检查 `.env.local` 中 Supabase URL 和 key 是否正确。

### 子任务刷新后变成同级

1. 检查数据库中该子任务的 `parent_id` 是否有值。
2. 确认执行过 `supabase/add-task-parent-id.sql` 或完整 `supabase/schema.sql`。
3. 运行 `npm run test:api`。
4. 检查前端 `buildTaskTree` 是否按 `parent_id` 组装任务树。

### AI 拆解失败

1. 检查 `.env.local` 是否配置 `DEEPSEEK_API_KEY`。
2. 修改 key 后重启 `npm run dev`。
3. 运行 `npm run test:breakdown`。
4. 如果失败，查看返回的 `details` 字段，区分是 DeepSeek 调用失败、JSON 解析失败，还是数据库写入失败。

### AI 拆解顺序刷新后变化

1. 运行 `npm run test:breakdown`。
2. 检查 `pages/api/tasks/breakdown.ts` 是否逐条保存子任务。
3. 检查写入时是否为子任务设置递增的 `created_at`。
4. 检查前端子任务排序是否仍按 `created_at` 正序。

## 人工开发流程

建议人工开发或业务交接按以下流程进行：

1. 先阅读本文件，确认当前项目入口、环境变量、数据库结构。
2. 启动项目：`npm run dev`。
3. 打开 `http://localhost:3000`，手动验证当前核心流程。
4. 修改代码前，先判断改动属于前端、API、数据库还是测试脚本。
5. 小步修改，避免同时改动 UI、API 和数据库，除非功能必须联动。
6. 每完成一个功能，至少运行 `npm run typecheck` 和相关测试。
7. 涉及 AI 拆解时，必须运行 `npm run test:breakdown`。
8. 涉及样式或 Tailwind 时，必须运行 `npm run build`。
9. 交付时说明改了哪些文件、验证了哪些命令、还有哪些已知限制。

## 后续开发建议

- 如果需要多层子任务，扩展 `buildTaskTree` 为递归树，而不是只渲染一层子任务。
- 如果需要手动排序，建议新增 `position` 字段，不要长期依赖 `created_at` 承担排序职责。
- 如果需要用户隔离，新增用户表或认证，并给 `tasks` 增加 `user_id`。
- 如果项目进入生产环境，应收紧 CORS，不再使用 `Access-Control-Allow-Origin: *`。
- 如果要提交代码仓库，先清理 `.env.example` 中的真实密钥。
