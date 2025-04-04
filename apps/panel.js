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
import { getZzzEnkaData } from '../lib/ekapi/query.js'
import { _enka_data_to_mys_data } from '../lib/ekapi/enka_to_mys.js'
import { ZZZAvatarInfo } from '../model/avatar.js'

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
    this.uid = uid
    let playerInfo = null;
    let finalResultList = null;
    try {
      playerInfo = await this.getPlayerInfo();
      if (!playerInfo) playerInfo = this.e.player;
      if (!playerInfo) {
          playerInfo = { uid: uid, nickname: `用户${uid}`, level: '??', region_name: '未知服务器' };
      }
    } catch (playerInfoError) {
        playerInfo = { uid: uid, nickname: `用户${uid}`, level: '??', region_name: '错误', error: playerInfoError.message };
    }

    this.result = null;
    const useEnka = _.get(settings.getConfig('panel'), 'useEnka', true);
    logger.debug(`[panel.js] useEnka 设置值: ${useEnka}`);
    if (!useEnka && this.e.runtime.hasCk) {
      console.log('this.e.runtime.hasCk',this.e.runtime.hasCk)
      try {
          const { api } = await this.getAPI(); // MYS 需要 api 对象
          // MYS 逻辑需要冷却判断
          const lastQueryTime = await redis.get(`ZZZ:PANEL:${uid}:LASTTIME`);
          const panelSettings = settings.getConfig('panel');
          const coldTime = _.get(panelSettings, 'interval', 300);
          if (lastQueryTime && Date.now() - lastQueryTime < 1000 * coldTime) {
              await this.reply(`${coldTime}秒内只能刷新一次，请稍后再试`);
              return false;
          }
          await redis.set(`ZZZ:PANEL:${uid}:LASTTIME`, Date.now());
          await this.reply('正在刷新面板列表 (MYS API)，请稍候...');
          finalResultList = await refreshPanelFunction(api);
         if (!finalResultList || !Array.isArray(finalResultList)) {
             if (finalResultList === null || finalResultList === false) throw new Error('MYS API refreshPanelFunction 未返回有效结果');
             if (finalResultList.length === 0) logger.mark(`[panel.js] MYS API for UID ${uid} returned an empty list.`);
        }
      } catch (mysError) {
          logger.error(' MYS API 刷新出错:', mysError);
          finalResultList = await this.refreshByEnka();
      }

    } else {
      finalResultList = await this.refreshByEnka(); // <--- 赋值给局部变量
    }

    const currentResult = finalResultList;

    const newCharCount = (currentResult.length > 0 && currentResult[0]?.isNew !== undefined)
                         ? currentResult.filter(item => item && item.isNew).length
                         : 0;
    const finalData = {
      newChar: newCharCount,
      list: currentResult,
      player: playerInfo,
      uid: uid
    };

    try {
        await this.render('panel/refresh.html', finalData);
    } catch (renderError) {
        logger.error('[panel.js] 渲染 refresh.html 模板失败:', renderError);
        await this.reply(`生成刷新结果图片时出错: ${renderError.message}`);
    }
  }
  //
  // async refreshByEnka(){
  //   //enka兜底 todo:数据转换修正..
  //     logger.debug('[panel.js] 进入 Enka 逻辑块');
  //     try {
  //       const enkaData = await getZzzEnkaData(this.uid);
  //       if (!enkaData || enkaData === -1 || !enkaData.PlayerInfo) { throw new Error('获取或验证 Enka 数据失败'); }
  //       this.result = await _enka_data_to_mys_data(enkaData);
  //       return this.result;
  //     } catch (enkaError) {
  //        logger.error('处理 Enka 逻辑时出错:', enkaError);
  //        await this.reply(`处理Enka数据时出错: ${enkaError.message}`);
  //        return false;
  //     }
  // }

  async refreshByEnka() {
    logger.debug('[panel.js] 进入 Enka 逻辑块');
    try {
        // 1. 获取 Enka 数据
        const enkaData = await getZzzEnkaData(this.uid);
       if (!enkaData || enkaData === -1 || !enkaData.PlayerInfo) {
  throw new Error('获取或验证 Enka 数据失败');
}
        // 2. 转换 Enka 数据为 "新数据" 格式
        const convertedNewData = await _enka_data_to_mys_data(enkaData);
        if (!Array.isArray(convertedNewData)) {
            logger.error('[panel.js] Enka 数据转换 (_enka_data_to_mys_data) 后结果非数组:', convertedNewData);
            throw new Error('Enka 数据转换失败或结果格式不正确');
        }
        logger.mark(`[panel.js] Enka 数据转换完成，得到 ${convertedNewData.length} 条新记录.`);

        // 3. 调用 updatePanelData 进行合并、保存，并获取合并后的完整数据
        //    *** 关键：假设 updatePanelData 内部处理合并逻辑并返回合并结果 ***
        const finalMergedData = updatePanelData(this.uid, convertedNewData);
        if (!finalMergedData || !Array.isArray(finalMergedData)) {
             logger.error(`[panel.js] updatePanelData (called by Enka path) 未返回有效的合并后数组 for UID ${this.uid}`);
             throw new Error('数据合并或保存后未能返回有效列表');
        }
        logger.mark(`[panel.js] Enka 数据通过 updatePanelData 合并保存完成，合并后总 ${finalMergedData.length} 条.`);

        // 4. 格式化合并后的数据
        const formattedData = finalMergedData.map(item => new ZZZAvatarInfo(item));

        // 5. 加载基础资源 (可选，但为了与 MYS 版本一致)
        // 注意：如果资源加载很慢，可能会增加 Enka 路径的耗时
        logger.debug(`[panel.js] Enka path: 开始为 ${formattedData.length} 个角色加载基础资源...`);
        for (const item of formattedData) {
            await item.get_basic_assets();
        }
        logger.debug('[panel.js] Enka path: 基础资源加载完成.');


        // 6. 返回格式化后的完整列表
        return formattedData;

    } catch (enkaError) {
        logger.error(`[panel.js] 处理 Enka 逻辑 (refreshByEnka) 时出错 for UID ${this.uid}:`, enkaError);
        // 不在此处 reply，让调用者处理
        return false; // 返回 false 表示失败
    }
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
      const res = await this.reply(image);
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
            equip => equip.comment === 'SSS' || equip.comment === 'ACE'
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
