// // enka_to_mys.js (完整版本，包含常量和辅助函数定义)
//
// import {
//     equip_data,
//     weapon_data,
//     partner_data,
//     PartnerId2SkillParam,
//     get_char_circle_icon_url // 从 name_convert.js 导入
//     // 注意：假设 ID_TO_EN, ID_TO_PROP_NAME, MAIN_PROP_VALUE, PERCENT_ID, PERCENT_ID_LIST 也是从 name_convert.js 导入
//     // 如果它们原本是在 enka_to_mys.js 中定义的，你需要将它们的定义移回这里或保持导入
// } from './name_convert.js';
// import _ from 'lodash';
//
// // --- Logger Setup (根据你的项目替换) ---
// const logger = console;
//
// // --- 数据有效性检查 ---
// if (typeof partner_data === 'undefined' || Object.keys(partner_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: partner_data is undefined or empty!"); }
// if (typeof PartnerId2SkillParam === 'undefined') { PartnerId2SkillParam = {}; logger.warn("[enka_to_mys.js] WARNING: PartnerId2SkillParam is undefined."); }
// if (typeof equip_data === 'undefined') { equip_data = {}; logger.warn("[enka_to_mys.js] WARNING: equip_data is undefined."); }
// if (typeof weapon_data === 'undefined') { weapon_data = {}; logger.warn("[enka_to_mys.js] WARNING: weapon_data is undefined."); }
// // 检查从 name_convert.js 导入的常量
// // (如果这些常量是在此文件定义的，则不需要这些检查)
// // if (typeof ID_TO_EN === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: ID_TO_EN is undefined!"); }
// // if (typeof ID_TO_PROP_NAME === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: ID_TO_PROP_NAME is undefined!"); }
// // if (typeof MAIN_PROP_VALUE === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: MAIN_PROP_VALUE is undefined!"); }
// // if (typeof PERCENT_ID === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: PERCENT_ID is undefined!"); }
// // if (typeof PERCENT_ID_LIST === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: PERCENT_ID_LIST is undefined!"); }
//
//
// // --- 常量定义 (如果它们不从 name_convert.js 导入) ---
// // 注意：根据你的项目结构，这些常量可能在 name_convert.js 中定义并导出
// const ID_TO_PROP_NAME = {
//     '11101': '生命值', '11103': '生命值', '11102': '生命值百分比', '12101': '攻击力', '12103': '攻击力', '12102': '攻击力百分比',
//     '13101': '防御力', '13103': '防御力', '13102': '防御力百分比', '12203': '冲击力', '20103': '暴击率', '21103': '暴击伤害',
//     '31402': '异常掌控', '31403': '异常掌控', '31202': '异常精通', '31203': '异常精通', '23103': '穿透率', '23203': '穿透值',
//     '30503': '能量自动回复', '30502': '能量回复百分比', // 保持与Python名称一致
//     '31503': '物理伤害加成', '31603': '火属性伤害加成', '31703': '冰属性伤害加成', '31803': '雷属性伤害加成', '31903': '以太属性伤害加成',
//     '12202': '冲击力', // 另一个冲击力ID？
// };
// const MYSAPI_PROP_ID = { // 米游社API使用的属性ID映射
//     '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
//     '穿透率': 9, '能量自动回复': 11, '能量回复百分比': 11, '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317,
//     '雷属性伤害加成': 318, '以太属性伤害加成': 319, '生命值百分比': 0, '攻击力百分比': 0, '防御力百分比': 0, // 百分比在MYS API中可能不直接显示或ID不同
// };
// const ID_TO_EN = { // 内部ID到英文键名的映射
//     '11101': 'HpMax', '11103': 'HpBase', '11102': 'HpAdd', '12101': 'Attack', '12103': 'AttackBase', '12102': 'AttackAdd',
//     '13101': 'Defence', '13103': 'DefenceBase', '13102': 'DefenceAdd', '12203': 'BreakStun', '20103': 'Crit', '21103': 'CritDmg',
//     '31402': 'ElementAbnormalPower', '31403': 'ElementAbnormalPower', '31202': 'ElementMystery', '31203': 'ElementMystery', '23103': 'PenRate', '23203': 'PenDelta',
//     '30503': 'SpRecover', '30502': 'SpRecover', '31503': 'PhysDmgBonus', '31603': 'FireDmgBonus', '31703': 'IceDmgBonus',
//     '31803': 'ThunderDmgBonus', '31903': 'EtherDmgBonus', '12202': 'BreakStun',
// };
// const MAIN_PROP_VALUE = { // 驱动盘主属性每阶提升值
//     '11101': 330, '11103': 330, '11102': 330, // 生命值, 生命值, 生命值%
//     '12101': 47.4, '12103': 47.4, '12102': 450, // 攻击力, 攻击力, 攻击力%
//     '13101': 27.6, '13103': 27.6, '13102': 720, // 防御力, 防御力, 防御力%
//     '12203': 270, // 冲击力
//     '20103': 360, // 暴击率
//     '21103': 720, // 暴击伤害
//     '31402': 450, '31403': 450, // 异常掌控
//     '31202': 13, '31203': 13,   // 异常精通
//     '23103': 360, // 穿透率
//     '23203': 36,  // 穿透值
//     '30503': 900, '30502': 900, // 能量自动回复, 能量回复% (注意：这里的值可能是原始值*10000?)
//     '31503': 450, // 物理伤害加成
//     '31603': 450, // 火属性伤害加成
//     '31703': 450, // 冰属性伤害加成
//     '31803': 450, // 雷属性伤害加成
//     '31903': 450, // 以太属性伤害加成
//     '12202': 0,   // 另一个冲击力ID? 假设不增加
// };
// const PERCENT_ID = [ // 定义哪些ID本质上是百分比，用于_get_value_str_py_mimic
//     '11102', '12102', '13102', // HP%, ATK%, DEF%
//     '20103', // Crit Rate
//     '21103', // Crit DMG
//     '23103', // PEN Rate
//     '31503', '31603', '31703', '31803', '31903', // Element DMG Bonuses
//     //'12203', // 冲击力通常不是百分比？从日志看不需要加%
//     '30503', '30502', // Energy Regen Rate / %
//     '31402', '31403', // Anomaly Control (通常是固定值, 但面板显示%?) - 确认游戏内显示
// ];
// const PERCENT_ID_LIST = [ // 用于最终面板格式化的百分比ID列表
//     ...PERCENT_ID,
//     // 添加其他可能需要显示为百分比的属性ID
// ];
//
// // --- 派生常量 ---
// const EN_TO_ZH = {}; // 英文键名到中文名称的映射
// if (ID_TO_EN && ID_TO_PROP_NAME) {
//     for (const id in ID_TO_EN) { if (ID_TO_PROP_NAME[id]) { EN_TO_ZH[ID_TO_EN[id]] = ID_TO_PROP_NAME[id]; } }
//     EN_TO_ZH['HpAdd'] = '生命值百分比'; EN_TO_ZH['AttackAdd'] = '攻击力百分比'; EN_TO_ZH['DefenceAdd'] = '防御力百分比';
// } else {
//     logger.error("[enka_to_mys.js] Cannot create EN_TO_ZH mapping due to missing dependencies.");
// }
//
// const ELEMENT_TO_EN = { // 游戏内元素ID到英文名称
//     '203': 'Thunder', // 雷
//     '205': 'Ether',   // 以太
//     '202': 'Ice',     // 冰
//     '200': 'Phys',    // 物理
//     '201': 'Fire',    // 火
// };
//
//
// // --- 辅助函数定义 ---
//
// // 模拟Python为驱动盘词条生成显示字符串（基于词条等级/强化次数）
// function _get_value_str_py_mimic(value, prop_level, prop_id, is_main_r = false) {
//     const idStr = String(prop_id);
//     let calculatedValue = Number(value) || 0;
//
//     if (!ID_TO_PROP_NAME[idStr]) {
//         logger.warn(`[enka_to_mys.js][_get_value_str_py_mimic] Unknown prop_id for formatting: ${prop_id}`);
//         return String(Math.floor(calculatedValue)); // 未知ID回退
//     }
//
//     try {
//         if (is_main_r) {
//             const increase = MAIN_PROP_VALUE[idStr] ?? 0;
//             calculatedValue += increase * 1 * prop_level; // 主词条: 基础值 + 每阶提升 * 阶数 (这里prop_level是阶数)
//         } else {
//             calculatedValue = value * prop_level; // 副词条: 每跳数值 * 跳数 (这里prop_level是跳数)
//         }
//
//         // 检查是否是百分比ID
//         if (PERCENT_ID.includes(idStr)) {
//             return (calculatedValue / 100).toFixed(1) + '%'; // 除以100并保留一位小数
//         } else {
//             return String(Math.floor(calculatedValue)); // 固定值取整
//         }
//     } catch (e) {
//         logger.error(`[enka_to_mys.js][_get_value_str_py_mimic] Error formatting: val=${value}, lvl=${prop_level}, id=${prop_id}, main=${is_main_r}`, e);
//         return 'ERR';
//     }
// }
//
// // 格式化音擎/驱动盘主副属性的原始值用于显示（非roll数计算）
// function formatEquipWeaponPropValue(value, prop_id) {
//     const idStr = String(prop_id);
//     const isPercentProp = PERCENT_ID_LIST.includes(idStr); // 使用更广泛的列表判断是否加%
//     const numericValue = Number(value);
//     if (value === undefined || value === null || isNaN(numericValue)) {
//         return isPercentProp ? '0.0%' : '0'; // 未定义或非数字，按类型给默认值
//     }
//     try {
//         if (isPercentProp) {
//             // 假设传入的 value 是原始值 (例如, 800 代表 8.0%)
//             return (numericValue / 100).toFixed(1) + '%'; // 除以100显示为百分比
//         } else {
//             return String(Math.floor(numericValue)); // 固定值取整
//         }
//     } catch (e) {
//         logger.error(`[enka_to_mys.js][formatEquipWeaponPropValue] Error formatting E/W prop value ${value} for ${prop_id}:`, e);
//         return '0'; // 出错时返回0
//     }
// }
//
// // 计算音擎在特定等级和突破等级下的主副属性值
// function render_weapon_detail(weapon_meta, weapon_level, weapon_break_level) {
//     // 检查 weapon_meta 和必要字段是否存在
//     if (!weapon_meta || weapon_meta.props_value === undefined || !weapon_meta.level || !weapon_meta.stars) {
//         logger.warn(`[render_weapon_detail] Invalid weapon metadata for ID ${weapon_meta?.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
//         return [0, 0]; // 返回 [基础属性值, 随机属性值]
//     }
//
//     const levelData = weapon_meta.level?.[String(weapon_level)]; // 获取等级对应的数据
//     const starData = weapon_meta.stars?.[String(weapon_break_level)]; // 获取突破等级对应的数据 (ZZZ里break_level对应stars)
//
//     // 检查等级和突破数据是否存在
//     if (!levelData || !starData) {
//         logger.warn(`[render_weapon_detail] Missing level/break data for weapon ${weapon_meta.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
//         return [0, 0];
//     }
//
//     // 计算主属性值
//     let base_value = Number(weapon_meta.props_value) || 0; // 音擎基础主属性值
//     // 应用等级和突破的加成率 (Rate/10000 和 StarRate/10000 是百分比)
//     base_value = base_value + base_value * (((Number(levelData.Rate) || 0) + (Number(starData.StarRate) || 0)) / 10000);
//
//     // 计算随机属性（副属性）值
//     let rand_value = Number(weapon_meta.rand_props_value) || 0; // 音擎基础副属性值
//     // 仅当基础副属性值 > 0 且突破数据中有 RandRate 时才计算加成
//     if (rand_value > 0 && starData.RandRate !== undefined) {
//         rand_value = rand_value + rand_value * ((Number(starData.RandRate) || 0) / 10000);
//     } else {
//         rand_value = 0; // 如果没有基础副属性或没有突破加成率，则副属性值为0
//     }
//
//     // 返回计算后的主副属性值（取整）
//     return [Math.floor(base_value), Math.floor(rand_value)];
// }
//
// // 计算角色在特定等级和突破等级下的基础属性（不含武器和驱动盘）
// function _calculate_char_base_stat(base_val, growth_val, level_data, extra_level_data, char_level, promotion_level, stat_key_in_promo, extra_key_id) {
//     let final_value = Number(base_val) || 0; // 角色1级基础值
//     char_level = Number(char_level) || 1;
//     growth_val = Number(growth_val) || 0; // 成长值 (需要除以10000)
//     promotion_level = Number(promotion_level) || 0; // 突破等级 (0-6)
//
//     // 1. 基于等级的成长加成
//     if (char_level > 1) {
//         final_value += (char_level - 1) * growth_val / 10000;
//     }
//
//     // 2. 突破等级带来的固定加成 (来自 Level 字段)
//     const promoStr = String(promotion_level);
//     if (level_data?.[promoStr]?.[stat_key_in_promo] !== undefined) {
//         final_value += Number(level_data[promoStr][stat_key_in_promo]) || 0;
//     }
//
//     // 3. 核心强化带来的属性加成 (来自 ExtraLevel 字段)
//     // extra_key_id 是该属性在 ExtraLevel 中对应的数字ID (例如 11101 代表生命值)
//     if (extra_level_data && extra_level_data[promoStr] && extra_level_data[promoStr].Extra && extra_key_id) {
//         const extraValue = _.get(extra_level_data[promoStr], ['Extra', String(extra_key_id), 'Value'], 0);
//         final_value += Number(extraValue) || 0;
//     }
//
//     return Math.floor(final_value); // 返回最终计算的基础属性值（取整）
// }
//
// // 格式化最终面板属性值（用于最终展示）
// function formatFinalPanelPropValue(value, prop_id) {
//     const idStr = String(prop_id);
//     const isPercentProp = PERCENT_ID_LIST.includes(idStr); // 使用较宽泛的列表判断
//     const numericValue = Number(value);
//
//     if (value === undefined || value === null || isNaN(numericValue)) {
//         return isPercentProp ? '0.0%' : '0'; // 默认值
//     }
//
//     try {
//         if (isPercentProp) {
//             // 能量回复特殊处理，显示为 1.xx
//             if (idStr === '30503' || idStr === '30502') {
//                 // 假设传入的 value 是原始值 * 100，例如 12000 代表 1.20
//                 return (numericValue / 10000).toFixed(2);
//             } else {
//                 // 其他百分比，假设传入的 value 是原始值 * 100，例如 820 代表 8.2%
//                 return (numericValue / 100).toFixed(1) + '%';
//             }
//         } else {
//             // 固定值直接取整
//             return String(Math.floor(numericValue));
//         }
//     } catch (e) {
//         logger.error(`[enka_to_mys.js][formatFinalPanelPropValue] Error formatting Final prop value ${value} for ${prop_id}:`, e);
//         return '0'; // 出错返回0
//     }
// }
//
//
// // --- 主转换函数 ---
// export async function _enka_data_to_mys_data(enka_data) {
//     // 检查输入数据有效性
//     if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
//         logger.error("[enka_to_mys.js] Invalid enka_data structure or empty AvatarList.");
//         return []; // 返回空数组表示失败
//     }
//
//     const uid = enka_data.uid; // 获取UID
//     const result_list = []; // 初始化结果列表
//
//     // 遍历 Enka 数据中的每个角色
//     for (const char of enka_data.PlayerInfo.ShowcaseDetail.AvatarList) {
//         try {
//             // --- 0. 初始化和基础信息 ---
//             if (!char || typeof char.Id === 'undefined') {
//                 logger.warn("[enka_to_mys.js] Skipping invalid character entry.");
//                 continue; // 跳过无效的角色条目
//             }
//             const char_id = String(char.Id); // 角色ID转为字符串
//             const _partner = partner_data[char_id]; // 获取角色基础数据
//             if (!_partner) {
//                 logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing partner_data.`);
//                 continue; // 如果找不到角色数据则跳过
//             }
//
//             // 获取角色圆形图标URL
//             const characterIconUrl = get_char_circle_icon_url(char_id) ?? '';
//             if (!characterIconUrl && _partner) {
//                 logger.warn(`[enka_to_mys.js] Char ID ${char_id}: Could not generate icon URL.`);
//             }
//
//             // 初始化米游社格式的角色对象结构
//             const result = {
//                 id: char.Id,
//                 level: char.Level || 1,
//                 name_mi18n: _partner.name ?? `角色${char_id}`, // 短名称
//                 full_name_mi18n: _partner.full_name ?? _partner.name ?? `角色${char_id}`, // 全名
//                 element_type: parseInt(_partner.ElementType) || 0, // 主元素类型
//                 sub_element_type: parseInt(_partner.sub_element_type) || 0, // 副元素类型（如果有）
//                 camp_name_mi18n: _partner.Camp ?? '?', // 阵营
//                 avatar_profession: parseInt(_partner.WeaponType) || 0, // 职业/武器类型
//                 rarity: _partner.Rarity ?? 'A', // 稀有度 (A/S)
//                 group_icon_path: characterIconUrl, // 圆形图标
//                 hollow_icon_path: characterIconUrl, // 空心图标（可能与圆形相同）
//                 equip: [], // 驱动盘列表
//                 weapon: null, // 音擎对象
//                 properties: [], // 最终面板属性列表
//                 skills: [], // 技能列表
//                 rank: char.TalentLevel || 0, // 核心强化等级 (0-6)
//                 ranks: [], // 核心强化详细信息
//             };
//
//             // --- 1. 初始化属性累加器 ---
//             const props = {}; // 存储计算过程中的属性值
//             // 初始化所有可能的属性为0
//             Object.values(ID_TO_EN).forEach(enKey => { props[enKey] = 0; });
//             // 显式初始化百分比累加器
//             props.HpAdd = 0;
//             props.AttackAdd = 0;
//             props.DefenceAdd = 0;
//
//             // 用于存储“真实基础值”（角色基础+音擎基础）的变量
//             let trueBaseHP = 0;
//             let trueBaseATK = 0;
//             let trueBaseDEF = 0;
//
//             // --- 2. 计算并累加角色基础属性 ---
//             logger.debug(`[DEBUG][${char_id}] Calculating base stats for Level ${char.Level}, Promo ${char.PromotionLevel}`);
//             const NAME_TO_ID = Object.fromEntries(Object.entries(ID_TO_PROP_NAME).map(([id, name]) => [name, id])); // 用于查找核心强化对应的属性ID
//
//             // 计算角色自身的基础 HP, ATK, DEF (考虑等级、突破、核心强化)
//             const charBaseHP = _calculate_char_base_stat(_partner.HpMax, _partner.HpGrowth, _partner.Level, _partner.ExtraLevel, char.Level, char.PromotionLevel, 'HpMax', NAME_TO_ID['生命值']);
//             const charBaseATK = _calculate_char_base_stat(_partner.Attack, _partner.AttackGrowth, _partner.Level, _partner.ExtraLevel, char.Level, char.PromotionLevel, 'Attack', NAME_TO_ID['攻击力']);
//             const charBaseDEF = _calculate_char_base_stat(_partner.Defence, _partner.DefenceGrowth, _partner.Level, _partner.ExtraLevel, char.Level, char.PromotionLevel, 'Defence', NAME_TO_ID['防御力']);
//
//             // 累加到“真实基础值”和运行总和
//             trueBaseHP += charBaseHP;
//             trueBaseATK += charBaseATK;
//             trueBaseDEF += charBaseDEF;
//             props.HpMax += charBaseHP;
//             props.Attack += charBaseATK;
//             props.Defence += charBaseDEF;
//
//             // 累加其他角色自带的基础属性 (暴击、爆伤、冲击、异常、能量等)
//             props.Crit += (_partner.Crit || 500); // 基础暴击率 5.0%
//             props.CritDmg += (_partner.CritDamage || 5000); // 基础暴击伤害 50.0%
//             props.BreakStun += (_partner.BreakStun || 0); // 基础冲击力
//             props.ElementMystery += (_partner.ElementMystery || 0); // 基础异常精通
//             props.ElementAbnormalPower += (_partner.ElementAbnormalPower || 0); // 基础异常掌控
//             props.SpRecover += (_partner.SpRecover || 12000); // 基础能量回复 (1.20/s = 12000)
//
//             logger.debug(`[DEBUG][${char_id}] Initial Char Base: HP=${charBaseHP}, ATK=${charBaseATK}, DEF=${charBaseDEF}`);
//             logger.debug(`[DEBUG][${char_id}] Props after char base:`, JSON.stringify(props));
//
//             // --- 3. 计算并累加音擎属性 ---
//             let weaponBaseHP = 0; // 音擎提供的基础生命（通常为0）
//             let weaponBaseATK = 0; // 音擎提供的主属性攻击力
//             let weaponBaseDEF = 0; // 音擎提供的基础防御（通常为0）
//
//             if (char.Weapon?.Id) {
//                 const weapon_id = String(char.Weapon.Id);
//                 const _weapon_meta = weapon_data[weapon_id];
//                 if (_weapon_meta) {
//                     const weapon_level = char.Weapon.Level || 1;
//                     const weapon_star = char.Weapon.UpgradeLevel || 0; // 音擎阶级 (0-4 对应 MYS 1-5星)
//                     const weapon_break_level = char.Weapon.BreakLevel || 0; // 音擎突破等级 (0-5)
//                     logger.debug(`[DEBUG][${char_id}] Processing Weapon ID ${weapon_id}, Level ${weapon_level}, Star ${weapon_star}, Break ${weapon_break_level}`);
//
//                     // 获取计算后的音擎主、副属性值
//                     const [base_stat_value_raw, rand_stat_value_raw] = render_weapon_detail(_weapon_meta, weapon_level, String(weapon_break_level));
//
//                     // 处理音擎主属性
//                     const base_prop_id_str = String(_weapon_meta.props_id);
//                     const base_en_prop = ID_TO_EN[base_prop_id_str];
//                     const base_prop_zh = ID_TO_PROP_NAME[base_prop_id_str] || `?(${base_prop_id_str})`;
//
//                     if (base_en_prop && props[base_en_prop] !== undefined) {
//                         logger.debug(`[DEBUG][${char_id}] Weapon Main Stat: ${base_prop_zh} (${base_prop_id_str}), Value: ${base_stat_value_raw}`);
//                         props[base_en_prop] += base_stat_value_raw; // 累加到运行总和
//
//                         // 累加到“真实基础值”
//                         if (base_prop_id_str === '11101' || base_prop_id_str === '11103') trueBaseHP += base_stat_value_raw; // 假设11103也是基础HP
//                         else if (base_prop_id_str === '12101' || base_prop_id_str === '12103') trueBaseATK += base_stat_value_raw;
//                         else if (base_prop_id_str === '13101' || base_prop_id_str === '13103') trueBaseDEF += base_stat_value_raw;
//                     } else {
//                         logger.warn(`[enka_to_mys.js] Unknown EN mapping or key missing for weapon main prop ID ${base_prop_id_str}`);
//                     }
//
//                     // 处理音擎副属性 (随机属性)
//                     if (_weapon_meta.rand_props_id && rand_stat_value_raw > 0) {
//                         const rand_prop_id_str = String(_weapon_meta.rand_props_id);
//                         const rand_en_prop = ID_TO_EN[rand_prop_id_str];
//                         const rand_prop_zh = ID_TO_PROP_NAME[rand_prop_id_str] || `?(${rand_prop_id_str})`;
//
//                         if (rand_en_prop) {
//                             logger.debug(`[DEBUG][${char_id}] Weapon Rand Stat: ${rand_prop_zh} (${rand_prop_id_str}), Value: ${rand_stat_value_raw}`);
//                             // 根据属性ID累加到对应的百分比或固定值累加器
//                             if (rand_prop_id_str === '11102') props.HpAdd += rand_stat_value_raw;
//                             else if (rand_prop_id_str === '12102') props.AttackAdd += rand_stat_value_raw;
//                             else if (rand_prop_id_str === '13102') props.DefenceAdd += rand_stat_value_raw;
//                             else if (props[rand_en_prop] !== undefined) {
//                                 props[rand_en_prop] += rand_stat_value_raw; // 其他属性（如暴击率、爆伤等）直接累加
//                             } else {
//                                 logger.warn(`[enka_to_mys.js] Prop key ${rand_en_prop} undefined during weapon rand stat accumulation.`);
//                             }
//                         } else {
//                             logger.warn(`[enka_to_mys.js] Unknown EN mapping or key missing for weapon rand prop ID ${rand_prop_id_str}`);
//                         }
//                     }
//
//                     // 构建用于结果的 weapon 对象
//                     result.weapon = {
//                         id: char.Weapon.Id,
//                         level: weapon_level,
//                         name: _weapon_meta.name || `武器 ${weapon_id}`,
//                         star: weapon_star + 1, // MYS 星级是 1-5
//                         icon: _weapon_meta.IconPath ?? '',
//                         rarity: _weapon_meta.rarity ?? 'A',
//                         properties: [], // 副属性
//                         main_properties: [], // 主属性
//                         talent_title: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Name'], ''), // 获取对应阶级的天赋名称
//                         talent_content: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Desc'], ''), // 获取对应阶级的天赋描述
//                         profession: parseInt(_partner.WeaponType) || 0, // 武器类型/职业
//                     };
//                     // 添加格式化后的主副属性到 weapon 对象
//                     result.weapon.main_properties.push({ property_name: base_prop_zh, property_id: _weapon_meta.props_id, base: formatEquipWeaponPropValue(base_stat_value_raw, base_prop_id_str) });
//                     if (_weapon_meta.rand_props_id && rand_stat_value_raw > 0) {
//                          const rand_prop_id_str_disp = String(_weapon_meta.rand_props_id);
//                          const rand_prop_zh_disp = ID_TO_PROP_NAME[rand_prop_id_str_disp] || `?(${rand_prop_id_str_disp})`;
//                         result.weapon.properties.push({ property_name: rand_prop_zh_disp, property_id: _weapon_meta.rand_props_id, base: formatEquipWeaponPropValue(rand_stat_value_raw, rand_prop_id_str_disp) });
//                     }
//
//                 } else {
//                     logger.warn(`[enka_to_mys.js] Weapon metadata missing for ID: ${weapon_id}`);
//                 }
//                 logger.debug(`[DEBUG][${char_id}] True Base after weapon: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
//                 logger.debug(`[DEBUG][${char_id}] Props after weapon:`, JSON.stringify(props));
//             } else {
//                 logger.warn(`[enka_to_mys.js][${char_id}] No weapon data found in Enka payload.`);
//             }
//
//             // --- 4. 计算并累加驱动盘属性 ---
//             if (char.EquippedList && Array.isArray(char.EquippedList)) {
//                 logger.debug(`[DEBUG][${char_id}] Processing ${char.EquippedList.length} drives.`);
//                 for (const relic of char.EquippedList) {
//                     if (!relic?.Equipment) continue; // 跳过无效的驱动盘数据
//
//                     const _equip = relic.Equipment;
//                     const equip_id_str = String(_equip.Id); // 驱动盘具体ID
//                     // 从驱动盘ID推断套装ID (通常是前3位 + '00')
//                     const suit_id = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
//                     if (!suit_id) {
//                          logger.warn(`[enka_to_mys.js] Could not determine suit ID for equip ID: ${equip_id_str}`);
//                          continue;
//                     }
//                     const equip_meta = equip_data[suit_id]; // 获取套装元数据
//                     if (!equip_meta) {
//                          logger.warn(`[enka_to_mys.js] Missing equip metadata for suit ID: ${suit_id}`);
//                          continue;
//                     }
//
//                     const relic_level = _equip.Level || 0; // 驱动盘等级
//                     const relic_tier = Math.floor(relic_level / 3); // 驱动盘阶数 (0-5)
//
//                     // 初始化用于结果展示的驱动盘对象
//                     const raw_equip_obj = {
//                         id: _equip.Id,
//                         level: relic_level,
//                         name: equip_meta.equip_name ? `${equip_meta.equip_name}[${relic.Slot}]` : `驱动 [${relic.Slot}]`,
//                         icon: equip_meta.IconPath ?? '',
//                         rarity: equip_meta.Rarity ?? 'S', // 假设默认S级，实际应从equip_meta获取
//                         properties: [], // 副词条显示
//                         main_properties: [], // 主词条显示
//                         equip_suit: {
//                             suit_id: parseInt(suit_id),
//                             name: equip_meta.equip_name || `套装 ${suit_id}`,
//                             own: 0, // 套装件数，稍后计算
//                             desc1: equip_meta.desc1 || "", // 2件套描述
//                             desc2: equip_meta.desc2 || "", // 4件套描述
//                         },
//                         equipment_type: relic.Slot, // 部位 (1-6)
//                     };
//
//                     // --- 处理主词条 ---
//                     if (_equip.MainPropertyList?.[0]) {
//                         const main_prop = _equip.MainPropertyList[0];
//                         const prop_id_str = String(main_prop.PropertyId);
//                         const en_prop_name = ID_TO_EN[prop_id_str];
//                         const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
//
//                         if (en_prop_name) {
//                             const base_value = main_prop.PropertyValue || 0; // Lv 0 基础值
//                             const increase = MAIN_PROP_VALUE[prop_id_str] ?? 0; // 每阶提升值
//                             const prop_level = main_prop.PropertyLevel || 1; // 主词条通常为1
//
//                             // 计算主词条提供的原始数值
//                             const total_main_value_raw = base_value + (increase * prop_level * relic_tier);
//                             logger.debug(`[DEBUG][${char_id}] Drive ${relic.Slot} Main: ${prop_zh_name}(${prop_id_str}), Base:${base_value}, Inc:${increase}, Tier:${relic_tier}, Lvl:${prop_level} -> RawVal:${total_main_value_raw}`);
//
//                             // 累加到对应的属性累加器
//                             if (prop_id_str === '11102') props.HpAdd += total_main_value_raw;
//                             else if (prop_id_str === '12102') props.AttackAdd += total_main_value_raw;
//                             else if (prop_id_str === '13102') props.DefenceAdd += total_main_value_raw;
//                             else if (props[en_prop_name] !== undefined) {
//                                 props[en_prop_name] += total_main_value_raw; // 固定值直接加到总和
//                             } else {
//                                 logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive main stat accumulation.`);
//                             }
//
//                             // 格式化主词条用于显示
//                             const display_value_str = _get_value_str_py_mimic(base_value, relic_tier, prop_id_str, true);
//                             raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: display_value_str });
//                         } else {
//                             logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive main stat ID ${prop_id_str}`);
//                         }
//                     } else {
//                         logger.warn(`[enka_to_mys.js] Relic ${equip_id_str} missing MainPropertyList`);
//                     }
//
//                     // --- 处理副词条 ---
//                     if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
//                         for (const prop of _equip.RandomPropertyList) {
//                             if (!prop || prop.PropertyId === undefined) continue;
//                             const prop_id_str = String(prop.PropertyId);
//                             const en_prop_name = ID_TO_EN[prop_id_str];
//                             const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
//
//                             if (en_prop_name) {
//                                 const prop_level = prop.PropertyLevel || 1; // 强化次数/跳数
//                                 const base_value_per_roll = prop.PropertyValue || 0; // 每次强化的数值
//
//                                 // 计算该副词条提供的总原始数值
//                                 const total_substat_value_raw = base_value_per_roll * prop_level;
//                                 logger.debug(`[DEBUG][${char_id}] Drive ${relic.Slot} Sub: ${prop_zh_name}(${prop_id_str}), Val/Roll:${base_value_per_roll}, Rolls:${prop_level} -> RawVal:${total_substat_value_raw}`);
//
//                                 // 累加到对应的属性累加器
//                                 if (prop_id_str === '11102') props.HpAdd += total_substat_value_raw;
//                                 else if (prop_id_str === '12102') props.AttackAdd += total_substat_value_raw;
//                                 else if (prop_id_str === '13102') props.DefenceAdd += total_substat_value_raw;
//                                 else if (props[en_prop_name] !== undefined) {
//                                     props[en_prop_name] += total_substat_value_raw; // 固定值直接加到总和
//                                 } else {
//                                     logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive sub stat accumulation.`);
//                                 }
//
//                                 // 格式化副词条用于显示
//                                 const display_value_str = _get_value_str_py_mimic(base_value_per_roll, prop_level, prop_id_str, false);
//                                 raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: display_value_str });
//                             } else {
//                                 logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive sub stat ID ${prop_id_str}`);
//                             }
//                         }
//                     }
//                     result.equip.push(raw_equip_obj); // 添加处理完的驱动盘到结果列表
//                 } // --- 驱动盘循环结束 ---
//
//                 // 计算并更新每个驱动盘的套装件数
//                 const suitCounts = {};
//                 result.equip.forEach(eq => {
//                     const sid = eq.equip_suit.suit_id;
//                     suitCounts[sid] = (suitCounts[sid] || 0) + 1;
//                 });
//                 result.equip.forEach(eq => {
//                     eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0;
//                 });
//                 logger.debug(`[DEBUG][${char_id}] Props after drives:`, JSON.stringify(props));
//             } else {
//                  logger.warn(`[enka_to_mys.js][${char_id}] No equipment data found in Enka payload.`);
//             } // --- 驱动盘处理结束 ---
//
//
//             // --- 5. 修正后的最终属性计算 ---
//             logger.debug(`[DEBUG][CorrectedFinalCalc][${char_id}] Props BEFORE final calc:`, JSON.stringify(props));
//             logger.debug(`[DEBUG][CorrectedFinalCalc][${char_id}] True Base Values: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
//
//             // 计算来自驱动盘的固定值加成 = (当前运行总和) - (角色基础+音擎基础)
//             const flatHPAdd = props.HpMax - trueBaseHP;
//             const flatATKAdd = props.Attack - trueBaseATK;
//             const flatDEFAdd = props.Defence - trueBaseDEF;
//             logger.debug(`[DEBUG][CorrectedFinalCalc][${char_id}] Flat Adds Calculated: HP=${flatHPAdd}, ATK=${flatATKAdd}, DEF=${flatDEFAdd}`);
//
//             // 应用正确公式: 最终 = (角色基础 + 音擎基础) * (1 + 百分比加成总和%) + (驱动盘固定值加成总和)
//             // 注意：props.HpAdd 等存储的是原始值，需要 /10000
//             const finalHP = trueBaseHP * (1 + (props.HpAdd || 0) / 10000) + flatHPAdd;
//             const finalATK = trueBaseATK * (1 + (props.AttackAdd || 0) / 10000) + flatATKAdd;
//             const finalDEF = trueBaseDEF * (1 + (props.DefenceAdd || 0) / 10000) + flatDEFAdd;
//
//             // 将计算出的最终值更新回 props 对象，覆盖之前的运行总和
//             props.HpMax = finalHP;
//             props.Attack = finalATK;
//             props.Defence = finalDEF;
//
//             // 删除用于计算的中间百分比和基础值变量（可选）
//             delete props.HpAdd;
//             delete props.AttackAdd;
//             delete props.DefenceAdd;
//             delete props.HpBase; // 这些已合并到 trueBaseXXX
//             delete props.AttackBase;
//             delete props.DefenceBase;
//
//             // --- 处理元素伤害加成 (根据角色元素保留对应加成) ---
//             const char_element_en = ELEMENT_TO_EN[_partner.ElementType]; // 获取角色元素对应的英文名
//             if (char_element_en) {
//                 const elementBonusKeys = ['PhysDmgBonus', 'FireDmgBonus', 'IceDmgBonus', 'ThunderDmgBonus', 'EtherDmgBonus'];
//                 elementBonusKeys.forEach(key => {
//                     const expectedKey = `${char_element_en}DmgBonus`; // 期望保留的元素伤害键名
//                     // 如果当前键名不是角色对应的元素伤害，并且值为0 (或者总是删除非对应项?)
//                     if (key !== expectedKey && props[key] !== undefined /* && props[key] === 0 */) {
//                         logger.debug(`[DEBUG][CorrectedFinalCalc][${char_id}] Removing non-matching element bonus ${key} (Value: ${props[key]}) for char element ${char_element_en}`);
//                         // delete props[key]; // 可以取消注释以实际删除，但需确认是否符合预期
//                     }
//                 });
//             } else {
//                  logger.warn(`[enka_to_mys.js] Could not find EN element mapping for ElementType: ${_partner.ElementType}`);
//             }
//
//             logger.debug(`[DEBUG][CorrectedFinalCalc][${char_id}] Props AFTER final calc:`, JSON.stringify(props));
//
//
//             // --- 6. 格式化最终面板属性 ---
//             result.properties = []; // 清空用于存储最终面板属性的数组
//             const added_mys_ids = new Set(); // 用于跟踪已添加的属性ID，避免重复
//
//             // 定义最终面板属性的映射关系
//             const final_stat_mapping = {
//                 HpMax: { zh: '生命值', mysId: 1, enkaId: '11101' },
//                 Attack: { zh: '攻击力', mysId: 2, enkaId: '12101' },
//                 Defence: { zh: '防御力', mysId: 3, enkaId: '13101' },
//                 BreakStun: { zh: '冲击力', mysId: 4, enkaId: '12203' },
//                 Crit: { zh: '暴击率', mysId: 5, enkaId: '20103' },
//                 CritDmg: { zh: '暴击伤害', mysId: 6, enkaId: '21103' },
//                 ElementAbnormalPower: { zh: '异常掌控', mysId: 7, enkaId: '31403' },
//                 ElementMystery: { zh: '异常精通', mysId: 8, enkaId: '31203' },
//                 PenRate: { zh: '穿透率', mysId: 9, enkaId: '23103' },
//                 SpRecover: { zh: '能量自动回复', mysId: 11, enkaId: '30503' },
//                 PenDelta: { zh: '穿透值', mysId: 232, enkaId: '23203' },
//                 PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, enkaId: '31503' },
//                 FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, enkaId: '31603' },
//                 IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, enkaId: '31703' },
//                 ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, enkaId: '31803' },
//                 EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, enkaId: '31903' },
//             };
//
//             // 遍历计算后的 props，添加非零或必须显示的属性到 results.properties
//             for (const [propKey, mapping] of Object.entries(final_stat_mapping)) {
//                 const rawValue = props[propKey];
//                 const alwaysShow = ['HpMax', 'Attack', 'Defence', 'Crit', 'CritDmg', 'SpRecover'].includes(propKey); // 这些属性总是显示
//                 const numericValue = Number(rawValue); // 用于检查是否为0
//
//                 if (rawValue !== undefined && (numericValue !== 0 || alwaysShow)) {
//                     const final_value_str = formatFinalPanelPropValue(rawValue, mapping.enkaId); // 格式化最终值
//                     result.properties.push({
//                         property_name: mapping.zh,
//                         property_id: mapping.mysId,
//                         base: "", // 米游社格式通常不需要base和add
//                         add: "",
//                         final: final_value_str
//                     });
//                     added_mys_ids.add(mapping.mysId); // 标记已添加
//                 }
//             }
//
//             // 确保所有基础/常用属性都存在于列表中，即使值为0，也使用默认格式添加
//             const ensurePropertyExists = (propName, mysId, defaultValueFormatted, enkaIdForFormatting, propKey) => {
//                 if (!added_mys_ids.has(mysId)) { // 如果之前没添加过 (因为值是0)
//                     const rawValue = props[propKey] || 0; // 再次获取值，默认为0
//                     const finalValueStr = formatFinalPanelPropValue(rawValue, enkaIdForFormatting); // 正确格式化0值
//                     result.properties.push({
//                         property_name: propName, property_id: mysId, base: "", add: "", final: finalValueStr
//                     });
//                     added_mys_ids.add(mysId); // 标记已添加
//                 }
//             };
//
//             // 确保核心属性和元素伤害属性都存在
//             ensurePropertyExists('生命值', 1, '0', '11101', 'HpMax');
//             ensurePropertyExists('攻击力', 2, '0', '12101', 'Attack');
//             ensurePropertyExists('防御力', 3, '0', '13101', 'Defence');
//             ensurePropertyExists('冲击力', 4, '0', '12203', 'BreakStun');
//             ensurePropertyExists('暴击率', 5, '5.0%', '20103', 'Crit');
//             ensurePropertyExists('暴击伤害', 6, '50.0%', '21103', 'CritDmg');
//             ensurePropertyExists('异常掌控', 7, '0', '31403', 'ElementAbnormalPower');
//             ensurePropertyExists('异常精通', 8, '0', '31203', 'ElementMystery');
//             ensurePropertyExists('穿透率', 9, '0.0%', '23103', 'PenRate');
//             ensurePropertyExists('能量自动回复', 11, '1.20', '30503', 'SpRecover'); // 默认1.20
//             ensurePropertyExists('穿透值', 232, '0', '23203', 'PenDelta');
//             ensurePropertyExists('物理伤害加成', 315, '0.0%', '31503', 'PhysDmgBonus');
//             ensurePropertyExists('火属性伤害加成', 316, '0.0%', '31603', 'FireDmgBonus');
//             ensurePropertyExists('冰属性伤害加成', 317, '0.0%', '31703', 'IceDmgBonus');
//             ensurePropertyExists('雷属性伤害加成', 318, '0.0%', '31803', 'ThunderDmgBonus');
//             ensurePropertyExists('以太属性伤害加成', 319, '0.0%', '31903', 'EtherDmgBonus');
//
//
//             // 按米游社定义的 property_id 排序最终属性列表
//             result.properties.sort((a, b) => a.property_id - b.property_id);
//
//
//             // --- 7. 处理技能等级 ---
//             result.skills = [];
//             if (char.SkillLevelList && Array.isArray(char.SkillLevelList)) {
//                 for (const skill of char.SkillLevelList) {
//                     result.skills.push({
//                         level: skill.Level, // 技能等级
//                         skill_type: skill.Index, // 使用 Enka 的 Index 作为 skill_type
//                         items: [], // MYS 格式可能需要，暂时为空
//                     });
//                 }
//                 result.skills.sort((a, b) => a.skill_type - b.skill_type); // 按 Index 排序
//             } else {
//                 logger.warn(`[enka_to_mys.js][${char_id}] SkillLevelList is missing or not an array.`);
//             }
//
//
//             // --- 8. 处理核心强化 (影位) ---
//             result.rank = char.TalentLevel || 0; // 核心等级 (0-6)
//             result.ranks = []; // 初始化核心详情数组
//             const rankData = _partner.Talents || {}; // 获取角色数据中的核心天赋信息
//             const maxRank = 6; // 最高核心等级
//             for (let i = 1; i <= maxRank; i++) {
//                 const rankInfo = rankData[String(i)]; // 获取对应等级的核心信息
//                 result.ranks.push({
//                     id: rankInfo?.TalentID || i, // 核心ID，优先用数据中的，否则用等级
//                     name: rankInfo?.Name || `影位 ${i}`, // 核心名称
//                     desc: rankInfo?.Desc || '', // 核心描述
//                     pos: i, // 核心位置 (1-6)
//                     is_unlocked: i <= result.rank // 判断是否已解锁
//                 });
//             }
//
//             // --- 9. 添加处理好的角色到结果列表 ---
//             result_list.push(result);
//
//         } catch (processingError) {
//             // 捕获处理单个角色时可能发生的任何错误
//             logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message);
//             logger.error(processingError.stack); // 打印错误堆栈以便调试
//         }
//     } // --- 角色循环结束 ---
//
//     // 记录最终处理结果
//     logger.debug('[DEBUG] Final result_list structure sample (first character):', result_list.length > 0 ? JSON.stringify(result_list[0], null, 2) : 'No characters processed.');
//     logger.info(`[enka_to_mys.js] Finished conversion. Processed ${result_list.length} characters.`);
//     return result_list; // 返回包含所有处理成功的角色数据的列表
// }
//
// enka_to_mys.js (修正版)

