# Skill: 从远端分支按日期挑选提交并合入本地 master（ZZZ-Plugin）

## 适用场景
- `Yunzai` 根目录不是 Git 仓库，但 `plugins/ZZZ-Plugin` 是独立 Git 仓库（有自己的 `.git`）。
- 需要从远端 `origin/updist`（同步上游 `main`）中**筛选某一天的提交**（例如 `2026-01-23`），先审查，再以合适方式合入本地 `master`。

## 前置检查
1) 进入插件仓库目录（必须在这里执行 Git）
```powershell
# 方式 A：从 Yunzai 根目录进入
cd "plugins/ZZZ-Plugin"

# 方式 B：任意位置直接进入（自行替换为你的实际路径）
# cd "...\Yunzai\plugins\ZZZ-Plugin"

git rev-parse --show-toplevel
git status -sb
git branch --show-current
git remote -v
```
2) 确保工作区干净（`git status -sb` 不应有未提交改动）；否则先提交/暂存/放弃改动后再继续。

## 流程（推荐：临时分支 + cherry-pick + ff 合入）

### 1) 备份当前 master
```powershell
git switch master
git branch "backup/master-before-<topic>-$(Get-Date -Format yyyyMMdd)"
```
说明：`<topic>` 用于描述本次合入目标（例如 `jan23-main`）。

### 2) 拉取远端并定位目标日期提交
```powershell
git fetch origin

# 例：筛选 2026-01-23 当天（按提交时间）
git log origin/updist --since="2026-01-23 00:00" --until="2026-01-24 00:00" `
  --date=iso-strict --pretty=format:"%H %ad %an | %s"
```
提示：如需按本地时区/作者时区更精确筛选，可在 `--since/--until` 调整区间。

### 3) 审查每个提交（建议逐个看）
```powershell
git show --stat <hash>
git show <hash>
```
审查辅助（MCP 优先）：
- 用 `mcp__ACE__search_context` 定位变更点的调用链与上下游（例如：`lib/plugin.js getFp/deviceFp`、`apps/rank.js sort/max_display/render`），再结合 `git show` 做最终确认。

审查要点（示例）：
- 网络请求/超时/重试是否合理，是否引入新的依赖或行为变化。
- 业务逻辑（例如排序规则、显示数量）是否与页面说明一致。
- 资源文件（HTML/CSS/SCSS）变更是否会影响渲染性能与兼容性。

### 4) 在临时分支上 cherry-pick（带来源信息）
```powershell
git switch -c "merge/origin-updist-<YYYYMMDD>" master

# 按顺序挑选（推荐按时间先后）
git cherry-pick -x <hash1> <hash2> <hash3>
```

#### 发生冲突时（常用处理）
```powershell
git status -sb
git diff

# 手工编辑冲突文件，删除冲突标记后：
git add <conflicted-file>
git cherry-pick --continue
```
冲突处理建议（示例）：
- 优先保持仓库现有封装与风格（例如已有 `utils/request.js` 时，避免再引入另一套 `fetch` 直连实现）。
- 兜底逻辑要保证返回结构不变（上游调用依赖 `{ api, uid, deviceFp }`/`{ api:null,... }` 等约定时尤需注意）。

取消本次 cherry-pick：
```powershell
git cherry-pick --abort
```

### 5) 快进方式合入 master（避免额外 merge commit）
```powershell
git switch master
git merge --ff-only "merge/origin-updist-<YYYYMMDD>"
```
如果 `--ff-only` 失败，说明 `master` 发生了新的分叉；此时应重新评估合入策略（例如 rebase 临时分支或改用 merge commit）。

## 最小验证（合入后）
```powershell
git status -sb
git log --oneline --max-count=10

# 语法检查（不执行运行时配置加载）
node --check .\apps\rank.js
node --check .\lib\plugin.js

# 检查是否残留冲突标记
rg "<<<<<<<|>>>>>>>|=======" -n
```
如果没有 `rg`，可用：
```powershell
Select-String -Path . -Pattern "<<<<<<<|>>>>>>>|=======" -Recurse
```

## 推送（可选）
```powershell
git push origin master
# 如有其他远端（例如 gitee）：
git push gitee master
```

## 案例（2026-01-23）参考
- 目标：从 `origin/main` 选取 `2026-01-23` 的提交，审查后合入本地 `master`。
- 实际策略：在 `merge/origin-main-20260123` 上 `cherry-pick -x` 目标提交，解决 `lib/plugin.js` 冲突后 `--ff-only` 合入 `master`，最后请求用户自行同步到远端。
