// property_calculator.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import _ from 'lodash'; // Assuming lodash is available
// --- BEGIN Data Loading and Helpers (Moved inside or imported) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = console; // Simple logger
// Helper to load JSON relative to *this* file's location if needed, or assume paths are correct
function loadJsonData(fileName, relativePath = '../../resources/enka') { // Adjust default path if necessary
    const filePath = path.join(__dirname, relativePath, fileName);
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        logger.error(`[PropertyCalculator] Loading file ${fileName} failed:`, error);
        return null;
    }
}
const avatarData = loadJsonData('avatars.json');
const driveSetData = loadJsonData('EquipId2Data.json', '../../resources/enka');
const weaponData = loadJsonData('WeaponId2Data.json', '../../resources/enka');
const discLevelDataRaw = loadJsonData('EquipmentLevelTemplateTb.json');
const partnerData = loadJsonData('PartnerId2Data.json', '../../resources/enka');
const discLevelMap = {};
if (discLevelDataRaw?.GHFLHABGNDH) {
    discLevelDataRaw.GHFLHABGNDH.forEach(entry => {
        const rarity = entry.GPEHNHPCIDC; const level = entry.CPEGDKBNGDH;
        if (!discLevelMap[rarity]) { discLevelMap[rarity] = {}; }
        discLevelMap[rarity][level] = entry;
    });
} else {
    logger.error("[PropertyCalculator] EquipmentLevelTemplateTb.json structure error");
}
const propIdInfo = {
    11101: { name: "HP_BASE", type: 'base' }, 11102: { name: "HP%", type: 'percent' }, 11103: { name: "HP_FLAT", type: 'flat' },
    12101: { name: "ATK_BASE", type: 'base' }, 12102: { name: "ATK%", type: 'percent' }, 12103: { name: "ATK_FLAT", type: 'flat' },
    13101: { name: "DEF_BASE", type: 'base' }, 13102: { name: "DEF%", type: 'percent' }, 13103: { name: "DEF_FLAT", type: 'flat' },
    12201: { name: "IMPACT_BASE", type: 'other_flat' }, 12202: { name: "IMPACT%", type: 'percent' }, 12203: { name: "IMPACT", type: 'other_flat' },
    20101: { name: "CRIT_RATE_BASE", type: 'special_percent_base' }, 20103: { name: "CRIT_RATE", type: 'special_percent' },
    21101: { name: "CRIT_DMG_BASE", type: 'special_percent_base' }, 21103: { name: "CRIT_DMG", type: 'special_percent' },
    23101: { name: "PEN_RATIO_BASE", type: 'special_percent_base' }, 23103: { name: "PEN_RATIO", type: 'special_percent' },
    23201: { name: "PEN_VALUE_BASE", type: 'other_flat' }, 23203: { name: "PEN_VALUE", type: 'other_flat' },
    30501: { name: "ENERGY_REGEN_BASE", type: 'special_percent_base' }, 30502: { name: "ENERGY_REGEN%", type: 'percent' }, 30503: { name: "ENERGY_REGEN", type: 'special_percent' },
    31201: { name: "ANOMALY_PROFICIENCY_BASE", type: 'other_flat' }, 31203: { name: "ANOMALY_PROFICIENCY", type: 'other_flat' },
    31401: { name: "ANOMALY_MASTERY_BASE", type: 'other_flat' }, 31402: { name: "ANOMALY_MASTERY%", type: 'percent' }, 31403: { name: "ANOMALY_MASTERY", type: 'other_flat' },
    31501: { name: "PHYS_DMG_BASE", type: 'special_percent_base' }, 31503: { name: "PHYS_DMG", type: 'special_percent' },
    31601: { name: "FIRE_DMG_BASE", type: 'special_percent_base' }, 31603: { name: "FIRE_DMG", type: 'special_percent' },
    31701: { name: "ICE_DMG_BASE", type: 'special_percent_base' }, 31703: { name: "ICE_DMG", type: 'special_percent' },
    31801: { name: "ELEC_DMG_BASE", type: 'special_percent_base' }, 31803: { name: "ELEC_DMG", type: 'special_percent' },
    31901: { name: "ETHER_DMG_BASE", type: 'special_percent_base' }, 31903: { name: "ETHER_DMG", type: 'special_percent' },
};
function getPropInfo(id) { return propIdInfo[id] || { name: `UNKNOWN_${id}`, type: 'unknown' }; }
function parseSetBonus(desc, targetStatMap) {
     const percentMatch = desc.match(/([\u4e00-\u9fa5\w]+)\+([0-9.]+)%/);
     if (percentMatch) {
         const name = percentMatch[1]; const value = parseFloat(percentMatch[2]);
         if (!isNaN(value)) {
             const fracValue = value / 100;
             if (name.includes("暴击率")) targetStatMap.percent["CRIT_RATE"] = (targetStatMap.percent["CRIT_RATE"] || 0) + fracValue;
             else if (name.includes("暴击伤害")) targetStatMap.percent["CRIT_DMG"] = (targetStatMap.percent["CRIT_DMG"] || 0) + fracValue;
             else if (name.includes("攻击力")) targetStatMap.percent["ATK%"] = (targetStatMap.percent["ATK%"] || 0) + fracValue;
             else if (name.includes("防御力")) targetStatMap.percent["DEF%"] = (targetStatMap.percent["DEF%"] || 0) + fracValue;
             else if (name.includes("生命值")) targetStatMap.percent["HP%"] = (targetStatMap.percent["HP%"] || 0) + fracValue;
             else if (name.includes("护盾值")) targetStatMap.percent["SHIELD%"] = (targetStatMap.percent["SHIELD%"] || 0) + fracValue;
             else if (name.includes("冲击力")) targetStatMap.percent["IMPACT%"] = (targetStatMap.percent["IMPACT%"] || 0) + fracValue;
             else if (name.includes("穿透率")) targetStatMap.percent["PEN_RATIO"] = (targetStatMap.percent["PEN_RATIO"] || 0) + fracValue;
             else if (name.includes("能量自动回复")) targetStatMap.percent["ENERGY_REGEN%"] = (targetStatMap.percent["ENERGY_REGEN%"] || 0) + fracValue;
             else if (name.includes("异常掌控")) targetStatMap.percent["ANOMALY_MASTERY%"] = (targetStatMap.percent["ANOMALY_MASTERY%"] || 0) + fracValue;
             else if (name.includes("物理伤害")) targetStatMap.percent["PHYS_DMG"] = (targetStatMap.percent["PHYS_DMG"] || 0) + fracValue;
             else if (name.includes("火属性伤害")) targetStatMap.percent["FIRE_DMG"] = (targetStatMap.percent["FIRE_DMG"] || 0) + fracValue;
             else if (name.includes("冰属性伤害")) targetStatMap.percent["ICE_DMG"] = (targetStatMap.percent["ICE_DMG"] || 0) + fracValue;
             else if (name.includes("电属性伤害")) targetStatMap.percent["ELEC_DMG"] = (targetStatMap.percent["ELEC_DMG"] || 0) + fracValue;
             else if (name.includes("以太伤害")) targetStatMap.percent["ETHER_DMG"] = (targetStatMap.percent["ETHER_DMG"] || 0) + fracValue;
             else { logger.warn(`[parseSetBonus] Unhandled percent stat name: ${name}`); return false; }
             return true;
         }
     }
     const flatMatch = desc.match(/([\u4e00-\u9fa5\w]+)\+([0-9.]+)点/);
     if (flatMatch) {
         const name = flatMatch[1]; const value = parseFloat(flatMatch[2]);
         if (!isNaN(value)) {
             if (name.includes("异常精通")) targetStatMap.flat["ANOMALY_PROFICIENCY"] = (targetStatMap.flat["ANOMALY_PROFICIENCY"] || 0) + value;
             else if (name.includes("异常掌控")) targetStatMap.flat["ANOMALY_MASTERY"] = (targetStatMap.flat["ANOMALY_MASTERY"] || 0) + value;
             else { logger.warn(`[parseSetBonus] Unhandled flat stat name: ${name}`); return false; }
             return true;
         }
     }
     return false;
}
export class PropertyCalculator {
    constructor(characterApiData) {
        this.finalHp = 0; this.finalAtk = 0; this.finalDef = 0; this.finalCritRatePercent = 0; this.finalCritDmgPercent = 0;
        this.finalImpact = 0; this.finalAnomalyProficiency = 0; this.finalAnomalyMastery = 0; this.finalPhysDmgPercent = 0;
        this.finalFireDmgPercent = 0; this.finalIceDmgPercent = 0; this.finalElecDmgPercent = 0; this.finalEtherDmgPercent = 0;
        this.finalEnergyRegenPercent = 0; this.finalPenValue = 0; this.finalPenRatioPercent = 0;
        if (!characterApiData || !avatarData || !weaponData || !driveSetData || !discLevelMap) {
             logger.error("[PropertyCalculator] Missing required data for calculation. Cannot proceed.");
             return;
         }
        const characterId = characterApiData.Id;
        const avatarStaticData = avatarData[characterId];
        if (!avatarStaticData) {
            logger.error(`[PropertyCalculator] Missing static avatar data for ID ${characterId}`);
            return;
        }
        const finalStats = {
            HP: 0, ATK: 0, DEF: 0,
            CRIT_RATE: (avatarStaticData.BaseProps['20101'] || 500),
            CRIT_DMG: (avatarStaticData.BaseProps['21101'] || 5000),
            IMPACT: 0,
            ANOMALY_PROFICIENCY: 0,
            ANOMALY_MASTERY: 0,
            PHYS_DMG: 0, FIRE_DMG: 0, ICE_DMG: 0, ELEC_DMG: 0, ETHER_DMG: 0,
            ENERGY_REGEN: (avatarStaticData.BaseProps['30501'] || 12000),
            PEN_VALUE: (avatarStaticData.BaseProps['23201'] || 0),
            PEN_RATIO: (avatarStaticData.BaseProps['23101'] || 0)
        };
         const agentBaseStats = {
             HP: avatarStaticData.BaseProps['11101'] || 0,
             ATK: avatarStaticData.BaseProps['12101'] || 0,
             DEF: avatarStaticData.BaseProps['13101'] || 0,
             IMPACT: avatarStaticData.BaseProps['12201'] || 0,
             ANOMALY_PROFICIENCY: avatarStaticData.BaseProps['31201'] || 0,
             ANOMALY_MASTERY: avatarStaticData.BaseProps['31401'] || 0,
         };
        const level = characterApiData.Level;
        const promotionLevel = characterApiData.PromotionLevel;
        const coreEnhancementLevel = characterApiData.CoreSkillEnhancement;
        if (level > 1) {
            agentBaseStats.HP += Math.floor((avatarStaticData.GrowthProps['11101'] || 0) * (level - 1) / 10000);
            agentBaseStats.ATK += Math.floor((avatarStaticData.GrowthProps['12101'] || 0) * (level - 1) / 10000);
            agentBaseStats.DEF += Math.floor((avatarStaticData.GrowthProps['13101'] || 0) * (level - 1) / 10000);
        }
        if (promotionLevel > 0 && avatarStaticData.PromotionProps[promotionLevel - 1]) {
            agentBaseStats.HP += avatarStaticData.PromotionProps[promotionLevel - 1]['11101'] || 0;
            agentBaseStats.ATK += avatarStaticData.PromotionProps[promotionLevel - 1]['12101'] || 0;
            agentBaseStats.DEF += avatarStaticData.PromotionProps[promotionLevel - 1]['13101'] || 0;
        }
         if (coreEnhancementLevel >= 0 && avatarStaticData.CoreEnhancementProps?.[coreEnhancementLevel]) {
            const coreEnhancements = avatarStaticData.CoreEnhancementProps[coreEnhancementLevel];
            agentBaseStats.HP += coreEnhancements['11101'] || 0;
            agentBaseStats.ATK += coreEnhancements['12101'] || 0;
            agentBaseStats.DEF += coreEnhancements['13101'] || 0;
            agentBaseStats.IMPACT += coreEnhancements['12201'] || 0;
            agentBaseStats.ANOMALY_PROFICIENCY += coreEnhancements['31201'] || 0;
            agentBaseStats.ANOMALY_MASTERY += coreEnhancements['31401'] || 0;
            finalStats.CRIT_RATE += (coreEnhancements['20101'] || 0);
            finalStats.ENERGY_REGEN += (coreEnhancements['30501'] || 0);
             finalStats.PEN_VALUE += (coreEnhancements['23201'] || 0);
             finalStats.PEN_RATIO += (coreEnhancements['23101'] || 0);
         }
         const percentAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0 };
         const flatAdds = { HP: 0, ATK: 0, DEF: 0 };
         let weaponBaseAtk = 0;
         const weaponApiData = characterApiData.Weapon;
         if (weaponApiData?.Id) {
            const weaponStaticData = weaponData[weaponApiData.Id];
            if (weaponStaticData) {
                const weaponLevel = weaponApiData.Level;
                const weaponStars = weaponApiData.BreakLevel;
                const weaponMainStatBase = weaponStaticData.props_value;
                const levelScalingData = weaponStaticData.level?.[String(weaponLevel)];
                const starScalingData = weaponStaticData.stars?.[String(weaponStars)];
                if (levelScalingData && starScalingData) {
                    weaponBaseAtk = Math.floor(weaponMainStatBase * (1 + (levelScalingData.Rate / 10000) + (starScalingData.StarRate / 10000)));
                    const secondaryPropId = weaponStaticData.rand_props_id;
                    const secondaryPropBaseValue = weaponStaticData.rand_props_value;
                    const secondaryStatCalculated = Math.floor(secondaryPropBaseValue * (1 + (starScalingData.RandRate / 10000)));
                    const propInfo = getPropInfo(secondaryPropId);
                     if (propInfo.type === 'flat') flatAdds[propInfo.name.replace('_FLAT', '')] = (flatAdds[propInfo.name.replace('_FLAT', '')] || 0) + secondaryStatCalculated;
                     else if (propInfo.type === 'percent') percentAdds[propInfo.name.replace('%', '')] = (percentAdds[propInfo.name.replace('%', '')] || 0) + secondaryStatCalculated;
                     else if (propInfo.type === 'special_percent') finalStats[propInfo.name] = (finalStats[propInfo.name] || 0) + secondaryStatCalculated;
                     else if (propInfo.type === 'other_flat') agentBaseStats[propInfo.name] = (agentBaseStats[propInfo.name] || 0) + secondaryStatCalculated;
                     else logger.warn(`[PropertyCalculator] Unhandled weapon secondary stat type: ${propInfo.type} for ID ${secondaryPropId}`);
                } else {
                    weaponBaseAtk = weaponMainStatBase;
                }
            }
         }
         const totalBaseAtk = agentBaseStats.ATK + weaponBaseAtk;
         const equippedSetCounts = {};
         const setBonusDescStore = {};
         characterApiData.EquippedList?.forEach((item) => {
            if (!item?.Equipment) return;
            const disc = item.Equipment;
            const discId = disc.Id;
            const discLevel = disc.Level;
            const discApiRarity = Math.floor(discId / 10000);
            const setBaseId = Math.floor(discId / 100) * 100;
            equippedSetCounts[setBaseId] = (equippedSetCounts[setBaseId] || 0) + 1;
            const assumedRarity = (discLevel === 15 && discApiRarity < 4) ? 4 : discApiRarity;
            const levelData = discLevelMap[assumedRarity]?.[discLevel];
            const scalingFactor = levelData ? (levelData.HFGGMPPIKOG || 0) : 0;
            disc.MainPropertyList?.forEach(mainProp => {
                const mainStatBaseValue = mainProp.PropertyValue;
                const mainStatValue = Math.floor(mainStatBaseValue * (1 + scalingFactor / 10000));
                const propInfo = getPropInfo(mainProp.PropertyId);
                if (propInfo.type === 'flat') flatAdds[propInfo.name.replace('_FLAT', '')] = (flatAdds[propInfo.name.replace('_FLAT', '')] || 0) + mainStatValue;
                else if (propInfo.type === 'percent') percentAdds[propInfo.name.replace('%', '')] = (percentAdds[propInfo.name.replace('%', '')] || 0) + mainStatValue;
                else if (propInfo.type === 'special_percent') finalStats[propInfo.name] = (finalStats[propInfo.name] || 0) + mainStatValue;
                else if (propInfo.type === 'other_flat') agentBaseStats[propInfo.name] = (agentBaseStats[propInfo.name] || 0) + mainStatValue;
                else logger.warn(`[PropertyCalculator] Unhandled disc main stat type: ${propInfo.type} for ID ${mainProp.PropertyId}`);
            });
            disc.RandomPropertyList?.forEach(subProp => {
                const subStatValue = subProp.PropertyValue;
                const propInfo = getPropInfo(subProp.PropertyId);
                if (propInfo.type === 'flat') flatAdds[propInfo.name.replace('_FLAT', '')] = (flatAdds[propInfo.name.replace('_FLAT', '')] || 0) + subStatValue;
                else if (propInfo.type === 'percent') percentAdds[propInfo.name.replace('%', '')] = (percentAdds[propInfo.name.replace('%', '')] || 0) + subStatValue;
                else if (propInfo.type === 'special_percent') finalStats[propInfo.name] = (finalStats[propInfo.name] || 0) + subStatValue;
                else if (propInfo.type === 'other_flat') agentBaseStats[propInfo.name] = (agentBaseStats[propInfo.name] || 0) + subStatValue;
                else logger.warn(`[PropertyCalculator] Unhandled disc sub stat type: ${propInfo.type} for ID ${subProp.PropertyId}`);
            });
         });
         const setBonusesAccumulated = { flat: {}, percent: {}, other: {} };
         for (const setIdStr in equippedSetCounts) {
            if (!setIdStr.includes('_4pc_desc')) {
                const setId = parseInt(setIdStr, 10);
                const count = equippedSetCounts[setId];
                const setData = driveSetData[setId];
                if (!setData) continue;
                if (count >= 2 && setData.desc1) {
                    if(setId !== 32700) parseSetBonus(setData.desc1, setBonusesAccumulated);
                }
                 if (count >= 4) {
                    if(setId === 32700 && setData.desc1) parseSetBonus(setData.desc1, setBonusesAccumulated);
                     if (setData.desc2) setBonusDescStore[setId] = setData.desc2;
                 }
            }
         }
        let currentAnomalyMasteryBase = agentBaseStats.ANOMALY_MASTERY
                                        + (flatAdds.ANOMALY_MASTERY || 0)
                                        + (setBonusesAccumulated.flat.ANOMALY_MASTERY || 0);
        let currentAnomalyMasteryPercent = (percentAdds.ANOMALY_MASTERY || 0)
                                          + (setBonusesAccumulated.percent["ANOMALY_MASTERY%"] || 0) * 10000;
        let intermediateAnomalyMastery = Math.floor(currentAnomalyMasteryBase * (1 + currentAnomalyMasteryPercent / 10000));
         for (const setIdStr in setBonusDescStore) {
            const setId = parseInt(setIdStr, 10);
            const desc2 = setBonusDescStore[setId];
            if (setId === 32700) {
                if (intermediateAnomalyMastery >= 115) {
                    const critDmgMatch = desc2.match(/暴击伤害提升([0-9.]+)%/);
                    if (critDmgMatch) setBonusesAccumulated.percent["CRIT_DMG"] = (setBonusesAccumulated.percent["CRIT_DMG"] || 0) + parseFloat(critDmgMatch[1]) / 100;
                    const critRateMatch = desc2.match(/暴击率提升([0-9.]+)%/);
                    if (critRateMatch) setBonusesAccumulated.percent["CRIT_RATE"] = (setBonusesAccumulated.percent["CRIT_RATE"] || 0) + parseFloat(critRateMatch[1]) / 100;
                }
            }
         }
        Object.assign(flatAdds, _.mapValues(setBonusesAccumulated.flat, (v, k) => (flatAdds[k] || 0) + v));
        percentAdds.HP += (setBonusesAccumulated.percent['HP%'] || 0) * 10000;
        percentAdds.ATK += (setBonusesAccumulated.percent['ATK%'] || 0) * 10000;
        percentAdds.DEF += (setBonusesAccumulated.percent['DEF%'] || 0) * 10000;
        percentAdds.ANOMALY_MASTERY += (setBonusesAccumulated.percent['ANOMALY_MASTERY%'] || 0) * 10000;
        finalStats.CRIT_RATE += (setBonusesAccumulated.percent['CRIT_RATE'] || 0) * 10000;
        finalStats.CRIT_DMG += (setBonusesAccumulated.percent['CRIT_DMG'] || 0) * 10000;
        finalStats.PHYS_DMG += (setBonusesAccumulated.percent['PHYS_DMG'] || 0) * 10000;
        finalStats.FIRE_DMG += (setBonusesAccumulated.percent['FIRE_DMG'] || 0) * 10000;
        finalStats.ICE_DMG += (setBonusesAccumulated.percent['ICE_DMG'] || 0) * 10000;
        finalStats.ELEC_DMG += (setBonusesAccumulated.percent['ELEC_DMG'] || 0) * 10000;
        finalStats.ETHER_DMG += (setBonusesAccumulated.percent['ETHER_DMG'] || 0) * 10000;
        finalStats.ENERGY_REGEN += (setBonusesAccumulated.percent['ENERGY_REGEN%'] || 0) * 10000;
        finalStats.PEN_RATIO += (setBonusesAccumulated.percent['PEN_RATIO'] || 0) * 10000;
        agentBaseStats.ANOMALY_PROFICIENCY += (setBonusesAccumulated.flat.ANOMALY_PROFICIENCY || 0);
        this.finalHp = Math.floor(agentBaseStats.HP * (1 + (percentAdds.HP || 0) / 10000) + (flatAdds.HP || 0));
        this.finalAtk = Math.floor(totalBaseAtk * (1 + (percentAdds.ATK || 0) / 10000) + (flatAdds.ATK || 0));
        this.finalDef = Math.floor(agentBaseStats.DEF * (1 + (percentAdds.DEF || 0) / 10000) + (flatAdds.DEF || 0));
        this.finalImpact = agentBaseStats.IMPACT;
        this.finalAnomalyProficiency = agentBaseStats.ANOMALY_PROFICIENCY;
        this.finalAnomalyMastery = Math.floor(agentBaseStats.ANOMALY_MASTERY * (1 + (percentAdds.ANOMALY_MASTERY || 0) / 10000) + (flatAdds.ANOMALY_MASTERY || 0));
        this.finalCritRatePercent = finalStats.CRIT_RATE;
        this.finalCritDmgPercent = finalStats.CRIT_DMG;
        this.finalPhysDmgPercent = finalStats.PHYS_DMG;
        this.finalFireDmgPercent = finalStats.FIRE_DMG;
        this.finalIceDmgPercent = finalStats.ICE_DMG;
        this.finalElecDmgPercent = finalStats.ELEC_DMG;
        this.finalEtherDmgPercent = finalStats.ETHER_DMG;
        this.finalEnergyRegenPercent = finalStats.ENERGY_REGEN;
        this.finalPenValue = finalStats.PEN_VALUE;
        this.finalPenRatioPercent = finalStats.PEN_RATIO;
    }
    _formatValue(value, isPercent, decimals = 1, isRate = false) {
        const numericValue = Number(value);
        if (isNaN(numericValue)) {
            return isPercent ? `0.${'0'.repeat(decimals)}%` : '0';
        }
        if (isPercent) {
            return (numericValue / 100).toFixed(decimals) + '%';
        } else if (isRate) {
             return (numericValue / 100).toFixed(decimals) + '%';
        } else {
            return String(Math.floor(numericValue));
        }
    }
    getFormattedHpMax() { return this._formatValue(this.finalHp, false); }
    getFormattedAttack() { return this._formatValue(this.finalAtk, false); }
    getFormattedDefence() { return this._formatValue(this.finalDef, false); }
    getFormattedBreakStun() { return this._formatValue(this.finalImpact, false); }
    getFormattedCrit() { return this._formatValue(this.finalCritRatePercent, true, 1); }
    getFormattedCritDmg() { return this._formatValue(this.finalCritDmgPercent, true, 1); }
    getFormattedElementAbnormalPower() { return this._formatValue(this.finalAnomalyProficiency, false); }
    getFormattedElementMystery() { return this._formatValue(this.finalAnomalyMastery, false); }
    getFormattedPenRate() { return this._formatValue(this.finalPenRatioPercent, true, 1); }
    getFormattedSpRecoverPercent() { return this._formatValue(this.finalEnergyRegenPercent, true, 1); }
    getFormattedPenDelta() { return this._formatValue(this.finalPenValue, false); }
    getFormattedPhysDmgBonus() { return this._formatValue(this.finalPhysDmgPercent, true, 1); }
    getFormattedFireDmgBonus() { return this._formatValue(this.finalFireDmgPercent, true, 1); }
    getFormattedIceDmgBonus() { return this._formatValue(this.finalIceDmgPercent, true, 1); }
    getFormattedThunderDmgBonus() { return this._formatValue(this.finalElecDmgPercent, true, 1); }
    getFormattedEtherDmgBonus() { return this._formatValue(this.finalEtherDmgPercent, true, 1); }
}
