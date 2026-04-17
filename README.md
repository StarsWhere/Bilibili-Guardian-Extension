# Bilibili Guardian Extension

一个为 Bilibili 设计的统一浏览器扩展，整合了推荐流过滤、视频页 AI 广告检测与自动跳过、以及页面内统一悬浮控制中心。

这是一个全新的重构项目，用来整合并升级旧能力，而不是把旧脚本简单拼接在一起。

- 作者：**StarsWhere**
- License：**MIT**
- 目标平台：**Chrome / Edge Manifest V3**
- 当前版本：**0.1.0**

## 亮点

- 一个扩展同时覆盖“推荐流过滤”和“视频页 AI 跳过”
- 使用 `TypeScript + Vite + Manifest V3` 重构为模块化工程
- 页面内统一悬浮按钮与控制台，不再拆成两套体验
- 支持 OpenAI、DeepSeek、Gemini、Anthropic 与自定义 OpenAI-Compatible 接口
- 后台统一负责配置、缓存、模型拉取、超时控制和权限申请
- 去掉默认 `<all_urls>`，仅保留必要权限并对自定义域名动态申请

## 功能概览

### 推荐流过滤

当前优先覆盖 `www.bilibili.com` 下的 feed-like 页面：

- 首页
- 搜索结果页
- 热门页
- 排行榜页
- 分区 / 频道类页面

支持能力：

- 广告卡片过滤
- 直播卡片过滤
- 分类黑名单过滤
- 标题 / UP 主关键词黑名单过滤
- 页面变化持续监听与自动重扫

### 视频页 AI 广告检测与自动跳过

在 `https://www.bilibili.com/video/*` 页面中：

- 自动识别 `bvid`
- 拉取视频信息与弹幕
- 收集评论区首条 / 置顶评论
- 对弹幕做白名单 / 黑名单过滤
- 调用 AI 判断是否存在广告区间
- 对结果进行概率与时长修正
- 在命中阈值时自动跳过广告片段

支持的 AI Provider：

- OpenAI
- DeepSeek
- Gemini
- Anthropic
- 自定义 OpenAI-Compatible 接口

### 统一悬浮控制中心

页面内提供一个统一入口，覆盖首页过滤与视频页跳过能力：

- 拖拽移动
- 点击与拖动区分
- 边缘吸附
- 窗口尺寸变化后的安全回位
- 统一状态展示与诊断日志

当前控制台标签页：

- `总览`
- `过滤`
- `视频`
- `AI`
- `诊断`

## 为什么是一个新项目

这个仓库的目标不是“把两个旧项目塞进一个 content script”，而是做一次真正可维护的扩展重构：

- 统一配置结构 `ExtensionConfig`
- 统一前后台消息协议
- 路由模块化挂载 `FeedGuard` / `VideoGuard`
- 后台集中管理 Bilibili 请求、AI 请求和缓存
- 用 `AbortController` 支持视频分析取消
- 通过可选权限支持自定义 API 域名

## 技术架构

### Content Script

页面侧负责：

- 路由识别
- DOM 提取与页面交互
- 控制台 UI
- 推荐流扫描与过滤
- 视频播放器自动跳过
- 与后台 Service Worker 通信

### Background Service Worker

后台负责：

- 配置持久化
- 视频分析缓存
- Bilibili 接口访问
- AI 请求与超时控制
- 模型列表获取
- 自定义 API 域名权限申请

### Shared Modules

共享层统一：

- 配置类型
- 默认配置
- 消息协议
- 时间工具
- URL 路由识别

## 项目结构

```text
Bilibili-Guardian-Extension/
├── public/
│   └── manifest.json
├── src/
│   ├── background/
│   ├── content/
│   │   ├── modules/
│   │   └── ui/
│   └── shared/
├── tests/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

更细的源码结构可以直接查看：

- `src/background/`
- `src/content/modules/`
- `src/content/ui/`
- `src/shared/`

## 快速开始

### 环境要求

- Node.js 22+
- npm 10+
- Chrome / Edge 最新版本之一

### 安装依赖

```bash
npm install
```

### 构建扩展

```bash
npm run build
```

构建完成后会生成：

- `dist/manifest.json`
- `dist/content.js`
- `dist/background.js`

### 本地加载扩展

#### Chrome / Edge

1. 打开扩展管理页：
   - Chrome：`chrome://extensions`
   - Edge：`edge://extensions`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目的 `dist` 目录

## 开发命令

安装依赖：

```bash
npm install
```

监听构建：

```bash
npm run dev
```

正式构建：

```bash
npm run build
```

运行测试：

```bash
npm test
```

类型检查：

```bash
npx tsc --noEmit
```

## CI/CD

