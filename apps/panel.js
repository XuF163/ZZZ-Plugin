import { ZZZPlugin } from '../lib/plugin.js';
import {
  getPanelList,
  refreshPanel as refreshPanelFunction,
  getPanelOrigin,
  updatePanelData,
  formatPanelData,
  getPanelListOrigin,
} from '../lib/avatar.js';
import settings from '../lib/settings.js';
import _ from 'lodash';
import { rulePrefix } from '../lib/common.js';

export class Panel extends ZZZPlugin {
  constructor() {
    super({
      name: '[ZZZ-Plugin]Panel',
      dsc: 'zzzpanel',
      event: 'message',
      priority: _.get(settings.getConfig('priority'), 'panel', 70),
      rule: [
        {
          reg: `${rulePrefix}(.*)面板(刷新|更新|列表)?$`,
          fnc: 'handleRule',
        },
        {
          reg: `${rulePrefix}练度(统计)?$`,
          fnc: 'proficiency',
        },
        {
          reg: `${rulePrefix}原图$`,
          fnc: 'getCharOriImage',
        },
      ],
      handler: [
        { key: 'zzz.tool.panel', fn: 'getCharPanelTool' },
        { key: 'zzz.tool.panelList', fn: 'getCharPanelListTool' },
      ],
    });
  }
  async handleRule() {
    if (!this.e.msg) return;
    const reg = new RegExp(`${rulePrefix}(.*)面板(刷新|更新|列表)?$`);
    const pre = this.e.msg.match(reg)[4]?.trim();
    const suf = this.e.msg.match(reg)[5]?.trim();
    if (['刷新', '更新'].includes(pre) || ['刷新', '更新'].includes(suf))
      return await this.refreshPanel();
    if (!pre || suf === '列表') return await this.getCharPanelList();
    const queryPanelReg = new RegExp(`${rulePrefix}(.*)面板$`);
    if (queryPanelReg.test(this.e.msg)) return await this.getCharPanel();
    return false;
  }

  async refreshPanel() {
    const uid = await this.getUID();
    const lastQueryTime = await redis.get(`ZZZ:PANEL:${uid}:LASTTIME`);
    const panelSettings = settings.getConfig('panel');
    const coldTime = _.get(panelSettings, 'interval', 300);
    if (lastQueryTime && Date.now() - lastQueryTime < 1000 * coldTime) {
      // line 62 in V2
    await this.reply([`${coldTime}秒内只能刷新一次，请稍后再试`, segment.button([{ text: '再试一下', callback: '%更新面板' }])]);
    return false; // 保持原有逻辑
    }
    const { api } = await this.getAPI();
    await redis.set(`ZZZ:PANEL:${uid}:LASTTIME`, Date.now());
    await this.reply('正在刷新面板列表，请稍候...');
    await this.getPlayerInfo();
    const result = await refreshPanelFunction(api).catch(e => {
      this.reply(e.message);
      throw e;
    });
    if (!result) {
      // line 71 in V2
        await this.reply(['面板列表刷新失败，请稍后再试', segment.button([{ text: '再试一下', callback: '%更新面板' }])]);
        return false; // 保持原有逻辑
    }

    const newChar = result.filter(item => item.isNew);
    const finalData = {
      newChar: newChar.length,
      list: result,
    };// After line 77 in V2
const role_list = result.map(item => item.name_mi18n); // 从 result 获取角色名列表
logger.mark("角色列表", role_list); // 可选的日志记录

let buttons = [[]];
// 按钮组件
for (const name of role_list) {
    const array = buttons[buttons.length - 1];
    array.push({ text: `${name}`, callback: `%${name}面板` });
    if (array.length > 2) // 每行最多3个按钮
        buttons.push([]);
}
// 如果没有角色按钮，添加默认按钮
if (buttons.length === 1 && buttons[0].length === 0) {
    buttons[0] = [
        { text: "更新面板", callback: `%更新面板` },
        { text: "刷新访问凭据", callback: `#刷新访问凭据` }, // 确保这个命令在你的环境中有效
        { text: "练度统计", callback: "%练度统计" }
    ];
} else if (buttons[buttons.length - 1].length === 0) {
    // 移除最后一个空行
    buttons.pop();
}

// 修改发送逻辑，将按钮和图片一起发送
// 原来的 line 78: await this.render('panel/refresh.html', finalData);
// 修改为：
let cfg = { retType: 'base64' }; // 需要图片数据以便和按钮一起发送
this.e.reply([await this.render('panel/refresh.html', finalData, cfg), segment.button(...buttons)]);

  }
  async getCharPanelList() {
    const uid = await this.getUID();
    const result = getPanelList(uid);
    if (!result) {
      await this.reply('未找到面板数据，请先%刷新面板');
      return false;
    }
    await this.getPlayerInfo();
    const timer = setTimeout(() => {
      if (this?.reply) {
        this.reply('查询成功，正在下载图片资源，请稍候。');
      }
    }, 5000);
    for (const item of result) {
      await item.get_basic_assets();
    }
    clearTimeout(timer);
    const finalData = {
      count: result?.length || 0,
      list: result,
    };
    await this.render('panel/list.html', finalData);
  }

