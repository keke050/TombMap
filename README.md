# CombMap · 寻迹（中华古墓地图）

以权威文保名单为底的名人古墓分布与探索平台，强调“可信数据 + 可视化 + 可检索”。

## 主要功能
- 古墓点位与行政区边界展示（仅古墓类文保）
- 人物 / 称谓 / 关键词检索，支持省市区、范围筛选与附近模式
- 地图点位联动详情卡片（级别、年代、地址、简介、图片）
- 打卡、点赞、评论等轻互动
- 搜索排行（按用户检索/点击累计）
- 兼容离线种子数据与数据库模式

## 数据库（永久存储互动与搜索排行）
默认情况下（`TOMBS_DATABASE=0`），古墓数据读取自 `data/seed/tombs.json`，但只要配置 `DATABASE_URL` 并初始化表结构，就可以将点赞/评论/打卡/邀请登录/搜索排行等互动数据永久存入 Postgres。

注意：当前版本的“用户体系与互动功能”依赖数据库（未配置 `DATABASE_URL` 时，登录/注册/点赞/评论等接口会返回错误）。

1. 配置环境变量（示例见 `.env.example`）：
   - `DATABASE_URL=postgres://...`
2. 初始化表结构：
   - `npm run db:init`
3. 创建邀请码（可选）：
   - `npm run invite:create`
   - 或指定邮箱：`node scripts/create-invite.mjs --email=your@email.com`

说明：
- `npm run db:seed` 目前是 no-op（古墓点位仍使用本地种子数据），不必执行。
- 如需将古墓点位也放入数据库（并用 DB 做检索/范围查询），再将 `TOMBS_DATABASE=1` 并补充 tombs 表结构与导入脚本（暂未内置）。

## 数据与管线
- 国家级：XLS 导入 + 合并
- 省级：DOCX 导入 + 合并
- 市级：来源清单驱动抓取/解析（HTML/CSV/XLS/XLSX/PDF）
- 合并输出到 `data/seed/tombs.json`，可用高德地理编码补全坐标

## 市级数据接入
1. 在 `data/sources/city_sources.json` 中添加来源条目
2. 运行 `python3 scripts/ingest/city_ingest.py`
3. 运行 `python3 scripts/ingest/merge.py` 更新 `data/seed/tombs.json`
4. 可选：运行 `python3 scripts/ingest/geocode.py` 补全坐标（高德地理编码 + 高德 POI 搜索兜底）

坐标补全常用用法示例：
- 仅补全缺失坐标（自动：地址具体 → 地理编码，否则走 POI 搜索）：`python3 scripts/ingest/geocode.py`
- 先按省/市分批跑，控制配额与质量：`python3 scripts/ingest/geocode.py --mode poi --citylimit --province 浙江省 --limit 500 --checkpoint 50`
- 补全过程报告：`data/raw/geocode_report.json`（含 ambiguous 候选，建议人工核对后再放宽阈值）

## 当前进度（截至 2026-03-15）
- 市级抓取脚本增强：附件自动下载、多工作表解析、级别过滤
- 浙江省市县级名录（2023）已抓取并筛出市级墓葬 1141 条
- 已执行合并，`data/seed/tombs.json` 更新为 5517 条
- 已在 `.venv` 安装 `openpyxl` / `pdfplumber`

## 已知限制
- 南昌 / 赣州：页面无可解析表格或附件
- 温州：页面/附件链接返回 404
- 鹰潭：PDF 下载 TLS 失败

## 经验与注意
- 政府站点易 403 / 404 / 超时，必要时浏览器或手工下载附件
- 附件链接常在 query 参数中，需从 URL 参数识别扩展名
- 表头识别需至少 2 个字段命中，避免把标题行误判为表头
- 多城市合并 Excel 常按“城市”分工作表，需遍历并把 sheet 名写入 city
- 级别列可用于过滤市级数据（如 `level_allow`）
- 系统级 pip 无写权限时使用项目内 `.venv`
- TLS 握手失败可换网络或手工下载

## 待办（提要）
- 为江西 / 浙江更多城市补充可下载附件或本地文件
- 对于 docx 附件：转为 CSV/XLSX 或补充解析
- 对扫描 PDF：引入 OCR 流程，先转表格再解析
- 补全缺失坐标（高德地理编码 + 校正）
- 处理人物检索歧义：同名墓、称谓墓
- 继续补齐全国 / 省级批次与附件数据
- 无本地命中时的联网墓葬检索与点位生成（需确认数据源 / 缓存 / 合规）
