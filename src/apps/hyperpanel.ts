import { ZZZPlugin } from '../lib/plugin.js'
import { rulePrefix } from '../lib/common.js'
import settings from '../lib/settings.js'
import request from '../utils/request.js'
import { aliasToName } from '../lib/convert/char.js'
import { getPanelData } from '../lib/db.js'
import { updateExtremePanelsFromPanelDb } from '../model/hyperpanel/extreme.js'
import _ from 'lodash'

function toBool(value: unknown, fallback = false) {
  if (value == null || value === '') return fallback
  const s = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false
  return fallback
}

function toAvatarList(ds: any): any[] {
  const av = ds?.avatars
  if (!av) return []
  if (Array.isArray(av)) return av.filter(Boolean)
  if (typeof av === 'object') return Object.values(av).filter(Boolean)
  return []
}

function pickAvatarByName(list: any[], name: string) {
  const target = String(name || '').trim()
  if (!target) return null

  // exact
  const exact = list.find(
    (a) =>
      a?.name_mi18n === target ||
      a?.name === target ||
      a?.full_name_mi18n === target
  )
  if (exact) return exact

  // includes
  const lower = target.toLowerCase()
  const inc = list.find((a) => {
    const n1 = String(a?.name_mi18n || '').toLowerCase()
    const n2 = String(a?.full_name_mi18n || '').toLowerCase()
    const n3 = String(a?.name || '').toLowerCase()
    return (
      (n1 && n1.includes(lower)) ||
      (n2 && n2.includes(lower)) ||
      (n3 && n3.includes(lower))
    )
  })
  return inc || null
}

export class HyperPanel extends ZZZPlugin {
  static locked = false

  constructor() {
    super({
      name: '[ZZZ-Plugin]HyperPanel',
      dsc: '极限面板（基准）',
      event: 'message',
      // 该指令容易与其他插件的“xx面板”规则冲突，默认提高优先级以确保先匹配。
      priority: _.get(settings.getConfig('priority'), 'hyperpanel', -10),
      rule: [
        // 手动触发：%更新极限面包（避免与其他插件“更新极限面板/面板”抢指令）
        { reg: '^%更新极限面包$', fnc: 'updateBun', permission: 'master' },
        // 也支持带前缀
        { reg: `${rulePrefix}更新极限面包$`, fnc: 'updateBun', permission: 'master' },
        // 支持：%zzz极限安比面板 / #绝区零极限安比面板
        { reg: `${rulePrefix}极限(.+)面板$`, fnc: 'showHyperPanel' },
        // 支持：%极限安比面板（不写 zzz 前缀）
        { reg: '^%极限(.+)面板$', fnc: 'showHyperPanel' },
      ],
    })

    const cfg: any = settings.getConfig('config') || {}
    const bunCfg = _.get(cfg, 'hyperpanel.bun', {})
    const enabled = toBool(_.get(bunCfg, 'auto', true), true)
    const cron = String(_.get(bunCfg, 'cron', '0 30 4 * * ?') || '').trim()

    if (enabled && cron) {
      this.task = {
        name: 'ZZZ-Plugin极限面包自动更新',
        cron,
        fnc: () => this.updateBunTask(),
      }
    }
  }

  async updateBunTask() {
    const ret = await this.generateBunPreset()
    if (!ret.ok) {
      logger.warn(`[HyperPanel] 极限面包自动更新失败：${ret.message}`)
    } else {
      logger.mark(
        `[HyperPanel] 极限面包自动更新完成：uid=${ret.uid} 角色=${ret.count}`
      )
    }
  }

  async updateBun() {
    const start = Date.now()
    await this.reply('开始更新极限面包…（本地生成，可能需要一点时间）')

    const ret = await this.generateBunPreset()
    if (!ret.ok) {
      await this.reply(`更新失败：${ret.message}`)
      return true
    }

    const cost = Date.now() - start
    await this.reply(
      `更新完成：uid=${ret.uid} 角色=${ret.count}（${cost}ms）\n用法：%极限<角色名>面板`
    )
    return true
  }

