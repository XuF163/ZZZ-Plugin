import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const moduleFilePath = fileURLToPath(import.meta.url)
const moduleDirPath = path.dirname(moduleFilePath)

function findPluginRoot(startDir: string) {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    const parent = path.resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  // fallback: keep old behavior for dist/lib/path.js
  return path.resolve(startDir, '..', '..')
}

/** 插件路径 */
export const pluginPath = findPluginRoot(moduleDirPath)

/** 插件源码路径 */
export const srcPath = path.join(pluginPath, 'src')

/** 构建后路径 */
export const distPath = path.join(pluginPath, 'dist')

/** apps 路径 */
const isBuilt = moduleDirPath.split(path.sep).includes('dist')
export const appPath = isBuilt ? path.join(distPath, 'apps') : path.join(pluginPath, 'apps')

/** 插件名 */
export const pluginName = path.basename(pluginPath)

/** resources */
export const resourcesPath = path.join(pluginPath, 'resources')

export const imageResourcesPath = path.join(resourcesPath, 'images')

export const dataResourcesPath = path.join(resourcesPath, 'data')

export const mapResourcesPath = path.join(resourcesPath, 'map')

/** config 路径 */
export const configPath = path.join(pluginPath, 'config')

/** 默认配置路径 */
export const defPath = path.join(pluginPath, 'defSet')

/** data 路径 */
export const dataPath = path.join(pluginPath, 'data')
