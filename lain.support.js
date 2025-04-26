

export default class Button {
  constructor() {
    this.plugin = {
      name: 'zzz-plugin-support-global',
      dsc: 'zzz-plugin button support (uses global vars)',
      priority: 50, // 确保在 Panel(70) 之后运行
      rule: [
        { reg: '#绝区零更新面板|#绝区零面板更新|#绝区零刷新面板|#绝区零面板刷新$', fnc: 'profile1' },
        { reg:  '#绝区零(.*)面板(.*)$', fnc: 'handleRule' },
      ]
    }
  }

  profile1(e) {
    // === 正确地从全局变量读取数据 ===
    const roleList = global.zzzRoleList || []; // 直接读取，提供默认值
    const ifNewChar = global.ifNewChar || false; // 直接读取，提供默认值
    // ==============================

    logger.mark("[Support Global] 读取到的全局数据:", { roleList, ifNewChar });

    const button = []; // 收集按钮片段

    const staticList = [
      { label: `更新面板`, callback: `%更新面板` },
      { label: '绑定UID', callback: `%绑定` },
      { label: '扫码绑定', callback: `/扫码绑定` },
      { label: '绑定设备', callback: `%绑定设备帮助` },
    ];
    // 假设 Bot.Button 返回数组片段
    button.push(...Bot.Button(staticList));

    if (ifNewChar && roleList.length > 0) {
      logger.mark("[Support Global] 检测到新角色，添加角色按钮。");
      const charButtonList = roleList.map(role => ({
        label: role, callback: `%${role}面板`
      }));
      button.push(...Bot.Button(charButtonList, 4)); // 假设每行4个
    } else {
      logger.mark("[Support Global] 没有新角色或列表为空。");
    }

    return button.length > 0 ? button : null; // 返回给适配器
  }

  handleRule(e) {
    let charName = '';

    // === 优先从全局变量获取 ===
    if (global.zzzCurrentCharName) {
      charName = global.zzzCurrentCharName;
      logger.mark("[Support Global] 从 global 获取到角色名:", charName);
      // 读取后可以考虑清除全局变量，避免下次误用（可选）

    } else {
        logger.error('[Support Global] 无法确定角色名。');
        return null;
      }
    }

    // 构建按钮数据 (假设 Bot.Button/适配器能处理二维数组)
    const buttonRows = [
      [{ label: `更新面板`, callback: `%更新面板` }],
      [
        { label: `${charName}攻略`, callback: `%${charName}攻略` },
        { label: `练度统计`, callback: `%练度统计` },
        { label: `${charName}图鉴`, callback: `%${charName}图鉴` },
      ],
      [{ label: `签到`, callback: `%签到` }, { label: `电量`, callback: `%体力` }] // 可以合并常用的
    ];

    return Bot.Button(buttonRows); // 返回给适配器处理
  }
}