  async generateBunPreset(): Promise<
    | { ok: true; uid: string; count: number }
    | { ok: false; message: string }
  > {
    if (HyperPanel.locked) return { ok: false, message: '正在生成中，请稍后再试…' }
    HyperPanel.locked = true

    try {
      const cfg: any = settings.getConfig('config') || {}
      const bunCfg = _.get(cfg, 'hyperpanel.bun', {})
      const uid = String(_.get(bunCfg, 'uid', '10000000') || '').trim() || '10000000'

      const ret = await updateExtremePanelsFromPanelDb({
        targetUid: uid,
      })
      if (!ret.ok) return ret
      return { ok: true, uid: ret.uid, count: ret.count }
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) }
    } finally {
      HyperPanel.locked = false
    }
  }

  async showHyperPanel() {
    const msg = String(this.e?.msg || '').trim()
    if (!msg) return false

    const m1 = msg.match(new RegExp(`${rulePrefix}极限(.+)面板$`))
    const m2 = msg.match(/^%极限(.+)面板$/)
    const rawName = String((m1 ? m1[4] : m2 ? m2[1] : '') || '').trim()

    if (!rawName) {
      await this.reply('用法：%极限<角色名>面板（例：%极限安比面板）')
      return true
    }

    const resolved = aliasToName(rawName) || rawName

    const cfg: any = settings.getConfig('config') || {}
    const bunCfg = _.get(cfg, 'hyperpanel.bun', {})
    const bunUid = String(_.get(bunCfg, 'uid', '10000000') || '').trim() || '10000000'
    const useLocalFirst = toBool(_.get(bunCfg, 'useLocalFirst', true), true)

    let uid = bunUid
    let list: any[] = []
    let picked: any | null = null

    // 1) 优先读取本地极限面包（写入到 ZZZ-Plugin panel DB：plugins/ZZZ-Plugin/data/panel/<uid>.json）
    if (useLocalFirst) {
      try {
        const local = getPanelData(bunUid)
        if (Array.isArray(local) && local.length) {
          list = local
          picked = pickAvatarByName(list, resolved)
        }
      } catch {
        // ignore local read errors
      }
    }

    // 2) 兜底：请求 hyperpanel.api HTTP 接口（若有配置）
    let apiErr: any = null
    if (!picked) {
      const api = String(_.get(cfg, 'hyperpanel.api', 'http://127.0.0.1:4567/zzz/hyperpanel')).trim()
      const timeout = Number(_.get(cfg, 'hyperpanel.timeout', 15000))

      if (!api) {
        await this.reply('极限面板数据未初始化：请先执行 %更新极限面包（本地生成）。')
        return true
      }

      try {
        const res = await request.get(api, {}, { timeout })
        const ds = (await res.json()) as any
        uid = String(ds?.uid || bunUid)
        list = toAvatarList(ds)
        picked = pickAvatarByName(list, resolved)
      } catch (e) {
        apiErr = e
      }
    }

    if (!picked) {
      if (!list.length) {
        await this.reply(
          `极限面板数据获取失败：${apiErr?.message || apiErr || '数据为空'}\n` +
            `建议：先执行 %更新极限面包（本地生成），再使用 %极限<角色名>面板。`
        )
        return true
      }

      const hints = list
        .map((a) => String(a?.name_mi18n || a?.name || '').trim())
        .filter(Boolean)
        .filter((n) => n.includes(rawName) || n.includes(resolved))
        .slice(0, 10)
      await this.reply(
        `未找到角色「${rawName}」的极限面板。\n` +
          (hints.length
            ? `你是不是想查：${hints.join('、')}`
            : '可尝试使用角色全名/常用别名再试。')
      )
      return true
    }

    const handler = this.e?.runtime?.handler
    if (handler?.has?.('zzz.tool.panel')) {
      try {
        await handler.call('zzz.tool.panel', this.e, { uid, data: picked, needSave: false })
        return true
      } catch (e: any) {
        const api = String(_.get(cfg, 'hyperpanel.api', '') || '').trim()
        await this.reply(
          `极限面板数据已获取，但渲染失败：${e?.message || e}\n` +
            `建议：升级/修复 ZZZ-Plugin 面板渲染器，或先访问接口确认数据：\n${api}`
        )
        return true
      }
    }

    // fallback：直接复用 Panel 工具（在某些运行时 handler 未注入时）
    try {
      const mod = (await import('./panel.js')) as any
      const Panel = mod?.Panel
      if (typeof Panel !== 'function') throw new Error('panel tool not available')
      const inst = new Panel()
      await inst.getCharPanelTool(this.e, { uid, data: picked, needSave: false })
    } catch (e: any) {
      await this.reply(`渲染失败：${e?.message || e}`)
    }
    return true
  }
}

