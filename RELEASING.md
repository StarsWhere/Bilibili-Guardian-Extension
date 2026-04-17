# Releasing Bilibili Guardian Extension

这个文档描述 `Bilibili-Guardian-Extension` 的自动发布流程，以及在 GitHub Actions 不可用时的手动兜底方案。

## 自动发布总览

- 当有新提交进入 `main` 分支时，GitHub Actions 会自动触发发布流程
- 发布流程会先执行测试、类型检查和构建，全部通过后才继续
- workflow 会自动递增 `patch` 版本号
- workflow 会自动同步 `package.json` 与 `public/manifest.json`
- workflow 会自动创建 `vX.Y.Z` tag、打包 zip、生成 `sha256`，并发布公开 GitHub Release
- workflow 自己回写版本号时会带上 `[skip release]`，避免无限循环触发

## 发布前原则

- 正式发布始终基于 `dist/` 产物
- 版本号由 CI 统一管理，不再依赖手工同步
- 若本次改动涉及权限、AI 接口策略或页面选择器，仍建议做手工回归验证

## 建议发布清单

### 1. 安装依赖

```bash
npm install
```

如果依赖无变化但需要确保环境一致，也建议执行一次。

### 2. 运行质量检查

运行测试：

```bash
npm test
```

运行类型检查：

```bash
npx tsc --noEmit
```

运行正式构建：

```bash
npm run build
```

### 3. 本地手工验收

建议至少检查以下场景：

- 首页推荐流过滤是否生效
- 搜索页 / 热门页 / 排行榜页过滤是否正常
- 视频页 AI 分析是否能正常发起
- 缓存命中是否正常
- 自动跳过是否在命中阈值时正确触发
- 自定义 Provider 的动态权限申请是否符合预期
- 悬浮按钮拖拽、边缘吸附和控制台开关是否正常

## GitHub Actions 自动发布产物

自动发布成功后，GitHub Release 会附带：

- `bilibili-guardian-extension-vX.Y.Z.zip`
- `bilibili-guardian-extension-vX.Y.Z.zip.sha256`

zip 内包含扩展运行所需的 `dist/` 内容。

## 手动兜底发布流程

如果 GitHub Actions 暂时不可用，可以按下面的方式手动执行一次与自动发布接近的流程。

### 1. 准备版本号

默认策略是：

- 如果仓库还没有 `v*` tag，则首次发布使用当前版本
- 如果仓库已有最新 tag，例如 `v0.1.3`，则下一次发布版本为 `0.1.4`

可以直接运行：

```bash
npm run release:prepare
```

这个脚本会同步更新：

- `package.json`
- `public/manifest.json`

并输出：

- `version`
- `tag`
- `artifact_name`

### 2. 构建并打包发布产物

构建成功后，进入 `dist/` 目录，将以下内容打包为 zip：

- `manifest.json`
- `content.js`
- `background.js`
- `chunks/` 目录

示例命令：

```bash
cd dist
zip -r bilibili-guardian-extension-vX.Y.Z.zip .
```

生成后的 zip 适用于：

- 本地分享安装
- GitHub Release 附件
- 后续扩展商店提交前的基础包

### 3. 生成校验文件

```bash
sha256sum bilibili-guardian-extension-vX.Y.Z.zip > bilibili-guardian-extension-vX.Y.Z.zip.sha256
```

### 4. 提交版本文件并打 tag

```bash
git add package.json public/manifest.json
git commit -m "chore(release): vX.Y.Z [skip release]"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

## GitHub Release 内容建议

建议 Release 标题格式：

```text
v0.1.0
```

建议 Release 正文包含：

- 本次版本的主要新增能力
- 修复的问题
- 已知限制
- 安装方式说明

可参考模板：

```markdown
## Highlights

- 新增统一悬浮控制中心
- 新增推荐流过滤与视频页 AI 跳过整合能力
- 新增自定义 OpenAI-Compatible 接口支持

## Fixes

- 优化悬浮按钮拖拽与边缘吸附体验
- 优化视频页重复分析与缓存逻辑

## Notes

- 当前优先支持 Chrome / Edge Manifest V3
- 自定义 API 地址首次使用时会请求动态权限
```

## 如果后续要上架扩展商店

在真正提交到 Chrome Web Store 或其他商店前，建议额外补齐：

- 更正式的扩展图标资源
- 商店描述与截图
- 隐私政策
- 版本变更记录
- 更严格的权限说明

## 常见注意事项

### 自动发布跳过了

如果这次进入 `main` 的提交来自 `github-actions[bot]`，或者提交信息包含 `[skip release]`，`release.yml` 会主动跳过，防止重复发布。

### 版本脚本报 tag 已存在

这通常意味着：

- 有并发发布
- 或者仓库里已经存在同名 tag

应先检查已有 tag 与最近 workflow 运行记录。

### 直接打包源码目录

发布时应打包 `dist/`，不要直接把源码目录上传给用户或商店。

### 自定义 API 权限未验证

如果本次改动了 Provider 或 Base URL 权限逻辑，发布前一定要实际验证一次动态权限申请流程。

### 页面选择器变更未手测

推荐流过滤高度依赖页面结构；只通过单元测试并不足以覆盖真实页面回归，建议至少手工验证常见页面。
