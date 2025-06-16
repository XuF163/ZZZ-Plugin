import settings from "./lib/settings.js"
import { getPanelList } from "./lib/avatar.js"
import { Panel } from "./apps/panel.js"

export default class Button extends Panel {
  constructor() {
    super({
      name: 'zzz-plugin-Miao-support-Button',
      dsc: 'zzz-plugin button support (考古版本)',
      priority: -429,
      rule: [
        { reg: '#绝区零更新面板|#绝区零面板更新|#绝区零刷新面板|#绝区零面板刷新|#绝区零更新展柜面板|#绝区零展柜面板更新$', fnc: 'profile1' },
        { reg:  '#绝区零(.*)(?:展柜)?面板(?:展柜)?(.*)$', fnc: 'handleRule' },
      ]
    })
  }

  async profile1(e) {
    let roleList = [];
    let ifNewChar = false;

    try {
      // 设置事件对象
      this.e = e;

      // 获取UID
      const uid = await this.getUID();
      if (uid) {
        // 从数据库获取角色列表而不是全局变量
        const panelData = getPanelList(uid);
        roleList = panelData.map(item => item.name_mi18n) || [];
        ifNewChar = panelData.some(item => item.isNew) || false;
      }
    } catch (error) {
      // 如果获取UID失败，使用默认值
      logger.debug('获取UID失败，使用默认按钮:', error.message);
    }

    const button = [];

    const staticList = [
      { label: `更新面板`, callback: `%更新面板` },
      { label: '绑定UID', data: `%绑定` },
      { label: '扫码绑定', callback: `#扫码登录` },
      { label: '绑定设备', callback: `%绑定设备帮助` },
      { label: '爱发电', link: settings.getConfig('config').donationLink || 'https://afdian.com' },
    ];

    button.push(...Bot.Button(staticList));

    if (ifNewChar && roleList.length > 0) {
      const charButtonList = roleList.map(role => ({
        label: role, callback: `%${role}面板`
      }));
      button.push(...Bot.Button(charButtonList, 4));
    }

    return button.length > 0 ? button : null;
  }

  handleRule(e) {
    let charName = '';

    // 从消息中解析角色名称
    const match = e.match || e.msg.match(/^(%|＃|#)(.+?)(?:展柜)?面板(?:展柜)?$/);
    const parsedName = match?.[2]?.trim();
    if (parsedName && !['更新', '刷新', '列表'].includes(parsedName)) {
      charName = parsedName;
    }

    // 如果没有角色名称，使用默认按钮
    if (!charName) {
      const buttonRows = [
        [{ label: `更新面板`, callback: `%更新面板` }, { label: `展柜面板`, callback: `%更新展柜面板` }],
        [{ label: `练度统计`, callback: `%练度统计` }, { label: `投喂`, link: settings.getConfig('config').donationLink || 'https://afdian.com' }],
        [{ label: `体力`, callback: `%电量` }, { label: `签到`, callback: `#签到` }]
      ];
      return Bot.Button(buttonRows);
    }

    // 有角色名称时的按钮布局
    const buttonRows = [
      [{ label: `更新面板`, callback: `%更新面板` }, { label: `展柜面板`, callback: `%更新展柜面板` }],
      [
        { label: `${charName}攻略`, callback: `%${charName}攻略` },
        { label: `练度统计`, callback: `%练度统计` },
        { label: `${charName}图鉴`, callback: `%${charName}图鉴` },
      ],
      [
        { label: `电量`, callback: `%体力` },
        { label: `投喂`, link: settings.getConfig('config').donationLink || 'https://afdian.com' },
        { label: `${charName}伤害`, callback: `%${charName}伤害` },
        { label: `签到`, callback: `#签到` }
      ]
    ];

    return Bot.Button(buttonRows);
  }
}
