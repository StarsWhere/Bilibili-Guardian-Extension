# Bilibili Guardian

一个面向 Bilibili 的统一清理工具，提供两种可安装形态：

- 浏览器扩展版：适合长期使用，支持 Chrome / Edge Manifest V3
- Tampermonkey 油猴脚本版：适合快速安装，使用单文件 `.user.js`

它把两个核心能力整合到同一套页面内控制中心里：

- 推荐流过滤：整理首页、搜索、热门、排行榜和频道类页面中的广告、直播和不想看的内容
- 视频 AI 识别与自动跳过：分析弹幕与评论，判断视频中是否存在广告片段，并在满足条件时自动跳过

- 作者：**StarsWhere**
- License：**MIT**
- 当前版本：**0.1.3**

## 功能与适用场景

### 你可以用它做什么

- 在首页、搜索、热门、排行榜等页面自动移除广告卡片和直播卡片
- 按分类、标题关键词、UP 主关键词整理推荐流
- 在视频页调用 OpenAI、DeepSeek、Gemini、Anthropic 或自定义 OpenAI-Compatible 接口做广告片段识别
- 命中阈值后自动把播放器跳到广告片段之后
- 使用统一悬浮按钮和控制中心管理过滤、视频识别、AI 服务与诊断信息

### 更适合哪些用户

- 想减少首页和搜索页噪音的 Bilibili 高频用户
- 已经有 AI API Key，希望在视频页自动识别“恰饭”片段的用户
- 更偏好扩展安装，或者更偏好油猴脚本安装的用户

## 安装方式

### 方式一：浏览器扩展版

适用场景：

- 你主要使用 Chrome 或 Edge
- 你希望以浏览器扩展方式长期启用

安装步骤：

1. 克隆仓库并安装依赖：

   ```bash
   npm install
   ```

2. 构建扩展产物：

   ```bash
   npm run build
   ```

3. 打开扩展管理页：
   - Chrome：`chrome://extensions`
   - Edge：`edge://extensions`
4. 打开右上角“开发者模式”
5. 选择“加载已解压的扩展程序”
6. 选择项目里的 `dist/` 目录

### 方式二：Tampermonkey 油猴脚本版

适用场景：

- 你想快速安装单文件版本
- 你已经在浏览器中使用 Tampermonkey

安装步骤：

1. 安装 Tampermonkey
2. 安装依赖并构建 userscript：

   ```bash
   npm install
   npm run build:userscript
   ```

3. 打开 `dist/bilibili-guardian.user.js`
4. 在 Tampermonkey 安装页确认导入
5. 首次使用自定义 OpenAI-Compatible 接口时，如果脚本管理器提示访问授权，请允许目标域名

### 构建产物说明

当前仓库的正式产物包括：

- 扩展版：`dist/manifest.json`、`dist/content.js`、`dist/background.js`
- 油猴版：`dist/bilibili-guardian.user.js`

如果你需要一次性验证全部产物，可以执行：

```bash
npm run build:all
```

## 配置与使用说明

### 第一次使用建议

1. 打开任意 Bilibili 页面
2. 点击页面内的悬浮按钮，打开控制中心
3. 先在“AI”相关设置中填写：
   - Provider
   - Base URL
   - API Key
   - 模型名称
4. 再根据需要调整推荐流过滤规则和自动跳过阈值

### 推荐流过滤

支持页面：

- 首页
- 搜索结果页
- 热门页
- 排行榜页
- 频道 / 分区类页面

可配置项：

- 是否过滤广告
- 是否过滤直播
- 分类黑名单
- 标题 / UP 主关键词黑名单
- 是否持续监听页面变化并自动重扫

### 视频 AI 识别与自动跳过

工作流程：

1. 自动识别当前视频的 `bvid`
2. 获取视频 CID、弹幕和评论区首条 / 置顶评论
3. 按白名单 / 黑名单整理有效弹幕
4. 调用 AI 接口判断是否存在广告区间
5. 根据概率、最短时长、最长时长做结果修正
6. 当结果达到阈值时自动跳过

支持的 AI Provider：

- OpenAI
- DeepSeek
- Gemini
- Anthropic
- 自定义 OpenAI-Compatible 接口

### 自定义 OpenAI-Compatible 接口

使用自定义接口时，请确认：

- `Base URL` 是完整地址，例如 `https://example.com/v1`
- 已填写有效的 API Key
- 已填写模型名称
- 如果是 Tampermonkey 版，首次请求时允许脚本访问目标域名
- 如果是扩展版，首次保存或请求时允许扩展申请对应域名权限

## 常见问题

### 1. 页面上没有看到悬浮按钮

请先确认：

- 当前页面域名是 `https://www.bilibili.com/*`
- 扩展版已经成功加载，或 Tampermonkey 脚本已经启用
- 页面没有被其他脚本或样式异常覆盖

### 2. 视频识别时报“请先配置 AI API Key”或类似错误

通常表示以下字段还不完整：

- API Key
- 模型名称
- Base URL

如果你使用的是自定义兼容接口，还需要确认 URL 格式正确，并且脚本 / 扩展已获得访问该域名的权限。

### 3. 油猴版导入后无法请求外部接口

请优先检查：

- 是否使用 Tampermonkey
- 脚本是否已启用
- 首次访问外部接口时是否拒绝了授权提示
- 自定义接口服务端是否允许你的调用方式

### 4. 为什么有时不会触发自动跳过

常见原因：

- 当前识别结果概率没有达到阈值
- AI 没有返回可用的开始 / 结束时间
- 过滤后的有效弹幕过少
- 该视频已经命中过缓存结果，但缓存结果本身不满足跳过条件

## 开发与构建

### 环境要求

- Node.js 22+
- npm 10+

### 常用命令

安装依赖：

```bash
npm install
```

运行测试：

```bash
npm test
```

运行类型检查：

```bash
npm run typecheck
```

构建扩展版：

```bash
npm run build
```

构建油猴版：

```bash
npm run build:userscript
```

构建全部产物：

```bash
npm run build:all
```

### 目录概览

```text
src/
├── app/          # 共享应用入口
├── background/   # 扩展后台逻辑
├── content/      # 页面侧 UI 与页面交互
├── core/         # 跨平台的网络、存储、分析核心
├── extension/    # 扩展平台适配层
├── userscript/   # Tampermonkey 平台适配层
└── shared/       # 类型、配置、时间与路由工具
```

## CI / Release

当前 GitHub Actions 流程分为两部分：

- `CI`：对 Pull Request 和非 `main` 分支推送执行 `npm ci`、`npm test`、`npm run typecheck`、`npm run build:all`
- `Release`：对 `main` 分支推送执行版本准备、测试、类型检查、`npm run build:all`、打 tag、生成发布产物并创建 GitHub Release

当前 GitHub Release 会附带以下产物：

- `bilibili-guardian-extension-vX.Y.Z.zip`
- `bilibili-guardian-extension-vX.Y.Z.zip.sha256`
- `bilibili-guardian.user.js`

更详细的发版流程见 [RELEASING.md](RELEASING.md)。

## 许可证

本项目使用 [MIT License](LICENSE)。
