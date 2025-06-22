import { Enka2Mys } from './formater.js'
import fetch from 'node-fetch'
import settings from '../../lib/settings.js'

// 从配置文件获取Enka API设置
function getEnkaConfig() {
  const config = settings.getConfig('config')
  const enkaConfig = config.enka || {}
  
  const primaryDomain = enkaConfig.primaryDomain || 'enka.network'
  const fallbackDomain = enkaConfig.fallbackDomain || 'profile.microgg.cn'
  const apiPath = enkaConfig.apiPath || '/api/zzz/uid/'
  const randomSelection = enkaConfig.randomSelection !== false
  
  // 构建完整的API URL列表
  const domains = [primaryDomain, fallbackDomain]
  const apiUrls = domains.map(domain => `https://${domain}${apiPath}`)
  
  return {
    apiUrls,
    primaryDomain,
    fallbackDomain,
    timeout: enkaConfig.timeout || 10000,
    userAgent: enkaConfig.userAgent || 'ZZZ-Plugin/UCPr',
    randomSelection
  }
}

// 随机选择API URL
function selectApiUrl(apiUrls, randomSelection) {
  if (!randomSelection || apiUrls.length === 1) {
    return apiUrls[0]
  }
  const randomIndex = Math.floor(Math.random() * apiUrls.length)
  return apiUrls[randomIndex]
}

// 尝试请求API
async function tryFetchApi(url, uid, config) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)
  
  try {
    const res = await fetch(`${url}${uid}`, {
      method: 'GET',
      headers: {
        'User-Agent': config.userAgent,
      },
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return { success: true, response: res, url }
  } catch (error) {
    clearTimeout(timeoutId)
    return { success: false, error, url }
  }
}

export function parsePlayerInfo(SocialDetail = {}) {
  const ProfileDetail = SocialDetail.ProfileDetail || {}
  return {
    game_biz: 'nap_cn',
    region: 'prod_gf_cn',
    game_uid: ProfileDetail.Uid || SocialDetail.uid || '114514',
    nickname: ProfileDetail.Nickname || 'Fairy',
    level: ProfileDetail.Level || 60,
    is_chosen: true,
    region_name: '新艾利都',
    is_official: true,
    desc: SocialDetail.Desc || '',
  }
}

/**
 * Enka更新面板
 * @param {string|number} uid 
 */
export async function refreshPanelFromEnka(uid) {
  const enkaConfig = getEnkaConfig()
  const { apiUrls, randomSelection } = enkaConfig
  
  // 如果启用随机选择，随机排序API URLs
  let urlsToTry = [...apiUrls]
  if (randomSelection) {
    const selectedUrl = selectApiUrl(apiUrls, true)
    // 将选中的URL放在第一位，其他URL作为备选
    urlsToTry = [selectedUrl, ...apiUrls.filter(url => url !== selectedUrl)]
  }
  
  let lastError = null
  let lastStatus = null
  
  // 依次尝试每个API URL
  for (let i = 0; i < urlsToTry.length; i++) {
    const currentUrl = urlsToTry[i]
    const domain = currentUrl.match(/https:\/\/([^/]+)/)?.[1] || 'unknown'
    
    logger.debug(`[Enka] 尝试使用域名: ${domain} (${i + 1}/${urlsToTry.length})`)
    
    const result = await tryFetchApi(currentUrl, uid, enkaConfig)
    
    if (result.success) {
      const res = result.response
      
      if (!res.ok) {
        logger.warn(`[Enka] 域名 ${domain} 返回错误：${res.status} ${res.statusText}`)
        lastStatus = res.status
        // 如果不是最后一个URL，继续尝试下一个
        if (i < urlsToTry.length - 1) {
          continue
        }
        return res.status
      }
      
      try {
        const data = await res.json()
        /** @type {import('./interface.ts').Enka.Avatar[]} */
        const panelList = data?.PlayerInfo?.ShowcaseDetail?.AvatarList
        
        if (!panelList || !Array.isArray(panelList)) {
          logger.warn(`[Enka] 域名 ${domain} 获取面板数据失败`)
          // 如果不是最后一个URL，继续尝试下一个
          if (i < urlsToTry.length - 1) {
            continue
          }
          return res.status
        }
        
        if (!panelList.length) {
          console.log('面板列表为空')
        }
        
        logger.info(`[Enka] 成功使用域名 ${domain} 获取面板数据`)
        return {
          playerInfo: parsePlayerInfo(data.PlayerInfo.SocialDetail),
          panelList: Enka2Mys(panelList)
        }
      } catch (parseError) {
        logger.warn(`[Enka] 域名 ${domain} 解析数据失败：${parseError.message}`)
        lastError = parseError
        // 如果不是最后一个URL，继续尝试下一个
        if (i < urlsToTry.length - 1) {
          continue
        }
      }
    } else {
      const { error } = result
      if (error.name === 'AbortError') {
        logger.warn(`[Enka] 域名 ${domain} 请求超时 (${enkaConfig.timeout}ms)`)
        lastStatus = 408
      } else {
        logger.warn(`[Enka] 域名 ${domain} 请求失败：${error.message}`)
        lastError = error
      }
      
      // 如果不是最后一个URL，继续尝试下一个
      if (i < urlsToTry.length - 1) {
        continue
      }
    }
  }
  
  // 所有URL都失败了
  logger.error('[Enka] 所有域名都无法访问')
  if (lastStatus) {
    return lastStatus
  }
  if (lastError?.name === 'AbortError') {
    return 408 // Request Timeout
  }
  return 500 // Internal Server Error
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