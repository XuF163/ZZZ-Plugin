// enka_to_mys.js

import {
    equip_data,
    weapon_data,
    partner_data,
    PartnerId2SkillParam,
    get_char_circle_icon_url // Uses avatars.json via name_convert.js
} from './name_convert.js';
import _ from 'lodash';

// Assume logger is defined elsewhere (e.g., console or a dedicated logging library)
// Using console for simplicity here. Replace if you have a dedicated logger.
const logger = console;

// --- Data Validity Checks ---
if (typeof partner_data === 'undefined' || Object.keys(partner_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: partner_data is undefined or empty!"); }
if (typeof PartnerId2SkillParam === 'undefined') { PartnerId2SkillParam = {}; logger.warn("[enka_to_mys.js] WARNING: PartnerId2SkillParam is undefined."); }
if (typeof equip_data === 'undefined') { equip_data = {}; logger.warn("[enka_to_mys.js] WARNING: equip_data is undefined."); }
if (typeof weapon_data === 'undefined') { weapon_data = {}; logger.warn("[enka_to_mys.js] WARNING: weapon_data is undefined."); }


// --- Mappings and Constants ---
const ID_TO_PROP_NAME = {
    '11101': '生命值', '11103': '生命值', '11102': '生命值百分比', '12101': '攻击力', '12103': '攻击力', '12102': '攻击力百分比',
    '13101': '防御力', '13103': '防御力', '13102': '防御力百分比', '12203': '冲击力', '20103': '暴击率', '21103': '暴击伤害',
    '31402': '异常掌控', '31403': '异常掌控', '31202': '异常精通', '31203': '异常精通', '23103': '穿透率', '23203': '穿透值',
    '30503': '能量自动回复', '30502': '能量回复百分比', // Matching Python name
    '31503': '物理伤害加成', '31603': '火属性伤害加成', '31703': '冰属性伤害加成', '31803': '雷属性伤害加成', '31903': '以太属性伤害加成',
    '12202': '冲击力',
};
const MYSAPI_PROP_ID = {
    '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
    '穿透率': 9, '能量自动回复': 11, '能量回复百分比': 11, '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317,
    '雷属性伤害加成': 318, '以太属性伤害加成': 319, '生命值百分比': 0, '攻击力百分比': 0, '防御力百分比': 0,
};
const ID_TO_EN = {
    '11101': 'HpMax', '11103': 'HpBase', '11102': 'HpAdd', '12101': 'Attack', '12103': 'AttackBase', '12102': 'AttackAdd',
    '13101': 'Defence', '13103': 'DefenceBase', '13102': 'DefenceAdd', '12203': 'BreakStun', '20103': 'Crit', '21103': 'CritDmg',
    '31402': 'ElementAbnormalPower', '31403': 'ElementAbnormalPower', '31202': 'ElementMystery', '31203': 'ElementMystery', '23103': 'PenRate', '23203': 'PenDelta',
    '30503': 'SpRecover', '30502': 'SpRecover', '31503': 'PhysDmgBonus', '31603': 'FireDmgBonus', '31703': 'IceDmgBonus',
    '31803': 'ThunderDmgBonus', '31903': 'EtherDmgBonus', '12202': 'BreakStun',
};
const EN_TO_ZH = {};
for (const id in ID_TO_EN) { if (ID_TO_PROP_NAME[id]) { EN_TO_ZH[ID_TO_EN[id]] = ID_TO_PROP_NAME[id]; } }
EN_TO_ZH['HpAdd'] = '生命值百分比'; EN_TO_ZH['AttackAdd'] = '攻击力百分比'; EN_TO_ZH['DefenceAdd'] = '防御力百分比';

// ***** FIX: Added ELEMENT_TO_EN Definition *****
const ELEMENT_TO_EN = {
    '203': 'Thunder', // 雷
    '205': 'Ether',   // 以太
    '202': 'Ice',     // 冰
    '200': 'Phys',    // 物理
    '201': 'Fire',    // 火
};
// **********************************************

// *** Using the SAME constant name and VALUES as Python code ***
const MAIN_PROP_VALUE = { /* ... (Values as in previous version, mimicking Python) ... */
    '11101': 330, '11103': 330, '11102': 330, '12101': 47.4, '12103': 47.4, '12102': 450, '13101': 27.6, '13103': 27.6, '13102': 720,
    '12203': 270, '20103': 360, '21103': 720, '31402': 450, '31403': 450, '31202': 13, '31203': 13, '23103': 360, '23203': 36,
    '30503': 900, '30502': 900, '31503': 450, '31603': 450, '31703': 450, '31803': 450, '31903': 450, '12202': 0,
};

// *** Using PERCENT_ID name and list from Python code ***
const PERCENT_ID = [ /* ... (List as in previous version, mimicking Python) ... */
    '11102', '12102', '13102', '20103', '21103', '23103', '31603', '12203', '31703', '31803', '31903',
];
const PERCENT_ID_LIST = [...PERCENT_ID]; // Based on Python list
// Manually add others typically formatted as %
if (!PERCENT_ID_LIST.includes('30503')) PERCENT_ID_LIST.push('30503'); if (!PERCENT_ID_LIST.includes('30502')) PERCENT_ID_LIST.push('30502'); if (!PERCENT_ID_LIST.includes('31503')) PERCENT_ID_LIST.push('31503');


// --- Helper Function Definitions ---

// *** Define _get_value_str to mimic Python's formatting ***
function _get_value_str_py_mimic(value, prop_level, prop_id, is_main_r = false) {
    const idStr = String(prop_id); let calculatedValue = Number(value) || 0;
    if (is_main_r) { const increase = MAIN_PROP_VALUE[idStr] ?? 0; calculatedValue += increase * 1 * prop_level; } // base + increase * 1 * tier
    else { calculatedValue = value * prop_level; } // value_per_roll * num_rolls
    if (PERCENT_ID.includes(idStr)) { return (calculatedValue / 100).toFixed(1) + '%'; }
    else { return String(Math.floor(calculatedValue)); }
}

// Original JS helper functions
function formatEquipWeaponPropValue(value, prop_id) { /* ... (Definition as before) ... */
    const idStr = String(prop_id); const isPercentProp = PERCENT_ID_LIST.includes(idStr); const numericValue = Number(value); if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; } try { if (isPercentProp) { return (numericValue / 100).toFixed(1) + '%'; } else { return String(Math.floor(numericValue)); } } catch (e) { logger.error(`Error formatting E/W prop value ${value} for ${prop_id}:`, e); return '0'; }
}
function render_weapon_detail(weapon_meta, weapon_level, weapon_break_level) { /* ... (Definition as before) ... */
    if (!weapon_meta || weapon_meta.props_value === undefined || !weapon_meta.level || !weapon_meta.stars) { logger.warn(`[render_weapon_detail] Invalid weapon metadata for ID ${weapon_meta?.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`); return [0, 0]; } const levelData = weapon_meta.level?.[String(weapon_level)]; const starData = weapon_meta.stars?.[String(weapon_break_level)]; if (!levelData || !starData) { logger.warn(`[render_weapon_detail] Missing level/break data for weapon ${weapon_meta.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`); return [0, 0]; } let base_value = Number(weapon_meta.props_value) || 0; base_value = base_value + base_value * (((Number(levelData.Rate) || 0) + (Number(starData.StarRate) || 0)) / 10000); let rand_value = Number(weapon_meta.rand_props_value) || 0; if (rand_value > 0 && starData.RandRate !== undefined) { rand_value = rand_value + rand_value * ((Number(starData.RandRate) || 0) / 10000); } else { rand_value = 0; } return [Math.floor(base_value), Math.floor(rand_value)];
}
function _calculate_char_base_stat(base_val, growth_val, level_data, extra_level_data, char_level, promotion_level, stat_key_in_promo, extra_key_id) { /* ... (Definition as before) ... */
    let final_value = Number(base_val) || 0; char_level = Number(char_level) || 1; growth_val = Number(growth_val) || 0; if (char_level > 1) { final_value += (char_level - 1) * growth_val / 10000; } const promoStr = String(promotion_level); if (level_data?.[promoStr]?.[stat_key_in_promo] !== undefined) { final_value += Number(level_data[promoStr][stat_key_in_promo]) || 0; } if (extra_level_data && extra_level_data[promoStr] && extra_level_data[promoStr].Extra && extra_key_id) { const extraValue = _.get(extra_level_data[promoStr], ['Extra', String(extra_key_id), 'Value'], 0); final_value += Number(extraValue) || 0; } return Math.floor(final_value);
}
function formatFinalPanelPropValue(value, prop_id) { /* ... (Definition as before) ... */
    const idStr = String(prop_id); const isPercentProp = PERCENT_ID_LIST.includes(idStr); const numericValue = Number(value); if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; } try { if (isPercentProp) { if (idStr === '30503' || idStr === '30502') { return (numericValue / 100).toFixed(2); } else { return (numericValue / 100).toFixed(1) + '%'; } } else { return String(Math.floor(numericValue)); } } catch (e) { logger.error(`Error formatting Final prop value ${value} for ${prop_id}:`, e); return '0'; }
}

