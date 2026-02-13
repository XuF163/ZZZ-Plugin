# 安全同步：`origin/updev` → `dev`

目标：让 `dev` 跟上 `origin/updev`（通常对应上游 `upstream/dev`），但不“无脑合并/忽略差异”，在合并前先审阅变更、冲突时按依赖与兼容性做手动合并，并在推送前做最小校验。

## 标准合并策略（Review-first）

1) **前置检查**
- 确保在 `dev` 分支：`git rev-parse --abbrev-ref HEAD`
- 确保工作区干净：`git status -sb`（不干净先提交或 stash）

2) **拉取远端引用**
- `git fetch --prune origin`
- 若有 `upstream`：`git fetch --prune upstream`

3) **确认 updev 是否有新提交（避免盲合）**
- 看 tips：`git show -s --oneline --decorate origin/updev`
- 看分歧计数：`git rev-list --left-right --count dev...origin/updev`
  - 右侧为 `0`：说明 `dev` 已包含 `origin/updev`，无需合并
- 审阅将要进入 `dev` 的提交/改动范围：
  - `git log --oneline --decorate dev..origin/updev`
  - `git diff --stat dev..origin/updev`

（可选）确认 `origin/updev` 是否和上游同步：
- `git show -s --oneline --decorate upstream/dev`
- `git rev-list --left-right --count origin/updev...upstream/dev`（两侧都应为 0 才算完全同步）

4) **执行合并（保留历史，不重写）**
- `git merge --no-edit origin/updev`

5) **若有冲突：按“兼容 + 依赖”原则手动合并**
- 先定位冲突文件：`git status --porcelain`
- 对每个冲突块：
  - 不要一键全选 `--ours/--theirs`
  - 用 `mcp__ACE__search_context` 拉取该符号/函数在项目里的调用点，确认真实依赖与行为契约
  - 合并原则（推荐）：
    - 保留 `dev` 里已被其他模块依赖的**兼容签名/行为**（避免把调用方弄崩）
    - 同时把 `updev` 带来的**bugfix/数据更新**合进去
    - 变更涉及接口/返回值时，优先做“超集”实现（兼容旧调用 + 支持新逻辑）
- 解决后：
  - `git add <files>`
  - `git commit --no-edit`（若 `git merge` 未自动生成提交）

6) **最小校验（避免“合了就推”）**
- 确保无冲突标记（避免匹配到本文件里的示例）：`git grep -n "<<<<<<<" -- src resources`
- 项目自带校验（如果存在 `package.json`）：
  - `npm run check`
  - `npm run lint`
  - `npm run build`

7) **推送并复核同步**
- `git push origin dev`
- `git fetch --prune origin`
- `git status -sb`（应回到干净状态）
- `git rev-list --left-right --count dev...origin/updev`（右侧应为 0）

## 明确禁止（避免“无脑同步”）
- 不要用 `git merge -s ours` / `-X theirs` 去“一键覆盖”
- 不要 `git reset --hard` 去追远端（除非你非常确定且已备份/另开分支）
- 不要对 `dev` 做 `git push --force`

## 一键跑（可复制到终端执行）

```powershell
# 只检查差异（不合并）
git fetch --prune origin
git rev-list --left-right --count dev...origin/updev
git log --oneline --decorate dev..origin/updev
git diff --stat dev..origin/updev

# 合并 + 校验 + 推送（按需执行）
git switch dev
git status -sb
git merge --no-edit origin/updev
npm run check
npm run lint
npm run build
git grep -n "<<<<<<<" -- src resources
git push origin dev
```
