import { ZZZPlugin } from '../lib/plugin.js'
import { rulePrefix } from '../lib/common.js'
import settings from '../lib/settings.js'
import request from '../utils/request.js'
import { aliasToName } from '../lib/convert/char.js'
import _ from 'lodash'

function toAvatarList(ds) {
  const av = ds?.avatars
  if (!av) return []
  if (Array.isArray(av)) return av.filter(Boolean)
  if (typeof av === 'object') return Object.values(av).filter(Boolean)
  return []
}

function pickAvatarByName(list, name) {
  const target = String(name || '').trim()
  if (!target) return null

  // exact
  const exact = list.find((a) => a?.name_mi18n === target || a?.name === target || a?.full_name_mi18n === target)
  if (exact) return exact

  // includes
  const lower = target.toLowerCase()
  const inc = list.find((a) => {
    const n1 = String(a?.name_mi18n || '').toLowerCase()
    const n2 = String(a?.full_name_mi18n || '').toLowerCase()
    const n3 = String(a?.name || '').toLowerCase()
    return (n1 && n1.includes(lower)) || (n2 && n2.includes(lower)) || (n3 && n3.includes(lower))
  })
  return inc || null
}

export class HyperPanel extends ZZZPlugin {
  constructor() {
    super({
      name: '[ZZZ-Plugin]HyperPanel',
      dsc: '极限面板（基准）',
      event: 'message',
      // 该指令容易与其他插件的“xx面板”规则冲突，默认提高优先级以确保先匹配。
      priority: _.get(settings.getConfig('priority'), 'hyperpanel', -10),
      rule: [
        // 支持：%zzz极限安比面板 / #绝区零极限安比面板
        { reg: `${rulePrefix}极限(.+)面板$`, fnc: 'showHyperPanel' },
        // 支持：%极限安比面板（不写 zzz 前缀）
        { reg: '^%极限(.+)面板$', fnc: 'showHyperPanel' }
      ]
    })
  }

  async showHyperPanel() {
    const msg = String(this.e?.msg || '').trim()
    if (!msg) return false

    const m1 = msg.match(new RegExp(`${rulePrefix}极限(.+)面板$`))
    const m2 = msg.match(/^%极限(.+)面板$/)
    const rawName = String((m1 ? m1[4] : (m2 ? m2[1] : '')) || '').trim()

    if (!rawName) {
      await this.reply('用法：%极限<角色名>面板（例：%极限安比面板）')
      return true
    }

    const resolved = aliasToName(rawName) || rawName

    const cfg = settings.getConfig('config') || {}
    const api = String(_.get(cfg, 'hyperpanel.api', 'http://127.0.0.1:4567/zzz/hyperpanel')).trim()
    const timeout = Number(_.get(cfg, 'hyperpanel.timeout', 15000))

    if (!api) {
      await this.reply('极限面板 API 未配置：请在配置项 config.hyperpanel.api 中填写。')
      return true
    }

    let ds
    try {
      const res = await request.get(api, {}, { timeout })
      ds = await res.json()
    } catch (e) {
      await this.reply(`极限面板 API 请求失败：${e?.message || e}\napi=${api}`)
      return true
    }

    const list = toAvatarList(ds)
    if (!list.length) {
      await this.reply('极限面板数据为空：请确认 LimitedPanelAPI 已生成 out/zzz/<uid>.json，并且 /zzz/hyperpanel 可正常返回。')
      return true
    }

    const picked = pickAvatarByName(list, resolved)
    if (!picked) {
      const hints = list
        .map((a) => String(a?.name_mi18n || a?.name || '').trim())
        .filter(Boolean)
        .filter((n) => n.includes(rawName) || n.includes(resolved))
        .slice(0, 10)
      await this.reply(
        `未找到角色「${rawName}」的极限面板。\n` +
          (hints.length ? `你是不是想查：${hints.join('、')}` : '可尝试使用角色全名/常用别名再试。')
      )
      return true
    }

    const handler = this.e?.runtime?.handler
    const uid = String(ds?.uid || '10000000')

    if (handler?.has?.('zzz.tool.panel')) {
      try {
        await handler.call('zzz.tool.panel', this.e, { uid, data: picked, needSave: false })
        return true
      } catch (e) {
        await this.reply(
          `极限面板数据已获取，但渲染失败：${e?.message || e}\n` +
            `建议：升级/修复 ZZZ-Plugin 面板渲染器，或先访问接口确认数据：\n${api}`
        )
        return true
      }
    }

    // fallback：直接复用 Panel 工具（在某些运行时 handler 未注入时）
    try {
      const mod = await import('./panel.js')
      const Panel = mod?.Panel
      if (typeof Panel !== 'function') throw new Error('panel tool not available')
      const inst = new Panel()
      await inst.getCharPanelTool(this.e, { uid, data: picked, needSave: false })
    } catch (e) {
      await this.reply(`渲染失败：${e?.message || e}`)
    }
    return true
  }
}
