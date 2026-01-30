import { mergePanel, getPanelList, refreshPanel as refreshPanelFunction, getPanelOrigin, updatePanelData, formatPanelData, getPanelListOrigin, } from '../lib/avatar.js';
import { parsePlayerInfo, refreshPanelFromEnka } from '../model/Enka/enkaApi.js';
import { rulePrefix } from '../lib/common.js';
import { ZZZPlugin } from '../lib/plugin.js';
import settings from '../lib/settings.js';
import { getCk } from '../lib/common.js';
import _ from 'lodash';
function resolveButtonAppid() {
    const candidates = [
        Bot?.config?.bot?.appid,
        Bot?.config?.appid,
        Bot?.appid,
        Bot?.apk?.appid,
    ];
    for (const v of candidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0)
            return n;
    }
    return 0;
}
function buildCommandKeyboard(rows, idPrefix) {
    if (typeof segment?.button !== 'function')
        return null;
    const appid = resolveButtonAppid();
    let idx = 0;
    const normalizedRows = rows
        .filter(r => Array.isArray(r) && r.length > 0)
        .map(r => ({
        buttons: r.map(({ label, data }) => {
            const id = `${idPrefix}_${idx++}`;
            return {
                id,
                render_data: {
                    label,
                    visited_label: label,
                    style: 1,
                },
                action: {
                    type: 2,
                    permission: { type: 2 },
                    data,
                    unsupport_tips: '客户端暂不支持按钮，请手动发送指令',
                    enter: true,
                },
            };
        }),
    }));
    if (!normalizedRows.length)
        return null;
    return segment.button({ appid, rows: normalizedRows });
}
function chunkButtons(items, perRow) {
    const rows = [];
    let row = [];
    for (const it of items) {
        row.push(it);
        if (row.length >= perRow) {
            rows.push(row);
            row = [];
        }
    }
    if (row.length)
        rows.push(row);
    return rows;
}
export class Panel extends ZZZPlugin {
    constructor() {
        super({
            name: '[ZZZ-Plugin]Panel',
            dsc: 'zzzpanel',
            event: 'message',
            priority: _.get(settings.getConfig('priority'), 'panel', 70),
            rule: [
                {
                    reg: `${rulePrefix}(.*)面板(展柜)?(刷新|更新|列表)?$`,
                    fnc: 'handleRule'
                },
                {
                    reg: `${rulePrefix}练度(统计)?$`,
                    fnc: 'proficiency'
                },
                {
                    reg: `${rulePrefix}原图$`,
                    fnc: 'getCharOriImage'
                }
            ],
            handler: [
                { key: 'zzz.tool.panel', fn: 'getCharPanelTool' },
                { key: 'zzz.tool.panelList', fn: 'getCharPanelListTool' }
            ]
        });
    }
    async handleRule() {
        if (!this.e.msg)
            return;
        const reg = new RegExp(`${rulePrefix}(.*?)(?:展柜)?面板(?:展柜)?(刷新|更新|列表)?$`);
        const match = this.e.msg.match(reg);
        if (!match)
            return false;
        const pre = match[4]?.trim();
        const suf = match[5]?.trim();
        if (['刷新', '更新'].includes(pre || '') || ['刷新', '更新'].includes(suf || ''))
            return await this.refreshPanel();
        if (!pre || suf === '列表')
            return await this.getCharPanelList();
        const queryPanelReg = new RegExp(`${rulePrefix}(.*)面板$`);
        if (queryPanelReg.test(this.e.msg))
            return await this.getCharPanel();
        return false;
    }
    async refreshPanel() {
        const uid = await this.getUID();
        const lastQueryTime = await redis.get(`ZZZ:PANEL:${uid}:LASTTIME`);
        const panelSettings = settings.getConfig('panel');
        const coldTime = _.get(panelSettings, 'interval', 300);
        if (lastQueryTime && Date.now() - Number(lastQueryTime) < 1000 * coldTime) {
            const msg = `${coldTime}秒内只能更新一次，请稍后再试`;
            const kb = buildCommandKeyboard([[{ label: '再试一下', data: '%更新面板' }]], 'panel_retry');
            return this.reply(kb ? [msg, kb] : msg);
        }
        const isEnka = this.e.msg.includes('展柜') || !(await getCk(this.e));
        let result = null;
        if (isEnka) {
            const data = await refreshPanelFromEnka(uid)
                .catch(err => err);
            if (data instanceof Error) {
                logger.warn(`Enka服务调用失败：`, data);
                return this.reply(`Enka服务调用失败：${data.message}`);
            }
            if (typeof data === 'object') {
                await redis.set(`ZZZ:PANEL:${uid}:LASTTIME`, Date.now());
                const { playerInfo, panelList } = data;
                if (!panelList.length) {
                    return this.reply('面板列表为空，请确保已于游戏中展示角色');
                }
                result = await mergePanel(uid, panelList);
                await this.getPlayerInfo(playerInfo);
            }
            else if (typeof data === 'number') {
                return this.reply(`Enka服务调用失败，状态码：${data}`);
            }
        }
        else {
            const oriReply = this.reply.bind(this);
            let errorMsg = '';
            this.reply = (msg) => {
                errorMsg += '\n' + msg;
                return Promise.resolve(null);
            };
            try {
                const { api, deviceFp } = await this.getAPI();
                await oriReply('正在更新面板列表，请稍候...');
                await this.getPlayerInfo();
                await redis.set(`ZZZ:PANEL:${uid}:LASTTIME`, Date.now());
                result = await refreshPanelFunction(api, deviceFp);
            }
            catch (err) {
                logger.error('面板列表更新失败：', err);
                errorMsg = (err.message || '') + errorMsg;
            }
            this.reply = oriReply;
            if (errorMsg && !result) {
                const msg = `面板列表更新失败，请稍后再试：\n${errorMsg.trim()}`;
                const kb = buildCommandKeyboard([[{ label: '再试一下', data: '%更新面板' }]], 'panel_refresh_fail');
                return this.reply(kb ? [msg, kb] : msg);
            }
        }
        if (!result)
            return false;
        const newChar = result.filter(item => item.isNew);
        const finalData = {
            newChar: newChar.length,
            list: result
        };
        const roleNames = (result || [])
            .map((it) => String(it?.name_mi18n || '').trim())
            .filter(Boolean);
        const roleBtns = roleNames.map(name => ({
            label: name,
            data: `%${name}面板`
        }));
        const rows = roleBtns.length
            ? chunkButtons(roleBtns, 3)
            : [
                [
                    { label: '更新面板', data: '%更新面板' },
                    { label: '展柜面板', data: '%更新展柜面板' },
                    { label: '练度统计', data: '%练度统计' }
                ]
            ];
        const kb = buildCommandKeyboard(rows, 'panel_refresh');
        const img = await this.render('panel/refresh.html', finalData, { retType: 'base64' });
        await this.reply(kb ? [img, kb] : img);
    }
    async getCharPanelList() {
        const uid = await this.getUID();
        const result = getPanelList(uid);
        if (!result.length) {
            return this.reply(`UID:${uid}无本地面板数据，请先%更新面板 或 %更新展柜面板`);
        }
        const hasCk = !!(await getCk(this.e));
        await this.getPlayerInfo(hasCk ? undefined : parsePlayerInfo({ uid }));
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
            list: result
        };
        const roleNames = (result || [])
            .map((it) => String(it?.name_mi18n || '').trim())
            .filter(Boolean);
        const roleBtns = roleNames.map(name => ({
            label: name,
            data: `%${name}面板`
        }));
        const rows = roleBtns.length
            ? chunkButtons(roleBtns, 3)
            : [
                [
                    { label: '更新面板', data: '%更新面板' },
                    { label: '展柜面板', data: '%更新展柜面板' },
                    { label: '练度统计', data: '%练度统计' }
                ]
            ];
        const kb = buildCommandKeyboard(rows, 'panel_list');
        const img = await this.render('panel/list.html', finalData, { retType: 'base64' });
        await this.reply(kb ? [img, kb] : img);
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
        if (!match)
            return false;
        const name = match[4];
        const data = getPanelOrigin(uid, name);
        if (data === false) {
            return this.reply(`角色${name}不存在，请确保角色名称/别称存在`);
        }
        else if (data === null) {
            return this.reply(`暂无角色${name}面板数据，请先%更新面板`);
        }
        const handler = this.e.runtime.handler || {};
        if (handler.has('zzz.tool.panel')) {
            await handler.call('zzz.tool.panel', this.e, {
                uid,
                data: data,
                needSave: false
            });
        }
    }
    async getCharPanelTool(e, _data = {}) {
        if (e)
            this.e = e;
        if (e?.reply)
            this.reply = e.reply;
        const { uid = undefined, data = undefined, needSave = true, reply = true, needImg = true } = _data;
        if (!uid) {
            return this.reply('UID为空');
        }
        if (!data) {
            return this.reply('数据为空');
        }
        if (needSave) {
            updatePanelData(uid, [data]);
        }
        const timer = setTimeout(() => {
            const msg = '查询成功，正在下载图片资源，请稍候。';
            if (this?.reply && needImg) {
                this.reply(msg);
            }
            else {
                logger.mark(msg);
            }
        }, 5000);
        const parsedData = formatPanelData(data);
        await parsedData.get_detail_assets();
        clearTimeout(timer);
        const finalData = {
            uid,
            charData: parsedData
        };
        const image = needImg ? await this.render('panel/card.html', finalData, {
            retType: 'base64'
        }) : needImg;
        if (reply) {
            const role = String(parsedData?.name_mi18n || '').trim();
            const rows = [
                [
                    { label: '更新面板', data: '%更新面板' },
                    { label: '展柜面板', data: '%更新展柜面板' },
                ],
                role
                    ? [
                        { label: `${role}攻略`, data: `%${role}攻略` },
                        { label: '练度统计', data: '%练度统计' },
                        { label: `${role}图鉴`, data: `%${role}图鉴` },
                    ]
                    : [{ label: '练度统计', data: '%练度统计' }],
                [
                    { label: '电量', data: '%体力' },
                    { label: '签到', data: '#签到' },
                    { label: '帮助', data: '%帮助' },
                ],
            ];
            const kb = buildCommandKeyboard(rows, 'panel_card');
            const res = await this.reply(kb ? [image, kb] : image);
            if (res?.message_id && parsedData.role_icon)
                await redis.set(`ZZZ:PANEL:IMAGE:${res.message_id}`, parsedData.role_icon, {
                    EX: 3600 * 3
                });
            return {
                message: res,
                image
            };
        }
        return image;
    }
    async proficiency() {
        const uid = await this.getUID();
        const result = getPanelList(uid);
        if (!result) {
            return this.reply('未找到面板数据，请先%更新面板 或 %更新展柜面板');
        }
        await this.getPlayerInfo();
        result.sort((a, b) => {
            return b.proficiency_score - a.proficiency_score;
        });
        const WeaponCount = result.filter(item => item?.weapon).length;
        const SWeaponCount = result.filter(item => item?.weapon && item.weapon.rarity === 'S').length;
        const general = {
            total: result.length,
            SCount: result.filter(item => item.rarity === 'S').length,
            SWeaponRate: (SWeaponCount / WeaponCount) * 100,
            SSSCount: result.reduce((acc, item) => {
                if (item.equip) {
                    acc += item.equip.filter(equip => ['SSS', 'ACE', 'MAX'].includes(String(equip.comment))).length;
                }
                return acc;
            }, 0),
            highRank: result.filter(item => item.rank > 4).length
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
            list: result
        };
        await this.render('proficiency/index.html', finalData);
    }
    async getCharOriImage() {
        let source;
        if (this.e.getReply) {
            source = await this.e.getReply();
        }
        else if (this.e.source) {
            if (this.e.group?.getChatHistory) {
                source = (await this.e.group.getChatHistory(this.e.source?.seq, 1)).pop();
            }
            else if (this.e.friend?.getChatHistory) {
                source = (await this.e.friend.getChatHistory(this.e.source?.time + 1, 1)).pop();
            }
        }
        const id = source?.message_id;
        if (!id) {
            return this.reply('未找到消息源，请引用要查看的图片');
        }
        const image = await redis.get(`ZZZ:PANEL:IMAGE:${id}`);
        if (!image) {
            return this.reply('未找到原图');
        }
        await this.reply(segment.image(image));
    }
}
//# sourceMappingURL=panel.js.map