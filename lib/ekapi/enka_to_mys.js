// // enka_to_mys.js (完整版，结合旧角色图标URL与新Hakush数据，并特殊处理能量回复属性)
//
// enka_to_mys.js (修改版，移除最终属性计算，依赖外部获取器)

import {
    hakush_equip_data,
    getCharacterData,
    getWeaponData,
    ID_TO_PROP_NAME,
    PROP_NAME_TO_ID,
    ID_TO_EN,
    PERCENT_ID_LIST,
    MAIN_PROP_BASE_INCREASE,
    ENKA_INDEX_TO_HAKUSH_SKILL_KEY,
    HAKUSH_RARITY_MAP,
    getCharBasicInfo,          // 用于获取角色名称、元素、职业等非图标信息
    calculateCharBaseStat,     // 基于 Hakush 计算基础属性
    render_weapon_detail,      // 基于 Hakush 计算武器属性
    constructIconUrl,          // 基于 Hakush 路径构造武器/驱动盘图标 URL
    // 导入基于旧 avatars.json 的角色图标 URL 获取函数
    get_char_circle_icon_url_from_avatars,
    get_char_base_icon_url_from_avatars,
} from './name_convert.js'; // 确保 name_convert.js 包含这些导出
import _ from 'lodash';
// 导入你将要实现的属性计算器类/工厂函数
import { PropertyCalculator } from './property_calculator.js'; // <--- 新增：你需要创建这个文件并实现 PropertyCalculator

// 使用 console 作为临时日志记录器
const logger = console;

// MYS API 属性 ID 映射 (保持不变)
const MYSAPI_PROP_ID = {
    '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
    '穿透率': 9, /*'能量自动回复': 11,*/ '能量回复效率': 11, // MYS ID 11 通常对应能量回复效率
    '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
};

// 默认图标 URL (保持不变)
const DEFAULT_CIRCLE_ICON_URL = '';
const DEFAULT_BASE_ICON_URL = '';
const DEFAULT_WEAPON_ICON_URL = '';
const DEFAULT_DRIVE_ICON_URL = '';


// --- 格式化函数 (保持不变，外部计算器可能会用到) ---
function formatEquipWeaponPropValue(value, prop_id) {
    const idStr = String(prop_id);
    const isPercentProp = PERCENT_ID_LIST.includes(idStr);
    const numericValue = Number(value);

    if (value === undefined || value === null || isNaN(numericValue)) {
        return isPercentProp ? '0.0%' : '0';
    }

    try {
        if (isPercentProp) {
             // 假设 Enka/Hakush 的百分比值是目标值的 100 倍 (例如 500 代表 5.0%)
             return (numericValue / 100).toFixed(1) + '%';
        }
        // 固定值能量回复 (Enka: 30503, Hakush: 30501?) - 这个格式化逻辑可能移到外部，但先保留
        else if (idStr === '30503' || idStr === '30501') {
             // 假设 Enka/Hakush 的值是目标值的 1000 倍 (例如 1200 代表 1.20/s)
             return (numericValue / 1000).toFixed(2);
        }
        // 其他固定值，如精通、掌控、穿透值等，直接取整
        else {
             return String(Math.floor(numericValue));
        }
    } catch (e) {
        logger.error(`[formatEquipWeaponPropValue] Error formatting prop value ${value} for ${prop_id}:`, e);
        return '0';
    }
}

// 这个函数现在主要由外部计算器调用，本文件内不再直接用于最终面板
function formatFinalPanelPropValue(value, prop_id) {
      const idStr = String(prop_id);
      const isPercentProp = PERCENT_ID_LIST.includes(idStr);
      const numericValue = Number(value);

      if (value === undefined || value === null || isNaN(numericValue)) {
          return isPercentProp ? '0.0%' : '0';
      }

      try {
          // 最终面板百分比显示，保留一位小数
          if (isPercentProp) {
              // 假设传入的 value 是目标值的 100 倍
              return (numericValue / 100).toFixed(1) + '%';
          }
          // 固定值能量回复 (30503/30501)
          else if (idStr === '30503' || idStr === '30501') {
               // 假设传入的 value 是目标值的 100 倍 (例如 props.SpRecover = 120)
               return (numericValue / 100).toFixed(2); // 显示为 1.20
          }
          // 其他固定值取整
          else {
              return String(Math.floor(numericValue));
          }
      } catch (e) {
          logger.error(`[formatFinalPanelPropValue] Error formatting Final prop value ${value} for ${prop_id}:`, e);
          return '0';
      }
}


