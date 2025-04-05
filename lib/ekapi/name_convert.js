import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HAKUSH_DATA_PATH = path.join(__dirname, '..', '..', 'resources', 'hakush_data');
const EQUIP_FILE = path.join(HAKUSH_DATA_PATH, 'equipment.json');
const CHAR_DIR = path.join(HAKUSH_DATA_PATH, 'characters');
const WEAPON_DIR = path.join(HAKUSH_DATA_PATH, 'weapons');
const OLD_DATA_PATH = path.join(__dirname, '..', '..', 'resources', 'enka');
const AvatarIconDataFile = 'avatars.json';
const BASE_IMAGE_URL = 'https://enka.network';
const characterCache = new Map();
const weaponCache = new Map();

let hakush_equip_data = {};
try {
    if (fs.existsSync(EQUIP_FILE)) {
        hakush_equip_data = JSON.parse(fs.readFileSync(EQUIP_FILE, 'utf-8'));
        logger.info('[NameConvert] Loaded Hakush equipment data.');
    } else {
        logger.warn(`[NameConvert] Hakush equipment data file not found at: ${EQUIP_FILE}`);
    }
} catch (e) {
    logger.error(`[NameConvert] Error loading Hakush equipment data: ${e}`);
}
let avatar_icon_data = {};
try {
    const avatarIconDataPath = path.join(OLD_DATA_PATH, AvatarIconDataFile);
    if (fs.existsSync(avatarIconDataPath)) {
        const avatarIconContent = fs.readFileSync(avatarIconDataPath, { encoding: 'utf-8' });
        avatar_icon_data = JSON.parse(avatarIconContent);
        logger.info(`[NameConvert] Loaded old avatar icon data from: ${AvatarIconDataFile}`);
    } else {
         logger.warn(`[NameConvert] Old avatar icon data file not found at: ${avatarIconDataPath}`);
         avatar_icon_data = {};
    }
} catch (error) {
    logger.error(`[NameConvert] Error reading or parsing ${AvatarIconDataFile}:`, error);
    avatar_icon_data = {};
}
/**
 * 加载并缓存指定 ID 的角色详细数据 (Hakush CharacterData 格式)。
 */
