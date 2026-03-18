# CombMap · 寻迹（中华古墓地图）

以权威文保名录为底的古墓点位与检索平台，重点是「可信数据 + 地图体验 + 可持续更新」。

## 功能概览
- 地图点位：支持视野内加载、缩放聚合、点位联动详情
- 检索与筛选：人物/称谓/关键词、省市区、级别、附近范围
- 轻互动：点赞/收藏/打卡/评论、搜索点击排行
- 双模式：默认离线种子数据 + 可选 Postgres（存互动/排行）

## 快速开始（本地）
1. 安装依赖：`npm i`
2. 启动开发：`npm run dev`（默认端口 `3001`）
3. 打开：`http://localhost:3001`

环境变量示例见 `.env.example` / `.env.production.example`。

## 数据模式说明
### 1) 种子数据模式（默认）
- 古墓点位来自：`data/seed/tombs.json`
- 适合：只做展示/检索/地图交互；无需数据库也能跑起来

### 2) Postgres 模式（用于“用户体系/互动/排行”）
当前版本：**数据库用于永久存储互动与搜索排行**；古墓点位仍来自种子数据。

必需步骤：
1. 配置 `DATABASE_URL=postgres://...`
2. 初始化表结构：`npm run db:init`
3.（可选）创建邀请码：`npm run invite:create` 或 `node scripts/create-invite.mjs --email=your@email.com`

说明：
- 未配置 `DATABASE_URL` 时，登录/注册/点赞/评论等接口会返回错误（点位展示仍可用）。
- `TOMBS_DATABASE=1`（将古墓点位放入 DB 并用 PostGIS 做范围查询）目前未内置 schema/导入脚本。

## 公网性能优化（Vercel 场景）
### 地图点位接口（关键）
- `GET /api/tombs/markers`：按 `bbox + zoom` 返回视野点位/聚合点
- 已做优化：
  - seed 模式走轻量读取（`lib/seed/*`），避免加载重型检索模块
  - 响应头启用 Edge 缓存：`Cache-Control: public, s-maxage=1800, stale-while-revalidate=86400`
  - 前端对 `bbox/zoom` 做 rounding，提升 CDN 命中率（减少“抖动 URL”）

### 统计接口（避免冷启动拖慢首页）
- `GET /api/tombs/stats`：只返回全国/省份统计（同样启用 Edge 缓存）

进一步建议（可选）：
- 确保 Vercel region 与数据库 region 一致（否则每次互动请求都会被 RTT 拖慢）
- 若点位规模继续增长，建议引入“瓦片/网格预聚合”（按 zoom 预计算，接口直接按 tile 取）

## 数据与管线（简述）
- 国家级：XLS 导入 + 合并
- 省级：DOCX 导入 + 合并
- 市级：来源清单驱动抓取/解析（HTML/CSV/XLS/XLSX/PDF）
- 合并输出到：`data/seed/tombs.json`
- 可选坐标补全：`python3 scripts/ingest/geocode.py`（高德地理编码 + POI 兜底）

## 目录结构（常用）
- `app/`：Next.js App Router 页面与 API
- `components/`：前端组件（地图、详情、评论、排行等）
- `lib/`：业务逻辑
  - `lib/seed/`：种子数据轻量读（markers 等）
  - `lib/db.ts`：Postgres 连接池与查询封装
- `data/`：种子数据与抓取配置
- `scripts/`：数据抓取/导入/工具脚本

## 部署到 Vercel（建议）
1. 推送仓库到 GitHub/GitLab 并导入 Vercel
2. 配置环境变量：
   - `NEXT_PUBLIC_AMAP_KEY` / `NEXT_PUBLIC_AMAP_SECURITY`（高德 Web Key 与安全密钥）
   - `DATABASE_URL`（可选：启用登录/互动/排行）
3. 部署后检查：
   - 地图脚本域名绑定是否正确（高德 Key 常见问题）
   - `GET /api/tombs/markers` 响应头是否含 `s-maxage`（Edge 缓存是否生效）