// --- Main Conversion Function ---
export async function _enka_data_to_mys_data(enka_data) {
    if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
        logger.error("[enka_to_mys.js] Invalid enka_data structure or empty AvatarList."); return [];
    }

    const uid = enka_data.uid;
    const result_list = [];

    for (const char of enka_data.PlayerInfo.ShowcaseDetail.AvatarList) {
        try {
            // ... (Initialization: char_id, _partner, result object etc. as before) ...
            if (!char || typeof char.Id === 'undefined') { logger.warn("[enka_to_mys.js] Skipping invalid character entry."); continue; }
            const char_id = String(char.Id); const _partner = partner_data[char_id]; if (!_partner) { logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing partner_data.`); continue; } const characterIconUrl = get_char_circle_icon_url(char_id) ?? ''; if (!characterIconUrl && _partner) { logger.warn(`[enka_to_mys.js] Char ID ${char_id}: Could not generate icon URL.`); }
            const result = { id: char.Id, level: char.Level || 1, name_mi18n: _partner.name ?? `角色${char_id}`, full_name_mi18n: _partner.full_name ?? _partner.name ?? `角色${char_id}`, element_type: parseInt(_partner.ElementType) || 0, sub_element_type: parseInt(_partner.sub_element_type) || 0, camp_name_mi18n: _partner.Camp ?? '?', avatar_profession: parseInt(_partner.WeaponType) || 0, rarity: _partner.Rarity ?? 'A', group_icon_path: characterIconUrl, hollow_icon_path: characterIconUrl, equip: [], weapon: null, properties: [], skills: [], rank: char.TalentLevel || 0, ranks: [], };

            // --- Initialize Stat Accumulator (Original Structure) ---
            const props = {};
            Object.values(ID_TO_EN).forEach(enKey => { props[enKey] = 0; });

            // --- Base Character Stats (Mimic Python approach) ---
            // Calculate Base HP/ATK/DEF first
            const NAME_TO_ID = Object.fromEntries(Object.entries(ID_TO_PROP_NAME).map(([id, name]) => [name, id]));
            const baseStatsToCalc = { HpMax: { base: _partner.HpMax, growth: _partner.HpGrowth, key: 'HpMax', extraKeyId: NAME_TO_ID['生命值'] }, Attack: { base: _partner.Attack, growth: _partner.AttackGrowth, key: 'Attack', extraKeyId: NAME_TO_ID['攻击力'] }, Defence: { base: _partner.Defence, growth: _partner.DefenceGrowth, key: 'Defence', extraKeyId: NAME_TO_ID['防御力'] }, };
            for (const [statName, statData] of Object.entries(baseStatsToCalc)) { if (statData.base !== undefined && statData.growth !== undefined) { const calculatedBase = _calculate_char_base_stat(statData.base, statData.growth, _partner.Level, _partner.ExtraLevel, char.Level, char.PromotionLevel, statData.key, statData.extraKeyId); const basePropEn = statName.replace('Max', 'Base'); props[basePropEn] = calculatedBase; } else { logger.warn(` > Missing base/growth data for ${statName} ID ${char_id}`); } }
            // Assign/Add other base stats
            props.Crit = (props.Crit || 0) + (_partner.CritRate || 500); props.CritDmg = (props.CritDmg || 0) + (_partner.CritDamage || 5000); props.SpRecover = (props.SpRecover || 0) + (_partner.SpRecoverBase || 0) + 12000; props.ElementMystery = (props.ElementMystery || 0) + (_partner.ElementMystery || 0); props.ElementAbnormalPower = (props.ElementAbnormalPower || 0) + (_partner.ElementAbnormalPower || 0);
            // Initialize totals with base
            props.HpMax = props.HpBase || 0; props.Attack = props.AttackBase || 0; props.Defence = props.DefenceBase || 0;

            let weaponBaseATK = 0; // Store weapon base ATK

            // --- Process Weapon (Standard JS Accumulation) ---
            // ... (Weapon processing logic as in the previous *complete* version) ...
            if (char.Weapon?.Id) {
                const weapon_id = String(char.Weapon.Id); const _weapon_meta = weapon_data[weapon_id];
                if (_weapon_meta) {
                    const weapon_level = char.Weapon.Level || 1; const weapon_star = char.Weapon.UpgradeLevel || 0; const weapon_break_level = char.Weapon.BreakLevel || 0;
                    const [base_stat_value_raw, rand_stat_value_raw] = render_weapon_detail(_weapon_meta, weapon_level, String(weapon_break_level));
                    const base_prop_id_str = String(_weapon_meta.props_id); const base_en_prop = ID_TO_EN[base_prop_id_str];
                    if (base_en_prop && props[base_en_prop] !== undefined) { props[base_en_prop] += base_stat_value_raw; if (ID_TO_PROP_NAME[base_prop_id_str] === '攻击力') { weaponBaseATK = base_stat_value_raw; } }
                    else { logger.warn(`  >> Unknown EN mapping or key missing for weapon base prop ID ${base_prop_id_str}`); }
                    if (_weapon_meta.rand_props_id && rand_stat_value_raw > 0) {
                        const rand_prop_id_str = String(_weapon_meta.rand_props_id); const en_prop_name = ID_TO_EN[rand_prop_id_str];
                        if (en_prop_name && props[en_prop_name] !== undefined) { props[en_prop_name] += rand_stat_value_raw; }
                         else { logger.warn(`  >> Unknown EN mapping or key missing for weapon rand prop ID ${rand_prop_id_str}`); }
                    }
                    result.weapon = { id: char.Weapon.Id, level: weapon_level, name: _weapon_meta.name || `武器 ${weapon_id}`, star: weapon_star + 1, icon: _weapon_meta.IconPath ?? '', rarity: _weapon_meta.rarity ?? 'A', properties: [], main_properties: [], talent_title: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Name'], ''), talent_content: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Desc'], ''), profession: parseInt(_partner.WeaponType) || 0, }; const base_prop_zh = ID_TO_PROP_NAME[base_prop_id_str] || `?(${base_prop_id_str})`; result.weapon.main_properties.push({ property_name: base_prop_zh, property_id: _weapon_meta.props_id, base: formatEquipWeaponPropValue(base_stat_value_raw, base_prop_id_str) }); if (_weapon_meta.rand_props_id && rand_stat_value_raw > 0) { const rand_prop_id_str = String(_weapon_meta.rand_props_id); const rand_prop_zh = ID_TO_PROP_NAME[rand_prop_id_str] || `?(${rand_prop_id_str})`; result.weapon.properties.push({ property_name: rand_prop_zh, property_id: _weapon_meta.rand_props_id, base: formatEquipWeaponPropValue(rand_stat_value_raw, rand_prop_id_str) }); }
                } else { logger.warn(`[enka_to_mys.js] Weapon metadata missing for ID: ${weapon_id}`); }
            }


            // --- Process Equipment (Relics/Drives) ---
            if (char.EquippedList && Array.isArray(char.EquippedList)) {
                for (const relic of char.EquippedList) {
                    // ... (Setup: _equip, equip_meta, raw_equip_obj) ...
                     if (!relic?.Equipment) continue; const _equip = relic.Equipment; const equip_id_str = String(_equip.Id); const suit_id = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null; if (!suit_id) { continue; } const equip_meta = equip_data[suit_id]; if (!equip_meta) { continue; } const relic_level = _equip.Level || 0; const raw_equip_obj = { id: _equip.Id, level: relic_level, name: equip_meta.equip_name ? `${equip_meta.equip_name}[${relic.Slot}]` : `驱动 [${relic.Slot}]`, icon: equip_meta.IconPath ?? '', rarity: equip_meta.Rarity ?? 'S', properties: [], main_properties: [], equip_suit: { suit_id: parseInt(suit_id), name: equip_meta.equip_name || `套装 ${suit_id}`, own: 0, desc1: equip_meta.desc1 || "", desc2: equip_meta.desc2 || "", }, equipment_type: relic.Slot, };

                    // *** Process Main Stat using Python's Logic ***
                    if (_equip.MainPropertyList?.[0]) {
                        const main_prop = _equip.MainPropertyList[0]; const prop_id_str = String(main_prop.PropertyId); const en_prop_name = ID_TO_EN[prop_id_str];
                        if (en_prop_name) {
                            const base_value = main_prop.PropertyValue || 0; const increase = MAIN_PROP_VALUE[prop_id_str] ?? 0; const prop_level = main_prop.PropertyLevel || 1; const relic_tier = Math.floor(relic_level / 3);
                            // Mimic Python Calculation
                            const total_main_value_raw = base_value + (increase * prop_level * relic_tier);
                            if (props[en_prop_name] !== undefined) { props[en_prop_name] += total_main_value_raw; }
                            else { logger.warn(`  >> Prop ${en_prop_name} undefined during PY-MIMIC main stat accumulation.`); }
                            // Format for display
                            const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`; const display_value_str = _get_value_str_py_mimic(base_value, relic_tier, prop_id_str, true);
                            raw_equip_obj.main_properties.push({ property_name: prop_zh_name, property_id: main_prop.PropertyId, base: display_value_str });
                        } else { logger.warn(`  >> Unknown EN mapping for PY-MIMIC main stat ID ${prop_id_str}`); }
                    } else { logger.warn(` >> Relic ${equip_id_str} missing MainPropertyList`); }

                    // *** Process Sub Stats using Python's Logic ***
                    if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
                        for (const prop of _equip.RandomPropertyList) {
                            if (!prop || prop.PropertyId === undefined) continue; const prop_id_str = String(prop.PropertyId); const en_prop_name = ID_TO_EN[prop_id_str];
                            if (en_prop_name) {
                                const prop_level = prop.PropertyLevel || 1; const base_value_per_roll = prop.PropertyValue || 0;
                                // Mimic Python Calculation
                                const total_substat_value_raw = base_value_per_roll * prop_level;
                                if (props[en_prop_name] !== undefined) { props[en_prop_name] += total_substat_value_raw; }
                                else { logger.warn(`  >> Prop ${en_prop_name} undefined during PY-MIMIC sub stat accumulation.`); }
                                // Format for display
                                const prop_zh_name = ID_TO_PROP_NAME[prop_id_str] || `?(${prop_id_str})`; const display_value_str = _get_value_str_py_mimic(base_value_per_roll, prop_level, prop_id_str, false);
                                raw_equip_obj.properties.push({ property_name: prop_zh_name, property_id: prop.PropertyId, base: display_value_str });
                            } else { logger.warn(`  >> Unknown EN mapping for PY-MIMIC sub stat ID ${prop_id_str}`); }
                        }
                    }
                    result.equip.push(raw_equip_obj);
                } // End relic loop
                // Calculate suit counts
                const suitCounts = {}; result.equip.forEach(eq => { const sid = eq.equip_suit.suit_id; suitCounts[sid] = (suitCounts[sid] || 0) + 1; }); result.equip.forEach(eq => { eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
            } // End equip processing


            // --- Mimic Python's Final Stat Calculation (Directly modify props) ---
            logger.debug("[DEBUG][PyMimicFinalCalc] Props BEFORE final calc:", JSON.stringify(props));
            // Apply Python's potentially incorrect formula
            props.HpMax += (props.HpBase || 0) + ((props.HpAdd || 0) / 10000) * (props.HpMax || 0);
            props.Attack += (props.AttackBase || 0) + ((props.AttackAdd || 0) / 10000) * (props.Attack || 0);
            props.Defence += (props.DefenceBase || 0) + ((props.DefenceAdd || 0) / 10000) * (props.Defence || 0);
            // Delete intermediate keys
            delete props.HpBase; delete props.HpAdd; delete props.AttackBase; delete props.AttackAdd; delete props.DefenceBase; delete props.DefenceAdd;
            // Mimic Python's deletion of non-character element bonuses
            // ***** FIX: Define ELEMENT_TO_EN before use *****
            // const ELEMENT_TO_EN = { '203': 'Thunder', '205': 'Ether', '202': 'Ice', '200': 'Phys', '201': 'Fire' }; // Defined globally now
            const char_element_en = ELEMENT_TO_EN[_partner.ElementType]; // Line 319 where error occurred
            const elementBonusKeys = ['PhysDmgBonus', 'FireDmgBonus', 'IceDmgBonus', 'ThunderDmgBonus', 'EtherDmgBonus'];
            elementBonusKeys.forEach(key => {
                 const expectedKey = `${char_element_en}DmgBonus`;
                 if (key !== expectedKey && props[key] !== undefined) {
                    // Decide whether to actually delete based on Python's implicit logic.
                    // For now, let's just log it. To truly mimic Python's potential deletion: delete props[key];
                     logger.debug(`[DEBUG][PyMimicFinalCalc] Would delete ${key} (Value: ${props[key]}) as it doesn't match char element ${char_element_en}`);
                    // delete props[key]; // Uncomment to exactly mimic Python's deletion
                 }
            });
            logger.debug("[DEBUG][PyMimicFinalCalc] Props AFTER final calc:", JSON.stringify(props));


            // --- Format Final Properties Panel ---
            result.properties = [];
            const added_mys_ids = new Set();
            const final_stat_mapping = { HpMax: { zh: '生命值', mysId: 1, enkaId: '11101' }, Attack: { zh: '攻击力', mysId: 2, enkaId: '12101' }, Defence: { zh: '防御力', mysId: 3, enkaId: '13101' }, BreakStun: { zh: '冲击力', mysId: 4, enkaId: '12203' }, Crit: { zh: '暴击率', mysId: 5, enkaId: '20103' }, CritDmg: { zh: '暴击伤害', mysId: 6, enkaId: '21103' }, ElementAbnormalPower: { zh: '异常掌控', mysId: 7, enkaId: '31403' }, ElementMystery: { zh: '异常精通', mysId: 8, enkaId: '31203' }, PenRate: { zh: '穿透率', mysId: 9, enkaId: '23103' }, SpRecover: { zh: '能量自动回复', mysId: 11, enkaId: '30503' }, PenDelta: { zh: '穿透值', mysId: 232, enkaId: '23203' }, PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, enkaId: '31503' }, FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, enkaId: '31603' }, IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, enkaId: '31703' }, ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, enkaId: '31803' }, EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, enkaId: '31903' }, };
            for (const [propKey, mapping] of Object.entries(final_stat_mapping)) { const rawValue = props[propKey]; if (rawValue === undefined) continue; const final_value_str = formatFinalPanelPropValue(rawValue, mapping.enkaId); const alwaysShow = ['HpMax', 'Attack', 'Defence', 'Crit', 'CritDmg', 'SpRecover'].includes(propKey); const numericValue = Number(rawValue); if (numericValue !== 0 || alwaysShow) { result.properties.push({ property_name: mapping.zh, property_id: mapping.mysId, base: "", add: "", final: final_value_str }); added_mys_ids.add(mapping.mysId); } }
            const ensurePropertyExists = (propName, propId, defaultValueFormatted, enkaIdForFormatting, propKey) => { if (!added_mys_ids.has(propId)) { const rawValue = props[propKey] || 0; const finalValueStr = (rawValue !== 0) ? formatFinalPanelPropValue(rawValue, enkaIdForFormatting) : defaultValueFormatted; result.properties.push({ property_name: propName, property_id: propId, base: "", add: "", final: finalValueStr }); added_mys_ids.add(propId); } };
            ensurePropertyExists('生命值', 1, '0', '11101', 'HpMax'); ensurePropertyExists('攻击力', 2, '0', '12101', 'Attack'); ensurePropertyExists('防御力', 3, '0', '13101', 'Defence'); ensurePropertyExists('冲击力', 4, '0', '12203', 'BreakStun'); ensurePropertyExists('暴击率', 5, '5.0%', '20103', 'Crit'); ensurePropertyExists('暴击伤害', 6, '50.0%', '21103', 'CritDmg'); ensurePropertyExists('异常掌控', 7, '0', '31403', 'ElementAbnormalPower'); ensurePropertyExists('异常精通', 8, '0', '31203', 'ElementMystery'); ensurePropertyExists('穿透率', 9, '0.0%', '23103', 'PenRate'); ensurePropertyExists('能量自动回复', 11, '1.20', '30503', 'SpRecover'); ensurePropertyExists('穿透值', 232, '0', '23203', 'PenDelta'); ensurePropertyExists('物理伤害加成', 315, '0.0%', '31503', 'PhysDmgBonus'); ensurePropertyExists('火属性伤害加成', 316, '0.0%', '31603', 'FireDmgBonus'); ensurePropertyExists('冰属性伤害加成', 317, '0.0%', '31703', 'IceDmgBonus'); ensurePropertyExists('雷属性伤害加成', 318, '0.0%', '31803', 'ThunderDmgBonus'); ensurePropertyExists('以太属性伤害加成', 319, '0.0%', '31903', 'EtherDmgBonus');
            result.properties.sort((a, b) => a.property_id - b.property_id);


            // --- Process Skills (Mimic Python's simple structure) ---
            result.skills = []; if (char.SkillLevelList && Array.isArray(char.SkillLevelList)) { for (const skill of char.SkillLevelList) { result.skills.push({ level: skill.Level, skill_type: skill.Index, items: [], }); } result.skills.sort((a, b) => a.skill_type - b.skill_type); }


            // --- Process Ranks (Mimic Python's simple assignment) ---
            result.rank = char.TalentLevel || 0;
            result.ranks = []; const rankData = _partner.Talents || {}; const maxRank = 6;
            for (let i = 1; i <= maxRank; i++) { const rankInfo = rankData[String(i)]; result.ranks.push({ id: rankInfo?.TalentID || i, name: rankInfo?.Name || `影位 ${i}`, desc: rankInfo?.Desc || '', pos: i, is_unlocked: i <= result.rank }); }

            result_list.push(result);

        } catch (processingError) { logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message); logger.error(processingError.stack); }
    } // --- End of character loop ---

    logger.debug('[DEBUG] Final result_list structure sample (first character):', result_list.length > 0 ? JSON.stringify(result_list[0], null, 2) : 'No characters processed.');
    logger.info(`[enka_to_mys.js] Finished conversion. Processed ${result_list.length} characters.`);
    return result_list;
}