  async getCharPanelListTool(uid, origin = false) {
    if (!uid) {
      return false;
    }
    if (origin) {
      const result = getPanelListOrigin(uid);
      return result;
    }
    const result = getPanelList(uid);
    return result;
  }

  async getCharPanel() {
    const uid = await this.getUID();
    const reg = new RegExp(`${rulePrefix}(.+)面板$`);
    const match = this.e.msg.match(reg);
    if (!match) return false;
    const name = match[4];
    const data = getPanelOrigin(uid, name);
    if (!data) {
      await this.reply(`未找到角色${name}的面板信息，请先刷新面板`);
      return;
    }
    let handler = this.e.runtime.handler || {};

    if (handler.has('zzz.tool.panel')) {
      await handler.call('zzz.tool.panel', this.e, {
        uid,
        data: data,
        needSave: false,
      });
    }
    return false;
  }

  async getCharPanelTool(e, _data = {}) {
    if (e) this.e = e;
    if (e?.reply) this.reply = e.reply;

    const {
      uid = undefined,
      data = undefined,
      needSave = true,
      reply = true,
      needImg = true
    } = _data;
    if (!uid) {
      await this.reply('UID为空');
      return false;
    }
    if (!data) {
      await this.reply('数据为空');
      return false;
    }
    if (needSave) {
      updatePanelData(uid, [data]);
    }
    const timer = setTimeout(() => {
      const msg = '查询成功，正在下载图片资源，请稍候。'
      if (this?.reply && needImg) {
        this.reply(msg);
      } else {
        logger.mark(msg)
      }
    }, 5000);
    const parsedData = formatPanelData(data);
    await parsedData.get_detail_assets();
    clearTimeout(timer);
    const finalData = {
      uid,
      charData: parsedData,
    };
    const image = needImg ? await this.render('panel/card.html', finalData, {
      retType: 'base64',
    }) : needImg;

    if (reply) {
      let role = parsedData.name_mi18n; // 从 parsedData 获取角色名
    let buts = [
        [{ text: '看看我的面板', callback: '%更新面板' }], // 或者 '%刷新面板' ? 根据你的命令调整
        [
            { text: `${role}攻略`, callback: `%${role}攻略` }, // 确保攻略命令存在
            { text: `练度统计`, callback: `%练度统计` },
            { text: `${role}图鉴`, callback: `%${role}图鉴` } // 确保图鉴命令存在
        ],
        [
            { text: `电量`, callback: `%体力` }, // 确保体力命令存在
            { text: `签到`, callback: `%签到` }, // 确保签到命令存在
            { text: `帮助`, callback: `%帮助` }  // 确保帮助命令存在
        ],
    ];

      const res = await this.reply([image, segment.button(...buts)]);
      if (res?.message_id && parsedData.role_icon)
        await redis.set(
          `ZZZ:PANEL:IMAGE:${res.message_id}`,
          parsedData.role_icon,
          {
            EX: 3600 * 3,
          }
        );
      return {
        message: res,
        image,
      };
    }

    return image;
  }
  async proficiency() {
    const uid = await this.getUID();
    const result = getPanelList(uid);
    if (!result) {
      await this.reply('未找到面板数据，请先%刷新面板');
      return false;
    }
    await this.getPlayerInfo();
    result.sort((a, b) => {
      return b.proficiency_score - a.proficiency_score;
    });
    const WeaponCount = result.filter(item => item?.weapon).length,
      SWeaponCount = result.filter(
        item => item?.weapon && item.weapon.rarity === 'S'
      ).length;
    const general = {
      total: result.length,
      SCount: result.filter(item => item.rarity === 'S').length,
      SWeaponRate: (SWeaponCount / WeaponCount) * 100,
      SSSCount: result.reduce((acc, item) => {
        if (item.equip) {
          acc += item.equip.filter(
            equip => ['SSS', 'ACE', 'MAX'].includes(equip.comment)
          ).length;
        }
        return acc;
      }, 0),
      highRank: result.filter(item => item.rank > 4).length,
    };
    const timer = setTimeout(() => {
      if (this?.reply) {
        this.reply('查询成功，正在下载图片资源，请稍候。');
      }
    }, 5000);
    for (const item of result) {
      await item.get_small_basic_assets();
    }
    clearTimeout(timer);
    const finalData = {
      general,
      list: result,
    };
    await this.render('proficiency/index.html', finalData);
  }
  async getCharOriImage() {
    let source;
    if (this.e.getReply) {
      source = await this.e.getReply();
    } else if (this.e.source) {
      if (this.e.group?.getChatHistory) {
        // 支持at图片添加，以及支持后发送
        source = (
          await this.e.group.getChatHistory(this.e.source?.seq, 1)
        ).pop();
      } else if (this.e.friend?.getChatHistory) {
        source = (
          await this.e.friend.getChatHistory(this.e.source?.time + 1, 1)
        ).pop();
      }
    }
    const id = source?.message_id;
    if (!id) {
      await this.reply('未找到消息源，请引用要查看的图片');
      return false;
    }
    const image = await redis.get(`ZZZ:PANEL:IMAGE:${id}`);
    if (!image) {
      await this.reply('未找到原图');
      return false;
    }
    await this.reply(segment.image(image));
    return false;
  }
}
// import { ZZZPlugin } from '../lib/plugin.js';
// import {
//   getPanelList,
//   refreshPanel as refreshPanelFunction,
//   getPanelOrigin,
//   updatePanelData,
//   formatPanelData,
//   getPanelListOrigin, getPanel,
// } from '../lib/avatar.js'
// import settings from '../lib/settings.js';
// import _ from 'lodash';
// import { rulePrefix } from '../lib/common.js';
//
//
// global.zzzRoleList = [];
// global.ifNewChar = false;
// export default class Panel extends ZZZPlugin {
//   constructor() {
//     super({
//       name: '[ZZZ-Plugin]Panel',
//       dsc: 'zzzpanel',
//       event: 'message',
//       priority: _.get(settings.getConfig('priority'), 'panel', 70),
//       rule: [
//         {
//           reg: `${rulePrefix}(.*)面板(刷新|更新|列表)?$`,
//           fnc: 'handleRule',
//         },
//         {
//           reg: `${rulePrefix}练度(统计)?$`,
//           fnc: 'proficiency',
//         },
//         {
//           reg: `${rulePrefix}原图$`,
//           fnc: 'getCharOriImage',
//         },
//       ],
//       handler: [
//         { key: 'zzz.tool.panel', fn: 'getCharPanelTool' },
//         { key: 'zzz.tool.panelList', fn: 'getCharPanelListTool' },
//       ],
//     });
//
//     Panel.zzzroleList = []
//     Panel.ifNewChar = false
//   }
//   async handleRule() {
//     if (!this.e.msg) return;
//     const reg = new RegExp(`${rulePrefix}(.*)面板(刷新|更新|列表)?$`);
//     const pre = this.e.msg.match(reg)[4]?.trim();
//     const suf = this.e.msg.match(reg)[5]?.trim();
//     if (['刷新', '更新'].includes(pre) || ['刷新', '更新'].includes(suf))
//       return await this.refreshPanel();
//     if (!pre || suf === '列表') return await this.getCharPanelList();
//     const queryPanelReg = new RegExp(`${rulePrefix}(.*)面板$`);
//     if (queryPanelReg.test(this.e.msg)) return await this.getCharPanel();
//     return false;
//   }
//
//   async refreshPanel() {
//     const uid = await this.getUID();
//     const lastQueryTime = await redis.get(`ZZZ:PANEL:${uid}:LASTTIME`);
//     const panelSettings = settings.getConfig('panel');
//     const coldTime = _.get(panelSettings, 'interval', 300);
//     if (lastQueryTime && Date.now() - lastQueryTime < 1000 * coldTime) {
//       await this.reply([`你看，又急\n${coldTime}秒内只能刷新一次`,segment.button([{text:'再试一下',callback:'%更新面板'}])])
//       return;
//     }
//     const { api } = await this.getAPI();
//     await redis.set(`ZZZ:PANEL:${uid}:LASTTIME`, Date.now());
//     await logger.mark(`正在更新面板${uid}，请稍候...当前更新服务：派蒙`);
//
//     await this.getPlayerInfo();
//     const result = await refreshPanelFunction(api).catch(e => {
//       this.reply(e.message);
//       throw e;
//     });
//     if (!result) {
//       await this.reply(['面板列表刷新失败，请稍后再试',segment.button([{text:'再试一下',callback:'%更新面板'}])])
//       return false;
//     }
//     const newChar = result.filter(item => item.isNew);
//
//
//     let str = '面板列表获取成功，本次共刷新了' + newChar.length + '个角色：\n';
//
//     const  role_list = []
//
//     global.ifNewChar = false //有什么意义呢？
//
//     for (const item of result) {
//       if (item.isNew ) {
//         Panel.ifNewChar = true
//         global.ifNewChar = true
//     }
//       str += item.name_mi18n + (item.isNew ? '（新）' : '') + '、';
//       role_list.push(item.name_mi18n)
//     }
//     Panel.zzzroleList = role_list
//     global.zzzroleList = role_list;
//     logger.mark("角色列表",role_list)
//     str = str.slice(0, -1);
//     str += '\n总计' + result.length + '个角色';
//     let buttons = [[]]
//     //按钮组件
//     for (const name of role_list) {
//       const array = buttons[buttons.length-1]
//       array.push({ text: `${name}`, callback: `%${name}面板` })
//       if (array.length > 2)
//         buttons.push([])
//     }
//     if (!buttons[0].length)
//       buttons[0] = [
//         { text: "更新面板", callback: `%更新面板` },
//         { text: "刷新访问凭据", callback: `#刷新访问凭据` },
//         {text:"练度统计",callback:"%练度统计"}
//       ]
//     //console.log("按钮构造",buttons)
//     //await this.reply([str,segment.button(...buttons)]);
//     let cfg = {retType: 'base64'}
//     const finalData = {
//       newChar: newChar.length,
//       list: result,
//     };
//       this.e.reply([await this.render( 'panel/refresh.html', finalData,cfg),segment.button(...buttons)])
//   }
//   async getCharPanelList() {
//     const uid = await this.getUID();
//     const result = getPanelList(uid);
//     if (!result) {
//       await this.reply('未找到面板数据，请手动键入%更新面板');
//       return false;
//     }
//     await this.getPlayerInfo();
//     const timer = setTimeout(() => {
//       if (this?.reply) {
//         this.reply('查询中，请稍后...');
//       }
//     }, 5000);
//     for (const item of result) {
//       await item.get_basic_assets();
//     }
//     clearTimeout(timer);
//     const finalData = {
//       count: result?.length || 0,
//       list: result,
//     };
//     await this.render('panel/list.html', finalData);
//   }
//   async getCharPanel() {
//     const uid = await this.getUID();
//     const reg = new RegExp(`${rulePrefix}(.+)面板$`);
//     const match = this.e.msg.match(reg);
//     if (!match) return false;
//     const name = match[4];
//     const data = getPanel(uid, name);
//     if (!data) {
//       await this.reply(`未找到面板信息，请确保你已经注册了【原神】并在机器人处完成了【#扫码登录】`);
//       return;
//     }
//     let handler = this.e.runtime.handler || {};
//
//     if (handler.has('zzz.tool.panel')) {
//       await handler.call('zzz.tool.panel', this.e, {
//         uid,
//         data: data,
//         needSave: false,
//       });
//     }
//     return false;
//   }
//
//   async getCharPanelTool(e, _data = {}) {
//     if (e) this.e = e;
//     if (e?.reply) this.reply = e.reply;
//
//     const {
//       uid = undefined,
//       data = undefined,
//       needSave = true,
//       reply = true,
//       needImg = true
//     } = _data;
//     if (!uid) {
//       await this.reply('UID为空');
//       return false;
//     }
//     if (!data) {
//       await this.reply('数据为空');
//       return false;
//     }
//     if (needSave) {
//       updatePanelData(uid, [data]);
//     }
//     const timer = setTimeout(() => {
//       const msg = '查询成功，正在下载图片资源，请稍候。'
//       if (this?.reply && needImg) {
//         this.reply(msg);
//       } else {
//         logger.mark(msg)
//       }
//     }, 5000);
//     const parsedData = formatPanelData(data);
//     await parsedData.get_detail_assets();
//     clearTimeout(timer);
//     const finalData = {
//       uid: uid,
//       charData: data,
//     };
//     // const image = needImg ? await this.render('panel/card.html', finalData, {
//     //   retType: 'base64',
//     // }) : needImg;
//
//     //await render(this.e, 'panel/card.html', finalData);
//
//     //console.log("角色名",finalData.charData.name_mi18n)
//     let role = finalData.charData.name_mi18n
//     let buts =[
//         [{text:'看看我的面板',callback:'%更新面板'}],
//         [{text:`${role}攻略`,callback:`%${role}攻略`},{text:`练度统计`,callback: `%练度统计`},
//           {text:`${role}图鉴`,callback:`%${role}图鉴`}],
//         [{text: `电量`,callback: `%体力`},{text: `签到`,callback:`%签到`},{text: `帮助`,callback:`%帮助`}],
//     ]
//       //let pic = await render(this.e, 'panel/card.html', finalData)
//     let cfg = {retType: 'base64'}
//
//       const res = await  this.e.reply([await this.render( 'panel/card.html', finalData,cfg),segment.button(...buts)])
//     if (res?.message_id && data.role_icon)
//       await redis.set(`ZZZ:PANEL:IMAGE:${res.message_id}`, data.role_icon, {
//         EX: 3600 * 3,
//       });
//       //  const res = await this.reply(image);
//       // if (res?.message_id)
//       // await redis.set(`ZZZ:PANEL:IMAGE:${res.message_id}`, data.role_icon, {
//       //   EX: 3600 * 3,
//       // });
//       // 备用
//     // console.log("e对象",this.e)
//     // console.log("终数据",finalData)
//     // console.log("角色名",role_name)
//   }
//   async proficiency() {
//     const uid = await this.getUID();
//     const result = getPanelList(uid);
//     if (!result) {
//       await this.reply('未找到面板数据，请手动键入【%更新面板】');
//       return false;
//     }
//     await this.getPlayerInfo();
//     result.sort((a, b) => {
//       return b.proficiency_score - a.proficiency_score;
//     });
//     const WeaponCount = result.filter(item => item?.weapon).length,
//       SWeaponCount = result.filter(
//         item => item?.weapon && item.weapon.rarity === 'S'
//       ).length;
//     const general = {
//       total: result.length,
//       SCount: result.filter(item => item.rarity === 'S').length,
//       SWeaponRate: (SWeaponCount / WeaponCount) * 100,
//       SSSCount: result.reduce((acc, item) => {
//         if (item.equip) {
//           acc += item.equip.filter(
//             equip => equip.comment === 'SSS' || equip.comment === 'ACE'
//           ).length;
//         }
//         return acc;
//       }, 0),
//       highRank: result.filter(item => item.rank > 4).length,
//     };
//     const timer = setTimeout(() => {
//       if (this?.reply) {
//         this.reply('查询中...请稍候。');
//       }
//     }, 5000);
//     for (const item of result) {
//       await item.get_small_basic_assets();
//     }
//     clearTimeout(timer);
//     const finalData = {
//       general,
//       list: result,
//     };
//     await this.render('proficiency/index.html', finalData);
//   }
//   async getCharOriImage() {
//     let source;
//     if (this.e.getReply) {
//       source = await this.e.getReply();
//     } else if (this.e.source) {
//       if (this.e.group?.getChatHistory) {
//         // 支持at图片添加，以及支持后发送
//         source = (
//           await this.e.group.getChatHistory(this.e.source?.seq, 1)
//         ).pop();
//       } else if (this.e.friend?.getChatHistory) {
//         source = (
//           await this.e.friend.getChatHistory(this.e.source?.time + 1, 1)
//         ).pop();
//       }
//     }
//     const id = source?.message_id;
//     if (!id) {
//       await this.reply('未找到消息源，请引用要查看的图片');
//       return false;
//     }
//     const image = await redis.get(`ZZZ:PANEL:IMAGE:${id}`);
//     if (!image) {
//       await this.reply('未找到原图');
//       return false;
//     }
//     await this.reply(segment.image(image));
//     return false;
//   }
//
// }