// 假设已从 './name_convert.js' 导入了所有需要的数据和常量
// 包括: partner_data, weapon_data, equip_data, PartnerId2SkillParam,
//        avatar_icon_data (!!!), get_char_circle_icon_url,
//        ID_TO_PROP_NAME, MYSAPI_PROP_ID, ID_TO_EN, EN_TO_ZH,
//        MAIN_PROP_BASE_INCREASE (!!! 需要验证其准确性 !!!), PERCENT_ID_LIST, ELEMENT_TO_EN
// enka_to_mys.js (完整修正版)

import {
    equip_data,
    weapon_data,
    partner_data,        // 用于基础信息 (名称, 阵营, 天赋描述等)
    avatar_icon_data,    // 用于角色基础属性计算和图标
    PartnerId2SkillParam, // 用于技能描述
    get_char_circle_icon_url // 用于获取角色图标URL
} from './name_convert.js'; // 确保 name_convert.js 正确加载并导出了这些变量
import _ from 'lodash';

// --- Logger Setup ---
const logger = console; // 使用 console 或替换为你项目的 logger

// --- Mappings and Constants (定义在文件内部) ---
const ID_TO_PROP_NAME = {
    '11101': '生命值', '11103': '生命值', '11102': '生命值百分比', '12101': '攻击力', '12103': '攻击力', '12102': '攻击力百分比',
    '13101': '防御力', '13103': '防御力', '13102': '防御力百分比', '12203': '冲击力', '20103': '暴击率', '21103': '暴击伤害',
    '31402': '异常掌控', '31403': '异常掌控', '31202': '异常精通', '31203': '异常精通', '23103': '穿透率', '23203': '穿透值',
    '30503': '能量自动回复', '30502': '能量回复百分比', // 都映射到“能量自动回复”以简化处理，具体区分在格式化时进行
    '31503': '物理伤害加成', '31603': '火属性伤害加成', '31703': '冰属性伤害加成', '31803': '雷属性伤害加成', '31903': '以太属性伤害加成',
    '12202': '冲击力', // 假设 12202 也是冲击力固定值
};
const MYSAPI_PROP_ID = {
    '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
    '穿透率': 9, '能量自动回复': 11,
    '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
    // 百分比和固定值在最终面板中不需要映射ID，所以这里可以简化
};
const ID_TO_EN = {
    '11101': 'HpMax', '11103': 'HpBase', '11102': 'HpAdd', '12101': 'Attack', '12103': 'AttackBase', '12102': 'AttackAdd',
    '13101': 'Defence', '13103': 'DefenceBase', '13102': 'DefenceAdd', '12203': 'BreakStun',
    '20103': 'Crit', '21103': 'CritDmg', '31402': 'ElementAbnormalPower', '31403': 'ElementAbnormalPower',
    '31202': 'ElementMystery', '31203': 'ElementMystery', '23103': 'PenRate', '23203': 'PenDelta',
    '30503': 'SpRecover', '30502': 'SpRecover', // 使用相同 EN Key 简化处理
    '31503': 'PhysDmgBonus', '31603': 'FireDmgBonus', '31703': 'IceDmgBonus',
    '31803': 'ThunderDmgBonus', '31903': 'EtherDmgBonus',
    '12202': 'BreakStun', // 假设 12202 也是冲击力固定值
};
const EN_TO_ZH = {}; // 派生常量，将在下面生成
for (const id in ID_TO_EN) { if (ID_TO_PROP_NAME[id]) { EN_TO_ZH[ID_TO_EN[id]] = ID_TO_PROP_NAME[id]; } }
EN_TO_ZH['HpAdd'] = '生命值百分比'; EN_TO_ZH['AttackAdd'] = '攻击力百分比'; EN_TO_ZH['DefenceAdd'] = '防御力百分比';

