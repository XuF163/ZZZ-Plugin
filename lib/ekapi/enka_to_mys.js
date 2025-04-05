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
    getCharBasicInfo,
    calculateCharBaseStat,
    render_weapon_detail,
    constructIconUrl,
    get_char_circle_icon_url_from_avatars,
    get_char_base_icon_url_from_avatars,
} from './name_convert.js';
import _ from 'lodash';
import { PropertyCalculator } from './property_calculator.js';
const logger = console;
const MYSAPI_PROP_ID = {
    '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
    '穿透率': 9, /*'能量自动回复': 11,*/ '能量回复效率': 11,
    '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
};
const DEFAULT_CIRCLE_ICON_URL = '';
const DEFAULT_BASE_ICON_URL = '';
const DEFAULT_WEAPON_ICON_URL = '';
const DEFAULT_DRIVE_ICON_URL = '';
function formatEquipWeaponPropValue(value, prop_id) {
    const idStr = String(prop_id);
    const isPercentProp = PERCENT_ID_LIST.includes(idStr);
    const numericValue = Number(value);
    if (value === undefined || value === null || isNaN(numericValue)) {
        return isPercentProp ? '0.0%' : '0';
    }
    try {
        if (isPercentProp) {
             return (numericValue / 100).toFixed(1) + '%';
        }
        else if (idStr === '30503' || idStr === '30501') {
             return (numericValue / 1000).toFixed(2);
        }
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
          if (isPercentProp) {
              return (numericValue / 100).toFixed(1) + '%';
          }
          else if (idStr === '30503' || idStr === '30501') {
               return (numericValue / 100).toFixed(2);
          }
          else {
              return String(Math.floor(numericValue));
          }
      } catch (e) {
          logger.error(`[formatFinalPanelPropValue] Error formatting Final prop value ${value} for ${prop_id}:`, e);
          return '0';
      }
}
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
            const basicInfo = getCharBasicInfo(char_id);
            const charData = getCharacterData(char_id);
            if (!basicInfo || !charData) {
                logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing basic info or detailed data from Hakush.`);
                continue;
            }
            const characterCircleIconUrl = get_char_circle_icon_url_from_avatars(char_id) || DEFAULT_CIRCLE_ICON_URL;
            const characterBaseIconUrl = get_char_base_icon_url_from_avatars(char_id) || DEFAULT_BASE_ICON_URL;
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
            const props = {};
            const percentAdds = { HpAdd: 0, AttackAdd: 0, DefenceAdd: 0 };
            const flatAdds = { HpMax: 0, Attack: 0, Defence: 0 };
            Object.keys(ID_TO_EN).forEach(keyId => {
                 const enKey = ID_TO_EN[keyId];
                 if (!['HpBase', 'AttackBase', 'DefenceBase', 'HpAdd', 'AttackAdd', 'DefenceAdd', 'HpMax', 'Attack', 'Defence'].includes(enKey)) {
                     props[enKey] = 0;
                 }
            });
            const { baseHp: charBaseHp, baseAtk: charBaseAtk, baseDef: charBaseDef } = calculateCharBaseStat(char_id, enkaLevel, enkaPromotionLevel);
            const initialStats = charData.Stats;
            props.Crit = Number(initialStats?.Crit) || 500;
            props.CritDmg = Number(initialStats?.CritDamage) || 5000;
            props.BreakStun = Number(initialStats?.BreakStun) || 0;
            props.ElementAbnormalPower = Number(initialStats?.ElementAbnormalPower) || 0;
            props.ElementMystery = Number(initialStats?.ElementMystery) || 0;
            props.PenRate = (Number(initialStats?.PenRate) || 0) * 100;
            props.PenDelta = Number(initialStats?.PenDelta) || 0;
            props.SpRecover = Number(initialStats?.SpRecover) || 120;
            props.SpRecoverPercent = 10000;
            let trueBaseHP = charBaseHp;
            let trueBaseATK = charBaseAtk;
            let trueBaseDEF = charBaseDef;
            logger.debug(`[${char_id}] Initial Base Stats (Hakush): HP=${trueBaseHP}, ATK=${trueBaseATK}, DEF=${trueBaseDEF}`);
            logger.debug(`[${char_id}] Initial accumulated props:`, JSON.stringify(props));
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
                    if (basePropId === atkId) trueBaseATK += baseValue;
                    else if (basePropId === hpId) trueBaseHP += baseValue;
                    else if (basePropId === defId) trueBaseDEF += baseValue;
                    else {
                        const baseEnProp = ID_TO_EN[basePropId];
                        if(baseEnProp && props[baseEnProp] !== undefined) props[baseEnProp] += baseValue;
                        else logger.warn(`[enka_to_mys.js] Weapon ${weapon_id} has unhandled base prop ID: ${basePropId}`);
                    }
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
                        else if (randEnProp && props[randEnProp] !== undefined) props[randEnProp] += randValue;
                        else logger.warn(`[enka_to_mys.js] Unknown or unhandled weapon random prop ID: ${randPropId} (EN: ${randEnProp})`);
                    }
                    const weaponIconPath = weaponData.Icon;
                    const weaponIconUrl = weaponIconPath ? constructIconUrl(weaponIconPath) : DEFAULT_WEAPON_ICON_URL;
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
                finalCharDataForModel.equip = equipDisplayList;
                logger.debug(`[${char_id}] Final accumulated props after drives:`, JSON.stringify(props));
                logger.debug(`[${char_id}] Final accumulated percentAdds after drives:`, JSON.stringify(percentAdds));
                logger.debug(`[${char_id}] Final accumulated flatAdds after drives:`, JSON.stringify(flatAdds));
            }
            const propertiesGetter = new PropertyCalculator(char);
            const finalPropertiesArrayForModel = [];
            const added_mys_ids_for_model = new Set();
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
                 SpRecoverPercent: { zh: '能量回复效率', mysId: 11, getter: 'getFormattedSpRecoverPercent' },
                 PenDelta: { zh: '穿透值', mysId: 232, getter: 'getFormattedPenDelta' },
                 PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, getter: 'getFormattedPhysDmgBonus' },
                 FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, getter: 'getFormattedFireDmgBonus' },
                 IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, getter: 'getFormattedIceDmgBonus' },
                 ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, getter: 'getFormattedThunderDmgBonus' },
                 EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, getter: 'getFormattedEtherDmgBonus' },
            };
            for (const [propKey, config] of Object.entries(MYS_PANEL_CONFIG)) {
                 if (typeof propertiesGetter[config.getter] === 'function') {
                     const finalValueStr = propertiesGetter[config.getter]();
                     if (finalValueStr !== undefined && finalValueStr !== null) {
                         let propertyName = config.zh;
                         if (config.mysId === 11) {
                             propertyName = '能量自动回复';
                         }
                         if (!added_mys_ids_for_model.has(config.mysId)) {
                             finalPropertiesArrayForModel.push({
                                 property_name: propertyName,
                                 property_id: config.mysId,
                                 base: "",
                                 add: "",
                                 final: finalValueStr
                             });
                             added_mys_ids_for_model.add(config.mysId);
                         } else {
                             logger.warn(`[enka_to_mys] Duplicate MYS ID ${config.mysId} encountered for key ${propKey}.`);
                         }
                     } else {
                     }
                 } else {
                     logger.warn(`[enka_to_mys] Getter function ${config.getter} not found on PropertyCalculator for key ${propKey}.`);
                 }
            }
            finalPropertiesArrayForModel.sort((a, b) => {
                const order = [1, 2, 3, 5, 6, 11, 4, 8, 7, 9, 232, 315, 316, 317, 318, 319];
                const indexA = order.indexOf(a.property_id); const indexB = order.indexOf(b.property_id);
                if (indexA === -1 && indexB === -1) return a.property_id - b.property_id;
                if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB;
            });
            finalCharDataForModel.properties = finalPropertiesArrayForModel;
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
                    (hakushSkillDetail.Description || []).forEach(descItem => {
                        let currentDescriptionText = descItem.Desc || '';
                        const multipliers = [];
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
                                              let finalValueRaw = mainValue + growthValue * (currentLevel - 1);
                                              let displayValue = '';
                                              const format = skillValue.Format || '';
                                              if (format.includes('%')) {
                                                  displayValue = (finalValueRaw / 100).toFixed(1) + '%';
                                              } else if (format === 'I' || format === '' || format.includes('{0:0.#}')) {
                                                  if (paramInfo.Name?.includes('伤害倍率') || paramInfo.Name?.includes('失衡倍率')) {
                                                      displayValue = (finalValueRaw / 100).toFixed(1) + '%';
                                                  } else {
                                                      displayValue = String(Math.round(finalValueRaw / 100));
                                                  }
                                              } else {
                                                 displayValue = String(finalValueRaw);
                                              }
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
                            skillItems.push({
                                title: descItem.Name || '',
                                text: processedText + (multiplierText ? (processedText ? '\n\n' : '') + multiplierText : '')
                            });
                        }
                        currentDescriptionText = '';
                    });
                    if (skillItems.length === 0 && hakushSkillDetail.Description?.length > 0) {
                        const firstDesc = hakushSkillDetail.Description[0];
                        skillItems.push({
                            title: firstDesc.Name || `技能 ${enkaIndex}`,
                            text: (firstDesc.Desc || '').replace(/<IconMap:[^>]+>/g, '').trim()
                        });
                    }
                    skillsForModel.push({
                        level: currentLevel,
                        skill_type: enkaIndex,
                        items: skillItems.filter(item => item.title || item.text),
                    });
                } else {
                    logger.warn(`[enka_to_mys] Skill mapping or data not found for Enka Index ${enkaIndex} (Hakush Key: ${hakushSkillKey}) on char ${char_id}`);
                    skillsForModel.push({
                        level: currentLevel,
                        skill_type: enkaIndex,
                        items: [{ title: `未知技能 ${enkaIndex}`, text: '技能描述数据缺失'}]
                    });
                }
            }
            skillsForModel.sort((a, b) => a.skill_type - b.skill_type);
            finalCharDataForModel.skills = skillsForModel;
            const ranksForModel = [];
            const hakushTalents = charData.Talent || {};
            const maxRank = 6;
            for (let i = 1; i <= maxRank; i++) {
                 const rankKey = String(i);
                 const rankInfo = hakushTalents[rankKey];
                 if (rankInfo) {
                     ranksForModel.push({
                         id: i,
                         name: rankInfo.Name || `影位 ${i}`,
                         desc: (rankInfo.Desc || rankInfo.Desc2 || '').replace(/<IconMap:[^>]+>/g, '').trim(),
                         pos: i,
                         is_unlocked: i <= enkaRank
                     });
                 } else {
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
 * @typedef {object} PropertyData
 * @property {number} property_id MYS API 属性 ID
 * @property {string} property_name 属性中文名
 * @property {string} final 最终格式化后的值
 * @property {string} [base]
 * @property {string} [add]
 */
