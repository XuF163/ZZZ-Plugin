// enka_to_mys.js (完整版，结合旧角色图标URL与新Hakush数据，并特殊处理能量回复属性)

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

// 使用 console 作为临时日志记录器
const logger = console;

// MYS API 属性 ID 映射
const MYSAPI_PROP_ID = {
    '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
    '穿透率': 9, /*'能量自动回复': 11,*/ '能量回复效率': 11, // MYS ID 11 通常对应能量回复效率
    '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
};

// 默认图标 URL (如果获取失败，可以使用这些)
const DEFAULT_CIRCLE_ICON_URL = ''; // 可选: 'https://your-cdn.com/default_circle.png'
const DEFAULT_BASE_ICON_URL = '';   // 可选: 'https://your-cdn.com/default_base.png'
const DEFAULT_WEAPON_ICON_URL = ''; // 可选: 'https://your-cdn.com/default_weapon.png'
const DEFAULT_DRIVE_ICON_URL = '';  // 可选: 'https://your-cdn.com/default_drive.png'


// --- 格式化函数 (保持不变) ---
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
        // 固定值能量回复 (Enka: 30503, Hakush: 30501?)
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
    const result_list = []; // 用于存储最终生成的、符合 ZZZAvatarInfo 输入期望的对象列表

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

            // --- 1. 初始化属性累加器 ---
            const props = {};
            const percentAdds = { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 };
            const flatAdds = { HpMax: 0, Attack: 0, Defence: 0 };
            Object.keys(ID_TO_EN).forEach(keyId => {
                 const enKey = ID_TO_EN[keyId];
                 if (!['HpBase', 'AttackBase', 'DefenceBase', 'HpAdd', 'AttackAdd', 'DefenceAdd'].includes(enKey)) {
                     props[enKey] = 0;
                 }
            });
            props.HpMax = 0; props.Attack = 0; props.Defence = 0;

            // --- 2. 计算角色自身基础属性 (使用 Hakush) ---
            const { baseHp: charBaseHp, baseAtk: charBaseAtk, baseDef: charBaseDef } = calculateCharBaseStat(char_id, enkaLevel, enkaPromotionLevel);
            const initialStats = charData.Stats; // 获取 Hakush 基础数据
            props.Crit = Number(initialStats?.Crit) || 500;
            props.CritDmg = Number(initialStats?.CritDamage) || 5000;
            props.BreakStun = Number(initialStats?.BreakStun) || 0;
            props.ElementAbnormalPower = Number(initialStats?.ElementAbnormalPower) || 0;
            props.ElementMystery = Number(initialStats?.ElementMystery) || 0;
            props.PenRate = (Number(initialStats?.PenRate) || 0) * 100;
            props.PenDelta = Number(initialStats?.PenDelta) || 0;
            props.SpRecover = Number(initialStats?.SpRecover) || 120; // 固定能回基础值
            props.SpRecoverPercent = 10000; // 百分比能回基础值
            let trueBaseHP = charBaseHp;
            let trueBaseATK = charBaseAtk;
            let trueBaseDEF = charBaseDef;
            logger.debug(`[${char_id}] Initial Base Stats (Hakush): HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);

            // --- 3. 处理武器 (图标使用 Hakush + constructIconUrl) ---
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
                        const baseEnProp = ID_TO_EN[basePropId];
                        if(baseEnProp && props[baseEnProp] !== undefined) props[baseEnProp] += baseValue;
                        else logger.warn(`[enka_to_mys.js] Weapon ${weapon_id} has unhandled base prop ID: ${basePropId}`);
                    }
                    // 累加武器副属性
                    if (randPropId && randValue > 0) {
                        const randEnProp = ID_TO_EN[randPropId], hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
                        const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];
                        if (randPropId === hpAddId) percentAdds.HpAdd += randValue;
                        else if (randPropId === atkAddId) percentAdds.AttackAdd += randValue;
                        else if (randPropId === defAddId) percentAdds.DefenceAdd += randValue;
                        else if (randPropId === hpFlatId) flatAdds.HpMax += randValue;
                        else if (randPropId === atkFlatId) flatAdds.Attack += randValue;
                        else if (randPropId === defFlatId) flatAdds.Defence += randValue;
                        else if (randEnProp && props[randEnProp] !== undefined) props[randEnProp] += randValue;
                        else logger.warn(`[enka_to_mys.js] Unknown or unhandled weapon random prop ID: ${randPropId} (EN: ${randEnProp})`);
                    }
                    // 获取武器图标
                    const weaponIconPath = weaponData.Icon;
                    const weaponIconUrl = weaponIconPath ? constructIconUrl(weaponIconPath) : DEFAULT_WEAPON_ICON_URL;
                    // 准备武器显示对象
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
            finalCharDataForModel.weapon = weaponDisplay; // 填充武器数据
            logger.debug(`[${char_id}] True Base after weapon: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);

            // --- 4. 处理驱动盘 (图标使用 Hakush + constructIconUrl) ---
            const equipDisplayList = [];
            const suitCounts = {};
            if (char.EquippedList && Array.isArray(char.EquippedList)) {
                for (const relic of char.EquippedList) {
                    if (!relic?.Equipment) continue;
                    const _equip = relic.Equipment;
                    const equip_id_str = String(_equip.Id);
                    const suit_id_str = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
                    if (!suit_id_str) { logger.warn(`[enka_to_mys.js] Could not derive suit ID for equip ID ${equip_id_str}`); continue; }
                    const equip_meta = hakush_equip_data[suit_id_str];
                    //if (!equip_meta) { logger.warn(`[enka_to_mys.js] Relic suit metadata missing in Hakush data for suit ID: ${suit_id_str}`); } // 减少警告
                    const relic_level = _equip.Level || 0;
                    const relic_tier = Math.floor(relic_level / 3);
                    const suit_info = { suit_id: parseInt(suit_id_str), name: equip_meta?.CHS?.name || `套装 ${suit_id_str}`, own: 0, desc1: equip_meta?.CHS?.desc2 || "", desc2: equip_meta?.CHS?.desc4 || "" };
                    suitCounts[suit_info.suit_id] = (suitCounts[suit_info.suit_id] || 0) + 1;
                    const equipIconPath = equip_meta?.icon;
                    const equipIconUrl = equipIconPath ? constructIconUrl(equipIconPath) : DEFAULT_DRIVE_ICON_URL;
                    const raw_equip_obj = {
                        id: _equip.Id, level: relic_level, name: `${suit_info.name || '未知套装'}[${relic.Slot}]`, icon: equipIconUrl,
                        rarity: _equip.Rarity ? (_equip.Rarity == 4 ? 'S' : 'A') : 'A', properties: [], main_properties: [],
                        equip_suit: suit_info, equipment_type: relic.Slot
                    };
                    // 处理主词条
                    if (_equip.MainPropertyList?.[0]) {
                        const main_prop = _equip.MainPropertyList[0];
                        const prop_id_str = String(main_prop.PropertyId);
                        const en_prop_name = ID_TO_EN[prop_id_str];
                        if (en_prop_name) {
                             const base_value = main_prop.PropertyValue || 0;
                             const increase_per_tier = MAIN_PROP_BASE_INCREASE[prop_id_str] ?? 0;
                             const total_main_value_raw = base_value + (increase_per_tier * relic_tier);
                             logger.debug(`[${char_id}] Drive ${relic.Slot} Main: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Lvl:${relic_level}(T${relic_tier}), Base:${base_value}, Inc:${increase_per_tier} -> RawVal:${total_main_value_raw}`);
                             const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
                             const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];
                             if (prop_id_str === hpAddId) percentAdds.HpAdd += total_main_value_raw;
                             else if (prop_id_str === atkAddId) percentAdds.AttackAdd += total_main_value_raw;
                             else if (prop_id_str === defAddId) percentAdds.DefenceAdd += total_main_value_raw;
                             else if (prop_id_str === hpFlatId) flatAdds.HpMax += total_main_value_raw;
                             else if (prop_id_str === atkFlatId) flatAdds.Attack += total_main_value_raw;
                             else if (prop_id_str === defFlatId) flatAdds.Defence += total_main_value_raw;
                             else if (props[en_prop_name] !== undefined) props[en_prop_name] += total_main_value_raw;
                             else logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive main stat accumulation.`);
                            const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
                            raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: formatEquipWeaponPropValue(total_main_value_raw, prop_id_str) });
                        } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive main stat ID ${prop_id_str}`); }
                    }
                    // 处理副词条
                    if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
                        for (const prop of _equip.RandomPropertyList) {
                            if (!prop || prop.PropertyId === undefined) continue;
                            const prop_id_str = String(prop.PropertyId);
                            const en_prop_name = ID_TO_EN[prop_id_str];
                             if (en_prop_name) {
                                 const prop_level = prop.PropertyLevel || 1;
                                 const base_value_per_roll = prop.PropertyValue || 0;
                                 const total_substat_value_raw = base_value_per_roll * prop_level;
                                 logger.debug(`[${char_id}] Drive ${relic.Slot} Sub: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Val/Roll:${base_value_per_roll}, Rolls:${prop_level} -> RawVal:${total_substat_value_raw}`);
                                 const hpAddId = PROP_NAME_TO_ID['生命值百分比'], atkAddId = PROP_NAME_TO_ID['攻击力百分比'], defAddId = PROP_NAME_TO_ID['防御力百分比'];
                                 const hpFlatId = PROP_NAME_TO_ID['生命值'], atkFlatId = PROP_NAME_TO_ID['攻击力'], defFlatId = PROP_NAME_TO_ID['防御力'];
                                 if (prop_id_str === hpAddId) percentAdds.HpAdd += total_substat_value_raw;
                                 else if (prop_id_str === atkAddId) percentAdds.AttackAdd += total_substat_value_raw;
                                 else if (prop_id_str === defAddId) percentAdds.DefenceAdd += total_substat_value_raw;
                                 else if (prop_id_str === hpFlatId) flatAdds.HpMax += total_substat_value_raw;
                                 else if (prop_id_str === atkFlatId) flatAdds.Attack += total_substat_value_raw;
                                 else if (prop_id_str === defFlatId) flatAdds.Defence += total_substat_value_raw;
                                 else if (props[en_prop_name] !== undefined) props[en_prop_name] += total_substat_value_raw;
                                 else logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive sub stat accumulation.`);
                                const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
                                raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: formatEquipWeaponPropValue(total_substat_value_raw, prop_id_str) });
                             } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive sub stat ID ${prop_id_str}`); }
                        }
                    }
                    equipDisplayList.push(raw_equip_obj);
                }
                equipDisplayList.forEach(eq => { eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
                finalCharDataForModel.equip = equipDisplayList; // 填充驱动盘数据
                logger.debug(`[${char_id}] Flat Adds after drives:`, JSON.stringify(flatAdds));
                logger.debug(`[${char_id}] Percent Adds after drives:`, JSON.stringify(percentAdds));
                logger.debug(`[${char_id}] Other props after drives:`, JSON.stringify(props));
            }

            // --- 5. 最终属性计算 ---
            props.HpMax = trueBaseHP * (1 + (percentAdds.HpAdd || 0) / 10000) + (flatAdds.HpMax || 0);
            props.Attack = trueBaseATK * (1 + (percentAdds.AttackAdd || 0) / 10000) + (flatAdds.Attack || 0);
            props.Defence = trueBaseDEF * (1 + (percentAdds.DefenceAdd || 0) / 10000) + (flatAdds.Defence || 0);
            logger.info(`[${char_id}] FINAL Calculated Raw Stats: HP=${props.HpMax.toFixed(2)}, ATK=${props.Attack.toFixed(2)}, DEF=${props.Defence.toFixed(2)}`);
            logger.info(`[${char_id}] FINAL Calculated Raw Others: Crit=${props.Crit}, CritDmg=${props.CritDmg}, ER%=${props.SpRecoverPercent}`);

            // --- 6. 格式化最终面板 -> 填充 finalCharDataForModel.properties 数组 ---
            const finalPropertiesArrayForModel = [];
            const added_mys_ids_for_model = new Set();
            const final_stat_mapping = {
                 HpMax: { zh: '生命值', mysId: 1, enkaId: PROP_NAME_TO_ID['生命值'] },
                 Attack: { zh: '攻击力', mysId: 2, enkaId: PROP_NAME_TO_ID['攻击力'] },
                 Defence: { zh: '防御力', mysId: 3, enkaId: PROP_NAME_TO_ID['防御力'] },
                 BreakStun: { zh: '冲击力', mysId: 4, enkaId: PROP_NAME_TO_ID['冲击力'] },
                 Crit: { zh: '暴击率', mysId: 5, enkaId: PROP_NAME_TO_ID['暴击率'] },
                 CritDmg: { zh: '暴击伤害', mysId: 6, enkaId: PROP_NAME_TO_ID['暴击伤害'] },
                 ElementAbnormalPower: { zh: '异常掌控', mysId: 7, enkaId: PROP_NAME_TO_ID['异常掌控'] },
                 ElementMystery: { zh: '异常精通', mysId: 8, enkaId: PROP_NAME_TO_ID['异常精通'] },
                 PenRate: { zh: '穿透率', mysId: 9, enkaId: PROP_NAME_TO_ID['穿透率'] },
                 SpRecoverPercent: { zh: '能量回复效率', mysId: 11, enkaId: PROP_NAME_TO_ID['能量回复百分比'] }, // 使用百分比作为 MYS ID 11 的代表
                 PenDelta: { zh: '穿透值', mysId: 232, enkaId: PROP_NAME_TO_ID['穿透值'] },
                 PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, enkaId: PROP_NAME_TO_ID['物理伤害加成'] },
                 FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, enkaId: PROP_NAME_TO_ID['火属性伤害加成'] },
                 IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, enkaId: PROP_NAME_TO_ID['冰属性伤害加成'] },
                 ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, enkaId: PROP_NAME_TO_ID['雷属性伤害加成'] },
                 EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, enkaId: PROP_NAME_TO_ID['以太属性伤害加成'] },
                 // 不再需要 SpRecover 的映射
            };

            // 遍历计算好的属性，填充 finalPropertiesArrayForModel (跳过 ID 11)
            for (const [propKey, mapping] of Object.entries(final_stat_mapping)) {
                 if (mapping.mysId === 11) continue; // 跳过能量回复的映射键
                 const rawValue = props[propKey];
                 if (rawValue !== undefined) {
                     const numericValue = Number(rawValue);
                     const alwaysShow = ['HpMax', 'Attack', 'Defence', 'Crit', 'CritDmg'].includes(propKey);
                     const isZero = numericValue === 0;
                     const neededByTemplate = ['PenRate'].includes(propKey); // 假设模板需要穿透率即使为0
                     const shouldShow = alwaysShow || neededByTemplate || !isZero;

                     if (shouldShow) {
                         if (!added_mys_ids_for_model.has(mapping.mysId)) {
                             const final_value_str = formatFinalPanelPropValue(rawValue, mapping.enkaId);
                             if (final_value_str !== undefined && final_value_str !== null) {
                                 finalPropertiesArrayForModel.push({
                                     property_name: mapping.zh, property_id: mapping.mysId,
                                     base: "", add: "", final: final_value_str
                                 });
                                 added_mys_ids_for_model.add(mapping.mysId);
                             } else {
                                 logger.warn(`[enka_to_mys] Invalid final value for ${propKey} (ID: ${mapping.enkaId}), rawValue: ${rawValue}`);
                                 finalPropertiesArrayForModel.push({ property_name: mapping.zh, property_id: mapping.mysId, base: "", add: "", final: 'N/A' });
                                 added_mys_ids_for_model.add(mapping.mysId);
                             }
                         }
                     }
                 }
            }

            // 确保属性列表完整性
            const ensurePropertyExistsForModel = (propName, mysId, enkaIdForFormatting, propKey) => {
                 if (mysId === 11) return; // 跳过能量回复，下面特殊处理
                 if (!added_mys_ids_for_model.has(mysId)) {
                     const rawValue = props[propKey] ?? (
                         propKey === 'Crit' ? (initialStats?.Crit || 500) :
                         propKey === 'CritDmg' ? (initialStats?.CritDamage || 5000) :
                         propKey === 'SpRecoverPercent' ? 10000 : // 这个不会被调用到
                         propKey === 'SpRecover' ? (initialStats?.SpRecover || 120) : // 固定能回，如果需要显示可以取消注释
                         propKey === 'PenRate' ? ((initialStats?.PenRate || 0) * 100) :
                         0
                     );
                     const finalValueStr = formatFinalPanelPropValue(rawValue, enkaIdForFormatting);
                     const displayValue = (finalValueStr !== undefined && finalValueStr !== null) ? finalValueStr : 'N/A';
                     finalPropertiesArrayForModel.push({
                         property_name: propName, property_id: mysId,
                         base: "", add: "", final: displayValue
                     });
                     added_mys_ids_for_model.add(mysId);
                     // logger.debug(`[enka_to_mys] Ensured property ${propName} (ID: ${mysId}) exists with value: ${displayValue}`);
                 }
             };

            // 确保基础属性等存在 (不处理 ID 11)
            ensurePropertyExistsForModel('生命值', 1, PROP_NAME_TO_ID['生命值'], 'HpMax');
            ensurePropertyExistsForModel('攻击力', 2, PROP_NAME_TO_ID['攻击力'], 'Attack');
            ensurePropertyExistsForModel('防御力', 3, PROP_NAME_TO_ID['防御力'], 'Defence');
            ensurePropertyExistsForModel('暴击率', 5, PROP_NAME_TO_ID['暴击率'], 'Crit');
            ensurePropertyExistsForModel('暴击伤害', 6, PROP_NAME_TO_ID['暴击伤害'], 'CritDmg');
            ensurePropertyExistsForModel('冲击力', 4, PROP_NAME_TO_ID['冲击力'], 'BreakStun');
            ensurePropertyExistsForModel('异常掌控', 7, PROP_NAME_TO_ID['异常掌控'], 'ElementAbnormalPower');
            ensurePropertyExistsForModel('异常精通', 8, PROP_NAME_TO_ID['异常精通'], 'ElementMystery');
            ensurePropertyExistsForModel('穿透率', 9, PROP_NAME_TO_ID['穿透率'], 'PenRate');
            ensurePropertyExistsForModel('穿透值', 232, PROP_NAME_TO_ID['穿透值'], 'PenDelta');
            // 如果需要显示固定能量回复，可以取消下面这行的注释，但这会与 ID 11 冲突
            // ensurePropertyExistsForModel('能量自动回复', 11, PROP_NAME_TO_ID['能量自动回复'], 'SpRecover');

            // ====[ 关键修改：特殊处理 MYS ID 11，模拟旧版输出 ]====
            if (!added_mys_ids_for_model.has(11)) {
                const energyRecoveryPropKey = 'SpRecoverPercent'; // 我们计算和关心的是百分比
                const energyRecoveryEnkaIdPercent = PROP_NAME_TO_ID['能量回复百分比']; // '30502'
                const energyRecoveryRawValue = props[energyRecoveryPropKey] ?? 10000; // 获取计算后的百分比值
                // 使用百分比ID和值进行格式化，得到正确的百分比字符串
                const energyRecoveryFinalValueStr = formatFinalPanelPropValue(energyRecoveryRawValue, energyRecoveryEnkaIdPercent);

                // 添加到数组，但强制使用旧的名称 '能量自动回复'
                finalPropertiesArrayForModel.push({
                    property_name: '能量自动回复', // <--- 强制使用旧名称
                    property_id: 11,            // MYS ID 保持 11
                    base: "", add: "",
                    final: energyRecoveryFinalValueStr // 值是正确计算的百分比字符串
                });
                added_mys_ids_for_model.add(11); // 标记已添加
                logger.debug(`[enka_to_mys] Ensured property '能量自动回复' (ID: 11) exists with final value: ${energyRecoveryFinalValueStr}`);
            }

            // 按 MYS API 推荐顺序排序
            finalPropertiesArrayForModel.sort((a, b) => {
                const order = [1, 2, 3, 5, 6, 11, 4, 8, 7, 9, 232, 315, 316, 317, 318, 319];
                const indexA = order.indexOf(a.property_id); const indexB = order.indexOf(b.property_id);
                if (indexA === -1 && indexB === -1) return a.property_id - b.property_id;
                if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB;
            });

            // 将最终生成的属性数组赋值给要传递给模型的对象
            finalCharDataForModel.properties = finalPropertiesArrayForModel;

            // --- 7. 处理技能 (使用 Hakush) ---
            const skillsForModel = [];
            const charSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
            const hakushSkills = charData.Skill;
            const skillOrder = [0, 1, 2, 3, 5, 6];
            for (const enkaIndex of skillOrder) {
                const enkaIndexStr = String(enkaIndex);
                const currentLevel = charSkillLevels[enkaIndexStr];
                if (currentLevel === undefined) continue;
                const hakushSkillKey = ENKA_INDEX_TO_HAKUSH_SKILL_KEY[enkaIndex];
                if (hakushSkillKey && hakushSkills && hakushSkills[hakushSkillKey]) {
                    const hakushSkillDetail = hakushSkills[hakushSkillKey];
                    const skillItems = [];
                    let currentDescriptionText = '';
                    (hakushSkillDetail.Description || []).forEach(descItem => {
                        const multipliers = [];
                        currentDescriptionText = descItem.Desc || '';
                        if (descItem.Param && Array.isArray(descItem.Param)) {
                            descItem.Param.forEach(paramInfo => {
                                try {
                                     if (paramInfo.Param) {
                                          const paramDict = paramInfo.Param;
                                          const effectKey = Object.keys(paramDict)[0];
                                          if (effectKey && paramDict[effectKey]) {
                                              const skillValue = paramDict[effectKey];
                                              const mainValue = Number(skillValue.Main) || 0;
                                              const growthValue = Number(skillValue.Growth) || 0;
                                              let finalValue = mainValue + growthValue * (currentLevel - 1);
                                              let displayValue = '';
                                              const format = skillValue.Format || '';
                                              if (format.includes('%')) displayValue = (finalValue / 100).toFixed(1) + '%';
                                              else if (format === 'I' || format === '' || format.includes('{0:0.#}')) {
                                                  if (paramInfo.Name?.includes('伤害倍率') || paramInfo.Name?.includes('失衡倍率')) displayValue = (finalValue / 100).toFixed(1) + '%';
                                                  else displayValue = String(Math.round(finalValue / 100));
                                              } else displayValue = String(finalValue);
                                              multipliers.push({ name: paramInfo.Name || '数值', value: displayValue });
                                              if (paramInfo.Desc && currentDescriptionText.includes(paramInfo.Desc)) {
                                                  currentDescriptionText = currentDescriptionText.replace(paramInfo.Desc, `<color=#FED663>${displayValue}</color>`);
                                              }
                                          }
                                      } else if (paramInfo.Desc && !paramInfo.Param && paramInfo.Name) {
                                         if (!currentDescriptionText.includes(paramInfo.Name)) {
                                             currentDescriptionText += (currentDescriptionText ? '\n' : '') + `${paramInfo.Name}: ${paramInfo.Desc}`;
                                         }
                                      }
                                } catch (paramError) { logger.error(`[enka_to_mys] Error processing skill param for ${char_id}, skill ${hakushSkillKey}, param: ${paramInfo?.Name}`, paramError); }
                            });
                        }
                        let processedText = currentDescriptionText.replace(/<color=#[0-9A-Fa-f]+>/g, '').replace(/<\/color>/g, '');
                        processedText = processedText.replace(/<IconMap:[^>]+>/g, '').trim();
                        let multiplierText = multipliers.map(m => `${m.name}: ${m.value}`).join('\n');
                        if(descItem.Name || processedText || multiplierText) {
                            skillItems.push({ title: descItem.Name || '', text: processedText + (multiplierText ? (processedText ? '\n' : '') + multiplierText : '') });
                        }
                        currentDescriptionText = '';
                    });
                    if (skillItems.length === 0 && hakushSkillDetail.Description?.length > 0) {
                        const firstDesc = hakushSkillDetail.Description[0];
                        skillItems.push({ title: firstDesc.Name || `技能 ${enkaIndex}`, text: (firstDesc.Desc || '').replace(/<IconMap:[^>]+>/g, '').trim() });
                    }
                    skillsForModel.push({ level: currentLevel, skill_type: enkaIndex, items: skillItems.filter(item => item.title || item.text), });
                } else {
                    logger.warn(`[enka_to_mys] Skill mapping or data not found for Enka Index ${enkaIndex} (Hakush Key: ${hakushSkillKey}) on char ${char_id}`);
                    skillsForModel.push({ level: currentLevel, skill_type: enkaIndex, items: [{ title: `未知技能 ${enkaIndex}`, text: '技能描述数据缺失'}] });
                }
            }
            skillsForModel.sort((a, b) => a.skill_type - b.skill_type);
            finalCharDataForModel.skills = skillsForModel; // 填充技能数据

            // --- 8. 处理核心强化 (使用 Hakush) ---
            const ranksForModel = [];
            const hakushTalents = charData.Talent || {};
            const maxRank = 6;
            for (let i = 1; i <= maxRank; i++) {
                 const rankKey = String(i);
                 const rankInfo = hakushTalents[rankKey];
                 if (rankInfo) {
                     ranksForModel.push({ id: i, name: rankInfo.Name || `影位 ${i}`, desc: rankInfo.Desc || rankInfo.Desc2 || '', pos: i, is_unlocked: i <= enkaRank });
                 } else {
                       ranksForModel.push({ id: i, name: `影位 ${i}`, desc: '影位数据缺失', pos: i, is_unlocked: i <= enkaRank });
                 }
            }
            finalCharDataForModel.ranks = ranksForModel; // 填充影位数据

            // 将完全准备好的、符合 ZZZAvatarInfo 输入结构的对象添加到最终列表
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
 * @typedef {object} PropertyData // 类型定义，说明属性对象的结构
 * @property {number} property_id MYS API 属性 ID
 * @property {string} property_name 属性中文名
 * @property {string} final 最终格式化后的值
 * @property {string} [base]
 * @property {string} [add]
 */
// --- 导入新版 name_convert.js 的接口 ---
//使用旧版本json的
// import {
//     equip_data,
//     weapon_data,
//     partner_data,        // 用于基础信息 (名称, 阵营, 天赋描述等)
//     avatar_icon_data,    // 用于角色基础属性计算和图标
//     PartnerId2SkillParam, // 用于技能描述
//     get_char_circle_icon_url // 用于获取角色图标URL
// } from './name_convert.js'; // 确保 name_convert.js 正确加载并导出了这些变量
// import _ from 'lodash';
//
// const ID_TO_PROP_NAME = {
//     '11101': '生命值', '11103': '生命值', '11102': '生命值百分比', '12101': '攻击力', '12103': '攻击力', '12102': '攻击力百分比',
//     '13101': '防御力', '13103': '防御力', '13102': '防御力百分比', '12203': '冲击力', '20103': '暴击率', '21103': '暴击伤害',
//     '31402': '异常掌控', '31403': '异常掌控', '31202': '异常精通', '31203': '异常精通', '23103': '穿透率', '23203': '穿透值',
//     '30503': '能量自动回复', '30502': '能量回复百分比', // 都映射到“能量自动回复”以简化处理，具体区分在格式化时进行
//     '31503': '物理伤害加成', '31603': '火属性伤害加成', '31703': '冰属性伤害加成', '31803': '雷属性伤害加成', '31903': '以太属性伤害加成',
//     '12202': '冲击力', // 假设 12202 也是冲击力固定值
// };
// const MYSAPI_PROP_ID = {
//     '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
//     '穿透率': 9, '能量自动回复': 11,
//     '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
// };
// const ID_TO_EN = {
//     '11101': 'HpMax', '11103': 'HpBase', '11102': 'HpAdd', '12101': 'Attack', '12103': 'AttackBase', '12102': 'AttackAdd',
//     '13101': 'Defence', '13103': 'DefenceBase', '13102': 'DefenceAdd', '12203': 'BreakStun',
//     '20103': 'Crit', '21103': 'CritDmg', '31402': 'ElementAbnormalPower', '31403': 'ElementAbnormalPower',
//     '31202': 'ElementMystery', '31203': 'ElementMystery', '23103': 'PenRate', '23203': 'PenDelta',
//     '30503': 'SpRecover', '30502': 'SpRecover',
//     '31503': 'PhysDmgBonus', '31603': 'FireDmgBonus', '31703': 'IceDmgBonus',
//     '31803': 'ThunderDmgBonus', '31903': 'EtherDmgBonus',
//     '12202': 'BreakStun',
// };
// const EN_TO_ZH = {};
// for (const id in ID_TO_EN) { if (ID_TO_PROP_NAME[id]) { EN_TO_ZH[ID_TO_EN[id]] = ID_TO_PROP_NAME[id]; } }
// EN_TO_ZH['HpAdd'] = '生命值百分比'; EN_TO_ZH['AttackAdd'] = '攻击力百分比'; EN_TO_ZH['DefenceAdd'] = '防御力百分比';
//
// const MAIN_PROP_BASE_INCREASE = {
//     '11101': 330, '11103': 330, // HP Flat
//     '12101': 47.4, '12103': 47.4, // ATK Flat (存疑, ZZZ S级音擎60级基础攻击700+, 这个增量可能偏低?)
//     '13101': 27.6, '13103': 27.6, // DEF Flat (存疑)
//     '12203': 270, // Impact Flat (存疑, 需看Lv0值)
//     '31202': 13, '31203': 13,   // EM Flat (存疑, 13点每阶?)
//     '31402': 450, '31403': 450, // Abnormal Control Flat (存疑)
//     '23203': 36,  // Pen Flat
//     '11102': 450, // HP% (4.5% per tier?) - 需要验证, 原代码是 330?
//     '12102': 450, // ATK% (4.5% per tier?)
//     '13102': 720, // DEF% (7.2% per tier?)
//     '20103': 360, // Crit Rate% (3.6% per tier?)
//     '21103': 720, // Crit Dmg% (7.2% per tier?)
//     '23103': 360, // Pen Rate% (3.6% per tier?)
//     '30503': 900, '30502': 900, // ER% (9.0% per tier?)
//     '31503': 450, // Phys DMG% (4.5% per tier?)
//     '31603': 450, // Fire DMG% (4.5% per tier?)
//     '31703': 450, // Ice DMG% (4.5% per tier?)
//     '31803': 450, // Thunder DMG% (4.5% per tier?)
//     '31903': 450, // Ether DMG% (4.5% per tier?)
//     '12202': 0,   // Impact % (如果存在的话，值是多少?)
// };
//
// // 哪些 ID 在显示时需要加百分号
// const PERCENT_ID_LIST = Object.keys(ID_TO_PROP_NAME)
//     .filter(id =>
//         ID_TO_PROP_NAME[id]?.includes('百分比') ||
//         ID_TO_PROP_NAME[id]?.includes('加成') ||
//         ['20103', '21103', '23103', '30502'].includes(id) // 明确指定暴击爆伤穿透率和能量回复效率%
//         // 30503 是能量自动回复 固定值/秒，不需要百分号
//     );
// // 确保核心百分比ID存在
// if (!PERCENT_ID_LIST.includes('11102')) PERCENT_ID_LIST.push('11102'); // HP%
// if (!PERCENT_ID_LIST.includes('12102')) PERCENT_ID_LIST.push('12102'); // ATK%
// if (!PERCENT_ID_LIST.includes('13102')) PERCENT_ID_LIST.push('13102'); // DEF%
//
// const ELEMENT_TO_EN = { '203': 'Thunder', '205': 'Ether', '202': 'Ice', '200': 'Phys', '201': 'Fire' };
//
//
// // --- 数据有效性检查 ---
// if (typeof partner_data === 'undefined' || Object.keys(partner_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: partner_data is undefined or empty!"); }
// if (typeof avatar_icon_data === 'undefined' || Object.keys(avatar_icon_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: avatar_icon_data is undefined or empty!"); }
// if (typeof weapon_data === 'undefined' || Object.keys(weapon_data || {}).length === 0) { logger.warn("[enka_to_mys.js] WARNING: weapon_data is undefined or empty."); }
// if (typeof equip_data === 'undefined' || Object.keys(equip_data || {}).length === 0) { logger.warn("[enka_to_mys.js] WARNING: equip_data is undefined or empty."); }
// if (typeof MAIN_PROP_BASE_INCREASE === 'undefined' || Object.keys(MAIN_PROP_BASE_INCREASE || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: MAIN_PROP_BASE_INCREASE is undefined or empty! Relic main stat calculations will be wrong."); }
// if (typeof PERCENT_ID_LIST === 'undefined') { logger.error("[enka_to_mys.js] CRITICAL ERROR: PERCENT_ID_LIST is undefined!"); }
// // 检查其他常量
// if (typeof ID_TO_PROP_NAME === 'undefined') logger.error("CRITICAL: ID_TO_PROP_NAME is undefined");
// if (typeof ID_TO_EN === 'undefined') logger.error("CRITICAL: ID_TO_EN is undefined");
// if (typeof MYSAPI_PROP_ID === 'undefined') logger.error("CRITICAL: MYSAPI_PROP_ID is undefined");
//
//
// // 计算角色自身基础属性 (使用 avatar_icon_data)
// function calculateCharBaseStat(char_id, level, promotion_level, rank) {
//     const charAvatarData = avatar_icon_data[char_id];
//     if (!charAvatarData) {
//         logger.error(`[calculateCharBaseStat] Avatar data not found for char_id: ${char_id}`);
//         return { baseHp: 0, baseAtk: 0, baseDef: 0 };
//     }
//
//     const baseProps = charAvatarData.BaseProps || {};
//     const growthProps = charAvatarData.GrowthProps || {};
//     const promotionProps = charAvatarData.PromotionProps?.[promotion_level] || {};
//     const coreEnhancementProps = charAvatarData.CoreEnhancementProps?.[rank] || {};
//
//     const getPropIdByName = (name) => Object.keys(ID_TO_PROP_NAME).find(id => ID_TO_PROP_NAME[id] === name);
//     const hpId = getPropIdByName('生命值');
//     const atkId = getPropIdByName('攻击力');
//     const defId = getPropIdByName('防御力');
//
//     let baseHp = Number(baseProps['11101']) || 0;
//     let baseAtk = Number(baseProps['12101']) || 0;
//     let baseDef = Number(baseProps['13101']) || 0;
//
//     if (level > 1) {
//         baseHp += (level - 1) * (Number(growthProps['11101']) || 0) / 10000;
//         baseAtk += (level - 1) * (Number(growthProps['12101']) || 0) / 10000;
//         baseDef += (level - 1) * (Number(growthProps['13101']) || 0) / 10000;
//     }
//
//     baseHp += Number(promotionProps['11101']) || 0;
//     baseAtk += Number(promotionProps['12101']) || 0;
//     baseDef += Number(promotionProps['13101']) || 0;
//
//     // 确保 ID 存在再访问
//     if (hpId && coreEnhancementProps[hpId] !== undefined) baseHp += Number(coreEnhancementProps[hpId]) || 0;
//     if (atkId && coreEnhancementProps[atkId] !== undefined) baseAtk += Number(coreEnhancementProps[atkId]) || 0;
//     if (defId && coreEnhancementProps[defId] !== undefined) baseDef += Number(coreEnhancementProps[defId]) || 0;
//
//     logger.debug(`[calculateCharBaseStat][${char_id}] Lvl ${level} Promo ${promotion_level} Rank ${rank} -> HP:${Math.floor(baseHp)}, ATK:${Math.floor(baseAtk)}, DEF:${Math.floor(baseDef)}`);
//     return {
//         baseHp: Math.floor(baseHp),
//         baseAtk: Math.floor(baseAtk),
//         baseDef: Math.floor(baseDef),
//     };
// }
//
// // 格式化音擎/驱动盘主副属性的原始值用于显示
// function formatEquipWeaponPropValue(value, prop_id) {
//     const idStr = String(prop_id);
//     const isPercentProp = PERCENT_ID_LIST.includes(idStr);
//     const numericValue = Number(value);
//     if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; }
//     try {
//         if (isPercentProp) {
//             // 能量回复效率 %
//             if (idStr === '30502') {
//                 return (numericValue / 100).toFixed(1) + '%';
//             }
//             // 其他百分比
//             else {
//                 return (numericValue / 100).toFixed(1) + '%'; // 假设原始值 * 100
//             }
//         }
//         // 能量自动回复 固定值
//         else if (idStr === '30503') {
//             return (numericValue / 10000).toFixed(2); // 假设原始值 * 10000
//         }
//         // 其他固定值
//         else {
//             return String(Math.floor(numericValue));
//         }
//     } catch (e) { logger.error(`[formatEquipWeaponPropValue] Error formatting E/W prop value ${value} for ${prop_id}:`, e); return '0'; }
// }
//
// // 计算音擎在特定等级和突破等级下的主副属性值
// function render_weapon_detail(weapon_meta, weapon_level, weapon_break_level) {
//      if (!weapon_meta || weapon_meta.props_value === undefined || !weapon_meta.level || !weapon_meta.stars) {
//          logger.warn(`[render_weapon_detail] Invalid weapon metadata for ID ${weapon_meta?.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
//          return { baseValue: 0, randValue: 0, basePropId: null, randPropId: null };
//      }
//      const levelData = weapon_meta.level?.[String(weapon_level)];
//      const starData = weapon_meta.stars?.[String(weapon_break_level)];
//      if (!levelData || !starData) {
//           logger.warn(`[render_weapon_detail] Missing level/break data for weapon ${weapon_meta.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
//          return { baseValue: 0, randValue: 0, basePropId: String(weapon_meta.props_id), randPropId: String(weapon_meta.rand_props_id) };
//      }
//
//      let base_value = Number(weapon_meta.props_value) || 0;
//      base_value = base_value + base_value * (((Number(levelData.Rate) || 0) + (Number(starData.StarRate) || 0)) / 10000);
//
//      let rand_value = Number(weapon_meta.rand_props_value) || 0;
//      if (rand_value > 0 && starData.RandRate !== undefined) {
//          rand_value = rand_value + rand_value * ((Number(starData.RandRate) || 0) / 10000);
//      } else {
//          rand_value = 0;
//      }
//      return {
//          baseValue: Math.floor(base_value),
//          randValue: Math.floor(rand_value),
//          basePropId: String(weapon_meta.props_id),
//          randPropId: String(weapon_meta.rand_props_id)
//         };
// }
//
// // 格式化最终面板属性值
// function formatFinalPanelPropValue(value, prop_id) {
//       const idStr = String(prop_id);
//       const isPercentProp = PERCENT_ID_LIST.includes(idStr);
//       const numericValue = Number(value);
//       if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; }
//
//       try {
//           if (isPercentProp) {
//               // 能量回复效率 % (ID 30502)
//               if (idStr === '30502') {
//                  return (numericValue / 100).toFixed(1) + '%';
//               }
//               // 其他百分比
//               else {
//                   return (numericValue / 100).toFixed(1) + '%'; // 假设计算结果已经是 百分比 * 100
//               }
//           }
//           // 能量自动回复 固定值/秒 (ID 30503)
//           else if (idStr === '30503') {
//               return (numericValue / 10000).toFixed(2); // 假设计算结果是 值 * 10000
//           }
//           // 其他固定值
//           else {
//               return String(Math.floor(numericValue));
//           }
//       } catch (e) { logger.error(`[formatFinalPanelPropValue] Error formatting Final prop value ${value} for ${prop_id}:`, e); return '0'; }
// }
//
//
// // --- 主转换函数 ---
// export async function _enka_data_to_mys_data(enka_data) {
//     if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
//         return [];
//     }
//
//     const uid = enka_data.uid;
//     const result_list = [];
//
//     for (const char of enka_data.PlayerInfo.ShowcaseDetail.AvatarList) {
//         try {
//             if (!char || typeof char.Id === 'undefined') {
//                 logger.warn("[enka_to_mys.js] Skipping invalid character entry in AvatarList.");
//                 continue;
//             }
//             const char_id = String(char.Id);
//             const _partner = partner_data[char_id];
//             const _avatar_data = avatar_icon_data[char_id];
//
//             if (!_partner || !_avatar_data) {
//                 logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing partner_data or avatar_icon_data.`); // 使用正确的变量名
//                 continue;
//             }
//
//             const characterIconUrl = get_char_circle_icon_url(char_id) ?? '';
//
//             const result = {
//                 id: char.Id,
//                 level: char.Level || 1,
//                 name_mi18n: _partner.name ?? `角色${char_id}`,
//                 full_name_mi18n: _partner.full_name ?? _partner.name ?? `角色${char_id}`,
//                 element_type: parseInt(_avatar_data.ElementTypes?.[0]?.replace('Elec', '203').replace('Ether', '205').replace('Ice', '202').replace('Physics', '200').replace('Fire', '201').replace('FireFrost','202')) || 0, // 主要从avatar_icon_data获取元素
//                 sub_element_type: parseInt(_avatar_data.ElementTypes?.[1]?.replace('Elec', '203').replace('Ether', '205').replace('Ice', '202').replace('Physics', '200').replace('Fire', '201')) || 0, // 副元素
//                 camp_name_mi18n: _partner.Camp ?? '?',
//                 avatar_profession: parseInt(_avatar_data.ProfessionType?.replace('Stun', '1').replace('Attack', '3').replace('Defense', '2').replace('Support', '4').replace('Anomaly', '5')) || 0, // 从avatar_icon_data获取职业
//                 rarity: (_avatar_data.Rarity === 4 ? 'S' : 'A') ?? 'A', // 从avatar_icon_data获取稀有度
//                 group_icon_path: characterIconUrl,
//                 hollow_icon_path: characterIconUrl,
//                 role_square_url: characterIconUrl,
//                 role_vertical_painting_url: characterIconUrl,
//                 square_icon: characterIconUrl,
//                 equip: [],
//                 weapon: null,
//                 properties: [],
//                 skills: [],
//                 rank: char.TalentLevel || 0,
//                 ranks: [],
//             };
//
//             // --- 1. 初始化属性累加器 ---
//             const props = {};
//             const percentAdds = { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 };
//             const flatAdds = { HpMax: 0, Attack: 0, Defence: 0 };
//             Object.keys(ID_TO_EN).forEach(keyId => {
//                  if (!['HpMax', 'Attack', 'Defence', 'HpBase', 'AttackBase', 'DefenceBase', 'HpAdd', 'AttackAdd', 'DefenceAdd'].includes(ID_TO_EN[keyId])) {
//                      props[ID_TO_EN[keyId]] = 0;
//                  }
//             });
//
//             // --- 2. 计算角色基础属性 ---
//             const { baseHp: charBaseHp, baseAtk: charBaseAtk, baseDef: charBaseDef } = calculateCharBaseStat(
//                 char_id,
//                 char.Level,
//                 char.PromotionLevel,
//                 result.rank
//             );
//             const charBaseProps = _avatar_data.BaseProps || {};
//             props.Crit = Number(charBaseProps['20101']) || 500;
//             props.CritDmg = Number(charBaseProps['21101']) || 5000;
//             props.BreakStun = Number(charBaseProps['12201']) || 0;
//             props.ElementAbnormalPower = Number(charBaseProps['31401']) || 0;
//             props.ElementMystery = Number(charBaseProps['31201']) || 0;
//             props.SpRecover = Number(charBaseProps['30501']) * 100 || 12000; // *100是因为avatar_icon_data里是120, enka是12000
//
//             let trueBaseHP = charBaseHp;
//             let trueBaseATK = charBaseAtk;
//             let trueBaseDEF = charBaseDef;
//
//            // logger.debug(`[DEBUG][${char_id}] Character Base Stats: HP=${charBaseHp}, ATK=${charBaseAtk}, DEF=${charBaseDef}`);
//
//             // --- 3. 处理武器 ---
//             let weaponDisplay = null;
//             if (char.Weapon?.Id) {
//                 const weapon_id = String(char.Weapon.Id);
//                 const _weapon_meta = weapon_data[weapon_id];
//                 if (_weapon_meta) {
//                     const weapon_level = char.Weapon.Level || 1;
//                     const weapon_star = char.Weapon.UpgradeLevel || 0;
//                     const weapon_break_level = char.Weapon.BreakLevel || 0;
//
//                     const { baseValue, randValue, basePropId, randPropId } = render_weapon_detail(
//                         _weapon_meta, weapon_level, String(weapon_break_level)
//                     );
//
//                     if (basePropId === '12101' || basePropId === '12103') trueBaseATK += baseValue;
//                     else if (basePropId === '11101' || basePropId === '11103') trueBaseHP += baseValue;
//                     else if (basePropId === '13101' || basePropId === '13103') trueBaseDEF += baseValue;
//                     else {
//                         const baseEnProp = ID_TO_EN[basePropId];
//                         if(baseEnProp && props[baseEnProp] !== undefined) props[baseEnProp] += baseValue;
//                          else logger.warn(`[enka_to_mys.js] Weapon ${weapon_id} has unhandled base prop ID: ${basePropId}`);
//                     }
//
//                     if (randPropId && randValue > 0) {
//                         const randEnProp = ID_TO_EN[randPropId];
//                         if (randPropId === '11102') percentAdds.HpAdd += randValue;
//                         else if (randPropId === '12102') percentAdds.AttackAdd += randValue;
//                         else if (randPropId === '13102') percentAdds.DefenceAdd += randValue;
//                         else if (randEnProp && props[randEnProp] !== undefined) {
//                             props[randEnProp] += randValue;
//                         } else {
//                              logger.warn(`[enka_to_mys.js] Unknown or unhandled weapon random prop ID: ${randPropId} (EN: ${randEnProp})`);
//                         }
//                     }
//                     // logger.debug(`[DEBUG][${char_id}] Weapon ${weapon_id}: BaseStat(+${baseValue} to ${ID_TO_PROP_NAME[basePropId]}), RandStat(+${randValue} to ${ID_TO_PROP_NAME[randPropId]})`);
//
//                     weaponDisplay = {
//                         id: char.Weapon.Id, level: weapon_level, name: _weapon_meta.name || `武器 ${weapon_id}`, star: weapon_star + 1,
//                         icon: _weapon_meta.IconPath ?? '', rarity: _weapon_meta.rarity ?? 'A', properties: [], main_properties: [],
//                         talent_title: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Name'], ''),
//                         talent_content: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Desc'], ''),
//                         profession: parseInt(_avatar_data.ProfessionType?.replace('Stun', '1').replace('Attack', '3').replace('Defense', '2').replace('Support', '4').replace('Anomaly', '5')) || 0,
//                      };
//                      const base_prop_zh = ID_TO_PROP_NAME[basePropId] || `?(${basePropId})`;
//                      weaponDisplay.main_properties.push({ property_name: base_prop_zh, property_id: basePropId, base: formatEquipWeaponPropValue(baseValue, basePropId) });
//                      if (randPropId && randValue > 0) {
//                          const rand_prop_zh = ID_TO_PROP_NAME[randPropId] || `?(${randPropId})`;
//                          weaponDisplay.properties.push({ property_name: rand_prop_zh, property_id: randPropId, base: formatEquipWeaponPropValue(randValue, randPropId) });
//                      }
//                 } else { logger.warn(`[enka_to_mys.js] Weapon metadata missing for ID: ${weapon_id}`); }
//             }
//             result.weapon = weaponDisplay;
//            // logger.debug(`[DEBUG][${char_id}] True Base after weapon: HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
//
//             // --- 4. 处理驱动盘 (Relics) ---
//             const equipDisplayList = [];
//             if (char.EquippedList && Array.isArray(char.EquippedList)) {
//                 for (const relic of char.EquippedList) {
//                      if (!relic?.Equipment) continue;
//                     const _equip = relic.Equipment;
//                     const equip_id_str = String(_equip.Id);
//                     const suit_id = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
//                     if (!suit_id) {
//                         logger.warn(`[enka_to_mys.js] Could not derive suit ID for equip ID ${equip_id_str}`);
//                         continue; }
//                     const equip_meta = equip_data[suit_id];
//                      if (!equip_meta) { logger.warn(`[enka_to_mys.js] Relic suit metadata missing for suit ID: ${suit_id} (from equip ${equip_id_str})`); continue; }
//
//                     const relic_level = _equip.Level || 0;
//                     const relic_tier = Math.floor(relic_level / 3);
//
//                     const raw_equip_obj = {
//                         id: _equip.Id, level: relic_level,
//                         name: equip_meta.equip_name ? `${equip_meta.equip_name}[${relic.Slot}]` : `驱动 [${relic.Slot}]`,
//                         icon: equip_meta.IconPath ?? '', rarity: _equip.Rarity ? (_equip.Rarity == 4 ? 'S' : 'A') : 'A', // 使用Enka的稀有度
//                         properties: [], main_properties: [],
//                         equip_suit: { suit_id: parseInt(suit_id), name: equip_meta.equip_name || `套装 ${suit_id}`, own: 0, desc1: equip_meta.desc1 || "", desc2: equip_meta.desc2 || "" },
//                         equipment_type: relic.Slot
//                     };
//
//                     // 主词条
//                     if (_equip.MainPropertyList?.[0]) {
//                         const main_prop = _equip.MainPropertyList[0];
//                         const prop_id_str = String(main_prop.PropertyId);
//                         const en_prop_name = ID_TO_EN[prop_id_str];
//
//                         if (en_prop_name) {
//                              const base_value = main_prop.PropertyValue || 0;
//                              const increase_per_tier = MAIN_PROP_BASE_INCREASE[prop_id_str] ?? 0;
//                              const total_main_value_raw = base_value + (increase_per_tier * relic_tier);
//                             // logger.debug(`[DEBUG][${char_id}] Drive ${relic.Slot} Main: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Lvl:${relic_level}(T${relic_tier}), Base:${base_value}, Inc:${increase_per_tier} -> RawVal:${total_main_value_raw}`);
//
//                              if (prop_id_str === '11102') percentAdds.HpAdd += total_main_value_raw;
//                              else if (prop_id_str === '12102') percentAdds.AttackAdd += total_main_value_raw;
//                              else if (prop_id_str === '13102') percentAdds.DefenceAdd += total_main_value_raw;
//                              else if (prop_id_str === '11103') flatAdds.HpMax += total_main_value_raw;
//                              else if (prop_id_str === '12103') flatAdds.Attack += total_main_value_raw;
//                              else if (prop_id_str === '13103') flatAdds.Defence += total_main_value_raw;
//                              else if (props[en_prop_name] !== undefined) { props[en_prop_name] += total_main_value_raw; }
//                              else {
//                                  logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive main stat accumulation.`);
//                                   }
//                             const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
//                             raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: formatEquipWeaponPropValue(total_main_value_raw, prop_id_str) });
//                         } else { logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive main stat ID ${prop_id_str}`); }
//                     }
//
//                     // 副词条
//                     if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
//                         for (const prop of _equip.RandomPropertyList) {
//                             if (!prop || prop.PropertyId === undefined) continue;
//                             const prop_id_str = String(prop.PropertyId);
//                             const en_prop_name = ID_TO_EN[prop_id_str];
//
//                              if (en_prop_name) {
//                                  const prop_level = prop.PropertyLevel || 1;
//                                  const base_value_per_roll = prop.PropertyValue || 0;
//                                  const total_substat_value_raw = base_value_per_roll * prop_level;
//                                  logger.debug(`[DEBUG][${char_id}] Drive ${relic.Slot} Sub: ${ID_TO_PROP_NAME[prop_id_str]}(${prop_id_str}), Val/Roll:${base_value_per_roll}, Rolls:${prop_level} -> RawVal:${total_substat_value_raw}`);
//
//                                  if (prop_id_str === '11102') percentAdds.HpAdd += total_substat_value_raw;
//                                  else if (prop_id_str === '12102') percentAdds.AttackAdd += total_substat_value_raw;
//                                  else if (prop_id_str === '13102') percentAdds.DefenceAdd += total_substat_value_raw;
//                                  else if (prop_id_str === '11103') flatAdds.HpMax += total_substat_value_raw;
//                                  else if (prop_id_str === '12103') flatAdds.Attack += total_substat_value_raw;
//                                  else if (prop_id_str === '13103') flatAdds.Defence += total_substat_value_raw;
//                                  else if (props[en_prop_name] !== undefined) { props[en_prop_name] += total_substat_value_raw; }
//                                  else {
//                                      logger.warn(`[enka_to_mys.js] Prop key ${en_prop_name} undefined during drive sub stat accumulation.`);
//                                  }
//
//                                 const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`;
//                                 raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: formatEquipWeaponPropValue(total_substat_value_raw, prop_id_str) });
//                              } else {
//                                  logger.warn(`[enka_to_mys.js] Unknown EN mapping for drive sub stat ID ${prop_id_str}`);
//                              }
//                         }
//                     }
//                     equipDisplayList.push(raw_equip_obj);
//                 }
//
//                 const suitCounts = {};
//                 equipDisplayList.forEach(eq => { const sid = eq.equip_suit.suit_id; suitCounts[sid] = (suitCounts[sid] || 0) + 1; });
//                 equipDisplayList.forEach(eq => { eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
//                 result.equip = equipDisplayList;
//               //  logger.debug(`[DEBUG][${char_id}] Flat Adds after drives:`, JSON.stringify(flatAdds));
//                // logger.debug(`[DEBUG][${char_id}] Percent Adds after drives:`, JSON.stringify(percentAdds));
//
//             }
//
//             // --- 5. 最终属性计算 ---
//             props.HpMax = trueBaseHP * (1 + (percentAdds.HpAdd || 0) / 10000) + (flatAdds.HpMax || 0);
//             props.Attack = trueBaseATK * (1 + (percentAdds.AttackAdd || 0) / 10000) + (flatAdds.Attack || 0);
//             props.Defence = trueBaseDEF * (1 + (percentAdds.DefenceAdd || 0) / 10000) + (flatAdds.Defence || 0);
//
//             //logger.debug(`[DEBUG][${char_id}] FINAL Calculated Stats: HP=${Math.floor(props.HpMax)}, ATK=${Math.floor(props.Attack)}, DEF=${Math.floor(props.Defence)}`);
//
//             // --- 6. 格式化最终面板 ---
//             result.properties = [];
//             const added_mys_ids = new Set();
//             const final_stat_mapping = {
//                 HpMax: { zh: '生命值', mysId: 1, enkaId: '11101' }, Attack: { zh: '攻击力', mysId: 2, enkaId: '12101' }, Defence: { zh: '防御力', mysId: 3, enkaId: '13101' },
//                 BreakStun: { zh: '冲击力', mysId: 4, enkaId: '12203' }, Crit: { zh: '暴击率', mysId: 5, enkaId: '20103' }, CritDmg: { zh: '暴击伤害', mysId: 6, enkaId: '21103' },
//                 ElementAbnormalPower: { zh: '异常掌控', mysId: 7, enkaId: '31403' }, ElementMystery: { zh: '异常精通', mysId: 8, enkaId: '31203' },
//                 PenRate: { zh: '穿透率', mysId: 9, enkaId: '23103' }, SpRecover: { zh: '能量自动回复', mysId: 11, enkaId: '30503' },
//                 PenDelta: { zh: '穿透值', mysId: 232, enkaId: '23203' }, PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, enkaId: '31503' },
//                 FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, enkaId: '31603' }, IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, enkaId: '31703' },
//                 ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, enkaId: '31803' }, EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, enkaId: '31903' },
//             };
//
//             for (const [propKey, mapping] of Object.entries(final_stat_mapping)) {
//                  const rawValue = props[propKey];
//                  const alwaysShow = ['HpMax', 'Attack', 'Defence', 'Crit', 'CritDmg'].includes(propKey); // 确保基础和双暴总是显示
//                  const numericValue = Number(rawValue);
//
//                  if (rawValue !== undefined && (!isNaN(numericValue)) && (numericValue !== 0 || alwaysShow)) {
//                      const final_value_str = formatFinalPanelPropValue(rawValue, mapping.enkaId);
//                      result.properties.push({ property_name: mapping.zh, property_id: mapping.mysId, base: "", add: "", final: final_value_str });
//                      added_mys_ids.add(mapping.mysId);
//                  }
//             }
//
//              const ensurePropertyExists = (propName, mysId, defaultValueFormatted, enkaIdForFormatting, propKey) => {
//                  if (!added_mys_ids.has(mysId)) {
//                      const rawValue = props[propKey] || 0;
//                      const finalValueStr = formatFinalPanelPropValue(rawValue, enkaIdForFormatting); // 总是格式化，即使是0
//                      result.properties.push({ property_name: propName, property_id: mysId, base: "", add: "", final: finalValueStr });
//                      added_mys_ids.add(mysId);
//                  }
//              };
//             // 确保所有属性都存在
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
//             result.properties.sort((a, b) => a.property_id - b.property_id);
//
//             // --- 7. 处理技能 ---
//             result.skills = [];
//             const charSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
//             const charSkillDetails = PartnerId2SkillParam[char_id] || {};
//             const skillTypesInOrder = [0, 1, 2, 3, 5, 6];
//             for (const skillIndex of skillTypesInOrder) {
//                  const skillIndexStr = String(skillIndex);
//                  const skillDetail = charSkillDetails[skillIndexStr];
//                  const currentLevel = charSkillLevels[skillIndexStr] ?? 1;
//                  let items = [];
//                  if (skillDetail && typeof skillDetail === 'object') {
//                       if (skillDetail.Items && Array.isArray(skillDetail.Items)) {
//                            items = skillDetail.Items.map(item => ({ title: item?.Title || '', text: item?.Text || '' })).filter(item => item.title || item.text);
//                       } else {
//                             // 尝试将整个对象作为 items (如果结构是 { title: '...', text: '...' })
//                             const skillKeys = Object.keys(skillDetail);
//                             if (skillKeys.length > 0) {
//                                 items = skillKeys.map(key => {
//                                     const itemData = skillDetail[key];
//                                     return { title: itemData?.title || key, text: itemData?.text || '' };
//                                 }).filter(item => item.title || item.text);
//                             }
//                       }
//                  }
//                  result.skills.push({ level: currentLevel, skill_type: skillIndex, items: items });
//             }
//
//             // --- 8. 处理核心强化---
//             result.ranks = [];
//             const rankData = _partner.Talents || {}; // 从 partner_data 获取天赋描述
//             const maxRank = 6;
//             for (let i = 1; i <= maxRank; i++) {
//                  const rankInfo = rankData[String(i)];
//                  result.ranks.push({
//                      id: rankInfo?.TalentID || i,
//                      name: rankInfo?.Name || `影位 ${i}`,
//                      desc: rankInfo?.Desc || '', // 使用 partner_data 中的描述
//                      pos: i,
//                      is_unlocked: i <= result.rank
//                  });
//             }
//
//             result_list.push(result);
//
//         } catch (processingError) {
//             logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message);
//             logger.error(processingError.stack);
//         }
//     }
//
//     return result_list;
// }