// !!! 这个常量非常重要，数值需要根据 ZZZ 游戏数据精确验证 !!!
const MAIN_PROP_BASE_INCREASE = {
    // Flat Stats Increase per Tier (来自 enka_to_mys (2).js，需要验证)
    '11101': 330, '11103': 330, // HP Flat
    '12101': 47.4, '12103': 47.4, // ATK Flat (存疑, ZZZ S级音擎60级基础攻击700+, 这个增量可能偏低?)
    '13101': 27.6, '13103': 27.6, // DEF Flat (存疑)
    '12203': 270, // Impact Flat (存疑, 需看Lv0值)
    '31202': 13, '31203': 13,   // EM Flat (存疑, 13点每阶?)
    '31402': 450, '31403': 450, // Abnormal Control Flat (存疑)
    '23203': 36,  // Pen Flat (存疑)

    // Percent Stats Increase per Tier (Raw 1/10000 unit, 来自 enka_to_mys (2).js，需要验证)
    '11102': 450, // HP% (4.5% per tier?) - 需要验证, 原代码是 330?
    '12102': 450, // ATK% (4.5% per tier?)
    '13102': 720, // DEF% (7.2% per tier?)
    '20103': 360, // Crit Rate% (3.6% per tier?)
    '21103': 720, // Crit Dmg% (7.2% per tier?)
    '23103': 360, // Pen Rate% (3.6% per tier?)
    '30503': 900, '30502': 900, // ER% (9.0% per tier?)
    '31503': 450, // Phys DMG% (4.5% per tier?)
    '31603': 450, // Fire DMG% (4.5% per tier?)
    '31703': 450, // Ice DMG% (4.5% per tier?)
    '31803': 450, // Thunder DMG% (4.5% per tier?)
    '31903': 450, // Ether DMG% (4.5% per tier?)
    '12202': 0,   // Impact % (如果存在的话，值是多少?)
};

