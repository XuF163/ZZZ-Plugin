import path from 'path';
import { pathToFileURL } from 'url';
import { pluginPath } from './path.js';
const pluginsRoot = path.resolve(pluginPath, '..');
const yunzaiRoot = path.resolve(pluginsRoot, '..');
const moduleCache = new Map();
function importCached(absPath) {
    const url = pathToFileURL(absPath).href;
    const cached = moduleCache.get(url);
    if (cached)
        return cached;
    const p = import(url);
    moduleCache.set(url, p);
    return p;
}
export function importFromYunzai(...segments) {
    return importCached(path.join(yunzaiRoot, ...segments));
}
export function importFromPlugins(pluginName, ...segments) {
    return importCached(path.join(pluginsRoot, pluginName, ...segments));
}
let yunzaiCommonPromise = null;
export async function getYunzaiCommon() {
    if (!yunzaiCommonPromise) {
        yunzaiCommonPromise = importFromYunzai('lib', 'common', 'common.js')
            .then((m) => m?.default ?? m);
    }
    return yunzaiCommonPromise;
}
let yunzaiConfigPromise = null;
export async function getYunzaiConfig() {
    if (!yunzaiConfigPromise) {
        yunzaiConfigPromise = importFromYunzai('lib', 'config', 'config.js')
            .then((m) => m?.default ?? m);
    }
    return yunzaiConfigPromise;
}
let genshinUserPromise = null;
export async function getGenshinUser() {
    if (!genshinUserPromise) {
        genshinUserPromise = importFromPlugins('genshin', 'model', 'user.js')
            .then((m) => m?.default ?? m);
    }
    return genshinUserPromise;
}
let genshinMysApiPromise = null;
export async function getGenshinMysApi() {
    if (!genshinMysApiPromise) {
        genshinMysApiPromise = importFromPlugins('genshin', 'model', 'mys', 'mysApi.js')
            .then((m) => m?.default ?? m);
    }
    return genshinMysApiPromise;
}
let genshinNoteUserPromise = null;
export async function getGenshinNoteUser() {
    if (!genshinNoteUserPromise) {
        genshinNoteUserPromise = importFromPlugins('genshin', 'model', 'mys', 'NoteUser.js')
            .then((m) => m?.default ?? m);
    }
    return genshinNoteUserPromise;
}
//# sourceMappingURL=external.js.map