项目已规划为使用 GitHub Actions 自动完成质量校验与发布：

- `CI` workflow：对 `push` / `pull_request` 自动执行 `npm ci`、测试、类型检查和构建
- `Release` workflow：对 `main` 分支推送自动执行发布
- 发布时自动递增 `patch` 版本号
- 自动同步 `package.json` 与 `public/manifest.json`
- 自动创建 `vX.Y.Z` tag
- 自动打包 `dist/` 为 zip 并生成 `sha256`
- 自动创建公开 GitHub Release

如果这次推送是 GitHub Actions 自己回写的版本提交，workflow 会通过 `[skip release]` 自动跳过，避免无限循环触发。

## 当前测试覆盖

已包含的测试方向：

- 配置合并
- URL 路由识别
- 时间工具函数
- 推荐流过滤规则
- 悬浮按钮拖拽辅助逻辑

后续仍值得补充：

- 更完整的 DOM 夹具测试
- 视频页 SPA 切换场景
- 更多页面卡片选择器兼容测试

## 配置说明

### UI 配置

- 浅色 / 深色主题
- 悬浮按钮位置
- 面板打开状态
- 当前激活标签页
- 诊断模式开关

### 推荐流配置

- 是否启用推荐流过滤
- 是否过滤广告卡片
- 是否过滤直播卡片
- 是否持续扫描页面变化
- 页面范围选择
- 分类黑名单
- 关键词黑名单

### 视频配置

- 是否启用视频分析
- 默认自动跳过
- 自动跳过概率阈值
- 时长惩罚系数
- 最小 / 最大广告时长
- 最少弹幕分析数量
- 缓存 TTL

### AI 配置

- Provider
- Base URL
- API Key
- Model
- Agent Prompt
- 白名单 / 黑名单
- 正则匹配开关

## 权限策略

固定权限：

- `storage`
- `permissions`

固定 Host 权限：

- `https://www.bilibili.com/*`
- `https://api.bilibili.com/*`
- `https://comment.bilibili.com/*`
- `https://api.openai.com/*`
- `https://api.deepseek.com/*`
- `https://generativelanguage.googleapis.com/*`
- `https://api.anthropic.com/*`

可选权限：

- `https://*/*`
- `http://*/*`

说明：

- 内置 Provider 使用固定 Host 权限
- 自定义 OpenAI-Compatible 地址在需要时通过 `chrome.permissions.request` 动态申请来源权限

## 发布

发布相关步骤见 [RELEASING.md](./RELEASING.md)。

当前建议的发布方式：

1. 合并代码到 `main`
2. GitHub Actions 自动执行测试、类型检查与构建
3. 自动递增 patch 版本并回写版本文件
4. 自动创建 tag、打包产物、生成 checksum
5. 自动发布公开 GitHub Release

## 与旧项目的关系

本项目继承并整合了以下两个旧项目的目标能力：

- `Bilibili-Video-Ad-Skipper`
- `Bilibili-Video-Filter`

当前策略是：

- 保留旧仓库作为参考实现
- 不复用旧的单文件结构
- 不兼容旧存储键
- 首版不做自动配置迁移
- 暂不提供油猴脚本版本

## 已知限制

### 推荐流页面结构仍需持续维护

Bilibili 页面结构变化较快，不同 feed 页面卡片结构也不一致。当前版本已覆盖最常见场景，但未来仍需要继续补充和维护 selector。

### 评论提取依赖页面 DOM

当前评论内容通过页面 DOM 获取，因此在评论区异步加载较慢或页面结构变化时，可能影响评论采集质量。

### AI 判断本质上仍是概率判断

即使结合弹幕与评论，AI 分析依然可能存在：

- 漏判
- 误判
- 起止时间偏移

因此阈值、时长修正和提示词仍需要根据实际使用效果持续调整。

### Firefox 暂未作为首要目标

当前实现优先围绕 Chrome / Edge MV3 进行设计和验证，Firefox 不是当前阶段的首要支持目标。

## 后续增强方向

- 增加更多 B 站页面场景支持
- 增强推荐流卡片标准化提取能力
- 增加更细粒度的视频分析状态反馈
- 增加配置导入 / 导出
- 增加独立 Options Page 或浏览器工具栏 Popup
- 增加更完整的 DOM 测试与兼容性回归测试
- 优化自定义 API 权限申请与错误提示体验

## 免责声明

- 本项目仅供学习、研究与个人本地体验优化使用。
- 扩展不会内置任何第三方 AI Key，使用 AI 服务产生的费用由用户自行承担。
- Bilibili 页面结构可能随时变化，导致部分功能失效。
- 作者不对使用本项目造成的任何直接或间接后果负责。

## License

本项目采用 [MIT License](./LICENSE)。