// --- 主转换函数 ---
export async function _enka_data_to_mys_data(enka_data) {
    if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
        logger.error("[enka_to_mys.js] Invalid or empty AvatarList in Enka data.");
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
            const enkaLevel = char.Level || 1;
            const enkaPromotionLevel = char.PromotionLevel || 0;
            const enkaRank = char.TalentLevel || 0;

            // --- 0. 获取角色基础(非图标)和详细数据 (使用 Hakush) ---
            const basicInfo = getCharBasicInfo(char_id);
            const charData = getCharacterData(char_id);
            if (!basicInfo || !charData) {
                logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing basic info or detailed data from Hakush.`);
                continue;
            }

            // --- 获取角色图标 URL (使用旧 avatars.json 逻辑) ---
            const characterCircleIconUrl = get_char_circle_icon_url_from_avatars(char_id) || DEFAULT_CIRCLE_ICON_URL;
            const characterBaseIconUrl = get_char_base_icon_url_from_avatars(char_id) || DEFAULT_BASE_ICON_URL;

            // --- 初始化最终要 push 到 result_list 的对象 ---
            const finalCharDataForModel = {
                id: char.Id, level: enkaLevel, name_mi18n: basicInfo.name, full_name_mi18n: basicInfo.full_name,
                element_type: basicInfo.element_type, sub_element_type: 0, camp_name_mi18n: basicInfo.camp_name_mi18n,
                avatar_profession: basicInfo.avatar_profession, rarity: basicInfo.rarity,
                group_icon_path: characterCircleIconUrl,
                hollow_icon_path: characterCircleIconUrl,
                role_square_url: characterBaseIconUrl,
                role_vertical_painting_url: characterBaseIconUrl,
                square_icon: characterBaseIconUrl,
                equip: [], weapon: null, properties: [], skills: [], rank: enkaRank, ranks: [], isNew: undefined
            };

            // --- 1. 初始化属性累加器 (保持不变) ---
            const props = {}; // 用于存储非基础三维的直接累加属性 (暴击、爆伤、精通、掌控、能回%、固定能回、穿透等)
            const percentAdds = { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 }; // 存储基础三维的百分比加成
            const flatAdds = { HpMax: 0, Attack: 0, Defence: 0 }; // 存储基础三维的固定值加成
            Object.keys(ID_TO_EN).forEach(keyId => {
                 const enKey = ID_TO_EN[keyId];
                 // 将所有非基础三维百分比和固定值的属性放入 props 初始化为 0
                 if (!['HpBase', 'AttackBase', 'DefenceBase', 'HpAdd', 'AttackAdd', 'DefenceAdd', 'HpMax', 'Attack', 'Defence'].includes(enKey)) {
                     props[enKey] = 0;
                 }
            });
            // 注意：props 中现在也可能包含 SpRecover (固定能回) 和 SpRecoverPercent (能回效率) 等

            // --- 2. 获取角色自身基础属性和初始面板值 (使用 Hakush) ---
            const { baseHp: charBaseHp, baseAtk: charBaseAtk, baseDef: charBaseDef } = calculateCharBaseStat(char_id, enkaLevel, enkaPromotionLevel);
            const initialStats = charData.Stats; // 获取 Hakush 基础数据，用于获取角色自带的初始面板值
            // 将角色自带的非基础三维初始值加到 props 中
            props.Crit = Number(initialStats?.Crit) || 500;
            props.CritDmg = Number(initialStats?.CritDamage) || 5000;
            props.BreakStun = Number(initialStats?.BreakStun) || 0;
            props.ElementAbnormalPower = Number(initialStats?.ElementAbnormalPower) || 0;
            props.ElementMystery = Number(initialStats?.ElementMystery) || 0;
            props.PenRate = (Number(initialStats?.PenRate) || 0) * 100; // 注意 PenRate 初始值通常为 0
            props.PenDelta = Number(initialStats?.PenDelta) || 0;
            props.SpRecover = Number(initialStats?.SpRecover) || 120; // 固定能回基础值 (e.g., 1.2/s)
            props.SpRecoverPercent = 10000; // 百分比能回基础值 (100%)

            // 这三个是计算最终属性的【基础】，武器主属性会加到这里
            let trueBaseHP = charBaseHp;
            let trueBaseATK = charBaseAtk;
            let trueBaseDEF = charBaseDef;
            logger.debug(`[${char_id}] Initial Base Stats (Hakush): HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
            logger.debug(`[${char_id}] Initial accumulated props:`, JSON.stringify(props));


            // --- 3. 处理武器 (累加属性到 trueBase 或 props/percentAdds/flatAdds) ---
            let weaponDisplay = null;
            if (char.Weapon?.Id) {
                const weapon_id = String(char.Weapon.Id);
                const weaponData = getWeaponData(weapon_id);
                if (weaponData) {
                    const weapon_level = char.Weapon.Level || 1;
                    const weapon_star = char.Weapon.UpgradeLevel || 0;
                    const weapon_break_level = char.Weapon.BreakLevel || 0;
                    const { baseValue, randValue, basePropId, randPropId } = render_weapon_detail(weapon_id, weapon_level, weapon_break_level);
                    logger.debug(`[${char_id}] Weapon ${weapon_id} L${weapon_level} B${weapon_break_level} R${weapon_star}: Base(${basePropId})=${baseValue}, Rand(${randPropId})=${randValue}`);

                    const atkId = PROP_NAME_TO_ID['攻击力'], hpId = PROP_NAME_TO_ID['生命值'], defId = PROP_NAME_TO_ID['防御力'];
                    // 累加武器主属性到真实基础值
                    if (basePropId === atkId) trueBaseATK += baseValue;
                    else if (basePropId === hpId) trueBaseHP += baseValue;
                    else if (basePropId === defId) trueBaseDEF += baseValue;
                    else {
                        // 其他类型的主属性（不太常见，但以防万一），直接加到 props
                        const baseEnProp = ID_TO_EN[basePropId];
                        if(baseEnProp && props[baseEnProp] !== undefined) props[baseEnProp] += baseValue;
                        else logger.warn(`[enka_to_mys.js] Weapon ${weapon_id} has unhandled base prop ID: ${basePropId}`);
                    }

                    // 累加武器副属性
                    if (randPropId && randValue > 0) {
                        const randEnProp = ID_TO_EN[randPropId];
                        const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
                        const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];

                        if (randPropId === hpAddId) percentAdds.HpAdd += randValue;
                        else if (randPropId === atkAddId) percentAdds.AttackAdd += randValue;
                        else if (randPropId === defAddId) percentAdds.DefenceAdd += randValue;
                        else if (randPropId === hpFlatId) flatAdds.HpMax += randValue;
                        else if (randPropId === atkFlatId) flatAdds.Attack += randValue;
                        else if (randPropId === defFlatId) flatAdds.Defence += randValue;
                        // 其他副属性（暴击、爆伤、能回等）直接加到 props
                        else if (randEnProp && props[randEnProp] !== undefined) props[randEnProp] += randValue;
                        else logger.warn(`[enka_to_mys.js] Unknown or unhandled weapon random prop ID: ${randPropId} (EN: ${randEnProp})`);
                    }

                    // 获取武器图标 (逻辑不变)
                    const weaponIconPath = weaponData.Icon;
                    const weaponIconUrl = weaponIconPath ? constructIconUrl(weaponIconPath) : DEFAULT_WEAPON_ICON_URL;
                    // 准备武器显示对象 (格式化逻辑不变)
                    weaponDisplay = {
                        id: char.Weapon.Id, level: weapon_level, name: weaponData.Name || `武器 ${weapon_id}`, star: weapon_star + 1,
                        icon: weaponIconUrl, rarity: HAKUSH_RARITY_MAP[weaponData.Rarity] || 'B', properties: [], main_properties: [],
                        talent_title: _.get(weaponData, ['Talents', String(weapon_star + 1), 'Name'], ''), talent_content: _.get(weaponData, ['Talents', String(weapon_star + 1), 'Desc'], ''),
                        profession: basicInfo.avatar_profession,
                     };
                     const base_prop_zh = ID_TO_PROP_NAME[basePropId] || `?(${basePropId})`;
                     weaponDisplay.main_properties.push({ property_name: base_prop_zh, property_id: basePropId, base: formatEquipWeaponPropValue(baseValue, basePropId) });
                     if (randPropId && randValue > 0) {
                         const rand_prop_zh = ID_TO_PROP_NAME[randPropId] || `?(${randPropId})`;
                         weaponDisplay.properties.push({ property_name: rand_prop_zh, property_id: randPropId, base: formatEquipWeaponPropValue(randValue, randPropId) });
                     }
                } else { logger.warn(`[enka_to_mys.js] Weapon metadata missing in Hakush for ID: ${weapon_id}`); }
            }
            finalCharDataForModel.weapon = weaponDisplay;
            logger.debug(`[${char_id}] True Base after weapon: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
            logger.debug(`[${char_id}] Accumulated props after weapon:`, JSON.stringify(props));
            logger.debug(`[${char_id}] Accumulated percentAdds after weapon:`, JSON.stringify(percentAdds));
            logger.debug(`[${char_id}] Accumulated flatAdds after weapon:`, JSON.stringify(flatAdds));


            // --- 4. 处理驱动盘 (累加属性到 props/percentAdds/flatAdds) ---
            const equipDisplayList = [];
            const suitCounts = {}; // 驱动盘套装计数器
            if (char.EquippedList && Array.isArray(char.EquippedList)) {
                for (const relic of char.EquippedList) {
                    if (!relic?.Equipment) continue;
                    const _equip = relic.Equipment;
                    const equip_id_str = String(_equip.Id);
                    const suit_id_str = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
                    if (!suit_id_str) { logger.warn(`[enka_to_mys.js] Could not derive suit ID for equip ID ${equip_id_str}`); continue; }

                    const equip_meta = hakush_equip_data[suit_id_str];
                    const relic_level = _equip.Level || 0;
                    const relic_tier = Math.floor(relic_level / 3); // 计算强化等级对应的档位
                    const suit_info = { suit_id: parseInt(suit_id_str), name: equip_meta?.CHS?.name || `套装 ${suit_id_str}`, own: 0, desc1: equip_meta?.CHS?.desc2 || "", desc2: equip_meta?.CHS?.desc4 || "" };
                    suitCounts[suit_info.suit_id] = (suitCounts[suit_info.suit_id] || 0) + 1;

                    const equipIconPath = equip_meta?.icon;
                    const equipIconUrl = equipIconPath ? constructIconUrl(equipIconPath) : DEFAULT_DRIVE_ICON_URL;
                    const raw_equip_obj = {
                        id: _equip.Id, level: relic_level, name: `${suit_info.name || '未知套装'}[${relic.Slot}]`, icon: equipIconUrl,
                        rarity: _equip.Rarity ? (_equip.Rarity == 4 ? 'S' : 'A') : 'A', properties: [], main_properties: [],
                        equip_suit: suit_info, equipment_type: relic.Slot
                    };

                    // 处理主词条 (累加到 props/percentAdds/flatAdds)
                    if (_equip.MainPropertyList?.[0]) {
                        const main_prop = _equip.MainPropertyList[0];
                        const prop_id_str = String(main_prop.PropertyId);
                        const en_prop_name = ID_TO_EN[prop_id_str];
                        if (en_prop_name) {
                             const base_value = main_prop.PropertyValue || 0; // 0级时的基础值
                             const increase_per_tier = MAIN_PROP_BASE_INCREASE[prop_id_str] ?? 0; // 每档(3级)的成长值
                             const total_main_value_raw = base_value + (increase_per_tier * relic_tier); // 计算当前等级的总值
                             logger.debug(`[${char_id}] Drive ${relic.Slot} Main: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Lvl:${relic_level}(T${relic_tier}), Base:${base_value}, Inc:${increase_per_tier} -> RawVal:${total_main_value_raw}`);

                             const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
                             const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];

                             if (prop_id_str === hpAddId) percentAdds.HpAdd += total_main_value_raw;
                             else if (prop_id_str === atkAddId) percentAdds.AttackAdd += total_main_value_raw;
                             else if (prop_id_str === defAddId) percentAdds.DefenceAdd += total_main_value_raw;
                             else if (prop_id_str === hpFlatId) flatAdds.HpMax += total_main_value_raw;
                             else if (prop_id_str === atkFlatId) flatAdds.Attack += total_main_value_raw;
                             else if (prop_id_str === defFlatId) flatAdds.Defence += total_main_value_raw;
                             // 其他主属性（如属伤、治疗、效果命中等）直接加到 props
                             else if (props[en_prop_name] !== undefined) props[en_prop_name] += total_main_value_raw;
                             else logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive main stat accumulation.`);

                            // 格式化显示 (保持不变)
                            const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
                            raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: formatEquipWeaponPropValue(total_main_value_raw, prop_id_str) });
                        } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive main stat ID ${prop_id_str}`); }
                    }

                    // 处理副词条 (累加到 props/percentAdds/flatAdds)
                    if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
                        for (const prop of _equip.RandomPropertyList) {
                            if (!prop || prop.PropertyId === undefined) continue;
                            const prop_id_str = String(prop.PropertyId);
                            const en_prop_name = ID_TO_EN[prop_id_str];
                             if (en_prop_name) {
                                 const prop_level = prop.PropertyLevel || 1; // 这个代表强化次数/等级
                                 const base_value_per_roll = prop.PropertyValue || 0; // 这个代表每次强化的基础值
                                 const total_substat_value_raw = base_value_per_roll * prop_level; // 总副词条值
                                 logger.debug(`[${char_id}] Drive ${relic.Slot} Sub: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Val/Roll:${base_value_per_roll}, Rolls:${prop_level} -> RawVal:${total_substat_value_raw}`);

                                 const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
                                 const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];

                                 if (prop_id_str === hpAddId) percentAdds.HpAdd += total_substat_value_raw;
                                 else if (prop_id_str === atkAddId) percentAdds.AttackAdd += total_substat_value_raw;
                                 else if (prop_id_str === defAddId) percentAdds.DefenceAdd += total_substat_value_raw;
                                 else if (prop_id_str === hpFlatId) flatAdds.HpMax += total_substat_value_raw;
                                 else if (prop_id_str === atkFlatId) flatAdds.Attack += total_substat_value_raw;
                                 else if (prop_id_str === defFlatId) flatAdds.Defence += total_substat_value_raw;
                                 // 其他副属性直接加到 props
                                 else if (props[en_prop_name] !== undefined) props[en_prop_name] += total_substat_value_raw;
                                 else logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive sub stat accumulation.`);

                                // 格式化显示 (保持不变)
                                const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
                                raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: formatEquipWeaponPropValue(total_substat_value_raw, prop_id_str) });
                             } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive sub stat ID ${prop_id_str}`); }
                        }
                    }
                    equipDisplayList.push(raw_equip_obj);
                }
                equipDisplayList.forEach(eq => { eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
                finalCharDataForModel.equip = equipDisplayList;
                logger.debug(`[${char_id}] Final accumulated props after drives:`, JSON.stringify(props));
                logger.debug(`[${char_id}] Final accumulated percentAdds after drives:`, JSON.stringify(percentAdds));
                logger.debug(`[${char_id}] Final accumulated flatAdds after drives:`, JSON.stringify(flatAdds));
            }

            // --- 5. 实例化外部属性计算器 ---
            // 将所有累加到的属性传递给外部计算器实例
            // 注意： PropertyCalculator 的构造函数需要能够接收并处理这些参数
            const propertiesGetter = new PropertyCalculator(
                trueBaseHP,
                trueBaseATK,
                trueBaseDEF,
                props,          // 包含暴击、爆伤、能回、精通、掌控、属伤等非基础三维的累加值
                percentAdds,    // 包含生命、攻击、防御百分比加成
                flatAdds        // 包含生命、攻击、防御固定值加成
                // initialStats // 如果外部计算器需要角色固有的初始面板值，也可以传进去
            );


            // --- 6. 调用外部计算器获取最终面板，并组装 properties 数组 ---
            const finalPropertiesArrayForModel = [];
            const added_mys_ids_for_model = new Set();

            // 定义需要展示的面板属性及其获取方式
            // key: 内部用于累加的属性名 (大致对应 ID_TO_EN 的值)
            // value: { zh: 中文名, mysId: MYS ID, getter: 外部计算器上的方法名 }
            const MYS_PANEL_CONFIG = {
                 HpMax: { zh: '生命值', mysId: 1, getter: 'getFormattedHpMax' },
                 Attack: { zh: '攻击力', mysId: 2, getter: 'getFormattedAttack' },
                 Defence: { zh: '防御力', mysId: 3, getter: 'getFormattedDefence' },
                 BreakStun: { zh: '冲击力', mysId: 4, getter: 'getFormattedBreakStun' },
                 Crit: { zh: '暴击率', mysId: 5, getter: 'getFormattedCrit' },
                 CritDmg: { zh: '暴击伤害', mysId: 6, getter: 'getFormattedCritDmg' },
                 ElementAbnormalPower: { zh: '异常掌控', mysId: 7, getter: 'getFormattedElementAbnormalPower' },
                 ElementMystery: { zh: '异常精通', mysId: 8, getter: 'getFormattedElementMystery' },
                 PenRate: { zh: '穿透率', mysId: 9, getter: 'getFormattedPenRate' },
                 SpRecoverPercent: { zh: '能量回复效率', mysId: 11, getter: 'getFormattedSpRecoverPercent' }, // 注意：这里用能回效率对应的key
                 PenDelta: { zh: '穿透值', mysId: 232, getter: 'getFormattedPenDelta' },
                 PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, getter: 'getFormattedPhysDmgBonus' },
                 FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, getter: 'getFormattedFireDmgBonus' },
                 IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, getter: 'getFormattedIceDmgBonus' },
                 ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, getter: 'getFormattedThunderDmgBonus' },
                 EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, getter: 'getFormattedEtherDmgBonus' },
                 // SpRecover: { zh: '能量自动回复(固定)', mysId: 某些特殊ID?, getter: 'getFormattedSpRecover' }, // 如果需要显示固定能回，可添加
            };

            // 遍历配置，调用 getter 获取格式化后的值
            for (const [propKey, config] of Object.entries(MYS_PANEL_CONFIG)) {
                 if (typeof propertiesGetter[config.getter] === 'function') {
                     const finalValueStr = propertiesGetter[config.getter](); // 调用外部方法获取格式化字符串

                     // 检查返回值是否有效，或者是否需要跳过显示 (外部getter可以返回 null/undefined 来表示不显示)
                     // 这里假设外部getter总会返回一个字符串（即使是 "0" 或 "0.0%"），如果需要跳过0值，外部getter应返回null
                     if (finalValueStr !== undefined && finalValueStr !== null) {
                         let propertyName = config.zh;
                         // ====[ 关键修改：特殊处理 MYS ID 11 的显示名称 ]====
                         if (config.mysId === 11) {
                             propertyName = '能量自动回复'; // <--- 强制使用旧名称
                         }

                         if (!added_mys_ids_for_model.has(config.mysId)) {
                             finalPropertiesArrayForModel.push({
                                 property_name: propertyName,
                                 property_id: config.mysId,
                                 base: "", // 移除 base 和 add 字段的计算
                                 add: "",
                                 final: finalValueStr // 使用从外部获取的格式化字符串
                             });
                             added_mys_ids_for_model.add(config.mysId);
                         } else {
                             // 如果 MYS ID 已经添加过（理论上不应该发生，除非配置错误），记录警告
                             logger.warn(`[enka_to_mys] Duplicate MYS ID ${config.mysId} encountered for key ${propKey}.`);
                         }
                     } else {
                        // logger.debug(`[enka_to_mys] Skipping property ${config.zh} (ID: ${config.mysId}) because getter returned null/undefined.`);
                     }
                 } else {
                     logger.warn(`[enka_to_mys] Getter function ${config.getter} not found on PropertyCalculator for key ${propKey}.`);
                 }
            }

            // 按 MYS API 推荐顺序排序 (逻辑不变)
            finalPropertiesArrayForModel.sort((a, b) => {
                const order = [1, 2, 3, 5, 6, 11, 4, 8, 7, 9, 232, 315, 316, 317, 318, 319];
                const indexA = order.indexOf(a.property_id); const indexB = order.indexOf(b.property_id);
                if (indexA === -1 && indexB === -1) return a.property_id - b.property_id; // 处理未在排序列表中的 ID
                if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB;
            });

            finalCharDataForModel.properties = finalPropertiesArrayForModel;

            // --- 7. 处理技能 (逻辑基本不变, 依赖 Hakush 数据) ---
            const skillsForModel = [];
            const charSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
            const hakushSkills = charData.Skill;
            const skillOrder = [0, 1, 2, 3, 5, 6]; // 技能显示顺序
            for (const enkaIndex of skillOrder) {
                const enkaIndexStr = String(enkaIndex);
                const currentLevel = charSkillLevels[enkaIndexStr];
                if (currentLevel === undefined) continue; // 跳过未解锁或数据不存在的技能

                const hakushSkillKey = ENKA_INDEX_TO_HAKUSH_SKILL_KEY[enkaIndex];
                if (hakushSkillKey && hakushSkills && hakushSkills[hakushSkillKey]) {
                    const hakushSkillDetail = hakushSkills[hakushSkillKey];
                    const skillItems = []; // 用于存储该技能的描述项 {title, text}

                    // 处理技能描述和倍率 (这部分逻辑保持不变)
                    (hakushSkillDetail.Description || []).forEach(descItem => {
                        let currentDescriptionText = descItem.Desc || ''; // 原始描述文本
                        const multipliers = []; // 用于存储计算出的倍率 {name, value}

                        if (descItem.Param && Array.isArray(descItem.Param)) {
                            descItem.Param.forEach(paramInfo => {
                                try {
                                     if (paramInfo.Param) { // 处理包含具体数值的参数
                                          const paramDict = paramInfo.Param;
                                          const effectKey = Object.keys(paramDict)[0]; // 通常只有一个 key
                                          if (effectKey && paramDict[effectKey]) {
                                              const skillValue = paramDict[effectKey];
                                              const mainValue = Number(skillValue.Main) || 0;     // 1级数值
                                              const growthValue = Number(skillValue.Growth) || 0; // 每级成长值
                                              // 计算当前等级的最终数值 (原始值，通常需要 /100 或 /10000)
                                              let finalValueRaw = mainValue + growthValue * (currentLevel - 1);
                                              let displayValue = ''; // 最终显示在描述中的字符串

                                              // 根据 Format 字段或名称判断如何格式化
                                              const format = skillValue.Format || '';
                                              if (format.includes('%')) { // 明确是百分比
                                                  displayValue = (finalValueRaw / 100).toFixed(1) + '%';
                                              } else if (format === 'I' || format === '' || format.includes('{0:0.#}')) { // 整数或需要根据名称判断
                                                  // 经验性判断：伤害/失衡倍率通常是百分比，其他是整数
                                                  if (paramInfo.Name?.includes('伤害倍率') || paramInfo.Name?.includes('失衡倍率')) {
                                                      displayValue = (finalValueRaw / 100).toFixed(1) + '%';
                                                  } else {
                                                      // 假设其他整数值也需要 /100 (需要根据具体游戏数据调整)
                                                      displayValue = String(Math.round(finalValueRaw / 100));
                                                  }
                                              } else { // 其他格式，暂时直接用原始值（可能需要调整）
                                                 displayValue = String(finalValueRaw);
                                              }

                                              multipliers.push({ name: paramInfo.Name || '数值', value: displayValue });

                                              // 如果描述中有占位符，替换为计算值
                                              if (paramInfo.Desc && currentDescriptionText.includes(paramInfo.Desc)) {
                                                  currentDescriptionText = currentDescriptionText.replace(paramInfo.Desc, `<color=#FED663>${displayValue}</color>`);
                                              }
                                          }
                                      } else if (paramInfo.Desc && !paramInfo.Param && paramInfo.Name) {
                                         // 处理纯文本描述的参数项，附加到主描述后
                                         if (!currentDescriptionText.includes(paramInfo.Name)) {
                                             currentDescriptionText += (currentDescriptionText ? '\n' : '') + `${paramInfo.Name}: ${paramInfo.Desc}`;
                                         }
                                      }
                                } catch (paramError) { logger.error(`[enka_to_mys] Error processing skill param for ${char_id}, skill ${hakushSkillKey}, param: ${paramInfo?.Name}`, paramError); }
                            });
                        }

                        // 清理描述文本中的 HTML 和特殊标记
                        let processedText = currentDescriptionText.replace(/<color=#[0-9A-Fa-f]+>/g, '').replace(/<\/color>/g, '');
                        processedText = processedText.replace(/<IconMap:[^>]+>/g, '').trim(); // 移除图标标记

                        // 将倍率附加到描述文本后面
                        let multiplierText = multipliers.map(m => `${m.name}: ${m.value}`).join('\n');
                        if(descItem.Name || processedText || multiplierText) {
                            skillItems.push({
                                title: descItem.Name || '', // 技能小标题
                                text: processedText + (multiplierText ? (processedText ? '\n\n' : '') + multiplierText : '') // 合并处理后的描述和倍率文本
                            });
                        }
                        currentDescriptionText = ''; // 重置
                    });

                    // 如果没有解析出任何 item，但确实有描述，使用第一个描述作为保底
                    if (skillItems.length === 0 && hakushSkillDetail.Description?.length > 0) {
                        const firstDesc = hakushSkillDetail.Description[0];
                        skillItems.push({
                            title: firstDesc.Name || `技能 ${enkaIndex}`,
                            text: (firstDesc.Desc || '').replace(/<IconMap:[^>]+>/g, '').trim() // 简单清理
                        });
                    }

                    // 添加到最终技能列表
                    skillsForModel.push({
                        level: currentLevel,
                        skill_type: enkaIndex, // 使用 Enka 索引作为 type
                        items: skillItems.filter(item => item.title || item.text), // 过滤掉完全空的 item
                    });

                } else {
                    // 如果 Hakush 数据缺失或映射失败
                    logger.warn(`[enka_to_mys] Skill mapping or data not found for Enka Index ${enkaIndex} (Hakush Key: ${hakushSkillKey}) on char ${char_id}`);
                    skillsForModel.push({
                        level: currentLevel,
                        skill_type: enkaIndex,
                        items: [{ title: `未知技能 ${enkaIndex}`, text: '技能描述数据缺失'}]
                    });
                }
            }
            // 按 skill_type 排序
            skillsForModel.sort((a, b) => a.skill_type - b.skill_type);
            finalCharDataForModel.skills = skillsForModel;

            // --- 8. 处理核心强化/影位 (逻辑不变, 依赖 Hakush 数据) ---
            const ranksForModel = [];
            const hakushTalents = charData.Talent || {}; // 获取 Hakush 中的影位数据
            const maxRank = 6; // 影位最大等级
            for (let i = 1; i <= maxRank; i++) {
                 const rankKey = String(i);
                 const rankInfo = hakushTalents[rankKey];
                 if (rankInfo) {
                     ranksForModel.push({
                         id: i,
                         name: rankInfo.Name || `影位 ${i}`,
                         desc: (rankInfo.Desc || rankInfo.Desc2 || '').replace(/<IconMap:[^>]+>/g, '').trim(), // 优先用 Desc，没有则用 Desc2，并清理标记
                         pos: i,
                         is_unlocked: i <= enkaRank // 判断是否解锁
                     });
                 } else {
                     // Hakush 数据缺失
                       ranksForModel.push({
                           id: i,
                           name: `影位 ${i}`,
                           desc: '影位数据缺失',
                           pos: i,
                           is_unlocked: i <= enkaRank
                       });
                 }
            }
            finalCharDataForModel.ranks = ranksForModel;

            // 将处理好的角色数据添加到结果列表
            result_list.push(finalCharDataForModel);

        } catch (processingError) {
            logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message);
            logger.error(processingError.stack);
        }
    }

    logger.info(`[enka_to_mys.js] Enka data conversion finished. Processed ${result_list.length} characters.`);
    return result_list;
}

