
import { Panel } from "./apps/panel.js"
import settings from "./lib/settings.js"

// 常用按钮列表
const commonButtons = [
  { label: '更新面板', callback: '%更新面板' },
  { label: '绑定UID', data: '%绑定' },
  { label: '扫码绑定', callback: '#扫码登录' },
  { label: '绑定设备', callback: '%绑定设备帮助' }
]

export default class Button extends Panel {
  constructor() {
    super({
      name: 'zzz-plugin-Miao-support-Button',
      dsc: 'zzz-plugin button support (考古版本)',
      priority: -429,
      rule: [
        { reg: '#绝区零更新面板|#绝区零面板更新|#绝区零刷新面板|#绝区零面板刷新|#绝区零更新展柜面板|#绝区零展柜面板更新$', fnc: 'profile1' },
        { reg: '#绝区零(.*)(?:展柜)?面板(?:展柜)?(.*)$', fnc: 'handleRule' }
      ]
    })

    // 确保 plugin 属性存在并正确配置
    this.plugin = this.plugin || {
      name: 'zzz-plugin-Miao-support-Button',
      dsc: 'zzz-plugin button support (考古版本)',
      priority: -429,
      rule: [
        { reg: '#绝区零更新面板|#绝区零面板更新|#绝区零刷新面板|#绝区零面板刷新|#绝区零更新展柜面板|#绝区零展柜面板更新$', fnc: 'profile1' },
        { reg: '#绝区零(.*)(?:展柜)?面板(?:展柜)?(.*)$', fnc: 'handleRule' }
      ]
    }

    // 确保 rule 是数组
    if (!Array.isArray(this.plugin.rule)) {
      this.plugin.rule = [
        { reg: '#绝区零更新面板|#绝区零面板更新|#绝区零刷新面板|#绝区零面板刷新|#绝区零更新展柜面板|#绝区零展柜面板更新$', fnc: 'profile1' },
        { reg: '#绝区零(.*)(?:展柜)?面板(?:展柜)?(.*)$', fnc: 'handleRule' }
      ]
    }
  }

  async profile1(e) {
    this.e = e

    const { roleList, ifNewChar } = await this.getUserData()
    const button = []

    // 添加常用按钮
    const staticList = [
      ...commonButtons,
      { label: '爱发电', link: settings.getConfig('config').donationLink || 'https://afdian.com' }
    ]
    button.push(...Bot.Button(staticList))

    // 添加角色按钮（最多显示最新8个角色）
    if ( roleList.length > 0) {
      const limitedRoleList = roleList.slice(0, 8)
      const charButtonList = limitedRoleList.map(role => ({
        label: role,
        callback: `%${role}面板`
      }))
      logger.mark(`[ZZZ-Plugin] 构造角色列表按钮: ${JSON.stringify(charButtonList)}`)
      const charButtons = Bot.Button(charButtonList, 4)
      logger.mark(`[ZZZ-Plugin] Bot.Button返回结果: ${JSON.stringify(charButtons)}`)
      button.push(...charButtons)
      logger.mark(`[ZZZ-Plugin] 合并后按钮总数: ${button.length}`)
    }

    logger.mark(`[ZZZ-Plugin] 最终返回按钮: ${JSON.stringify(button)}`)
    return button.length > 0 ? button : null
  }

  /** 获取用户数据 */
  async getUserData() {
    let roleList = []
    let ifNewChar = false

    try {
      const uid = await this.getUID()
      if (uid) {
        // 使用handler获取角色列表
        let handler = this.e?.runtime?.handler || {}
        if (handler.has && handler.has('zzz.tool.panelList')) {
          const panelData = await handler.call('zzz.tool.panelList', uid, false)
          if (panelData) {
            roleList = panelData.map(item => item.name_mi18n) || []
            ifNewChar = panelData.some(item => item.isNew) || false
          }
        }
      }
    } catch (error) {
      logger.debug('获取UID失败，使用默认按钮:', error.message)
    }

    return { roleList, ifNewChar }
  }

  handleRule(e) {
    const charName = this.parseCharName(e)
    return charName ? this.getCharButtons(charName) : this.getDefaultButtons()
  }

  /** 解析角色名称 */
  parseCharName(e) {
    const match = e.match || e.msg.match(/^(%|＃|#)(.+?)(?:展柜)?面板(?:展柜)?$/)
    const parsedName = match?.[2]?.trim()
    return parsedName && !['更新', '刷新', '列表'].includes(parsedName) ? parsedName : ''
  }

  /** 获取默认按钮 */
  getDefaultButtons() {
    const buttonRows = [
      [
        { label: '更新面板', callback: '%更新面板' },
        { label: '展柜面板', callback: '%更新展柜面板' }
      ],
      [
        { label: '练度统计', callback: '%练度统计' },
        { label: '投喂', link: settings.getConfig('config').donationLink || 'https://afdian.com' }
      ],
      [
        { label: '体力', callback: '%电量' },
        { label: '签到', callback: '#签到' }
      ]
    ]
    return Bot.Button(buttonRows)
  }

  /** 获取角色专属按钮 */
  getCharButtons(charName) {
    const buttonRows = [
      [
        { label: '更新面板', callback: '%更新面板' },
        { label: '展柜面板', callback: '%更新展柜面板' }
      ],
      [
        { label: `${charName}攻略`, callback: `%${charName}攻略` },
        { label: '练度统计', callback: '%练度统计' },
        { label: `${charName}图鉴`, callback: `%${charName}图鉴` }
      ],
      [
        { label: '电量', callback: '%体力' },
        { label: '投喂', link: settings.getConfig('config').donationLink || 'https://afdian.com' },
        { label: `${charName}伤害`, callback: `%${charName}伤害` },
        { label: '签到', callback: '#签到' }
      ]
    ]
    return Bot.Button(buttonRows)
  }
}
