import { mdLogLineToHTML } from '../utils/data.js';
import { pluginName } from './path.js';
import { importFromPlugins, importFromYunzai } from './external.js';
import { exec } from 'child_process';
import _ from 'lodash';
let Update = null;
try {
    Update = (await importFromPlugins('other', 'update.js').catch(() => null))?.update;
    Update ||= (await importFromYunzai('system', 'apps', 'update.js').catch(() => null))?.update;
    Update ||= (await importFromYunzai('system', 'apps', 'update.ts').catch(() => null))?.update;
}
catch (e) {
    logger.error(`[${pluginName}]未获取到更新js ${logger.yellow('更新功能')} 将无法使用`);
}
let ZZZUpdate = null;
if (Update) {
    ZZZUpdate = class ZZZUpdate extends Update {
        exec(cmd, plugin, opts = {}) {
            if (plugin)
                opts.cwd = `plugins/${plugin}`;
            return new Promise(resolve => {
                exec(cmd, { windowsHide: true, ...opts }, (error, stdout, stderr) => {
                    resolve({ error, stdout: stdout.toString().trim(), stderr: stderr.toString().trim() });
                });
            });
        }
        async handleLog(remote = false) {
            let cmdStr = 'git log -100 --pretty="%h||%cd||%s" --date=format:"%Y-%m-%d %H:%M:%S"';
            if (remote) {
                const remoteRef = await this.resolveRemoteRef();
                cmdStr = `git log -100 --pretty="%h||%cd||%s" --date=format:"%Y-%m-%d %H:%M:%S" ${remoteRef}`;
            }
            const cm = await this.exec(cmdStr, pluginName);
            if (cm.error) {
                throw new Error(cm.error.message);
            }
            const logAll = cm.stdout.split('\n');
            if (!logAll.length) {
                throw new Error('未获取到更新日志');
            }
            const log = [];
            let current = true;
            for (const str of logAll) {
                if (!str)
                    continue;
                const sp = str.split('||');
                if (sp[0] === this.oldCommitId)
                    break;
                if (sp[2].includes('Merge'))
                    continue;
                const commit = {
                    commit: sp[0],
                    date: sp[1],
                    msg: mdLogLineToHTML(sp[2]),
                    local: !remote,
                    current: false,
                };
                if (!remote && current) {
                    commit.current = true;
                    current = false;
                }
                log.push(commit);
            }
            return log;
        }
        async resolveRemoteRef() {
            const upstream = await this.exec('git rev-parse --abbrev-ref @{upstream}', pluginName);
            if (!upstream.error) {
                const upstreamRef = upstream.stdout.trim();
                const match = upstreamRef.match(/^([^/]+)\/(.+)$/);
                if (match) {
                    const remote = match[1];
                    const branch = match[2];
                    const fetched = await this.exec(`git fetch ${remote} ${branch}`, pluginName);
                    if (!fetched.error) {
                        const hasRef = await this.exec(`git show-ref --verify --quiet refs/remotes/${remote}/${branch}`, pluginName);
                        if (!hasRef.error)
                            return `${remote}/${branch}`;
                    }
                }
            }
            const candidates = ['master', 'dev', 'updist', 'updev', 'main'];
            for (const branch of candidates) {
                const fetched = await this.exec(`git fetch origin ${branch}`, pluginName);
                if (fetched.error)
                    continue;
                const hasRef = await this.exec(`git show-ref --verify --quiet refs/remotes/origin/${branch}`, pluginName);
                if (!hasRef.error)
                    return `origin/${branch}`;
            }
            await this.exec('git fetch origin', pluginName);
            return 'origin/HEAD';
        }
        async getZZZLog() {
            const log = await this.handleLog();
            return log;
        }
        async getZZZRemoteLog() {
            const log = await this.handleLog(true);
            return log;
        }
        async getZZZAllLog() {
            const localLog = await this.getZZZLog();
            const remoteLog = await this.getZZZRemoteLog();
            const logs = _.unionBy(localLog, remoteLog, 'commit');
            logs.sort((a, b) => {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            return logs;
        }
        async hasUpdate() {
            const logs = await this.getZZZAllLog();
            const newLogs = logs.filter(log => !log.local);
            const result = {
                hasUpdate: false,
                logs: [],
            };
            if (newLogs.length) {
                result.hasUpdate = true;
                result.logs = newLogs;
            }
            return result;
        }
    };
}
export { ZZZUpdate };
//# sourceMappingURL=update.js.map