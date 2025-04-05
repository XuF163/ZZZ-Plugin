// hakushi_updater.js
// Purpose: Provides a function to fetch detailed ZZZ data from Hakush API and save it locally.

import fetch from 'node-fetch';
import fs from 'fs/promises'; // Use promise-based fs for async/await
import path from 'path';
import { fileURLToPath } from 'url'; // Needed if using __dirname with ES Modules

// --- Configuration ---
const HAKUSH_BASE = 'https://api.hakush.in/zzz';
const HAKUSH_API = `${HAKUSH_BASE}/data/zh`; // Using Chinese data endpoint

const API_ENDPOINTS = {
    ALL_CHAR: `${HAKUSH_BASE}/data/character.json`,
    CHARACTER_DETAIL: `${HAKUSH_API}/character/{id}.json`,
    ALL_WEAPON: `${HAKUSH_BASE}/data/weapon.json`,
    WEAPON_DETAIL: `${HAKUSH_API}/weapon/{id}.json`,
    ALL_EQUIP: `${HAKUSH_API}/data/equipment.json`,
};

const REQUEST_DELAY_MS = 100; // Small delay between requests

// --- Helper Functions (kept internal to this module) ---

async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`[HakushUpdater] Error creating directory ${dirPath}:`, error);
            throw error;
        }
    }
}

async function fetchJson(url, logger = console) { // Accept optional logger
    logger.debug(`[HakushUpdater] Fetching: ${url}`); // Use debug level
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'ZZZeroUID-DataFetcher/1.0' }
        });
        if (!response.ok) {
            logger.error(`[HakushUpdater] HTTP error ${response.status} for ${url}`);
            return null;
        }
        const data = await response.json();
        if (REQUEST_DELAY_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
        }
        return data;
    } catch (error) {
        logger.error(`[HakushUpdater] Error fetching ${url}:`, error);
        return null;
    }
}

async function saveJson(filePath, data, logger = console) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        logger.info(`[HakushUpdater] Saved: ${path.basename(filePath)}`); // Log filename for brevity
    } catch (error) {
        logger.error(`[HakushUpdater] Error saving file ${filePath}:`, error);
    }
}

// --- Core Fetching Logic (internal functions) ---

async function fetchAndSaveEquipment(outputDir, logger) {
    logger.info('[HakushUpdater] --- Fetching Equipment Data ---');
    const equipData = await fetchJson(API_ENDPOINTS.ALL_EQUIP, logger);
    if (equipData) {
        const outputFile = path.join(outputDir, 'equipment.json');
        await saveJson(outputFile, equipData, logger);
        return true;
    } else {
        logger.error('[HakushUpdater] Failed to fetch equipment data.');
        return false;
    }
}

async function fetchAndSaveCharacters(outputDir, logger) {
    logger.info('[HakushUpdater] --- Fetching Character Data ---');
    const allCharInfo = await fetchJson(API_ENDPOINTS.ALL_CHAR, logger);
    if (!allCharInfo) {
        logger.error('[HakushUpdater] Failed to fetch character list. Aborting character fetch.');
        return false;
    }

    const charOutputDir = path.join(outputDir, 'characters');
    await ensureDir(charOutputDir);
    const charIds = Object.keys(allCharInfo);
    logger.info(`[HakushUpdater] Found ${charIds.length} characters. Fetching details...`);

    let successCount = 0;
    let failCount = 0;
    for (const charId of charIds) {
        logger.debug(`[HakushUpdater] Fetching character ${successCount + failCount + 1}/${charIds.length} (ID: ${charId})`);
        const detailUrl = API_ENDPOINTS.CHARACTER_DETAIL.replace('{id}', charId);
        const charDetail = await fetchJson(detailUrl, logger);
        if (charDetail) {
            const outputPath = path.join(charOutputDir, `${charId}.json`);
            await saveJson(outputPath, charDetail, logger);
            successCount++;
        } else {
            logger.warn(`[HakushUpdater] Skipped saving details for character ID: ${charId} due to fetch error.`);
            failCount++;
        }
    }
    logger.info(`[HakushUpdater] Character data fetching complete. Success: ${successCount}, Failed: ${failCount}`);
    return failCount === 0; // Return true only if all characters were fetched successfully
}

async function fetchAndSaveWeapons(outputDir, logger) {
    logger.info('[HakushUpdater] --- Fetching Weapon Data ---');
    const allWeaponInfo = await fetchJson(API_ENDPOINTS.ALL_WEAPON, logger);
    if (!allWeaponInfo) {
        logger.error('[HakushUpdater] Failed to fetch weapon list. Aborting weapon fetch.');
        return false;
    }

    const weaponOutputDir = path.join(outputDir, 'weapons');
    await ensureDir(weaponOutputDir);
    const weaponIds = Object.keys(allWeaponInfo);
    logger.info(`[HakushUpdater] Found ${weaponIds.length} weapons. Fetching details...`);

    let successCount = 0;
    let failCount = 0;
    for (const weaponId of weaponIds) {
        logger.debug(`[HakushUpdater] Fetching weapon ${successCount + failCount + 1}/${weaponIds.length} (ID: ${weaponId})`);
        const detailUrl = API_ENDPOINTS.WEAPON_DETAIL.replace('{id}', weaponId);
        const weaponDetail = await fetchJson(detailUrl, logger);
        if (weaponDetail) {
            const outputPath = path.join(weaponOutputDir, `${weaponId}.json`);
            await saveJson(outputPath, weaponDetail, logger);
            successCount++;
        } else {
            logger.warn(`[HakushUpdater] Skipped saving details for weapon ID: ${weaponId} due to fetch error.`);
            failCount++;
        }
    }
    logger.info(`[HakushUpdater] Weapon data fetching complete. Success: ${successCount}, Failed: ${failCount}`);
    return failCount === 0; // Return true only if all weapons were fetched successfully
}


// --- Exported Function ---

/**
 * Updates local Hakush data by fetching from the API.
 * @param {string} [outputDirectory] - Optional. The base directory to save the data.
 *                                     Defaults to '../resources/hakush_data' relative to this script.
 * @param {object} [logger=console] - Optional. A logger object (e.g., pino, winston) with info, warn, error, debug methods.
 *                                     Defaults to the standard console.
 * @returns {Promise<boolean>} - True if all updates were successful, false otherwise.
 */
export async function updateHakushData(outputDirectory = null, logger = console) {
    // Determine output directory
    if (!outputDirectory) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        outputDirectory = path.join(__dirname, '..', '..','resources', 'hakush_data');
    }
    logger.info(`[HakushUpdater] Starting Hakush data update. Output directory: ${outputDirectory}`);
    try {
        await ensureDir(outputDirectory); // Ensure base directory exists
        // Run fetch operations sequentially or in parallel (parallel might be faster but riskier for API rate limits)
        // Sequential example:
        const equipSuccess = await fetchAndSaveEquipment(outputDirectory, logger);
        const charSuccess = await fetchAndSaveCharacters(outputDirectory, logger);
        const weaponSuccess = await fetchAndSaveWeapons(outputDirectory, logger);
        const overallSuccess = equipSuccess && charSuccess && weaponSuccess;
        if (overallSuccess) {
            logger.info('[HakushUpdater] --- Hakush data update finished successfully! ---');
        } else {
            logger.warn('[HakushUpdater] --- Hakush data update finished with some errors. ---');
        }
        return overallSuccess;
    } catch (error) {
        logger.error("[HakushUpdater] An unexpected error occurred during the update:", error);
        return false; // Indicate failure
    }
}
