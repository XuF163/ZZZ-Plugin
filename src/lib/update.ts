import { mdLogLineToHTML } from '../utils/data.js'
import { pluginName } from './path.js'
import { exec } from 'child_process'
import _ from 'lodash'

let Update: (new (...args: any[]) => any) | null = null
try {
  // @ts-ignore
  Update = (await import('../../../other/update.js').catch(e => null))?.update
  // @ts-ignore
  Update ||= (await import('../../system/apps/update.js')).update
} catch (e) {
  logger.error(
    `[${pluginName}]未获取到更新js ${logger.yellow('更新功能')} 将无法使用`
  )
}
let ZZZUpdate: (new (...args: any[]) => any) | null = null

type CommitLog = {
  /** 提交ID */
  commit: string
  /** 提交时间 */
  date: string
  /** 提交信息 */
  msg: string
  /** 是否本地记录 */
  local: boolean
  /** 是否当前版本 */
  current: boolean
}

interface UpdateInfo {
  /** 是否有更新 */
  hasUpdate: boolean
  /** 更新日志 */
  logs: CommitLog[]
}

if (Update) {
  ZZZUpdate = class ZZZUpdate extends Update {

    exec(cmd: string, plugin: string, opts: any = {}): Promise<{ error: Error | null, stdout: string, stderr: string }> {
      if (plugin) opts.cwd = `plugins/${plugin}`
      return new Promise(resolve => {
        exec(cmd, { windowsHide: true, ...opts }, (error, stdout, stderr) => {
          resolve({ error, stdout: stdout.toString().trim(), stderr: stderr.toString().trim() })
        })
      })
    }

    async handleLog(remote = false) {
      let cmdStr =
        'git log -100 --pretty="%h||%cd||%s" --date=format:"%Y-%m-%d %H:%M:%S"'
      if (remote) {
        const remoteRef = await this.resolveRemoteRef()
        cmdStr = `git log -100 --pretty="%h||%cd||%s" --date=format:"%Y-%m-%d %H:%M:%S" ${remoteRef}`
      }
      const cm = await this.exec(cmdStr, pluginName)
      if (cm.error) {
        throw new Error(cm.error.message)
      }

      const logAll = cm.stdout.split('\n')
      if (!logAll.length) {
        throw new Error('未获取到更新日志')
      }
      const log = []
      let current = true
      for (const str of logAll) {
        if (!str) continue
        const sp = str.split('||')
        if (sp[0] === this.oldCommitId) break
        if (sp[2].includes('Merge')) continue
        /** @type CommitLog */
        const commit = {
          commit: sp[0],
          date: sp[1],
          msg: mdLogLineToHTML(sp[2]),
          local: !remote,
          current: false,
        }
        if (!remote && current) {
          commit.current = true
          current = false
        }
        log.push(commit)
      }
      return log
    }

    async resolveRemoteRef(): Promise<string> {
      // Prefer whatever branch the current checkout tracks (self-use often runs on master).
      const upstream = await this.exec('git rev-parse --abbrev-ref @{upstream}', pluginName)
      if (!upstream.error) {
        const upstreamRef = upstream.stdout.trim()
        const match = upstreamRef.match(/^([^/]+)\/(.+)$/)
        if (match) {
          const remote = match[1]
          const branch = match[2]
          const fetched = await this.exec(`git fetch ${remote} ${branch}`, pluginName)
          if (!fetched.error) {
            const hasRef = await this.exec(
              `git show-ref --verify --quiet refs/remotes/${remote}/${branch}`,
              pluginName
            )
            if (!hasRef.error) return `${remote}/${branch}`
          }
        }
      }

      // Fallback order: prefer self-use branches first; upstream mirrors last.
      const candidates = ['master', 'dev', 'updist', 'updev', 'main']
      for (const branch of candidates) {
        const fetched = await this.exec(`git fetch origin ${branch}`, pluginName)
        if (fetched.error) continue

        const hasRef = await this.exec(
          `git show-ref --verify --quiet refs/remotes/origin/${branch}`,
          pluginName
        )
        if (!hasRef.error) return `origin/${branch}`
      }

      await this.exec('git fetch origin', pluginName)
      return 'origin/HEAD'
    }
    async getZZZLog() {
      const log = await this.handleLog()
      return log
    }

    async getZZZRemoteLog() {
      const log = await this.handleLog(true)
      return log
    }

    async getZZZAllLog() {
      const localLog = await this.getZZZLog()
      const remoteLog = await this.getZZZRemoteLog()
      const logs = _.unionBy(localLog, remoteLog, 'commit')
      logs.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
      return logs
    }

    async hasUpdate() {
      const logs = await this.getZZZAllLog()
      const newLogs = logs.filter(log => !log.local)
      const result: UpdateInfo = {
        hasUpdate: false,
        logs: [],
      }
      if (newLogs.length) {
        result.hasUpdate = true
        result.logs = newLogs
      }
      return result
    }
  }
}

export { ZZZUpdate }
