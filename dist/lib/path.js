import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const moduleFilePath = fileURLToPath(import.meta.url);
const moduleDirPath = path.dirname(moduleFilePath);
function findPluginRoot(startDir) {
    let dir = startDir;
    for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, 'package.json')))
            return dir;
        const parent = path.resolve(dir, '..');
        if (parent === dir)
            break;
        dir = parent;
    }
    return path.resolve(startDir, '..', '..');
}
export const pluginPath = findPluginRoot(moduleDirPath);
export const srcPath = path.join(pluginPath, 'src');
export const distPath = path.join(pluginPath, 'dist');
const isBuilt = moduleDirPath.split(path.sep).includes('dist');
export const appPath = isBuilt ? path.join(distPath, 'apps') : path.join(pluginPath, 'apps');
export const pluginName = path.basename(pluginPath);
export const resourcesPath = path.join(pluginPath, 'resources');
export const imageResourcesPath = path.join(resourcesPath, 'images');
export const dataResourcesPath = path.join(resourcesPath, 'data');
export const mapResourcesPath = path.join(resourcesPath, 'map');
export const configPath = path.join(pluginPath, 'config');
export const defPath = path.join(pluginPath, 'defSet');
export const dataPath = path.join(pluginPath, 'data');
//# sourceMappingURL=path.js.map