function getCharacterData(id) {
    const charId = String(id);
    if (characterCache.has(charId)) return characterCache.get(charId);
    const filePath = path.join(CHAR_DIR, `${charId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            characterCache.set(charId, data);
            return data;
        }
    } catch (e) { logger.error(`[NameConvert] Error loading character data for ID ${charId}: ${e}`); }
    return null;
}
/**
 * 加载并缓存指定 ID 的武器详细数据 (Hakush WeaponData 格式)。
 */
function getWeaponData(id) {
    const weaponId = String(id);
    if (weaponCache.has(weaponId)) return weaponCache.get(weaponId);
    const filePath = path.join(WEAPON_DIR, `${weaponId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            weaponCache.set(weaponId, data);
            return data;
        }
    } catch (e) { logger.error(`[NameConvert] Error loading weapon data for ID ${weaponId}: ${e}`); }
    return null;
}
const ID_TO_PROP_NAME = {
    '11101': '生命值', '11103': '生命值', '11102': '生命值百分比',
    '12101': '攻击力', '12103': '攻击力', '12102': '攻击力百分比',
    '13101': '防御力', '13103': '防御力', '13102': '防御力百分比',
    '12203': '冲击力', '12201': '冲击力',
    '20103': '暴击率', '20101': '暴击率',
    '21103': '暴击伤害', '21101': '暴击伤害',
    '31402': '异常掌控', '31403': '异常掌控', '31401': '异常掌控',
    '31202': '异常精通', '31203': '异常精通', '31201': '异常精通',
    '23103': '穿透率', '23101': '穿透率',
    '23203': '穿透值', '23201': '穿透值',
    '30503': '能量自动回复', '30501': '能量自动回复',
    '30502': '能量回复百分比',
    '31503': '物理伤害加成', '31603': '火属性伤害加成', '31703': '冰属性伤害加成',
    '31803': '雷属性伤害加成', '31903': '以太属性伤害加成',
    '12202': '冲击力百分比',
};
const PROP_NAME_TO_ID = {};
for (const id in ID_TO_PROP_NAME) {
    const name = ID_TO_PROP_NAME[id];
    if (!PROP_NAME_TO_ID[name] || id.endsWith('3') || id.endsWith('2')) {
        PROP_NAME_TO_ID[name] = id;
    }
}
const ID_TO_EN = {
    '11101': 'HpMax', '11103': 'HpBase', '11102': 'HpAdd',
    '12101': 'Attack', '12103': 'AttackBase', '12102': 'AttackAdd',
    '13101': 'Defence', '13103': 'DefenceBase', '13102': 'DefenceAdd',
    '12203': 'BreakStun', '12201': 'BreakStun',
    '20103': 'Crit', '20101': 'Crit',
    '21103': 'CritDmg', '21101': 'CritDmg',
    '31402': 'ElementAbnormalPower', '31403': 'ElementAbnormalPower', '31401': 'ElementAbnormalPower',
    '31202': 'ElementMystery', '31203': 'ElementMystery', '31201': 'ElementMystery',
    '23103': 'PenRate', '23101': 'PenRate',
    '23203': 'PenDelta', '23201': 'PenDelta',
    '30503': 'SpRecover', '30501': 'SpRecover',
    '30502': 'SpRecoverPercent',
    '31503': 'PhysDmgBonus', '31603': 'FireDmgBonus', '31703': 'IceDmgBonus',
    '31803': 'ThunderDmgBonus', '31903': 'EtherDmgBonus',
    '12202': 'BreakStunPercent',
};
const PERCENT_ID_LIST = Object.keys(ID_TO_PROP_NAME)
    .filter(id =>
        ID_TO_PROP_NAME[id]?.includes('百分比') ||
        ID_TO_PROP_NAME[id]?.includes('加成') ||
        ['20103', '20101', '21103', '21101', '23103', '23101', '30502'].includes(id)
    );
if (!PERCENT_ID_LIST.includes('11102')) PERCENT_ID_LIST.push('11102');
if (!PERCENT_ID_LIST.includes('12102')) PERCENT_ID_LIST.push('12102');
if (!PERCENT_ID_LIST.includes('13102')) PERCENT_ID_LIST.push('13102');
const MAIN_PROP_BASE_INCREASE = {
    '11101': 330, '11103': 330, '12101': 47.4, '12103': 47.4, '13101': 27.6, '13103': 27.6,
    '12203': 270, '12201': 270, '31202': 13, '31203': 13, '31201': 13,
    '31402': 450, '31403': 450, '31401': 450, '23203': 36, '23201': 36,
    '11102': 450, '12102': 450, '13102': 720, '20103': 360, '20101': 360,
    '21103': 720, '21101': 720, '23103': 360, '23101': 360,
    '30503': 900, '30501': 900, '30502': 900,
    '31503': 450, '31603': 450, '31703': 450, '31803': 450, '31903': 450,
    '12202': 0,
};
const HAKUSH_ELEMENT_MAP = { '203': '电', '205': '以太', '202': '冰', '200': '物理', '201': '火' };
const HAKUSH_PROFESSION_MAP = { '2': '击破', '3': '强攻', '1': '强攻', '5': '异常', '4': '支援', '6': '防御' };
export const HAKUSH_RARITY_MAP = { 3: 'A', 4: 'S' };
const ENKA_INDEX_TO_HAKUSH_SKILL_KEY = {
    0: 'Basic', 1: 'Special', 2: 'Dodge', 3: 'Chain', 5: 'Ultimate', 6: 'Assist'
};
/**
 * [Hakush] 根据 Hakush CharacterData 获取角色基础信息 (用于名称、元素、职业等)。
 */