// Export the main function for use as a module

// import {
//     equip_data,
//     weapon_data,
//     partner_data,
//     PartnerId2SkillParam,
//     get_char_circle_icon_url // Uses avatars.json via name_convert.js
// } from './name_convert.js';
// import _ from 'lodash';
//
// // Assume logger is defined elsewhere (e.g., console or a dedicated logging library)
// const logger = console; // Replace with your actual logger if different
//
// // --- Data Validity Checks ---
// if (typeof partner_data === 'undefined' || Object.keys(partner_data || {}).length === 0) { logger.error("[enka_to_mys.js] CRITICAL ERROR: partner_data is undefined or empty!"); }
// if (typeof PartnerId2SkillParam === 'undefined') { PartnerId2SkillParam = {}; logger.warn("[enka_to_mys.js] WARNING: PartnerId2SkillParam is undefined."); }
// if (typeof equip_data === 'undefined') { equip_data = {}; logger.warn("[enka_to_mys.js] WARNING: equip_data is undefined."); }
// if (typeof weapon_data === 'undefined') { weapon_data = {}; logger.warn("[enka_to_mys.js] WARNING: weapon_data is undefined."); }
//
//
// // --- Mappings and Constants ---
// const ID_TO_PROP_NAME = {
//     '11101': '生命值', '11103': '生命值', '11102': '生命值百分比', '12101': '攻击力', '12103': '攻击力', '12102': '攻击力百分比',
//     '13101': '防御力', '13103': '防御力', '13102': '防御力百分比', '12203': '冲击力', '20103': '暴击率', '21103': '暴击伤害',
//     '31402': '异常掌控', '31403': '异常掌控', '31202': '异常精通', '31203': '异常精通', '23103': '穿透率', '23203': '穿透值',
//     '30503': '能量自动回复', '30502': '能量自动回复', '31503': '物理伤害加成', '31603': '火属性伤害加成', '31703': '冰属性伤害加成',
//     '31803': '雷属性伤害加成', '31903': '以太属性伤害加成', '12202': '冲击力', // Correcting ID 12202 based on sample equip[5] main stat - Revisit if 12202 is %
// };
// const MYSAPI_PROP_ID = {
//     '生命值': 1, '攻击力': 2, '防御力': 3, '冲击力': 4, '暴击率': 5, '暴击伤害': 6, '异常掌控': 7, '异常精通': 8,
//     '穿透率': 9, '能量自动回复': 11, // MyS uses 11 for SpRecover
//     '穿透值': 232, '物理伤害加成': 315, '火属性伤害加成': 316, '冰属性伤害加成': 317, '雷属性伤害加成': 318, '以太属性伤害加成': 319,
//     '生命值百分比': 0, '攻击力百分比': 0, '防御力百分比': 0, // Keep 0 for filtering in panel
// };
// const ID_TO_EN = {
//     '11101': 'HpMax', '11103': 'HpBase', '11102': 'HpAdd', '12101': 'Attack', '12103': 'AttackBase', '12102': 'AttackAdd',
//     '13101': 'Defence', '13103': 'DefenceBase', '13102': 'DefenceAdd', '12203': 'BreakStun', // Flat Impact from Enka? MyS panel uses ID 4
//     '20103': 'Crit', '21103': 'CritDmg', '31402': 'ElementAbnormalPower', '31403': 'ElementAbnormalPower',
//     '31202': 'ElementMystery', '31203': 'ElementMystery', '23103': 'PenRate', '23203': 'PenDelta',
//     '30503': 'SpRecover', '30502': 'SpRecover', '31503': 'PhysDmgBonus', '31603': 'FireDmgBonus', '31703': 'IceDmgBonus',
//     '31803': 'ThunderDmgBonus', '31903': 'EtherDmgBonus',
//     // '12202': 'BreakStunPercent', // If 12202 is Impact % - needs confirmation
//     '12202': 'BreakStun', // Assuming 12202 is also flat Impact based on mapping correction
// };
// const EN_TO_ZH = {};
// for (const id in ID_TO_EN) { if (ID_TO_PROP_NAME[id]) { EN_TO_ZH[ID_TO_EN[id]] = ID_TO_PROP_NAME[id]; } }
// EN_TO_ZH['HpAdd'] = '生命值百分比'; EN_TO_ZH['AttackAdd'] = '攻击力百分比'; EN_TO_ZH['DefenceAdd'] = '防御力百分比';
// // EN_TO_ZH['BreakStunPercent'] = '冲击力'; // Assign ZH if BreakStunPercent is used
//
// // *** CRUCIAL CONSTANT ***
// // Increase per Tier (3 levels) for Relic Main Stats.
// // Values MUST be accurate for ZZZ for calculations to be correct.
// // These are placeholder/example values potentially from other games or estimations. VERIFY THEM.
// const MAIN_PROP_BASE_INCREASE = {
//     // Flat Stats Increase per Tier
//     '11101': 330, '11103': 330, // HP Flat
//     '12101': 47.4, '12103': 47.4, // ATK Flat - This seems low? Verify. Should be like 22?
//     '13101': 27.6, '13103': 27.6, // DEF Flat - This seems low? Verify. Should be like 27?
//     '12203': 270, // Impact Flat? Verify value. Enka shows 93 at L15, base might be 0?
//     '31202': 13, '31203': 13, // EM Flat? Verify value. Should be like 27?
//     '31402': 450, '31403': 450, // Abnormal Control Flat? Verify value.
//     '23203': 36, // Pen Flat? Verify value.
//
//     // Percent Stats Increase per Tier (Raw 1/10000 unit)
//     '11102': 474, // HP% - e.g., 4.74% per tier? Verify.
//     '12102': 450, // ATK% - e.g., 4.5% per tier? Verify.
//     '13102': 720, // DEF% - e.g., 7.2% per tier? Verify.
//     '20103': 360, // Crit Rate% - e.g., 3.6% per tier? Verify.
//     '21103': 720, // Crit Dmg% - e.g., 7.2% per tier? Verify.
//     '23103': 360, // Pen Rate% - e.g., 3.6% per tier? Verify.
//     '30503': 900, '30502': 900, // ER% - e.g., 9.0% per tier? Verify.
//     '31503': 450, // Phys DMG% - e.g., 4.5% per tier? Verify.
//     '31603': 450, // Fire DMG% - e.g., 4.5% per tier? Verify.
//     '31703': 450, // Ice DMG% - e.g., 4.5% per tier? Verify.
//     '31803': 450, // Thunder DMG% - e.g., 4.5% per tier? Verify.
//     '31903': 450, // Ether DMG% - e.g., 4.5% per tier? Verify.
//     '12202': 180, // Impact %? - e.g., 1.8% per tier? Verify if this ID is % and value.
// };
// // Verify above values based on ZZZ game data if possible!
//
//
// // List of IDs whose values are typically treated as percentages (1/10000 unit)
// const PERCENT_ID_LIST = Object.keys(ID_TO_PROP_NAME)
//     .filter(id =>
//         ID_TO_PROP_NAME[id]?.includes('百分比') ||
//         ID_TO_PROP_NAME[id]?.includes('加成') ||
//         ['20103', '21103', '23103', '30502', '30503', /* '12202' if % */].includes(id)
//     );
// // Add potentially missing percent types explicitly if not covered by name
// if (!PERCENT_ID_LIST.includes('11102')) PERCENT_ID_LIST.push('11102'); // HP%
// if (!PERCENT_ID_LIST.includes('12102')) PERCENT_ID_LIST.push('12102'); // ATK%
// if (!PERCENT_ID_LIST.includes('13102')) PERCENT_ID_LIST.push('13102'); // DEF%
//
// const ELEMENT_TO_EN = { '203': 'Thunder', '205': 'Ether', '202': 'Ice', '200': 'Phys', '201': 'Fire' };
//
// // --- Helper Functions ---
//
// function formatEquipWeaponPropValue(value, prop_id) {
//     const idStr = String(prop_id);
//     const isPercentProp = PERCENT_ID_LIST.includes(idStr);
//     const numericValue = Number(value);
//     if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; }
//     try {
//         if (isPercentProp) {
//             return (numericValue / 100).toFixed(1) + '%';
//         } else {
//             return String(Math.floor(numericValue));
//         }
//     } catch (e) { logger.error(`Error formatting E/W prop value ${value} for ${prop_id}:`, e); return '0'; }
// }
//
// function render_weapon_detail(weapon_meta, weapon_level, weapon_break_level) {
//      if (!weapon_meta || weapon_meta.props_value === undefined || !weapon_meta.level || !weapon_meta.stars) {
//          logger.warn(`[enka_to_mys.js][render_weapon_detail] Invalid weapon metadata for ID ${weapon_meta?.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
//          return [0, 0];
//      }
//      const levelData = weapon_meta.level?.[String(weapon_level)];
//      const starData = weapon_meta.stars?.[String(weapon_break_level)];
//      if (!levelData || !starData) {
//           logger.warn(`[enka_to_mys.js][render_weapon_detail] Missing level/break data for weapon ${weapon_meta.id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
//          return [0, 0];
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
//      return [Math.floor(base_value), Math.floor(rand_value)];
// }
//
// function _calculate_char_base_stat(base_val = 0, growth_val = 0, level_data, extra_level_data, char_level, promotion_level, stat_key_in_promo, extra_key_id) {
//     let final_value = Number(base_val) || 0;
//     char_level = Number(char_level) || 1;
//     growth_val = Number(growth_val) || 0;
//
//     if (char_level > 1) { final_value += (char_level - 1) * growth_val / 10000; }
//
//     const promoStr = String(promotion_level);
//
//     if (level_data?.[promoStr]?.[stat_key_in_promo] !== undefined) {
//         final_value += Number(level_data[promoStr][stat_key_in_promo]) || 0;
//     }
//
//     if (extra_level_data && extra_level_data[promoStr] && extra_level_data[promoStr].Extra && extra_key_id) {
//         const extraValue = _.get(extra_level_data[promoStr], ['Extra', String(extra_key_id), 'Value'], 0);
//         final_value += Number(extraValue) || 0;
//     }
//
//     return Math.floor(final_value);
// }
//
// function formatFinalPanelPropValue(value, prop_id) {
//      const idStr = String(prop_id);
//      const isPercentProp = PERCENT_ID_LIST.includes(idStr);
//      const numericValue = Number(value);
//      if (value === undefined || value === null || isNaN(numericValue)) { return isPercentProp ? '0.0%' : '0'; }
//
//      try {
//          if (isPercentProp) {
//              if (idStr === '30503' || idStr === '30502') {
//                  return (numericValue / 100).toFixed(2); // ER needs 2 decimals
//              } else {
//                  return (numericValue / 100).toFixed(1) + '%';
//              }
//          } else {
//              return String(Math.floor(numericValue));
//          }
//      } catch (e) { logger.error(`Error formatting Final prop value ${value} for ${prop_id}:`, e); return '0'; }
// }
//
//
// // --- Main Conversion Function ---
// export async function _enka_data_to_mys_data(enka_data) {
//     if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
//         logger.error("[enka_to_mys.js] Invalid enka_data structure or empty AvatarList.");
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
//             if (!_partner) {
//                 logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing partner_data.`);
//                 continue;
//             }
//
//             const characterIconUrl = get_char_circle_icon_url(char_id) ?? '';
//             if (!characterIconUrl && _partner) {
//                 logger.warn(`[enka_to_mys.js] Char ID ${char_id}: Could not generate icon URL.`);
//             }
//
//             const result = { /* ... (Result object initialization - no changes) ... */
//                 id: char.Id,
//                 level: char.Level || 1,
//                 name_mi18n: _partner.name ?? `角色${char_id}`,
//                 full_name_mi18n: _partner.full_name ?? _partner.name ?? `角色${char_id}`,
//                 element_type: parseInt(_partner.ElementType) || 0,
//                 sub_element_type: parseInt(_partner.sub_element_type) || 0,
//                 camp_name_mi18n: _partner.Camp ?? '?',
//                 avatar_profession: parseInt(_partner.WeaponType) || 0,
//                 rarity: _partner.Rarity ?? 'A',
//                 group_icon_path: characterIconUrl,
//                 hollow_icon_path: characterIconUrl,
//                 equip: [],
//                 weapon: null,
//                 properties: [],
//                 skills: [],
//                 rank: char.TalentLevel || 0,
//                 ranks: [],
//              };
//
//             // --- Initialize Stat Accumulator ---
//             const props = {};
//             Object.values(ID_TO_EN).forEach(enKey => { props[enKey] = 0; });
//
//             // --- Base Character Stats ---
//             props.Crit = _partner.CritRate || 500;
//             props.CritDmg = _partner.CritDamage || 5000;
//             // FIX: Add base Energy Recharge
//             props.SpRecover = (_partner.SpRecoverBase || 0) + 12000; // Assuming 120% base, adjust if needed
//             props.ElementMystery = _partner.ElementMystery || 0; // Add base EM if exists
//             props.ElementAbnormalPower = _partner.ElementAbnormalPower || 0; // Add base AbnPow if exists
//
//             // Calculate HP, ATK, DEF base values
//             const NAME_TO_ID = Object.fromEntries(Object.entries(EN_TO_ZH).map(([k, v]) => [v, Object.keys(ID_TO_EN).find(id => ID_TO_EN[id] === k)]));
//             const baseStatsToCalc = { /* ... (no changes) ... */
//                 'HpMax': { base: _partner.HpMax, growth: _partner.HpGrowth, key: 'HpMax', extraKeyId: NAME_TO_ID['生命值'] },
//                 'Attack': { base: _partner.Attack, growth: _partner.AttackGrowth, key: 'Attack', extraKeyId: NAME_TO_ID['攻击力'] },
//                 'Defence': { base: _partner.Defence, growth: _partner.DefenceGrowth, key: 'Defence', extraKeyId: NAME_TO_ID['防御力'] },
//             };
//             for (const [statName, statData] of Object.entries(baseStatsToCalc)) {
//                  if (statData.base !== undefined && statData.growth !== undefined) {
//                      const calculatedBase = _calculate_char_base_stat(
//                          statData.base, statData.growth,
//                          _partner.Level, _partner.ExtraLevel,
//                          char.Level, char.PromotionLevel,
//                          statData.key, statData.extraKeyId
//                      );
//                      const basePropEn = statName.replace('Max', 'Base');
//                      if (props[basePropEn] !== undefined) {
//                          props[basePropEn] = calculatedBase;
//                      } else { logger.warn(` > Base prop ${basePropEn} not found in props dict for ${statName}`); }
//                  } else { logger.warn(` > Missing base/growth data for ${statName} ID ${char_id}`); }
//             }
//             props.HpMax += props.HpBase || 0;
//             props.Attack += props.AttackBase || 0;
//             props.Defence += props.DefenceBase || 0;
//
//
//             // --- Process Equipment (Relics/Drives) ---
//             if (char.EquippedList && Array.isArray(char.EquippedList)) {
//                 for (const relic of char.EquippedList) {
//                     if (!relic?.Equipment) continue;
//                     const _equip = relic.Equipment;
//                     const equip_id_str = String(_equip.Id);
//                     const suit_id = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
//                     if (!suit_id) { logger.warn(`[enka_to_mys.js] Could not derive suit ID for equip ID ${equip_id_str}`); continue; }
//
//                     const equip_meta = equip_data[suit_id];
//                     if (!equip_meta) { logger.warn(`[enka_to_mys.js] Relic suit metadata missing for suit ID: ${suit_id} (from equip ${equip_id_str})`); continue; }
//
//                     const relic_level = _equip.Level || 0;
//                     const raw_equip_obj = { /* ... (Relic object initialization - no changes) ... */
//                         id: _equip.Id, level: relic_level,
//                         name: equip_meta.equip_name ? `${equip_meta.equip_name}[${relic.Slot}]` : `驱动 [${relic.Slot}]`,
//                         icon: equip_meta.IconPath ?? '',
//                         rarity: equip_meta.Rarity ?? 'S',
//                         properties: [],      // Substats
//                         main_properties: [], // Main stat
//                         equip_suit: {
//                             suit_id: parseInt(suit_id),
//                             name: equip_meta.equip_name || `套装 ${suit_id}`,
//                             own: 0, // Placeholder
//                             desc1: equip_meta.desc1 || "",
//                             desc2: equip_meta.desc2 || "",
//                         },
//                         equipment_type: relic.Slot,
//                      };
//
//                     // Process Main Stat - *** REVISED CALCULATION ***
//                     if (_equip.MainPropertyList?.[0]) {
//                         const main_prop = _equip.MainPropertyList[0];
//                         const prop_id_str = String(main_prop.PropertyId);
//                         const prop_zh_name = ID_TO_PROP_NAME[prop_id_str];
//                         const en_prop_name = ID_TO_EN[prop_id_str];
//
//                         if (prop_zh_name && en_prop_name) {
//                             // --- CORRECTED CALCULATION ---
//                             // Get Lv 0 Base Value from API
//                             const base_value = main_prop.PropertyValue || 0;
//                             // Lookup increase per tier (ensure MAIN_PROP_BASE_INCREASE is accurate!)
//                             const increase_per_tier = MAIN_PROP_BASE_INCREASE[prop_id_str] ?? 0;
//                             if (increase_per_tier === 0 && base_value !== 0 && relic_level > 0) {
//                                 logger.warn(`[enka_to_mys.js] Missing or Zero MAIN_PROP_BASE_INCREASE value for main stat ID ${prop_id_str} (${prop_zh_name}) on Relic ${equip_id_str} Lvl ${relic_level}. Calculation might be wrong.`);
//                             }
//                             // Calculate current tier
//                             const relic_tier = Math.floor(relic_level / 3);
//                             // Calculate final raw value: Base + Increase * Tiers
//                             const total_main_value_raw = base_value + (increase_per_tier * relic_tier);
//                             // -----------------------------
//
//                             // --- Accumulate Stat ---
//                             if (props[en_prop_name] !== undefined) {
//                                 // logger.debug(` > Adding main stat ${en_prop_name} (${prop_zh_name}) value ${total_main_value_raw} (Base:${base_value}, Inc:${increase_per_tier}, Tier:${relic_tier}) from relic ${equip_id_str}`);
//                                 props[en_prop_name] += total_main_value_raw;
//                             } else {
//                                 logger.warn(`  >> Prop ${en_prop_name} was undefined in props during main stat accumulation for ID ${prop_id_str}`);
//                             }
//                             // -----------------------
//
//                             // Add to relic display object using the CALCULATED value
//                             raw_equip_obj.main_properties.push({
//                                 property_name: prop_zh_name,
//                                 property_id: main_prop.PropertyId,
//                                 base: formatEquipWeaponPropValue(total_main_value_raw, prop_id_str) // Format the *calculated* value
//                             });
//                         } else { logger.warn(`  >> Skipping unknown main relic prop ID ${prop_id_str}`); }
//                     } else { logger.warn(` >> Relic ${equip_id_str} missing MainPropertyList`); }
//
//                     // Process Sub Stats (No changes needed here)
//                     if (_equip.RandomPropertyList && Array.isArray(_equip.RandomPropertyList)) {
//                         for (const prop of _equip.RandomPropertyList) {
//                              if (!prop || prop.PropertyId === undefined) continue;
//                             const prop_id_str = String(prop.PropertyId);
//                             const prop_zh_name = ID_TO_PROP_NAME[prop_id_str];
//                             const en_prop_name = ID_TO_EN[prop_id_str];
//
//                             if (prop_zh_name && en_prop_name) {
//                                 const prop_level = prop.PropertyLevel || 1;
//                                 const base_value_per_roll = prop.PropertyValue || 0;
//                                 const total_substat_value_raw = base_value_per_roll * prop_level;
//
//                                 if (props[en_prop_name] !== undefined) {
//                                     props[en_prop_name] += total_substat_value_raw;
//                                 } else {
//                                      logger.warn(`  >> Prop ${en_prop_name} was undefined in props during sub stat accumulation for ID ${prop_id_str}`);
//                                 }
//
//                                 raw_equip_obj.properties.push({
//                                     property_name: prop_zh_name,
//                                     property_id: prop.PropertyId,
//                                     base: formatEquipWeaponPropValue(total_substat_value_raw, prop_id_str)
//                                 });
//                             } else { logger.warn(`  >> Skipping unknown sub relic prop ID ${prop_id_str}`); }
//                         }
//                     }
//                     result.equip.push(raw_equip_obj);
//                 } // End equip loop
//
//                  // Calculate equip_suit.own counts (No changes)
//                  const suitCounts = {};
//                  result.equip.forEach(eq => { /* ... */ suitCounts[eq.equip_suit.suit_id] = (suitCounts[eq.equip_suit.suit_id] || 0) + 1; });
//                  result.equip.forEach(eq => { /* ... */ eq.equip_suit.own = suitCounts[eq.equip_suit.suit_id] || 0; });
//
//             } // End equip processing
//
//
//             // --- Process Weapon (No changes needed here) ---
//             if (char.Weapon?.Id) {
//                 const weapon_id = String(char.Weapon.Id);
//                 const _weapon_meta = weapon_data[weapon_id];
//                 if (_weapon_meta) {
//                     const weapon_level = char.Weapon.Level || 1;
//                     const weapon_star = char.Weapon.UpgradeLevel || 0;
//                     const weapon_break_level = char.Weapon.BreakLevel || 0;
//                     const [base_stat_value_raw, rand_stat_value_raw] = render_weapon_detail(_weapon_meta, weapon_level, String(weapon_break_level));
//
//                     // Accumulate Base Stat
//                     const base_prop_id_str = String(_weapon_meta.props_id);
//                     const base_en_prop = ID_TO_EN[base_prop_id_str];
//                     if (base_en_prop) {
//                         if (props[base_en_prop] !== undefined) { props[base_en_prop] += base_stat_value_raw; }
//                         else { logger.warn(`  >> Prop ${base_en_prop} was undefined during weapon base stat accumulation for ID ${base_prop_id_str}`); }
//                     } else { logger.warn(`  >> Unknown EN mapping for weapon base prop ID ${base_prop_id_str}`); }
//
//                     // Accumulate Random/Sub Stat
//                     if (_weapon_meta.rand_props_id && rand_stat_value_raw > 0) {
//                         const rand_prop_id_str = String(_weapon_meta.rand_props_id);
//                         const rand_en_prop = ID_TO_EN[rand_prop_id_str];
//                         if (rand_en_prop) {
//                              if (props[rand_en_prop] !== undefined) { props[rand_en_prop] += rand_stat_value_raw; }
//                              else { logger.warn(`  >> Prop ${rand_en_prop} was undefined during weapon rand stat accumulation for ID ${rand_prop_id_str}`); }
//                         } else { logger.warn(`  >> Unknown EN mapping for weapon rand prop ID ${rand_prop_id_str}`); }
//                     }
//
//                     // Build weapon object (No changes)
//                     result.weapon = { /* ... */
//                         id: char.Weapon.Id, level: weapon_level, name: _weapon_meta.name || `武器 ${weapon_id}`, star: weapon_star + 1,
//                         icon: _weapon_meta.IconPath ?? '', rarity: _weapon_meta.rarity ?? 'A', properties: [], main_properties: [],
//                         talent_title: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Name'], ''),
//                         talent_content: _.get(_weapon_meta, ['talents', String(weapon_star + 1), 'Desc'], ''),
//                         profession: parseInt(_partner.WeaponType) || 0,
//                      };
//                     const base_prop_zh = ID_TO_PROP_NAME[base_prop_id_str] || `?(${base_prop_id_str})`;
//                     result.weapon.main_properties.push({ property_name: base_prop_zh, property_id: _weapon_meta.props_id, base: formatEquipWeaponPropValue(base_stat_value_raw, base_prop_id_str) });
//                     if (_weapon_meta.rand_props_id && rand_stat_value_raw > 0) {
//                         const rand_prop_id_str = String(_weapon_meta.rand_props_id);
//                         const rand_prop_zh = ID_TO_PROP_NAME[rand_prop_id_str] || `?(${rand_prop_id_str})`;
//                          result.weapon.properties.push({ property_name: rand_prop_zh, property_id: _weapon_meta.rand_props_id, base: formatEquipWeaponPropValue(rand_stat_value_raw, rand_prop_id_str) });
//                     }
//                 } else { logger.warn(`[enka_to_mys.js] Weapon metadata missing for ID: ${weapon_id}`); }
//             } // End weapon processing
//
//
//             // --- Final Stat Calculation (No changes needed here) ---
//             const final_Hp = (props.HpBase || 0) * (1 + (props.HpAdd || 0) / 10000) + (props.HpMax || 0) - (props.HpBase || 0);
//             const final_Attack = (props.AttackBase || 0) * (1 + (props.AttackAdd || 0) / 10000) + (props.Attack || 0) - (props.AttackBase || 0);
//             const final_Defence = (props.DefenceBase || 0) * (1 + (props.DefenceAdd || 0) / 10000) + (props.Defence || 0) - (props.DefenceBase || 0);
//
//             props.HpMax = Math.floor(final_Hp);
//             props.Attack = Math.floor(final_Attack);
//             props.Defence = Math.floor(final_Defence);
//
//             delete props.HpBase; delete props.HpAdd;
//             delete props.AttackBase; delete props.AttackAdd;
//             delete props.DefenceBase; delete props.DefenceAdd;
//
//
//             // --- Format Final Properties Panel (No changes needed here) ---
//             result.properties = [];
//             const added_mys_ids = new Set();
//             for (const [prop_en, prop_value_raw] of Object.entries(props)) {
//                  if (prop_value_raw === undefined) continue; // Skip undefined, handle 0 later
//                  const prop_zh = EN_TO_ZH[prop_en];
//                  if (!prop_zh) continue;
//                  const prop_id_mys = MYSAPI_PROP_ID[prop_zh];
//                  if (prop_id_mys === undefined || prop_id_mys === 0) continue;
//                  const current_prop_enka_id = Object.keys(ID_TO_EN).find(k => ID_TO_EN[k] === prop_en);
//                  if (!current_prop_enka_id) { logger.warn(` > Could not find Enka ID for EN prop ${prop_en}`); continue; }
//
//                  const final_value_str = formatFinalPanelPropValue(prop_value_raw, current_prop_enka_id);
//                  const alwaysShow = ['暴击率', '暴击伤害', '能量自动回复'].includes(prop_zh);
//                  const isBaseMainStat = ['生命值', '攻击力', '防御力'].includes(prop_zh);
//                  const numericValue = Number(prop_value_raw);
//
//                  if (numericValue !== 0 || alwaysShow || isBaseMainStat) {
//                      result.properties.push({ property_name: prop_zh, property_id: prop_id_mys, base: "", add: "", final: final_value_str });
//                      added_mys_ids.add(prop_id_mys);
//                  }
//             }
//
//             // Ensure essential properties exist (No changes)
//              const ensurePropertyExists = (propName, propId, defaultValueFormatted, enkaIdForFormatting, enKey) => { /* ... */
//                  if (!added_mys_ids.has(propId)) {
//                      const rawValue = props[enKey] || 0;
//                      const finalValueStr = (rawValue !== 0) ? formatFinalPanelPropValue(rawValue, enkaIdForFormatting) : defaultValueFormatted;
//                      result.properties.push({ property_name: propName, property_id: propId, base: "", add: "", final: finalValueStr });
//                      added_mys_ids.add(propId);
//                  }
//              };
//             ensurePropertyExists('生命值', 1, '0', '11101', 'HpMax');
//             ensurePropertyExists('攻击力', 2, '0', '12101', 'Attack');
//             ensurePropertyExists('防御力', 3, '0', '13101', 'Defence');
//             ensurePropertyExists('冲击力', 4, '0', '12203', 'BreakStun');
//             ensurePropertyExists('暴击率', 5, '5.0%', '20103', 'Crit');
//             ensurePropertyExists('暴击伤害', 6, '50.0%', '21103', 'CritDmg');
//             ensurePropertyExists('异常掌控', 7, '0', '31403', 'ElementAbnormalPower');
//             ensurePropertyExists('异常精通', 8, '0', '31203', 'ElementMystery');
//             ensurePropertyExists('穿透率', 9, '0.0%', '23103', 'PenRate');
//             ensurePropertyExists('能量自动回复', 11, '1.20', '30503', 'SpRecover');
//             ensurePropertyExists('穿透值', 232, '0', '23203', 'PenDelta');
//             const elementDmgBonusEnKeys = { /* ... */ Phys: { enKey: 'PhysDmgBonus', id: 315, enkaId: '31503' }, Fire: { enKey: 'FireDmgBonus', id: 316, enkaId: '31603' }, Ice: { enKey: 'IceDmgBonus', id: 317, enkaId: '31703' }, Thunder: { enKey: 'ThunderDmgBonus', id: 318, enkaId: '31803' }, Ether: { enKey: 'EtherDmgBonus', id: 319, enkaId: '31903' } };
//             for (const data of Object.values(elementDmgBonusEnKeys)) { /* ... */ const propName = EN_TO_ZH[data.enKey]; if (propName && data.id) { ensurePropertyExists(propName, data.id, '0.0%', data.enkaId, data.enKey); } }
//
//             result.properties.sort((a, b) => a.property_id - b.property_id);
//
//
//             // --- Process Skills (No changes) ---
//             result.skills = [];
//             const charSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
//             const charSkillDetails = PartnerId2SkillParam[char_id] || {};
//             const skillTypesInOrder = [0, 1, 2, 3, 5, 6];
//             for (const skillIndex of skillTypesInOrder) { /* ... */
//                 const skillIndexStr = String(skillIndex);
//                 const skillDetail = charSkillDetails[skillIndexStr];
//                 const currentLevel = charSkillLevels[skillIndexStr] ?? 1;
//                 let items = [];
//                 if (skillDetail?.Items && Array.isArray(skillDetail.Items)) { items = skillDetail.Items.map(item => ({ title: item?.Title || '', text: item?.Text || '' })).filter(item => item.title || item.text); }
//                 result.skills.push({ level: currentLevel, skill_type: skillIndex, items: items });
//              }
//
//
//             // --- Process Ranks (No changes) ---
//             result.ranks = [];
//             const rankData = _partner.Talents || {};
//             const maxRank = 6;
//             for (let i = 1; i <= maxRank; i++) { /* ... */
//                 const rankInfo = rankData[String(i)];
//                  result.ranks.push({ id: rankInfo?.TalentID || i, name: rankInfo?.Name || `影位 ${i}`, desc: rankInfo?.Desc || '', pos: i, is_unlocked: i <= result.rank });
//              }
//
//             result_list.push(result);
//
//         } catch (processingError) {
//             logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError.message);
//             logger.error(processingError.stack);
//         }
//     } // --- End of character loop ---
//
//     logger.info(`[enka_to_mys.js] Finished conversion. Processed ${result_list.length} characters.`);
//     return result_list;
// }
