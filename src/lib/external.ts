import path from 'path'
import { pathToFileURL } from 'url'
import { pluginPath } from './path.js'

const pluginsRoot = path.resolve(pluginPath, '..')
const yunzaiRoot = path.resolve(pluginsRoot, '..')

const moduleCache = new Map<string, Promise<any>>()

function importCached<T = any>(absPath: string): Promise<T> {
  const url = pathToFileURL(absPath).href
  const cached = moduleCache.get(url)
  if (cached) return cached as Promise<T>
  const p = import(url) as Promise<T>
  moduleCache.set(url, p)
  return p
}

export function importFromYunzai<T = any>(...segments: string[]): Promise<T> {
  return importCached<T>(path.join(yunzaiRoot, ...segments))
}

export function importFromPlugins<T = any>(pluginName: string, ...segments: string[]): Promise<T> {
  return importCached<T>(path.join(pluginsRoot, pluginName, ...segments))
}

let yunzaiCommonPromise: Promise<any> | null = null
export async function getYunzaiCommon() {
  if (!yunzaiCommonPromise) {
    yunzaiCommonPromise = importFromYunzai('lib', 'common', 'common.js')
      .then((m: any) => m?.default ?? m)
  }
  return yunzaiCommonPromise
}

let yunzaiConfigPromise: Promise<any> | null = null
export async function getYunzaiConfig() {
  if (!yunzaiConfigPromise) {
    yunzaiConfigPromise = importFromYunzai('lib', 'config', 'config.js')
      .then((m: any) => m?.default ?? m)
  }
  return yunzaiConfigPromise
}

let genshinUserPromise: Promise<any> | null = null
export async function getGenshinUser() {
  if (!genshinUserPromise) {
    genshinUserPromise = importFromPlugins('genshin', 'model', 'user.js')
      .then((m: any) => m?.default ?? m)
  }
  return genshinUserPromise
}

let genshinMysApiPromise: Promise<any> | null = null
export async function getGenshinMysApi() {
  if (!genshinMysApiPromise) {
    genshinMysApiPromise = importFromPlugins('genshin', 'model', 'mys', 'mysApi.js')
      .then((m: any) => m?.default ?? m)
  }
  return genshinMysApiPromise
}

let genshinNoteUserPromise: Promise<any> | null = null
export async function getGenshinNoteUser() {
  if (!genshinNoteUserPromise) {
    genshinNoteUserPromise = importFromPlugins('genshin', 'model', 'mys', 'NoteUser.js')
      .then((m: any) => m?.default ?? m)
  }
  return genshinNoteUserPromise
}
