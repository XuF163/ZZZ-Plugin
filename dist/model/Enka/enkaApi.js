import { Enka2Mys } from './formater.js';
import settings from '../../lib/settings.js';
import fetch from 'node-fetch';
function normalizeApiBaseUrl(baseUrl) {
    if (!baseUrl)
        return '';
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
function getEnkaConfig() {
    const config = settings.getConfig('config') || {};
    if (config.enkaApi) {
        const apiUrls = (Array.isArray(config.enkaApi) ? config.enkaApi : [config.enkaApi])
            .filter(Boolean)
            .map((u) => normalizeApiBaseUrl(String(u)));
        return {
            apiUrls,
            timeout: 10000,
            userAgent: 'ZZZ-Plugin/UCPr',
            randomSelection: false,
        };
    }
    const enkaConfig = config.enka || {};
    const primaryDomain = enkaConfig.primaryDomain || 'enka.network';
    const fallbackDomain = enkaConfig.fallbackDomain || 'profile.microgg.cn';
    const apiPath = enkaConfig.apiPath || '/api/zzz/uid/';
    const randomSelection = enkaConfig.randomSelection !== false;
    const domains = [primaryDomain, fallbackDomain].filter(Boolean);
    const apiUrls = [...new Set(domains)].map((domain) => normalizeApiBaseUrl(`https://${domain}${apiPath}`));
    return {
        apiUrls,
        timeout: enkaConfig.timeout || 10000,
        userAgent: enkaConfig.userAgent || 'ZZZ-Plugin/UCPr',
        randomSelection,
    };
}
function pickTryOrder(apiUrls, randomSelection) {
    if (!randomSelection || apiUrls.length <= 1)
        return apiUrls;
    const idx = Math.floor(Math.random() * apiUrls.length);
    const picked = apiUrls[idx];
    return [picked, ...apiUrls.filter((_, i) => i !== idx)];
}
async function fetchEnka(baseUrl, uid, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    try {
        const res = await fetch(`${baseUrl}${uid}`, {
            method: 'GET',
            headers: {
                'User-Agent': config.userAgent,
            },
            signal: controller.signal,
        });
        return { ok: true, res };
    }
    catch (error) {
        return { ok: false, error };
    }
    finally {
        clearTimeout(timeoutId);
    }
}
export function getGameRoles(uid, region = false) {
    const _uid = String(uid);
    switch (_uid.slice(0, -8)) {
        case '10':
            return region == true ? 'prod_gf_us' : 'America';
        case '15':
            return region == true ? 'prod_gf_eu' : 'Europe';
        case '13':
            return region == true ? 'prod_gf_jp' : 'Asia';
        case '17':
            return region == true ? 'prod_gf_sg' : 'TW,HK,MO';
    }
    return region == true ? 'prod_gf_cn' : '新艾利都';
}
export function parsePlayerInfo(SocialDetail = {}) {
    const ProfileDetail = SocialDetail.ProfileDetail || {};
    const game_uid = ProfileDetail.Uid || SocialDetail.uid || '114514';
    return {
        game_biz: String(game_uid).length < 10 ? 'nap_cn' : 'nap_global',
        region: getGameRoles(game_uid, true),
        game_uid: game_uid,
        nickname: ProfileDetail.Nickname || 'Fairy',
        level: ProfileDetail.Level || 60,
        is_chosen: true,
        region_name: getGameRoles(game_uid, false),
        is_official: true,
        desc: SocialDetail.Desc || '',
    };
}
export async function refreshPanelFromEnka(uid) {
    const enkaConfig = getEnkaConfig();
    const urlsToTry = pickTryOrder(enkaConfig.apiUrls, enkaConfig.randomSelection);
    if (!urlsToTry?.length) {
        logger.warn('[Enka] 配置缺失：未找到可用的 API 地址');
        return 500;
    }
    let lastError = null;
    let lastStatus = null;
    for (let i = 0; i < urlsToTry.length; i++) {
        const baseUrl = urlsToTry[i];
        let name = baseUrl || 'unknown';
        try {
            name = new URL(baseUrl).hostname || name;
        }
        catch {
        }
        logger.debug(`[Enka] 尝试使用接口: ${name} (${i + 1}/${urlsToTry.length})`);
        const result = await fetchEnka(baseUrl, uid, enkaConfig);
        if (!result.ok) {
            const { error } = result;
            if (error?.name === 'AbortError') {
                logger.warn(`[Enka] 接口 ${name} 请求超时 (${enkaConfig.timeout}ms)`);
                lastStatus = 408;
            }
            else {
                logger.warn(`[Enka] 接口 ${name} 请求失败：${error?.message || error}`);
                lastError = error;
            }
            continue;
        }
        const res = result.res;
        if (!res.ok) {
            logger.warn(`[Enka] 接口 ${name} 返回错误：${res.status} ${res.statusText}`);
            lastStatus = res.status;
            continue;
        }
        try {
            const data = (await res.json());
            const panelList = data?.PlayerInfo?.ShowcaseDetail?.AvatarList;
            if (!panelList || !Array.isArray(panelList)) {
                logger.warn(`[Enka] 接口 ${name} 获取面板数据失败`);
                lastStatus = res.status;
                continue;
            }
            logger.info(`[Enka] 成功使用接口 ${name} 获取面板数据`);
            return {
                playerInfo: parsePlayerInfo(data.PlayerInfo.SocialDetail),
                panelList: Enka2Mys(panelList),
            };
        }
        catch (parseError) {
            logger.warn(`[Enka] 接口 ${name} 解析数据失败：${parseError?.message || parseError}`);
            lastError = parseError;
            continue;
        }
    }
    logger.error('[Enka] 所有接口都无法访问');
    if (lastStatus)
        return lastStatus;
    if (lastError?.name === 'AbortError')
        return 408;
    return 500;
}
//# sourceMappingURL=enkaApi.js.map