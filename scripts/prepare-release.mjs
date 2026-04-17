import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, "package.json");
const manifestPath = path.join(projectRoot, "public", "manifest.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function safeRunGit(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

function assertSemver(version, sourceLabel) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${sourceLabel} 不是有效的 x.y.z 版本号: ${version}`);
  }
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function determineReleaseVersion(currentVersion, latestTag) {
  if (!latestTag) {
    return currentVersion;
  }

  const normalized = latestTag.replace(/^v/, "");
  assertSemver(normalized, "最新 tag");
  return bumpPatch(normalized);
}

function writeGithubOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }

  fs.appendFileSync(outputFile, `${key}=${value}\n`, "utf8");
}

function main() {
  const packageJson = readJson(packageJsonPath);
  const manifestJson = readJson(manifestPath);

  if (!packageJson.version) {
    throw new Error("package.json 缺少 version 字段");
  }

  if (!manifestJson.version) {
    throw new Error("public/manifest.json 缺少 version 字段");
  }

  assertSemver(packageJson.version, "package.json version");
  assertSemver(manifestJson.version, "manifest version");

  if (packageJson.version !== manifestJson.version) {
    throw new Error(
      `package.json 与 public/manifest.json 版本号不一致: ${packageJson.version} !== ${manifestJson.version}`
    );
  }

  const latestTag = safeRunGit(["describe", "--tags", "--abbrev=0", "--match", "v*"]);
  const version = determineReleaseVersion(packageJson.version, latestTag);
  const tag = `v${version}`;
  const artifactName = `bilibili-guardian-extension-${tag}.zip`;

  const existingTag = safeRunGit(["tag", "-l", tag]);
  if (existingTag === tag) {
    throw new Error(`目标 tag 已存在: ${tag}`);
  }

  packageJson.version = version;
  manifestJson.version = version;

  writeJson(packageJsonPath, packageJson);
  writeJson(manifestPath, manifestJson);

  writeGithubOutput("version", version);
  writeGithubOutput("tag", tag);
  writeGithubOutput("artifact_name", artifactName);
  writeGithubOutput("latest_tag", latestTag || "");

  process.stdout.write(
    JSON.stringify(
      {
        version,
        tag,
        artifact_name: artifactName,
        latest_tag: latestTag || null
      },
      null,
      2
    ) + "\n"
  );
}

main();
