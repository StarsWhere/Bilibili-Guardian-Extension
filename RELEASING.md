# Releasing Bilibili Guardian

这个文档描述当前仓库的正式发布方式，以及在 GitHub Actions 暂时不可用时的手动兜底流程。

## 自动发布总览

当前仓库有两条自动化链路：

- `CI` workflow：对 Pull Request 和非 `main` 分支推送执行质量校验
- `Release` workflow：对 `main` 分支推送执行版本准备、构建、打 tag 和 GitHub Release 发布

自动发布的固定行为如下：

- 统一使用 Node.js 22
- 统一执行 `npm ci`
- 统一执行 `npm test`
- 统一执行 `npm run typecheck`
- 统一执行 `npm run build:all`
- 自动递增 `patch` 版本号
- 自动同步 `package.json` 与 `public/manifest.json`
- 自动创建 `vX.Y.Z` tag
- 自动上传扩展 zip、zip 的 `sha256`、以及 userscript 单文件
- 自动使用 `[skip release]` 防止 workflow 回写版本时重复触发发布

## 发布产物

每次正式发布会产出以下文件：

- `bilibili-guardian-extension-vX.Y.Z.zip`
- `bilibili-guardian-extension-vX.Y.Z.zip.sha256`
- `bilibili-guardian.user.js`

含义分别是：

- 扩展版安装包：给 Chrome / Edge 解压加载使用
- 扩展版校验文件：用于核对 zip 完整性
- Tampermonkey 单文件脚本：可直接导入安装

## 发布前建议检查

即使自动化全部通过，以下场景仍建议人工回归一次：

- 首页、搜索、热门、排行榜页面的过滤是否正常
- 视频页 AI 识别是否能正常发起
- 缓存命中与手动重跑是否正常
- 自动跳过是否在阈值命中时正确触发
- 自定义 OpenAI-Compatible 接口是否能正常请求
- 扩展版域名权限申请与 Tampermonkey 访问授权是否符合预期
- 悬浮按钮拖拽、吸附和控制中心开关是否正常

## 自动发布流程细节

### CI workflow

当前 `CI` workflow 会执行：

```bash
npm ci
npm test
npm run typecheck
npm run build:all
```

这意味着扩展版与 userscript 版都会在 CI 中被验证。

### Release workflow

当前 `Release` workflow 的关键步骤为：

1. `npm run release:prepare`
2. `npm test`
3. `npm run typecheck`
4. `npm run build:all`
5. 提交回写的版本文件
6. 创建 `vX.Y.Z` tag
7. 打包 `dist/` 为扩展 zip
8. 生成 zip 的 `sha256`
9. 上传 zip、checksum 和 `bilibili-guardian.user.js`

## 手动兜底发布流程

如果 GitHub Actions 暂时不可用，可以用下面的步骤手工完成一次接近正式流程的发布。

### 1. 安装依赖

```bash
npm install
```

### 2. 准备版本号

执行：

```bash
npm run release:prepare
```

该脚本会：

- 检查 `package.json` 与 `public/manifest.json` 的版本一致性
- 根据最新 tag 自动计算下一个版本
- 更新 `package.json`
- 更新 `public/manifest.json`
- 更新 `README.md` 顶部的当前版本号

同时它会输出：

- `version`
- `tag`
- `artifact_name`
- `userscript_artifact_name`

### 3. 运行质量检查

```bash
npm test
npm run typecheck
npm run build:all
```

### 4. 准备发布文件

扩展版打包：

```bash
cd dist
zip -r ../bilibili-guardian-extension-vX.Y.Z.zip .
cd ..
```

生成扩展包校验文件：

```bash
sha256sum bilibili-guardian-extension-vX.Y.Z.zip > bilibili-guardian-extension-vX.Y.Z.zip.sha256
```

userscript 单文件：

- 直接使用 `dist/bilibili-guardian.user.js`
- 不需要额外再打 zip

### 5. 提交版本文件并打 tag

```bash
git add package.json public/manifest.json README.md
git commit -m "chore(release): vX.Y.Z [skip release]"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### 6. 上传 GitHub Release

建议上传以下三个附件：

- `bilibili-guardian-extension-vX.Y.Z.zip`
- `bilibili-guardian-extension-vX.Y.Z.zip.sha256`
- `dist/bilibili-guardian.user.js`

## Release 正文建议

建议在 Release 正文里同时给出两种安装方式。

推荐结构：

```markdown
## 浏览器扩展版

- 下载 `bilibili-guardian-extension-vX.Y.Z.zip`
- 在本地解压缩
- 打开 `chrome://extensions` 或 `edge://extensions`
- 开启开发者模式并加载解压后的目录

## Tampermonkey 油猴脚本版

- 下载 `bilibili-guardian.user.js`
- 在浏览器中安装 Tampermonkey
- 打开该 `.user.js` 文件并确认导入

## Artifacts

- `bilibili-guardian-extension-vX.Y.Z.zip`
- `bilibili-guardian-extension-vX.Y.Z.zip.sha256`
- `bilibili-guardian.user.js`
```

## 常见注意事项

### 自动发布被跳过

如果进入 `main` 的提交来自 `github-actions[bot]`，或者提交信息里包含 `[skip release]`，`release.yml` 会主动跳过，避免无限循环。

### 版本号不同步

当前版本源有三处需要持久同步：

- `package.json`
- `public/manifest.json`
- `README.md`

userscript metadata 的版本会在构建时从 `package.json` 动态读取，不需要手工维护第三份版本号。

### 不要直接发布源码目录

正式分发时只发布构建产物，不要把源码目录直接提供给用户。

### 自定义接口权限问题

如果本次改动涉及 Provider、Base URL、权限或请求方式，发布前一定要手测：

- 扩展版的域名权限申请
- Tampermonkey 的外部请求授权
- 自定义 OpenAI-Compatible 接口的实际可用性
