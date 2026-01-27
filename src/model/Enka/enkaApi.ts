import type { Enka } from '#interface'
import { Enka2Mys } from './formater.js'
import settings from '../../lib/settings.js'
import fetch from 'node-fetch'

function normalizeApiBaseUrl(baseUrl: string) {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

// 兼容两种配置：
// - config.enkaApi: "https://enka.network/api/zzz/uid/" 或 ["https://enka.network/api/zzz/uid/", ...]
// - config.enka: { primaryDomain, fallbackDomain, apiPath, timeout, userAgent, randomSelection }
function getEnkaConfig() {
  const config: any = settings.getConfig('config') || {}

  if (config.enkaApi) {
    const apiUrls = (Array.isArray(config.enkaApi) ? config.enkaApi : [config.enkaApi])
      .filter(Boolean)
      .map((u: string) => normalizeApiBaseUrl(String(u)))

    return {
      apiUrls,
      timeout: 10000,
      userAgent: 'ZZZ-Plugin/UCPr',
      randomSelection: false,
    }
  }

  const enkaConfig: any = config.enka || {}
  const primaryDomain = enkaConfig.primaryDomain || 'enka.network'
  const fallbackDomain = enkaConfig.fallbackDomain || 'profile.microgg.cn'
  const apiPath = enkaConfig.apiPath || '/api/zzz/uid/'
  const randomSelection = enkaConfig.randomSelection !== false

  const domains = [primaryDomain, fallbackDomain].filter(Boolean)
  const apiUrls = [...new Set(domains)].map((domain) =>
    normalizeApiBaseUrl(`https://${domain}${apiPath}`)
  )

  return {
    apiUrls,
    timeout: enkaConfig.timeout || 10000,
    userAgent: enkaConfig.userAgent || 'ZZZ-Plugin/UCPr',
    randomSelection,
  }
}

function pickTryOrder(apiUrls: string[], randomSelection: boolean) {
  if (!randomSelection || apiUrls.length <= 1) return apiUrls
  const idx = Math.floor(Math.random() * apiUrls.length)
  const picked = apiUrls[idx]
  return [picked, ...apiUrls.filter((_, i) => i !== idx)]
}

async function fetchEnka(baseUrl: string, uid: string | number, config: any) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const res = await fetch(`${baseUrl}${uid}`, {
      method: 'GET',
      headers: {
        'User-Agent': config.userAgent,
      },
      signal: controller.signal as any,
    })
    return { ok: true, res }
  } catch (error: any) {
    return { ok: false, error }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function getGameRoles(uid: string | number, region = false) {
  const _uid = String(uid)
  switch (_uid.slice(0, -8)) {
    case '10':
      return region == true ? 'prod_gf_us' : 'America' // 美服
    case '15':
      return region == true ? 'prod_gf_eu' : 'Europe' // 欧服
    case '13':
      return region == true ? 'prod_gf_jp' : 'Asia' // 亚服
    case '17':
      return region == true ? 'prod_gf_sg' : 'TW,HK,MO' // 港澳台服
  }
  return region == true ? 'prod_gf_cn' : '新艾利都' // 官服
}

export function parsePlayerInfo(SocialDetail: any = {}) {
  const ProfileDetail = SocialDetail.ProfileDetail || {}
  const game_uid = ProfileDetail.Uid || SocialDetail.uid || '114514'
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
  }
}

/**
 * Enka更新面板
 * @param uid
 */
export async function refreshPanelFromEnka(uid: string | number) {
  const enkaConfig = getEnkaConfig()
  const urlsToTry = pickTryOrder(enkaConfig.apiUrls, enkaConfig.randomSelection)

  if (!urlsToTry?.length) {
    logger.warn('[Enka] 配置缺失：未找到可用的 API 地址')
    return 500
  }

  let lastError: any = null
  let lastStatus: number | null = null

  for (let i = 0; i < urlsToTry.length; i++) {
    const baseUrl = urlsToTry[i]
    let name = baseUrl || 'unknown'
    try {
      name = new URL(baseUrl).hostname || name
    } catch {
      // ignore
    }

    logger.debug(`[Enka] 尝试使用接口: ${name} (${i + 1}/${urlsToTry.length})`)

    const result = await fetchEnka(baseUrl, uid, enkaConfig)

    if (!result.ok) {
      const { error } = result
      if (error?.name === 'AbortError') {
        logger.warn(`[Enka] 接口 ${name} 请求超时 (${enkaConfig.timeout}ms)`)
        lastStatus = 408
      } else {
        logger.warn(`[Enka] 接口 ${name} 请求失败：${error?.message || error}`)
        lastError = error
      }
      continue
    }

    const res = result.res as any

    if (!res.ok) {
      logger.warn(`[Enka] 接口 ${name} 返回错误：${res.status} ${res.statusText}`)
      lastStatus = res.status
      continue
    }

    try {
      const data = (await res.json()) as any
      const panelList = data?.PlayerInfo?.ShowcaseDetail?.AvatarList as Enka.Avatar[]

      if (!panelList || !Array.isArray(panelList)) {
        logger.warn(`[Enka] 接口 ${name} 获取面板数据失败`)
        lastStatus = res.status
        continue
      }

      logger.info(`[Enka] 成功使用接口 ${name} 获取面板数据`)
      return {
        playerInfo: parsePlayerInfo(data.PlayerInfo.SocialDetail),
        panelList: Enka2Mys(panelList),
      }
    } catch (parseError: any) {
      logger.warn(`[Enka] 接口 ${name} 解析数据失败：${parseError?.message || parseError}`)
      lastError = parseError
      continue
    }
  }

  logger.error('[Enka] 所有接口都无法访问')
  if (lastStatus) return lastStatus
  if (lastError?.name === 'AbortError') return 408
  return 500
}

// import fs from 'fs'
// const uid = 11070609
// const res = await fetch(`${EnkaApi}${uid}`, {
//   method: 'GET',
//   headers: {
//     'User-Agent': 'ZZZ-Plugin/UCPr',
//   }
// })
// if (!res.ok) {
//   console.log(`Enka更新面板失败：${res.status} ${res.statusText}`)
// }
// const data = await res.json()
// console.log(data)
// fs.writeFileSync('enkaPanel1.json', JSON.stringify(data, null, 2))
