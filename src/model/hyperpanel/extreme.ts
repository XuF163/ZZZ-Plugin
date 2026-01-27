import fs from 'fs'
import path from 'path'

import _ from 'lodash'

import { pluginPath } from '../../lib/path.js'
import { getPanelData, savePanelData } from '../../lib/db.js'
import { baseValueData } from '../../lib/score.js'
import { idToName } from '../../lib/convert/property.js'

const panelDir = path.join(pluginPath, 'data', 'panel')

const percentPropIds = new Set([
  11102, 12102, 12202, 13102, 20103, 21103, 23103, 30502, 31402, 31503, 31603,
  31703, 31803, 31903,
])

function sleep0() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function formatValue(propId: number, value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  if (percentPropIds.has(Number(propId))) {
    const fixed = n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
    return `${fixed}%`
  }
  return String(Math.trunc(n))
}

function ensureZzzSkills(avatar: any) {
  // ZZZ skill indices: 0,1,2,3,5,6 (note: 4 is unused)
  const rank = Number(avatar?.rank) || 0
  const rankLevel = rank >= 3 ? (rank >= 5 ? 4 : 2) : 0
  avatar.skills = [0, 1, 2, 3, 5, 6].map((skill_type) => {
    // Core (Index=5) max is 6; others max is 12 (+rank bonus).
    const base = skill_type === 5 ? 6 : 12
    return {
      level: base + (rankLevel && skill_type !== 5 ? rankLevel : 0),
      skill_type,
      items: [],
    }
  })
}

function pickTopSubStats(weights: any, mainPropId: number) {
  const all = Object.keys(baseValueData || {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))

  const candidates = all
    .filter((id) => id !== Number(mainPropId) && Number(weights?.[id] || 0) > 0)
    .sort((a, b) => Number(weights?.[b] || 0) - Number(weights?.[a] || 0))

  const picked: number[] = []
  for (const id of candidates) {
    if (picked.length >= 4) break
    if (!picked.includes(id)) picked.push(id)
  }

  // fallback: fill to 4 with any remaining sub stats (rare cases: all weights are 0)
  for (const id of all) {
    if (picked.length >= 4) break
    if (id === Number(mainPropId)) continue
    if (!picked.includes(id)) picked.push(id)
  }

  return picked.slice(0, 4)
}

function buildExtremeEquipList(equipList: any, weights: any) {
  const out: any[] = []
  const list = Array.isArray(equipList) ? equipList : []

  for (const equip of list) {
    const mainPropId = Number(equip?.main_properties?.[0]?.property_id)
    const picked = pickTopSubStats(weights, mainPropId)
    const topId = picked[0]

    const properties = picked.map((propId) => {
      const rolls = propId === topId ? 6 : 1
      const base = Number((baseValueData as any)?.[String(propId)] || 0) * rolls
      return {
        property_name: idToName(propId) || '',
        property_id: propId,
        base: formatValue(propId, base),
      }
    })

    out.push({
      ...equip,
      // 15级 + S 稀有度，保证驱动盘评分上限
      level: 15,
      rarity: 'S',
      properties,
    })
  }

  return out
}