// 哪些 ID 在显示时需要加百分号
const PERCENT_ID_LIST = Object.keys(ID_TO_PROP_NAME)
    .filter(id =>
        ID_TO_PROP_NAME[id]?.includes('百分比') ||
        ID_TO_PROP_NAME[id]?.includes('加成') ||
        ['20103', '21103', '23103', '30502'].includes(id) // 明确指定暴击爆伤穿透率和能量回复效率%
        // 30503 是能量自动回复 固定值/秒，不需要百分号
    );
// 确保核心百分比ID存在
if (!PERCENT_ID_LIST.includes('11102')) PERCENT_ID_LIST.push('11102'); // HP%
if (!PERCENT_ID_LIST.includes('12102')) PERCENT_ID_LIST.push('12102'); // ATK%
if (!PERCENT_ID_LIST.includes('13102')) PERCENT_ID_LIST.push('13102'); // DEF%

const ELEMENT_TO_EN = { '203': 'Thunder', '205': 'Ether', '202': 'Ice', '200': 'Phys', '201': 'Fire' };


// --- 数据有效性检查 ---
if (typeof partner_data === 'undefined' || Object.keys(partner_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: partner_data is undefined or empty!"); }
if (typeof avatar_icon_data === 'undefined' || Object.keys(avatar_icon_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: avatar_icon_data is undefined or empty!"); }
if (typeof weapon_data === 'undefined' || Object.keys(weapon_data || {}).length === 0) { logger.warn("[enka_to_mys.js] WARNING: weapon_data is undefined or empty."); }
if (typeof equip_data === 'undefined' || Object.keys(equip_data || {}).length === 0) { logger.warn("[enka_to_mys.js] WARNING: equip_data is undefined or empty."); }
if (typeof MAIN_PROP_BASE_INCREASE === 'undefined' || Object.keys(MAIN_PROP_BASE_INCREASE || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: MAIN_PROP_BASE_INCREASE is undefined or empty! Relic main stat calculations will be wrong."); }
if (typeof PERCENT_ID_LIST === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: PERCENT_ID_LIST is undefined!"); }
// 检查其他常量
if (typeof ID_TO_PROP_NAME === 'undefined') logger.error("CRITICAL: ID_TO_PROP_NAME is undefined");
if (typeof ID_TO_EN === 'undefined') logger.error("CRITICAL: ID_TO_EN is undefined");
if (typeof MYSAPI_PROP_ID === 'undefined') logger.error("CRITICAL: MYSAPI_PROP_ID is undefined");


// --- Helper Function Definitions ---

// 计算角色自身基础属性 (使用 avatar_icon_data)
function calculateCharBaseStat(char_id, level, promotion_level, rank) {
    const charAvatarData = avatar_icon_data[char_id];
    if (!charAvatarData) {
        logger.error(`[calculateCharBaseStat] Avatar data not found for char_id: ${char_id}`);
        return { baseHp: 0, baseAtk: 0, baseDef: 0 };
    }

    const baseProps = charAvatarData.BaseProps || {};
    const growthProps = charAvatarData.GrowthProps || {};
    const promotionProps = charAvatarData.PromotionProps?.[promotion_level] || {};
    const coreEnhancementProps = charAvatarData.CoreEnhancementProps?.[rank] || {};

    const getPropIdByName = (name) => Object.keys(ID_TO_PROP_NAME).find(id => ID_TO_PROP_NAME[id] === name);
    const hpId = getPropIdByName('生命值');
    const atkId = getPropIdByName('攻击力');
    const defId = getPropIdByName('防御力');

    let baseHp = Number(baseProps['11101']) || 0;
    let baseAtk = Number(baseProps['12101']) || 0;
    let baseDef = Number(baseProps['13101']) || 0;

    if (level > 1) {
        baseHp += (level - 1) * (Number(growthProps['11101']) || 0) / 10000;
        baseAtk += (level - 1) * (Number(growthProps['12101']) || 0) / 10000;
        baseDef += (level - 1) * (Number(growthProps['13101']) || 0) / 10000;
    }

    baseHp += Number(promotionProps['11101']) || 0;
    baseAtk += Number(promotionProps['12101']) || 0;
    baseDef += Number(promotionProps['13101']) || 0;

    // 确保 ID 存在再访问
    if (hpId && coreEnhancementProps[hpId] !== undefined) baseHp += Number(coreEnhancementProps[hpId]) || 0;
    if (atkId && coreEnhancementProps[atkId] !== undefined) baseAtk += Number(coreEnhancementProps[atkId]) || 0;
    if (defId && coreEnhancementProps[defId] !== undefined) baseDef += Number(coreEnhancementProps[defId]) || 0;

    logger.debug(`[calculateCharBaseStat][${char_id}] Lvl ${level} Promo ${promotion_level} Rank ${rank} -> HP:${Math.floor(baseHp)}, ATK:${Math.floor(baseAtk)}, DEF:${Math.floor(baseDef)}`);
    return {
        baseHp: Math.floor(baseHp),
        baseAtk: Math.floor(baseAtk),
        baseDef: Math.floor(baseDef),
    };
}

// 格式化音擎/驱动盘主副属性的原始值用于显示
function formatEquipWeaponPropValue(value, prop_id) {
    const idStr = String(prop_id);
    const isPercentProp = PERCENT_ID_LIST.includes(idStr);
    const numericValue = Number(value);
    if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; }
    try {
        if (isPercentProp) {
            // 能量回复效率 %
            if (idStr === '30502') {
                return (numericValue / 100).toFixed(1) + '%';
            }
            // 其他百分比
            else {
                return (numericValue / 100).toFixed(1) + '%'; // 假设原始值 * 100
            }
        }
        // 能量自动回复 固定值
        else if (idStr === '30503') {
            return (numericValue / 10000).toFixed(2); // 假设原始值 * 10000
        }
        // 其他固定值
        else {
            return String(Math.floor(numericValue));
        }
    } catch (e) { logger.error(`[formatEquipWeaponPropValue] Error formatting E/W prop value ${value} for ${prop_id}:`, e); return '0'; }
}

// 计算音擎在特定等级和突破等级下的主副属性值
function render_weapon_detail(weapon_meta, weapon_level, weapon_break_level) {
     if (!weapon_meta || weapon_meta.props_value === undefined || !weapon_meta.level || !weapon_meta.stars) {
         logger.warn(`[render_weapon_detail] Invalid weapon metadata for ID ${weapon_meta?.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
         return { baseValue: 0, randValue: 0, basePropId: null, randPropId: null };
     }
     const levelData = weapon_meta.level?.[String(weapon_level)];
     const starData = weapon_meta.stars?.[String(weapon_break_level)];
     if (!levelData || !starData) {
          logger.warn(`[render_weapon_detail] Missing level/break data for weapon ${weapon_meta.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
         return { baseValue: 0, randValue: 0, basePropId: String(weapon_meta.props_id), randPropId: String(weapon_meta.rand_props_id) };
     }

     let base_value = Number(weapon_meta.props_value) || 0;
     base_value = base_value + base_value * (((Number(levelData.Rate) || 0) + (Number(starData.StarRate) || 0)) / 10000);

     let rand_value = Number(weapon_meta.rand_props_value) || 0;
     if (rand_value > 0 && starData.RandRate !== undefined) {
         rand_value = rand_value + rand_value * ((Number(starData.RandRate) || 0) / 10000);
     } else {
         rand_value = 0;
     }
     return {
         baseValue: Math.floor(base_value),
         randValue: Math.floor(rand_value),
         basePropId: String(weapon_meta.props_id),
         randPropId: String(weapon_meta.rand_props_id)
        };
}

// 格式化最终面板属性值
function formatFinalPanelPropValue(value, prop_id) {
      const idStr = String(prop_id);
      const isPercentProp = PERCENT_ID_LIST.includes(idStr);
      const numericValue = Number(value);
      if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; }

      try {
          if (isPercentProp) {
              // 能量回复效率 % (ID 30502)
              if (idStr === '30502') {
                 return (numericValue / 100).toFixed(1) + '%';
              }
              // 其他百分比
              else {
                  return (numericValue / 100).toFixed(1) + '%'; // 假设计算结果已经是 百分比 * 100
              }
          }
          // 能量自动回复 固定值/秒 (ID 30503)
          else if (idStr === '30503') {
              return (numericValue / 10000).toFixed(2); // 假设计算结果是 值 * 10000
          }
          // 其他固定值
          else {
              return String(Math.floor(numericValue));
          }
      } catch (e) { logger.error(`[formatFinalPanelPropValue] Error formatting Final prop value ${value} for ${prop_id}:`, e); return '0'; }
}


// --- 主转换函数 ---
export async function _enka_data_to_mys_data(enka_data) {
    if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
        logger.error("[enka_to_mys.js] Invalid enka_data structure or empty AvatarList.");
        return [];
    }

    const uid = enka_data.uid;
    const result_list = [];

    for (const char of enka_data.PlayerInfo.ShowcaseDetail.AvatarList) {
        try {
            if (!char || typeof char.Id === 'undefined') {
                logger.warn("[enka_to_mys.js] Skipping invalid character entry in AvatarList.");
                continue;
            }
            const char_id = String(char.Id);
            const _partner = partner_data[char_id];
            const _avatar_data = avatar_icon_data[char_id]; // 使用正确的变量名

            if (!_partner || !_avatar_data) {
                logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing partner_data or avatar_icon_data.`); // 使用正确的变量名
                continue;
            }

            const characterIconUrl = get_char_circle_icon_url(char_id) ?? '';

            const result = {
                id: char.Id,
                level: char.Level || 1,
                name_mi18n: _partner.name ?? `角色${char_id}`,
                full_name_mi18n: _partner.full_name ?? _partner.name ?? `角色${char_id}`,
                element_type: parseInt(_avatar_data.ElementTypes?.[0]?.replace('Elec', '203').replace('Ether', '205').replace('Ice', '202').replace('Physics', '200').replace('Fire', '201').replace('FireFrost','202')) || 0, // 主要从avatar_icon_data获取元素
                sub_element_type: parseInt(_avatar_data.ElementTypes?.[1]?.replace('Elec', '203').replace('Ether', '205').replace('Ice', '202').replace('Physics', '200').replace('Fire', '201')) || 0, // 副元素
                camp_name_mi18n: _partner.Camp ?? '?',
                avatar_profession: parseInt(_avatar_data.ProfessionType?.replace('Stun', '1').replace('Attack', '3').replace('Defense', '2').replace('Support', '4').replace('Anomaly', '5')) || 0, // 从avatar_icon_data获取职业
                rarity: (_avatar_data.Rarity === 4 ? 'S' : 'A') ?? 'A', // 从avatar_icon_data获取稀有度
                group_icon_path: characterIconUrl,
                hollow_icon_path: characterIconUrl,
                role_square_url: characterIconUrl,
                role_vertical_painting_url: characterIconUrl,
                square_icon: characterIconUrl,
                equip: [],
                weapon: null,
                properties: [],
                skills: [],
                rank: char.TalentLevel || 0,
                ranks: [],
            };

            // --- 1. 初始化属性累加器 ---
            const props = {}; // 存储最终计算值
            const percentAdds = { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 };
            const flatAdds = { HpMax: 0, Attack: 0, Defence: 0 };
            Object.keys(ID_TO_EN).forEach(keyId => {
                 if (!['HpMax', 'Attack', 'Defence', 'HpBase', 'AttackBase', 'DefenceBase', 'HpAdd', 'AttackAdd', 'DefenceAdd'].includes(ID_TO_EN[keyId])) {
                     props[ID_TO_EN[keyId]] = 0;
                 }
            });

            // --- 2. 计算角色基础属性 ---
            const { baseHp: charBaseHp, baseAtk: charBaseAtk, baseDef: charBaseDef } = calculateCharBaseStat(
                char_id,
                char.Level,
                char.PromotionLevel,
                result.rank
            );
            const charBaseProps = _avatar_data.BaseProps || {};
            props.Crit = Number(charBaseProps['20101']) || 500;
            props.CritDmg = Number(charBaseProps['21101']) || 5000;
            props.BreakStun = Number(charBaseProps['12201']) || 0;
            props.ElementAbnormalPower = Number(charBaseProps['31401']) || 0;
            props.ElementMystery = Number(charBaseProps['31201']) || 0;
            props.SpRecover = Number(charBaseProps['30501']) * 100 || 12000; // *100是因为avatar_icon_data里是120, enka是12000

            let trueBaseHP = charBaseHp;
            let trueBaseATK = charBaseAtk;
            let trueBaseDEF = charBaseDef;

            logger.debug(`[DEBUG][${char_id}] Character Base Stats: HP=${charBaseHp}, ATK=${charBaseAtk}, DEF=${charBaseDef}`);

            // --- 3. 处理武器 ---
            let weaponDisplay = null;
            if (char.Weapon?.Id) {
                const weapon_id = String(char.Weapon.Id);
                const _weapon_meta = weapon_data[weapon_id];
                if (_weapon_meta) {
                    const weapon_level = char.Weapon.Level || 1;
                    const weapon_star = char.Weapon.UpgradeLevel || 0;
                    const weapon_break_level = char.Weapon.BreakLevel || 0;

                    const { baseValue, randValue, basePropId, randPropId } = render_weapon_detail(
                        _weapon_meta, weapon_level, String(weapon_break_level)
                    );

                    if (basePropId === '12101' || basePropId === '12103') trueBaseATK += baseValue;
                    else if (basePropId === '11101' || basePropId === '11103') trueBaseHP += baseValue;
                    else if (basePropId === '13101' || basePropId === '13103') trueBaseDEF += baseValue;
                    else {
                        const baseEnProp = ID_TO_EN[basePropId];
                        if(baseEnProp && props[baseEnProp] !== undefined) props[baseEnProp] += baseValue;
                         else logger.warn(`[enka_to_mys.js] Weapon ${weapon_id} has unhandled base prop ID: ${basePropId}`);
                    }

                    if (randPropId && randValue > 0) {
                        const randEnProp = ID_TO_EN[randPropId];
                        if (randPropId === '11102') percentAdds.HpAdd += randValue;
                        else if (randPropId === '12102') percentAdds.AttackAdd += randValue;
                        else if (randPropId === '13102') percentAdds.DefenceAdd += randValue;
                        else if (randEnProp && props[randEnProp] !== undefined) {
                            props[randEnProp] += randValue;
                        } else {
                             logger.warn(`[enka_to_mys.js] Unknown or unhandled weapon random prop ID: ${randPropId} (EN: ${randEnProp})`);
                        }
                    }
                     logger.debug(`[DEBUG][${char_id}] Weapon ${weapon_id}: BaseStat(+${baseValue} to ${ID_TO_PROP_NAME[basePropId]}), RandStat(+${randValue} to ${ID_TO_PROP_NAME[randPropId]})`);

                    weaponDisplay = {
                        id: char.Weapon.Id, level: weapon_level, name: _weapon_meta.name || `武器 ${weapon_id}`, star: weapon_star + 1,
                        icon: _weapon_meta.IconPath ?? '', rarity: _weapon_meta.rarity ?? 'A', properties: [], main_properties: [],
                        talent_title: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Name'], ''),
                        talent_content: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Desc'], ''),
                        profession: parseInt(_avatar_data.ProfessionType?.replace('Stun', '1').replace('Attack', '3').replace('Defense', '2').replace('Support', '4').replace('Anomaly', '5')) || 0,
                     };
                     const base_prop_zh = ID_TO_PROP_NAME[basePropId] || `?(${basePropId})`;
                     weaponDisplay.main_properties.push({ property_name: base_prop_zh, property_id: basePropId, base: formatEquipWeaponPropValue(baseValue, basePropId) });
                     if (randPropId && randValue > 0) {
                         const rand_prop_zh = ID_TO_PROP_NAME[randPropId] || `?(${randPropId})`;
                         weaponDisplay.properties.push({ property_name: rand_prop_zh, property_id: randPropId, base: formatEquipWeaponPropValue(randValue, randPropId) });
                     }
                } else { logger.warn(`[enka_to_mys.js] Weapon metadata missing for ID: ${weapon_id}`); }
            }
            result.weapon = weaponDisplay;
            logger.debug(`[DEBUG][${char_id}] True Base after weapon: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);

            // --- 4. 处理驱动盘 (Relics) ---
            const equipDisplayList = [];
            if (char.EquippedList && Array.isArray(char.EquippedList)) {
                for (const relic of char.EquippedList) {
                     if (!relic?.Equipment) continue;
                    const _equip = relic.Equipment;
                    const equip_id_str = String(_equip.Id);
                    const suit_id = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
                    if (!suit_id) { logger.warn(`[enka_to_mys.js] Could not derive suit ID for equip ID ${equip_id_str}`); continue; }
                    const equip_meta = equip_data[suit_id];
                     if (!equip_meta) { logger.warn(`[enka_to_mys.js] Relic suit metadata missing for suit ID: ${suit_id} (from equip ${equip_id_str})`); continue; }

                    const relic_level = _equip.Level || 0;
                    const relic_tier = Math.floor(relic_level / 3);

                    const raw_equip_obj = {
                        id: _equip.Id, level: relic_level,
                        name: equip_meta.equip_name ? `${equip_meta.equip_name}[${relic.Slot}]` : `驱动 [${relic.Slot}]`,
                        icon: equip_meta.IconPath ?? '', rarity: _equip.Rarity ? (_equip.Rarity == 4 ? 'S' : 'A') : 'A', // 使用Enka的稀有度
                        properties: [], main_properties: [],
                        equip_suit: { suit_id: parseInt(suit_id), name: equip_meta.equip_name || `套装 ${suit_id}`, own: 0, desc1: equip_meta.desc1 || "", desc2: equip_meta.desc2 || "" },
                        equipment_type: relic.Slot
                    };

                    // 主词条
                    if (_equip.MainPropertyList?.[0]) {
                        const main_prop = _equip.MainPropertyList[0];
                        const prop_id_str = String(main_prop.PropertyId);
                        const en_prop_name = ID_TO_EN[prop_id_str];

                        if (en_prop_name) {
                             const base_value = main_prop.PropertyValue || 0;
                             const increase_per_tier = MAIN_PROP_BASE_INCREASE[prop_id_str] ?? 0;
                             const total_main_value_raw = base_value + (increase_per_tier * relic_tier);
                             logger.debug(`[DEBUG][${char_id}] Drive ${relic.Slot} Main: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Lvl:${relic_level}(T${relic_tier}), Base:${base_value}, Inc:${increase_per_tier} -> RawVal:${total_main_value_raw}`);

                             if (prop_id_str === '11102') percentAdds.HpAdd += total_main_value_raw;
                             else if (prop_id_str === '12102') percentAdds.AttackAdd += total_main_value_raw;
                             else if (prop_id_str === '13102') percentAdds.DefenceAdd += total_main_value_raw;
                             else if (prop_id_str === '11103') flatAdds.HpMax += total_main_value_raw;
                             else if (prop_id_str === '12103') flatAdds.Attack += total_main_value_raw;
                             else if (prop_id_str === '13103') flatAdds.Defence += total_main_value_raw;
                             else if (props[en_prop_name] !== undefined) { props[en_prop_name] += total_main_value_raw; }
                             else { logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive main stat accumulation.`); }

                            const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
                            raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: formatEquipWeaponPropValue(total_main_value_raw, prop_id_str) });
                        } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive main stat ID ${prop_id_str}`); }
                    }

                    // 副词条
                    if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
                        for (const prop of _equip.RandomPropertyList) {
                            if (!prop || prop.PropertyId === undefined) continue;
                            const prop_id_str = String(prop.PropertyId);
                            const en_prop_name = ID_TO_EN[prop_id_str];

                             if (en_prop_name) {
                                 const prop_level = prop.PropertyLevel || 1;
                                 const base_value_per_roll = prop.PropertyValue || 0;
                                 const total_substat_value_raw = base_value_per_roll * prop_level;
                                 logger.debug(`[DEBUG][${char_id}] Drive ${relic.Slot} Sub: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Val/Roll:${base_value_per_roll}, Rolls:${prop_level} -> RawVal:${total_substat_value_raw}`);

                                 if (prop_id_str === '11102') percentAdds.HpAdd += total_substat_value_raw;
                                 else if (prop_id_str === '12102') percentAdds.AttackAdd += total_substat_value_raw;
                                 else if (prop_id_str === '13102') percentAdds.DefenceAdd += total_substat_value_raw;
                                 else if (prop_id_str === '11103') flatAdds.HpMax += total_substat_value_raw;
                                 else if (prop_id_str === '12103') flatAdds.Attack += total_substat_value_raw;
                                 else if (prop_id_str === '13103') flatAdds.Defence += total_substat_value_raw;
                                 else if (props[en_prop_name] !== undefined) { props[en_prop_name] += total_substat_value_raw; }
                                 else { logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive sub stat accumulation.`); }

                                const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
                                raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: formatEquipWeaponPropValue(total_substat_value_raw, prop_id_str) });
                             } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive sub stat ID ${prop_id_str}`); }
                        }
                    }
                    equipDisplayList.push(raw_equip_obj);
                }

                const suitCounts = {};
                equipDisplayList.forEach(eq => { const sid = eq.equip_suit.suit_id; suitCounts[sid] = (suitCounts[sid] || 0) + 1; });
                equipDisplayList.forEach(eq => { eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
                result.equip = equipDisplayList;
                logger.debug(`[DEBUG][${char_id}] Flat Adds after drives:`, JSON.stringify(flatAdds));
                logger.debug(`[DEBUG][${char_id}] Percent Adds after drives:`, JSON.stringify(percentAdds));

            }

            // --- 5. 最终属性计算 ---
            props.HpMax = trueBaseHP * (1 + (percentAdds.HpAdd || 0) / 10000) + (flatAdds.HpMax || 0);
            props.Attack = trueBaseATK * (1 + (percentAdds.AttackAdd || 0) / 10000) + (flatAdds.Attack || 0);
            props.Defence = trueBaseDEF * (1 + (percentAdds.DefenceAdd || 0) / 10000) + (flatAdds.Defence || 0);

            logger.debug(`[DEBUG][${char_id}] FINAL Calculated Stats: HP=${Math.floor(props.HpMax)}, ATK=${Math.floor(props.Attack)}, DEF=${Math.floor(props.Defence)}`);

            // --- 6. 格式化最终面板 ---
            result.properties = [];
            const added_mys_ids = new Set();
            const final_stat_mapping = {
                HpMax: { zh: '生命值', mysId: 1, enkaId: '11101' }, Attack: { zh: '攻击力', mysId: 2, enkaId: '12101' }, Defence: { zh: '防御力', mysId: 3, enkaId: '13101' },
                BreakStun: { zh: '冲击力', mysId: 4, enkaId: '12203' }, Crit: { zh: '暴击率', mysId: 5, enkaId: '20103' }, CritDmg: { zh: '暴击伤害', mysId: 6, enkaId: '21103' },
                ElementAbnormalPower: { zh: '异常掌控', mysId: 7, enkaId: '31403' }, ElementMystery: { zh: '异常精通', mysId: 8, enkaId: '31203' },
                PenRate: { zh: '穿透率', mysId: 9, enkaId: '23103' }, SpRecover: { zh: '能量自动回复', mysId: 11, enkaId: '30503' },
                PenDelta: { zh: '穿透值', mysId: 232, enkaId: '23203' }, PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, enkaId: '31503' },
                FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, enkaId: '31603' }, IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, enkaId: '31703' },
                ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, enkaId: '31803' }, EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, enkaId: '31903' },
            };

            for (const [propKey, mapping] of Object.entries(final_stat_mapping)) {
                 const rawValue = props[propKey];
                 const alwaysShow = ['HpMax', 'Attack', 'Defence', 'Crit', 'CritDmg'].includes(propKey); // 确保基础和双暴总是显示
                 const numericValue = Number(rawValue);

                 if (rawValue !== undefined && (!isNaN(numericValue)) && (numericValue !== 0 || alwaysShow)) {
                     const final_value_str = formatFinalPanelPropValue(rawValue, mapping.enkaId);
                     result.properties.push({ property_name: mapping.zh, property_id: mapping.mysId, base: "", add: "", final: final_value_str });
                     added_mys_ids.add(mapping.mysId);
                 }
            }

             const ensurePropertyExists = (propName, mysId, defaultValueFormatted, enkaIdForFormatting, propKey) => {
                 if (!added_mys_ids.has(mysId)) {
                     const rawValue = props[propKey] || 0;
                     const finalValueStr = formatFinalPanelPropValue(rawValue, enkaIdForFormatting); // 总是格式化，即使是0
                     result.properties.push({ property_name: propName, property_id: mysId, base: "", add: "", final: finalValueStr });
                     added_mys_ids.add(mysId);
                 }
             };
            // 确保所有属性都存在
            ensurePropertyExists('生命值', 1, '0', '11101', 'HpMax');
            ensurePropertyExists('攻击力', 2, '0', '12101', 'Attack');
            ensurePropertyExists('防御力', 3, '0', '13101', 'Defence');
            ensurePropertyExists('冲击力', 4, '0', '12203', 'BreakStun');
            ensurePropertyExists('暴击率', 5, '5.0%', '20103', 'Crit');
            ensurePropertyExists('暴击伤害', 6, '50.0%', '21103', 'CritDmg');
            ensurePropertyExists('异常掌控', 7, '0', '31403', 'ElementAbnormalPower');
            ensurePropertyExists('异常精通', 8, '0', '31203', 'ElementMystery');
            ensurePropertyExists('穿透率', 9, '0.0%', '23103', 'PenRate');
            ensurePropertyExists('能量自动回复', 11, '1.20', '30503', 'SpRecover'); // 默认1.20
            ensurePropertyExists('穿透值', 232, '0', '23203', 'PenDelta');
            ensurePropertyExists('物理伤害加成', 315, '0.0%', '31503', 'PhysDmgBonus');
            ensurePropertyExists('火属性伤害加成', 316, '0.0%', '31603', 'FireDmgBonus');
            ensurePropertyExists('冰属性伤害加成', 317, '0.0%', '31703', 'IceDmgBonus');
            ensurePropertyExists('雷属性伤害加成', 318, '0.0%', '31803', 'ThunderDmgBonus');
            ensurePropertyExists('以太属性伤害加成', 319, '0.0%', '31903', 'EtherDmgBonus');

            result.properties.sort((a, b) => a.property_id - b.property_id);

            // --- 7. 处理技能 ---
            result.skills = [];
            const charSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
            const charSkillDetails = PartnerId2SkillParam[char_id] || {};
            const skillTypesInOrder = [0, 1, 2, 3, 5, 6];
            for (const skillIndex of skillTypesInOrder) {
                 const skillIndexStr = String(skillIndex);
                 const skillDetail = charSkillDetails[skillIndexStr];
                 const currentLevel = charSkillLevels[skillIndexStr] ?? 1;
                 let items = [];
                 if (skillDetail && typeof skillDetail === 'object') {
                      if (skillDetail.Items && Array.isArray(skillDetail.Items)) {
                           items = skillDetail.Items.map(item => ({ title: item?.Title || '', text: item?.Text || '' })).filter(item => item.title || item.text);
                      } else {
                            // 尝试将整个对象作为 items (如果结构是 { title: '...', text: '...' })
                            const skillKeys = Object.keys(skillDetail);
                            if (skillKeys.length > 0) {
                                items = skillKeys.map(key => {
                                    const itemData = skillDetail[key];
                                    return { title: itemData?.title || key, text: itemData?.text || '' };
                                }).filter(item => item.title || item.text);
                            }
                      }
                 }
                 result.skills.push({ level: currentLevel, skill_type: skillIndex, items: items });
            }

            // --- 8. 处理核心强化 (影位/Rank) ---
            result.ranks = [];
            const rankData = _partner.Talents || {}; // 从 partner_data 获取天赋描述
            const maxRank = 6;
            for (let i = 1; i <= maxRank; i++) {
                 const rankInfo = rankData[String(i)];
                 result.ranks.push({
                     id: rankInfo?.TalentID || i,
                     name: rankInfo?.Name || `影位 ${i}`,
                     desc: rankInfo?.Desc || '', // 使用 partner_data 中的描述
                     pos: i,
                     is_unlocked: i <= result.rank
                 });
            }

            result_list.push(result);

        } catch (processingError) {
            logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message);
            logger.error(processingError.stack);
        }
    } // --- 角色循环结束 ---

    logger.info(`[enka_to_mys.js] Finished conversion. Processed ${result_list.length} characters.`);
    return result_list;
}