function getCharBasicInfo(char_id) {
    const data = getCharacterData(char_id);
    if (!data) return { name: `角色${char_id}`, rarity: 'A', element: 0, profession: 0, camp: '?' };
    const elementKey = Object.keys(data.ElementType || {})[0];
    const professionKey = Object.keys(data.WeaponType || {})[0];
    const campKey = Object.keys(data.Camp || {})[0];
    const campName = data.Camp?.[campKey] || '?';
    return {
        id: data.Id,
        name: data.Name || `角色${char_id}`,
        full_name: data.PartnerInfo?.FullName || data.CodeName || data.Name,
        rarity: HAKUSH_RARITY_MAP[data.Rarity] || 'A',
        element_type: parseInt(elementKey) || 0,
        element_name: data.ElementType?.[elementKey] || '未知',
        avatar_profession: parseInt(professionKey) || 0,
        profession_name: data.WeaponType?.[professionKey] || '未知',
        camp_name_mi18n: campName,
        base_icon_path_rel: data.PartnerInfo?.RoleIcon ? `UI/Sprite/A1DynamicLoad/${data.PartnerInfo.RoleIcon}/UnPacker/${data.Icon}.png` : `UI/Sprite/A1DynamicLoad/ItemIconRole/UnPacker/${data.Icon}.png`,
        circle_icon_path_rel: data.PartnerInfo?.IconPath,
    };
}
/**
 * [Hakush] 根据 Hakush 相对路径构建武器/驱动盘等资源的图标 URL。
 */
function constructIconUrl(relativePath) {
    if (!relativePath || !relativePath.startsWith('UI/')) return '';
    const pathSuffix = relativePath.substring(3);
    const finalPath = pathSuffix.replace('/UnPacker', '');
    return `${BASE_IMAGE_URL}/ui${finalPath}`;
}
/**
 * [旧逻辑] 根据 avatars.json 获取角色圆形图标 URL。
 */
function get_char_circle_icon_url_from_avatars(char_id) {
    const charIdStr = String(char_id);
    const iconPathField = 'CircleIcon';
    if (avatar_icon_data[charIdStr]?.[iconPathField] && typeof avatar_icon_data[charIdStr][iconPathField] === 'string') {
        const iconPath = avatar_icon_data[charIdStr][iconPathField];
        if (iconPath.startsWith('/')) {
            return BASE_IMAGE_URL + iconPath;
        } else {
            logger.warn(`[AvatarsURL] Unexpected path format in ${AvatarIconDataFile} for char ${charIdStr}, field ${iconPathField}: "${iconPath}".`);
            return `${BASE_IMAGE_URL}/${iconPath}`;
        }
    } else {
        return undefined;
    }
}
/**
 * [旧逻辑] 根据 avatars.json 获取角色方形/基础图标 URL。
 */
function get_char_base_icon_url_from_avatars(char_id) {
    const charIdStr = String(char_id);
    const iconPathField = 'IconPath';
    if (avatar_icon_data[charIdStr]?.[iconPathField] && typeof avatar_icon_data[charIdStr][iconPathField] === 'string') {
        const iconPath = avatar_icon_data[charIdStr][iconPathField];
        if (iconPath.startsWith('/')) {
            return BASE_IMAGE_URL + iconPath;
        } else {
            logger.warn(`[AvatarsURL] Unexpected path format in ${AvatarIconDataFile} for char ${charIdStr}, field ${iconPathField}: "${iconPath}".`);
            return `${BASE_IMAGE_URL}/${iconPath}`;
        }
    } else {
        return undefined;
    }
}
/**
 * [Hakush] 计算角色指定等级、突破的基础属性 HP/ATK/DEF。
 */