function resolvePanelUidsFromDir() {
  if (!fs.existsSync(panelDir)) return []
  return fs
    .readdirSync(panelDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.json'))
    .map((d) => d.name.replace(/\.json$/, ''))
    .filter((s) => /^\d+$/.test(s))
}

async function readPanelFile(uid: string) {
  const file = path.join(panelDir, `${uid}.json`)
  if (!fs.existsSync(file)) return []
  const raw = await fs.promises.readFile(file, 'utf8')
  const data = safeJsonParse<any>(raw, [])
  return Array.isArray(data) ? data : []
}

function cloneJson<T>(obj: T) {
  return safeJsonParse<T | null>(JSON.stringify(obj), null)
}

/**
 * 基于 ZZZ-Plugin 已缓存的真实用户面板（plugins/ZZZ-Plugin/data/panel/*.json）生成 “极限面板”（默认 UID=10000000）。
 * - 每个角色：选出当前缓存里驱动盘评分（equip_score）最高的真实面板作为样本
 * - 在样本基础上：驱动盘副词条按角色权重生成 6/1/1/1 分配（每次roll取最大档），并强制 15级 + S稀有度
 * - 角色：影画=6，技能满级（含影画加成），等级至少60（若样本更高则保留）
 */
export async function updateExtremePanelsFromPanelDb(
  { targetUid = '10000000' }: { targetUid?: string | number } = {}
): Promise<
  | { ok: true; uid: string; count: number; updated: number; scannedUids: number; scannedAvatars: number }
  | { ok: false; message: string }
> {
  // 兼容独立运行脚本：避免 Score 模块导入时找不到 logger
  if (!(globalThis as any).logger) {
    ;(globalThis as any).logger = {
      ...console,
      mark: console.log,
      debug: () => {},
      blue: (s: string) => s,
      green: (s: string) => s,
      yellow: (s: string) => s,
      red: (s: string) => s,
      magenta: (s: string) => s,
      cyan: (s: string) => s,
    }
  }

  const { ZZZAvatarInfo } = (await import('../avatar.js')) as any

  const target = String(targetUid)
  const uidList = resolvePanelUidsFromDir()
    .map((u) => String(u))
    .filter((u) => u !== target)

  if (!uidList.length) {
    return {
      ok: false,
      message:
        '未找到可用的面板数据源：请先让一些用户更新/刷新一次面板，生成 plugins/ZZZ-Plugin/data/panel/<uid>.json',
    }
  }

  const bestByChar = new Map<number, { uid: string; equipScore: number; avatar: any }>()
  let scannedUids = 0
  let scannedAvatars = 0

  for (const uid of uidList) {
    scannedUids++
    const list = await readPanelFile(uid)
    if (!Array.isArray(list) || !list.length) continue

    for (const ds of list) {
      const id = Number(ds?.id)
      if (!Number.isFinite(id) || id <= 0) continue
      const equipList = ds?.equip
      if (!Array.isArray(equipList) || equipList.length <= 0) continue

      scannedAvatars++
      let equipScore = 0
      try {
        equipScore = new ZZZAvatarInfo(ds).equip_score
      } catch {
        continue
      }

      const prev = bestByChar.get(id)
      if (!prev || equipScore > prev.equipScore) {
        bestByChar.set(id, { uid, equipScore, avatar: ds })
      }
    }

    if (scannedUids % 5 === 0) {
      await sleep0()
    }
  }

  if (!bestByChar.size) {
    return {
      ok: false,
      message:
        '扫描完成但未找到任何有效角色面板：可能面板数据为空/不完整。',
    }
  }

  const out: any[] = []
  const now = Date.now()

  const sorted = _.orderBy(
    Array.from(bestByChar.entries()).map(([id, v]) => ({ id, ...v })),
    ['equipScore', 'id'],
    ['desc', 'asc']
  )

  for (const rec of sorted) {
    const base = cloneJson(rec.avatar)
    if (!base) continue

    base.rank = 6
    base.level = Math.max(Number(base.level) || 0, 60)
    ensureZzzSkills(base)
    if (base.weapon && typeof base.weapon === 'object') {
      base.weapon.level = Math.max(Number(base.weapon.level) || 0, 60)
    }

    let weights: any = {}
    try {
      weights = new ZZZAvatarInfo(base).scoreWeight || {}
    } catch {
      weights = {}
    }

    base.equip = buildExtremeEquipList(base.equip, weights)
    base._source = `extreme:${rec.uid}`
    base._update = now
    base._time = now
    out.push(base)
  }

  // 合并旧数据：避免源数据不足时把 targetUid 的角色列表“覆盖变少”
  const origin = getPanelData(String(targetUid)) || []
  const final = [...out]
  for (const item of origin) {
    const id = Number(item?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    if (!final.find((i) => Number(i?.id) === id)) {
      final.push(item)
    }
  }

  savePanelData(String(targetUid), final)
  return {
    ok: true,
    uid: String(targetUid),
    count: final.length,
    updated: out.length,
    scannedUids,
    scannedAvatars,
  }
}