/**
 * @typedef {object} PropertyData // 类型定义 (保持不变)
 * @property {number} property_id MYS API 属性 ID
 * @property {string} property_name 属性中文名
 * @property {string} final 最终格式化后的值
 * @property {string} [base]
 * @property {string} [add]
 */
// import {
//     hakush_equip_data,
//     getCharacterData,
//     getWeaponData,
//     ID_TO_PROP_NAME,
//     PROP_NAME_TO_ID,
//     ID_TO_EN,
//     PERCENT_ID_LIST,
//     MAIN_PROP_BASE_INCREASE,
//     ENKA_INDEX_TO_HAKUSH_SKILL_KEY,
//     HAKUSH_RARITY_MAP,
//     getCharBasicInfo,          // 用于获取角色名称、元素、职业等非图标信息
//     calculateCharBaseStat,     // 基于 Hakush 计算基础属性
//     render_weapon_detail,      // 基于 Hakush 计算武器属性
//     constructIconUrl,          // 基于 Hakush 路径构造武器/驱动盘图标 URL
//     // 导入基于旧 avatars.json 的角色图标 URL 获取函数
//     get_char_circle_icon_url_from_avatars,
//     get_char_base_icon_url_from_avatars,
// } from './name_convert.js'; // 确保 name_convert.js 包含这些导出
// import _ from 'lodash';
//
// // 使用 console 作为临时日志记录器
// const logger = console;
//
// // MYS API 属性 ID 映射
// const MYSAPI_PROP_ID = {
//     '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
//     '穿透率': 9, /*'能量自动回复': 11,*/ '能量回复效率': 11, // MYS ID 11 通常对应能量回复效率
//     '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
// };
//
// // 默认图标 URL (如果获取失败，可以使用这些)
// const DEFAULT_CIRCLE_ICON_URL = ''; // 可选: 'https://your-cdn.com/default_circle.png'
// const DEFAULT_BASE_ICON_URL = '';   // 可选: 'https://your-cdn.com/default_base.png'
// const DEFAULT_WEAPON_ICON_URL = ''; // 可选: 'https://your-cdn.com/default_weapon.png'
// const DEFAULT_DRIVE_ICON_URL = '';  // 可选: 'https://your-cdn.com/default_drive.png'
//
//
// // --- 格式化函数 (保持不变) ---
// function formatEquipWeaponPropValue(value, prop_id) {
//     const idStr = String(prop_id);
//     const isPercentProp = PERCENT_ID_LIST.includes(idStr);
//     const numericValue = Number(value);
//
//     if (value === undefined || value === null || isNaN(numericValue)) {
//         return isPercentProp ? '0.0%' : '0';
//     }
//
//     try {
//         if (isPercentProp) {
//              // 假设 Enka/Hakush 的百分比值是目标值的 100 倍 (例如 500 代表 5.0%)
//              return (numericValue / 100).toFixed(1) + '%';
//         }
//         // 固定值能量回复 (Enka: 30503, Hakush: 30501?)
//         else if (idStr === '30503' || idStr === '30501') {
//              // 假设 Enka/Hakush 的值是目标值的 1000 倍 (例如 1200 代表 1.20/s)
//              return (numericValue / 1000).toFixed(2);
//         }
//         // 其他固定值，如精通、掌控、穿透值等，直接取整
//         else {
//              return String(Math.floor(numericValue));
//         }
//     } catch (e) {
//         logger.error(`[formatEquipWeaponPropValue] Error formatting prop value ${value} for ${prop_id}:`, e);
//         return '0';
//     }
// }
//
// function formatFinalPanelPropValue(value, prop_id) {
//       const idStr = String(prop_id);
//       const isPercentProp = PERCENT_ID_LIST.includes(idStr);
//       const numericValue = Number(value);
//
//       if (value === undefined || value === null || isNaN(numericValue)) {
//           return isPercentProp ? '0.0%' : '0';
//       }
//
//       try {
//           // 最终面板百分比显示，保留一位小数
//           if (isPercentProp) {
//               // 假设传入的 value 是目标值的 100 倍
//               return (numericValue / 100).toFixed(1) + '%';
//           }
//           // 固定值能量回复 (30503/30501)
//           else if (idStr === '30503' || idStr === '30501') {
//                // 假设传入的 value 是目标值的 100 倍 (例如 props.SpRecover = 120)
//                return (numericValue / 100).toFixed(2); // 显示为 1.20
//           }
//           // 其他固定值取整
//           else {
//               return String(Math.floor(numericValue));
//           }
//       } catch (e) {
//           logger.error(`[formatFinalPanelPropValue] Error formatting Final prop value ${value} for ${prop_id}:`, e);
//           return '0';
//       }
// }
//
//
// // --- 主转换函数 ---
// export async function _enka_data_to_mys_data(enka_data) {
//     if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
//         logger.error("[enka_to_mys.js] Invalid or empty AvatarList in Enka data.");
//         return [];
//     }
//
//     const uid = enka_data.uid;
//     const result_list = []; // 用于存储最终生成的、符合 ZZZAvatarInfo 输入期望的对象列表
//
//     for (const char of enka_data.PlayerInfo.ShowcaseDetail.AvatarList) {
//         try {
//             if (!char || typeof char.Id === 'undefined') {
//                 logger.warn("[enka_to_mys.js] Skipping invalid character entry in AvatarList.");
//                 continue;
//             }
//             const char_id = String(char.Id);
//             const enkaLevel = char.Level || 1;
//             const enkaPromotionLevel = char.PromotionLevel || 0;
//             const enkaRank = char.TalentLevel || 0;
//
//             // --- 0. 获取角色基础(非图标)和详细数据 (使用 Hakush) ---
//             const basicInfo = getCharBasicInfo(char_id);
//             const charData = getCharacterData(char_id);
//             if (!basicInfo || !charData) {
//                 logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing basic info or detailed data from Hakush.`);
//                 continue;
//             }
//
//             // --- 获取角色图标 URL (使用旧 avatars.json 逻辑) ---
//             const characterCircleIconUrl = get_char_circle_icon_url_from_avatars(char_id) || DEFAULT_CIRCLE_ICON_URL;
//             const characterBaseIconUrl = get_char_base_icon_url_from_avatars(char_id) || DEFAULT_BASE_ICON_URL;
//
//             // --- 初始化最终要 push 到 result_list 的对象 ---
//             const finalCharDataForModel = {
//                 id: char.Id, level: enkaLevel, name_mi18n: basicInfo.name, full_name_mi18n: basicInfo.full_name,
//                 element_type: basicInfo.element_type, sub_element_type: 0, camp_name_mi18n: basicInfo.camp_name_mi18n,
//                 avatar_profession: basicInfo.avatar_profession, rarity: basicInfo.rarity,
//                 group_icon_path: characterCircleIconUrl,
//                 hollow_icon_path: characterCircleIconUrl,
//                 role_square_url: characterBaseIconUrl,
//                 role_vertical_painting_url: characterBaseIconUrl,
//                 square_icon: characterBaseIconUrl,
//                 equip: [], weapon: null, properties: [], skills: [], rank: enkaRank, ranks: [], isNew: undefined
//             };
//
//             // --- 1. 初始化属性累加器 ---
//             const props = {};
//             const percentAdds = { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 };
//             const flatAdds = { HpMax: 0, Attack: 0, Defence: 0 };
//             Object.keys(ID_TO_EN).forEach(keyId => {
//                  const enKey = ID_TO_EN[keyId];
//                  if (!['HpBase', 'AttackBase', 'DefenceBase', 'HpAdd', 'AttackAdd', 'DefenceAdd'].includes(enKey)) {
//                      props[enKey] = 0;
//                  }
//             });
//             props.HpMax = 0; props.Attack = 0; props.Defence = 0;
//
//             // --- 2. 计算角色自身基础属性 (使用 Hakush) ---
//             const { baseHp: charBaseHp, baseAtk: charBaseAtk, baseDef: charBaseDef } = calculateCharBaseStat(char_id, enkaLevel, enkaPromotionLevel);
//             const initialStats = charData.Stats; // 获取 Hakush 基础数据
//             props.Crit = Number(initialStats?.Crit) || 500;
//             props.CritDmg = Number(initialStats?.CritDamage) || 5000;
//             props.BreakStun = Number(initialStats?.BreakStun) || 0;
//             props.ElementAbnormalPower = Number(initialStats?.ElementAbnormalPower) || 0;
//             props.ElementMystery = Number(initialStats?.ElementMystery) || 0;
//             props.PenRate = (Number(initialStats?.PenRate) || 0) * 100;
//             props.PenDelta = Number(initialStats?.PenDelta) || 0;
//             props.SpRecover = Number(initialStats?.SpRecover) || 120; // 固定能回基础值
//             props.SpRecoverPercent = 10000; // 百分比能回基础值
//             let trueBaseHP = charBaseHp;
//             let trueBaseATK = charBaseAtk;
//             let trueBaseDEF = charBaseDef;
//             logger.debug(`[${char_id}] Initial Base Stats (Hakush): HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
//
//             // --- 3. 处理武器 (图标使用 Hakush + constructIconUrl) ---
//             let weaponDisplay = null;
//             if (char.Weapon?.Id) {
//                 const weapon_id = String(char.Weapon.Id);
//                 const weaponData = getWeaponData(weapon_id);
//                 if (weaponData) {
//                     const weapon_level = char.Weapon.Level || 1;
//                     const weapon_star = char.Weapon.UpgradeLevel || 0;
//                     const weapon_break_level = char.Weapon.BreakLevel || 0;
//                     const { baseValue, randValue, basePropId, randPropId } = render_weapon_detail(weapon_id, weapon_level, weapon_break_level);
//                     logger.debug(`[${char_id}] Weapon ${weapon_id} L${weapon_level} B${weapon_break_level} R${weapon_star}: Base(${basePropId})=${baseValue}, Rand(${randPropId})=${randValue}`);
//                     const atkId = PROP_NAME_TO_ID['攻击力'], hpId = PROP_NAME_TO_ID['生命值'], defId = PROP_NAME_TO_ID['防御力'];
//                     // 累加武器主属性到真实基础值
//                     if (basePropId === atkId) trueBaseATK += baseValue;
//                     else if (basePropId === hpId) trueBaseHP += baseValue;
//                     else if (basePropId === defId) trueBaseDEF += baseValue;
//                     else {
//                         const baseEnProp = ID_TO_EN[basePropId];
//                         if(baseEnProp && props[baseEnProp] !== undefined) props[baseEnProp] += baseValue;
//                         else logger.warn(`[enka_to_mys.js] Weapon ${weapon_id} has unhandled base prop ID: ${basePropId}`);
//                     }
//                     // 累加武器副属性
//                     if (randPropId && randValue > 0) {
//                         const randEnProp = ID_TO_EN[randPropId], hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
//                         const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];
//                         if (randPropId === hpAddId) percentAdds.HpAdd += randValue;
//                         else if (randPropId === atkAddId) percentAdds.AttackAdd += randValue;
//                         else if (randPropId === defAddId) percentAdds.DefenceAdd += randValue;
//                         else if (randPropId === hpFlatId) flatAdds.HpMax += randValue;
//                         else if (randPropId === atkFlatId) flatAdds.Attack += randValue;
//                         else if (randPropId === defFlatId) flatAdds.Defence += randValue;
//                         else if (randEnProp && props[randEnProp] !== undefined) props[randEnProp] += randValue;
//                         else logger.warn(`[enka_to_mys.js] Unknown or unhandled weapon random prop ID: ${randPropId} (EN: ${randEnProp})`);
//                     }
//                     // 获取武器图标
//                     const weaponIconPath = weaponData.Icon;
//                     const weaponIconUrl = weaponIconPath ? constructIconUrl(weaponIconPath) : DEFAULT_WEAPON_ICON_URL;
//                     // 准备武器显示对象
//                     weaponDisplay = {
//                         id: char.Weapon.Id, level: weapon_level, name: weaponData.Name || `武器 ${weapon_id}`, star: weapon_star + 1,
//                         icon: weaponIconUrl, rarity: HAKUSH_RARITY_MAP[weaponData.Rarity] || 'B', properties: [], main_properties: [],
//                         talent_title: _.get(weaponData, ['Talents', String(weapon_star + 1), 'Name'], ''), talent_content: _.get(weaponData, ['Talents', String(weapon_star + 1), 'Desc'], ''),
//                         profession: basicInfo.avatar_profession,
//                      };
//                      const base_prop_zh = ID_TO_PROP_NAME[basePropId] || `?(${basePropId})`;
//                      weaponDisplay.main_properties.push({ property_name: base_prop_zh, property_id: basePropId, base: formatEquipWeaponPropValue(baseValue, basePropId) });
//                      if (randPropId && randValue > 0) {
//                          const rand_prop_zh = ID_TO_PROP_NAME[randPropId] || `?(${randPropId})`;
//                          weaponDisplay.properties.push({ property_name: rand_prop_zh, property_id: randPropId, base: formatEquipWeaponPropValue(randValue, randPropId) });
//                      }
//                 } else { logger.warn(`[enka_to_mys.js] Weapon metadata missing in Hakush for ID: ${weapon_id}`); }
//             }
//             finalCharDataForModel.weapon = weaponDisplay; // 填充武器数据
//             logger.debug(`[${char_id}] True Base after weapon: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
//
//             // --- 4. 处理驱动盘 (图标使用 Hakush + constructIconUrl) ---
//             const equipDisplayList = [];
//             const suitCounts = {};
//             if (char.EquippedList && Array.isArray(char.EquippedList)) {
//                 for (const relic of char.EquippedList) {
//                     if (!relic?.Equipment) continue;
//                     const _equip = relic.Equipment;
//                     const equip_id_str = String(_equip.Id);
//                     const suit_id_str = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
//                     if (!suit_id_str) { logger.warn(`[enka_to_mys.js] Could not derive suit ID for equip ID ${equip_id_str}`); continue; }
//                     const equip_meta = hakush_equip_data[suit_id_str];
//                     //if (!equip_meta) { logger.warn(`[enka_to_mys.js] Relic suit metadata missing in Hakush data for suit ID: ${suit_id_str}`); } // 减少警告
//                     const relic_level = _equip.Level || 0;
//                     const relic_tier = Math.floor(relic_level / 3);
//                     const suit_info = { suit_id: parseInt(suit_id_str), name: equip_meta?.CHS?.name || `套装 ${suit_id_str}`, own: 0, desc1: equip_meta?.CHS?.desc2 || "", desc2: equip_meta?.CHS?.desc4 || "" };
//                     suitCounts[suit_info.suit_id] = (suitCounts[suit_info.suit_id] || 0) + 1;
//                     const equipIconPath = equip_meta?.icon;
//                     const equipIconUrl = equipIconPath ? constructIconUrl(equipIconPath) : DEFAULT_DRIVE_ICON_URL;
//                     const raw_equip_obj = {
//                         id: _equip.Id, level: relic_level, name: `${suit_info.name || '未知套装'}[${relic.Slot}]`, icon: equipIconUrl,
//                         rarity: _equip.Rarity ? (_equip.Rarity == 4 ? 'S' : 'A') : 'A', properties: [], main_properties: [],
//                         equip_suit: suit_info, equipment_type: relic.Slot
//                     };
//                     // 处理主词条
//                     if (_equip.MainPropertyList?.[0]) {
//                         const main_prop = _equip.MainPropertyList[0];
//                         const prop_id_str = String(main_prop.PropertyId);
//                         const en_prop_name = ID_TO_EN[prop_id_str];
//                         if (en_prop_name) {
//                              const base_value = main_prop.PropertyValue || 0;
//                              const increase_per_tier = MAIN_PROP_BASE_INCREASE[prop_id_str] ?? 0;
//                              const total_main_value_raw = base_value + (increase_per_tier * relic_tier);
//                              logger.debug(`[${char_id}] Drive ${relic.Slot} Main: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Lvl:${relic_level}(T${relic_tier}), Base:${base_value}, Inc:${increase_per_tier} -> RawVal:${total_main_value_raw}`);
//                              const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
//                              const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];
//                              if (prop_id_str === hpAddId) percentAdds.HpAdd += total_main_value_raw;
//                              else if (prop_id_str === atkAddId) percentAdds.AttackAdd += total_main_value_raw;
//                              else if (prop_id_str === defAddId) percentAdds.DefenceAdd += total_main_value_raw;
//                              else if (prop_id_str === hpFlatId) flatAdds.HpMax += total_main_value_raw;
//                              else if (prop_id_str === atkFlatId) flatAdds.Attack += total_main_value_raw;
//                              else if (prop_id_str === defFlatId) flatAdds.Defence += total_main_value_raw;
//                              else if (props[en_prop_name] !== undefined) props[en_prop_name] += total_main_value_raw;
//                              else logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive main stat accumulation.`);
//                             const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
//                             raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: formatEquipWeaponPropValue(total_main_value_raw, prop_id_str) });
//                         } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive main stat ID ${prop_id_str}`); }
//                     }
//                     // 处理副词条
//                     if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
//                         for (const prop of _equip.RandomPropertyList) {
//                             if (!prop || prop.PropertyId === undefined) continue;
//                             const prop_id_str = String(prop.PropertyId);
//                             const en_prop_name = ID_TO_EN[prop_id_str];
//                              if (en_prop_name) {
//                                  const prop_level = prop.PropertyLevel || 1;
//                                  const base_value_per_roll = prop.PropertyValue || 0;
//                                  const total_substat_value_raw = base_value_per_roll * prop_level;
//                                  logger.debug(`[${char_id}] Drive ${relic.Slot} Sub: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Val/Roll:${base_value_per_roll}, Rolls:${prop_level} -> RawVal:${total_substat_value_raw}`);
//                                  const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
//                                  const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];
//                                  if (prop_id_str === hpAddId) percentAdds.HpAdd += total_substat_value_raw;
//                                  else if (prop_id_str === atkAddId) percentAdds.AttackAdd += total_substat_value_raw;
//                                  else if (prop_id_str === defAddId) percentAdds.DefenceAdd += total_substat_value_raw;
//                                  else if (prop_id_str === hpFlatId) flatAdds.HpMax += total_substat_value_raw;
//                                  else if (prop_id_str === atkFlatId) flatAdds.Attack += total_substat_value_raw;
//                                  else if (prop_id_str === defFlatId) flatAdds.Defence += total_substat_value_raw;
//                                  else if (props[en_prop_name] !== undefined) props[en_prop_name] += total_substat_value_raw;
//                                  else logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive sub stat accumulation.`);
//                                 const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
//                                 raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: formatEquipWeaponPropValue(total_substat_value_raw, prop_id_str) });
//                              } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive sub stat ID ${prop_id_str}`); }
//                         }
//                     }
//                     equipDisplayList.push(raw_equip_obj);
//                 }
//                 equipDisplayList.forEach(eq => { eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
//                 finalCharDataForModel.equip = equipDisplayList; // 填充驱动盘数据
//                 logger.debug(`[${char_id}] Flat Adds after drives:`, JSON.stringify(flatAdds));
//                 logger.debug(`[${char_id}] Percent Adds after drives:`, JSON.stringify(percentAdds));
//                 logger.debug(`[${char_id}] Other props after drives:`, JSON.stringify(props));
//             }
//
//             // --- 5. 最终属性计算 ---
//             props.HpMax = trueBaseHP * (1 + (percentAdds.HpAdd || 0) / 10000) + (flatAdds.HpMax || 0);
//             props.Attack = trueBaseATK * (1 + (percentAdds.AttackAdd || 0) / 10000) + (flatAdds.Attack || 0);
//             props.Defence = trueBaseDEF * (1 + (percentAdds.DefenceAdd || 0) / 10000) + (flatAdds.Defence || 0);
//             logger.info(`[${char_id}] FINAL Calculated Raw Stats: HP=${props.HpMax.toFixed(2)}, ATK=${props.Attack.toFixed(2)}, DEF=${props.Defence.toFixed(2)}`);
//             logger.info(`[${char_id}] FINAL Calculated Raw Others: Crit=${props.Crit}, CritDmg=${props.CritDmg}, ER%=${props.SpRecoverPercent}`);
//
//             // --- 6. 格式化最终面板 -> 填充 finalCharDataForModel.properties 数组 ---
//             const finalPropertiesArrayForModel = [];
//             const added_mys_ids_for_model = new Set();
//             const final_stat_mapping = {
//                  HpMax: { zh: '生命值', mysId: 1, enkaId: PROP_NAME_TO_ID['生命值'] },
//                  Attack: { zh: '攻击力', mysId: 2, enkaId: PROP_NAME_TO_ID['攻击力'] },
//                  Defence: { zh: '防御力', mysId: 3, enkaId: PROP_NAME_TO_ID['防御力'] },
//                  BreakStun: { zh: '冲击力', mysId: 4, enkaId: PROP_NAME_TO_ID['冲击力'] },
//                  Crit: { zh: '暴击率', mysId: 5, enkaId: PROP_NAME_TO_ID['暴击率'] },
//                  CritDmg: { zh: '暴击伤害', mysId: 6, enkaId: PROP_NAME_TO_ID['暴击伤害'] },
//                  ElementAbnormalPower: { zh: '异常掌控', mysId: 7, enkaId: PROP_NAME_TO_ID['异常掌控'] },
//                  ElementMystery: { zh: '异常精通', mysId: 8, enkaId: PROP_NAME_TO_ID['异常精通'] },
//                  PenRate: { zh: '穿透率', mysId: 9, enkaId: PROP_NAME_TO_ID['穿透率'] },
//                  SpRecoverPercent: { zh: '能量回复效率', mysId: 11, enkaId: PROP_NAME_TO_ID['能量回复百分比'] }, // 使用百分比作为 MYS ID 11 的代表
//                  PenDelta: { zh: '穿透值', mysId: 232, enkaId: PROP_NAME_TO_ID['穿透值'] },
//                  PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, enkaId: PROP_NAME_TO_ID['物理伤害加成'] },
//                  FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, enkaId: PROP_NAME_TO_ID['火属性伤害加成'] },
//                  IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, enkaId: PROP_NAME_TO_ID['冰属性伤害加成'] },
//                  ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, enkaId: PROP_NAME_TO_ID['雷属性伤害加成'] },
//                  EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, enkaId: PROP_NAME_TO_ID['以太属性伤害加成'] },
//                  // 不再需要 SpRecover 的映射
//             };
//
//             // 遍历计算好的属性，填充 finalPropertiesArrayForModel (跳过 ID 11)
//             for (const [propKey, mapping] of Object.entries(final_stat_mapping)) {
//                  if (mapping.mysId === 11) continue; // 跳过能量回复的映射键
//                  const rawValue = props[propKey];
//                  if (rawValue !== undefined) {
//                      const numericValue = Number(rawValue);
//                      const alwaysShow = ['HpMax', 'Attack', 'Defence', 'Crit', 'CritDmg'].includes(propKey);
//                      const isZero = numericValue === 0;
//                      const neededByTemplate = ['PenRate'].includes(propKey); // 假设模板需要穿透率即使为0
//                      const shouldShow = alwaysShow || neededByTemplate || !isZero;
//
//                      if (shouldShow) {
//                          if (!added_mys_ids_for_model.has(mapping.mysId)) {
//                              const final_value_str = formatFinalPanelPropValue(rawValue, mapping.enkaId);
//                              if (final_value_str !== undefined && final_value_str !== null) {
//                                  finalPropertiesArrayForModel.push({
//                                      property_name: mapping.zh, property_id: mapping.mysId,
//                                      base: "", add: "", final: final_value_str
//                                  });
//                                  added_mys_ids_for_model.add(mapping.mysId);
//                              } else {
//                                  logger.warn(`[enka_to_mys] Invalid final value for ${propKey} (ID: ${mapping.enkaId}), rawValue: ${rawValue}`);
//                                  finalPropertiesArrayForModel.push({ property_name: mapping.zh, property_id: mapping.mysId, base: "", add: "", final: 'N/A' });
//                                  added_mys_ids_for_model.add(mapping.mysId);
//                              }
//                          }
//                      }
//                  }
//             }
//
//             // 确保属性列表完整性
//             const ensurePropertyExistsForModel = (propName, mysId, enkaIdForFormatting, propKey) => {
//                  if (mysId === 11) return; // 跳过能量回复，下面特殊处理
//                  if (!added_mys_ids_for_model.has(mysId)) {
//                      const rawValue = props[propKey] ?? (
//                          propKey === 'Crit' ? (initialStats?.Crit || 500) :
//                          propKey === 'CritDmg' ? (initialStats?.CritDamage || 5000) :
//                          propKey === 'SpRecoverPercent' ? 10000 : // 这个不会被调用到
//                          propKey === 'SpRecover' ? (initialStats?.SpRecover || 120) : // 固定能回，如果需要显示可以取消注释
//                          propKey === 'PenRate' ? ((initialStats?.PenRate || 0) * 100) :
//                          0
//                      );
//                      const finalValueStr = formatFinalPanelPropValue(rawValue, enkaIdForFormatting);
//                      const displayValue = (finalValueStr !== undefined && finalValueStr !== null) ? finalValueStr : 'N/A';
//                      finalPropertiesArrayForModel.push({
//                          property_name: propName, property_id: mysId,
//                          base: "", add: "", final: displayValue
//                      });
//                      added_mys_ids_for_model.add(mysId);
//                      // logger.debug(`[enka_to_mys] Ensured property ${propName} (ID: ${mysId}) exists with value: ${displayValue}`);
//                  }
//              };
//
//             // 确保基础属性等存在 (不处理 ID 11)
//             ensurePropertyExistsForModel('生命值', 1, PROP_NAME_TO_ID['生命值'], 'HpMax');
//             ensurePropertyExistsForModel('攻击力', 2, PROP_NAME_TO_ID['攻击力'], 'Attack');
//             ensurePropertyExistsForModel('防御力', 3, PROP_NAME_TO_ID['防御力'], 'Defence');
//             ensurePropertyExistsForModel('暴击率', 5, PROP_NAME_TO_ID['暴击率'], 'Crit');
//             ensurePropertyExistsForModel('暴击伤害', 6, PROP_NAME_TO_ID['暴击伤害'], 'CritDmg');
//             ensurePropertyExistsForModel('冲击力', 4, PROP_NAME_TO_ID['冲击力'], 'BreakStun');
//             ensurePropertyExistsForModel('异常掌控', 7, PROP_NAME_TO_ID['异常掌控'], 'ElementAbnormalPower');
//             ensurePropertyExistsForModel('异常精通', 8, PROP_NAME_TO_ID['异常精通'], 'ElementMystery');
//             ensurePropertyExistsForModel('穿透率', 9, PROP_NAME_TO_ID['穿透率'], 'PenRate');
//             ensurePropertyExistsForModel('穿透值', 232, PROP_NAME_TO_ID['穿透值'], 'PenDelta');
//             // 如果需要显示固定能量回复，可以取消下面这行的注释，但这会与 ID 11 冲突
//             // ensurePropertyExistsForModel('能量自动回复', 11, PROP_NAME_TO_ID['能量自动回复'], 'SpRecover');
//
//             // ====[ 关键修改：特殊处理 MYS ID 11，模拟旧版输出 ]====
//             if (!added_mys_ids_for_model.has(11)) {
//                 const energyRecoveryPropKey = 'SpRecoverPercent'; // 我们计算和关心的是百分比
//                 const energyRecoveryEnkaIdPercent = PROP_NAME_TO_ID['能量回复百分比']; // '30502'
//                 const energyRecoveryRawValue = props[energyRecoveryPropKey] ?? 10000; // 获取计算后的百分比值
//                 // 使用百分比ID和值进行格式化，得到正确的百分比字符串
//                 const energyRecoveryFinalValueStr = formatFinalPanelPropValue(energyRecoveryRawValue, energyRecoveryEnkaIdPercent);
//
//                 // 添加到数组，但强制使用旧的名称 '能量自动回复'
//                 finalPropertiesArrayForModel.push({
//                     property_name: '能量自动回复', // <--- 强制使用旧名称
//                     property_id: 11,            // MYS ID 保持 11
//                     base: "", add: "",
//                     final: energyRecoveryFinalValueStr // 值是正确计算的百分比字符串
//                 });
//                 added_mys_ids_for_model.add(11); // 标记已添加
//                 logger.debug(`[enka_to_mys] Ensured property '能量自动回复' (ID: 11) exists with final value: ${energyRecoveryFinalValueStr}`);
//             }
//
//             // 按 MYS API 推荐顺序排序
//             finalPropertiesArrayForModel.sort((a, b) => {
//                 const order = [1, 2, 3, 5, 6, 11, 4, 8, 7, 9, 232, 315, 316, 317, 318, 319];
//                 const indexA = order.indexOf(a.property_id); const indexB = order.indexOf(b.property_id);
//                 if (indexA === -1 && indexB === -1) return a.property_id - b.property_id;
//                 if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB;
//             });
//
//             // 将最终生成的属性数组赋值给要传递给模型的对象
//             finalCharDataForModel.properties = finalPropertiesArrayForModel;
//
//             // --- 7. 处理技能 (使用 Hakush) ---
//             const skillsForModel = [];
//             const charSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
//             const hakushSkills = charData.Skill;
//             const skillOrder = [0, 1, 2, 3, 5, 6];
//             for (const enkaIndex of skillOrder) {
//                 const enkaIndexStr = String(enkaIndex);
//                 const currentLevel = charSkillLevels[enkaIndexStr];
//                 if (currentLevel === undefined) continue;
//                 const hakushSkillKey = ENKA_INDEX_TO_HAKUSH_SKILL_KEY[enkaIndex];
//                 if (hakushSkillKey && hakushSkills && hakushSkills[hakushSkillKey]) {
//                     const hakushSkillDetail = hakushSkills[hakushSkillKey];
//                     const skillItems = [];
//                     let currentDescriptionText = '';
//                     (hakushSkillDetail.Description || []).forEach(descItem => {
//                         const multipliers = [];
//                         currentDescriptionText = descItem.Desc || '';
//                         if (descItem.Param && Array.isArray(descItem.Param)) {
//                             descItem.Param.forEach(paramInfo => {
//                                 try {
//                                      if (paramInfo.Param) {
//                                           const paramDict = paramInfo.Param;
//                                           const effectKey = Object.keys(paramDict)[0];
//                                           if (effectKey && paramDict[effectKey]) {
//                                               const skillValue = paramDict[effectKey];
//                                               const mainValue = Number(skillValue.Main) || 0;
//                                               const growthValue = Number(skillValue.Growth) || 0;
//                                               let finalValue = mainValue + growthValue * (currentLevel - 1);
//                                               let displayValue = '';
//                                               const format = skillValue.Format || '';
//                                               if (format.includes('%')) displayValue = (finalValue / 100).toFixed(1) + '%';
//                                               else if (format === 'I' || format === '' || format.includes('{0:0.#}')) {
//                                                   if (paramInfo.Name?.includes('伤害倍率') || paramInfo.Name?.includes('失衡倍率')) displayValue = (finalValue / 100).toFixed(1) + '%';
//                                                   else displayValue = String(Math.round(finalValue / 100));
//                                               } else displayValue = String(finalValue);
//                                               multipliers.push({ name: paramInfo.Name || '数值', value: displayValue });
//                                               if (paramInfo.Desc && currentDescriptionText.includes(paramInfo.Desc)) {
//                                                   currentDescriptionText = currentDescriptionText.replace(paramInfo.Desc, `<color=#FED663>${displayValue}</color>`);
//                                               }
//                                           }
//                                       } else if (paramInfo.Desc && !paramInfo.Param && paramInfo.Name) {
//                                          if (!currentDescriptionText.includes(paramInfo.Name)) {
//                                              currentDescriptionText += (currentDescriptionText ? '\n' : '') + `${paramInfo.Name}: ${paramInfo.Desc}`;
//                                          }
//                                       }
//                                 } catch (paramError) { logger.error(`[enka_to_mys] Error processing skill param for ${char_id}, skill ${hakushSkillKey}, param: ${paramInfo?.Name}`, paramError); }
//                             });
//                         }
//                         let processedText = currentDescriptionText.replace(/<color=#[0-9A-Fa-f]+>/g, '').replace(/<\/color>/g, '');
//                         processedText = processedText.replace(/<IconMap:[^>]+>/g, '').trim();
//                         let multiplierText = multipliers.map(m => `${m.name}: ${m.value}`).join('\n');
//                         if(descItem.Name || processedText || multiplierText) {
//                             skillItems.push({ title: descItem.Name || '', text: processedText + (multiplierText ? (processedText ? '\n' : '') + multiplierText : '') });
//                         }
//                         currentDescriptionText = '';
//                     });
//                     if (skillItems.length === 0 && hakushSkillDetail.Description?.length > 0) {
//                         const firstDesc = hakushSkillDetail.Description[0];
//                         skillItems.push({ title: firstDesc.Name || `技能 ${enkaIndex}`, text: (firstDesc.Desc || '').replace(/<IconMap:[^>]+>/g, '').trim() });
//                     }
//                     skillsForModel.push({ level: currentLevel, skill_type: enkaIndex, items: skillItems.filter(item => item.title || item.text), });
//                 } else {
//                     logger.warn(`[enka_to_mys] Skill mapping or data not found for Enka Index ${enkaIndex} (Hakush Key: ${hakushSkillKey}) on char ${char_id}`);
//                     skillsForModel.push({ level: currentLevel, skill_type: enkaIndex, items: [{ title: `未知技能 ${enkaIndex}`, text: '技能描述数据缺失'}] });
//                 }
//             }
//             skillsForModel.sort((a, b) => a.skill_type - b.skill_type);
//             finalCharDataForModel.skills = skillsForModel; // 填充技能数据
//
//             // --- 8. 处理核心强化 (使用 Hakush) ---
//             const ranksForModel = [];
//             const hakushTalents = charData.Talent || {};
//             const maxRank = 6;
//             for (let i = 1; i <= maxRank; i++) {
//                  const rankKey = String(i);
//                  const rankInfo = hakushTalents[rankKey];
//                  if (rankInfo) {
//                      ranksForModel.push({ id: i, name: rankInfo.Name || `影位 ${i}`, desc: rankInfo.Desc || rankInfo.Desc2 || '', pos: i, is_unlocked: i <= enkaRank });
//                  } else {
//                        ranksForModel.push({ id: i, name: `影位 ${i}`, desc: '影位数据缺失', pos: i, is_unlocked: i <= enkaRank });
//                  }
//             }
//             finalCharDataForModel.ranks = ranksForModel; // 填充影位数据
//
//             // 将完全准备好的、符合 ZZZAvatarInfo 输入结构的对象添加到最终列表
//             result_list.push(finalCharDataForModel);
//
//         } catch (processingError) {
//             logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message);
//             logger.error(processingError.stack);
//         }
//     }
//
//     logger.info(`[enka_to_mys.js] Enka data conversion finished. Processed ${result_list.length} characters.`);
//     return result_list;
// }
//
// /**
//  * @typedef {object} PropertyData // 类型定义，说明属性对象的结构
//  * @property {number} property_id MYS API 属性 ID
//  * @property {string} property_name 属性中文名
//  * @property {string} final 最终格式化后的值
//  * @property {string} [base]
//  * @property {string} [add]
//  */