function calculateCharBaseStat(char_id, level, promotion_level) {
    const charData = getCharacterData(char_id);
    if (!charData || !charData.Stats || !charData.Level) {
        logger.error(`[calculateCharBaseStat] Missing Hakush data for char_id: ${char_id}`);
        return { baseHp: 0, baseAtk: 0, baseDef: 0 };
    }
    const stats = charData.Stats;
    const levelData = charData.Level;
    let baseHp = Number(stats.HpMax) || 0;
    let baseAtk = Number(stats.Attack) || 0;
    let baseDef = Number(stats.Defence) || 0;
    const hpGrowth = Number(stats.HpGrowth) || 0;
    const atkGrowth = Number(stats.AttackGrowth) || 0;
    const defGrowth = Number(stats.DefenceGrowth) || 0;
    if (level > 1) {
        baseHp += (level - 1) * hpGrowth / 10000;
        baseAtk += (level - 1) * atkGrowth / 10000;
        baseDef += (level - 1) * defGrowth / 10000;
    }
    const hakushPromoLevel = promotion_level + 1;
    for (let p = 1; p < hakushPromoLevel; p++) {
        const promoData = levelData[String(p)];
        if (promoData) {
            baseHp += Number(promoData.HpMax) || 0;
            baseAtk += Number(promoData.Attack) || 0;
            baseDef += Number(promoData.Defence) || 0;
        }
    }
    return {
        baseHp: Math.floor(baseHp),
        baseAtk: Math.floor(baseAtk),
        baseDef: Math.floor(baseDef),
    };
}
/**
 * [Hakush] 计算武器指定等级、突破等级的主副属性值。
 */
function render_weapon_detail(weapon_id, weapon_level, weapon_break_level) {
    const weaponData = getWeaponData(weapon_id);
    if (!weaponData || !weaponData.Level || !weaponData.Stars || !weaponData.BaseProperty) {
        logger.error(`[render_weapon_detail] Missing Hakush data for weapon_id: ${weapon_id}`);
        return { baseValue: 0, randValue: 0, basePropId: null, randPropId: null };
    }
    const levelData = weaponData.Level[String(weapon_level)];
    const starData = weaponData.Stars[String(weapon_break_level)];
    if (!levelData || !starData) {
        logger.warn(`[render_weapon_detail] Missing level/star data in Hakush for weapon ${weapon_id}. Lvl:${weapon_level}, Break:${weapon_break_level}`);
        return { baseValue: 0, randValue: 0, basePropId: null, randPropId: null };
    }
    let base_value = Number(weaponData.BaseProperty.Value) || 0;
    base_value = base_value + base_value * (((Number(levelData.Rate) || 0) + (Number(starData.StarRate) || 0)) / 10000);
    let rand_value = 0;
    let randPropId = null;
    if (weaponData.RandProperty && weaponData.RandProperty.Value !== undefined) {
        rand_value = Number(weaponData.RandProperty.Value) || 0;
        if (rand_value > 0 && starData.RandRate !== undefined) {
            rand_value = rand_value + rand_value * ((Number(starData.RandRate) || 0) / 10000);
        }
        randPropId = PROP_NAME_TO_ID[weaponData.RandProperty.Name2] || null;
    }
    const basePropNameClean = weaponData.BaseProperty.Name.replace('基础', '');
    const basePropId = PROP_NAME_TO_ID[basePropNameClean] || null;
    return {
        baseValue: Math.floor(base_value),
        randValue: Math.floor(rand_value),
        basePropId: basePropId,
        randPropId: randPropId
    };
}
export {
    hakush_equip_data,
    avatar_icon_data,
    getCharacterData,
    getWeaponData,
    ID_TO_PROP_NAME,
    PROP_NAME_TO_ID,
    ID_TO_EN,
    PERCENT_ID_LIST,
    MAIN_PROP_BASE_INCREASE,
    ENKA_INDEX_TO_HAKUSH_SKILL_KEY,
    getCharBasicInfo,
    constructIconUrl,
    calculateCharBaseStat,
    render_weapon_detail,
    get_char_circle_icon_url_from_avatars,
    get_char_base_icon_url_from_avatars,
};
