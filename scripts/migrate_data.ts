import fs from "fs-extra";
const { existsSync, readJsonSync, writeJsonSync } = fs;
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EquipmentData,
  RarityType,
  Equipment,
} from "../src/types/equipment.js";

const RARITY_MAP: Record<number | string, RarityType> = {
  5: "Gold",
  4: "Purple",
  3: "Blue",
  2: "Green",
  1: "White",
  0: "Unknown",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const LEGACY_FILE = path.join(__dirname, "lagacy-sample", "equipment.json");
const EQUIPMENT_FILE = path.join(DATA_DIR, "equipment.json");
const LOCALES_DIR = path.join(__dirname, "..", "locales");

async function migrate() {
  console.log("[*] Starting Precision Data Migration...");

  if (!existsSync(EQUIPMENT_FILE)) {
    console.error("[!] equipment.json not found.");
    return;
  }

  const equipment: EquipmentData = readJsonSync(EQUIPMENT_FILE);
  const legacy: any = existsSync(LEGACY_FILE) ? readJsonSync(LEGACY_FILE) : {};

  // Locale files
  const koLocaleFile = path.join(LOCALES_DIR, "ko", "equipment-name.json");
  const enLocaleFile = path.join(LOCALES_DIR, "en", "equipment-name.json");

  const koMap = existsSync(koLocaleFile) ? readJsonSync(koLocaleFile) : {};
  const enMap = existsSync(enLocaleFile) ? readJsonSync(enLocaleFile) : {};

  let migratedCount = 0;

  for (const [id, item] of Object.entries(equipment)) {
    // 1. Strict Interface Enforcement: Create a clean object from the current item
    const cleanItem: Equipment = {
      id: item.id || id,
      rarity: (item.rarity as any) || "Unknown",
      level: item.level || 0,
      gearType: (item.gearType as any) || "Unknown",
      set: item.set || "",
      stats: item.stats || [],
      effects: item.effects || [],
      imgUrl: item.imgUrl || "",
    };
    if (item.defense !== undefined) cleanItem.defense = item.defense;

    // Normalization for gearType if it's from legacy or other sources
    if ((cleanItem.gearType as string) === "GLOVE")
      cleanItem.gearType = "GLOVES";

    // Handle initial numerical rarity conversion if still present
    if (typeof cleanItem.rarity === "number") {
      cleanItem.rarity = RARITY_MAP[cleanItem.rarity] || "Unknown";
    }

    // 2. Precision Mapping from Legacy
    if (legacy[id]) {
      const legacyItem = legacy[id];

      // Legacy tier -> Project rarity
      if (legacyItem.tier !== undefined) {
        cleanItem.rarity = RARITY_MAP[legacyItem.tier] || "Unknown";
      }

      // Legacy type -> Project gearType
      if (legacyItem.type) {
        cleanItem.gearType = legacyItem.type;
      }

      // Other fields (Keep project values if they exist/are more recent, but legacy provides detailed data)
      if (legacyItem.level) cleanItem.level = legacyItem.level;
      if (legacyItem.set) cleanItem.set = legacyItem.set;
      if (legacyItem.defense !== undefined)
        cleanItem.defense = legacyItem.defense;
      if (legacyItem.stats && legacyItem.stats.length > 0)
        cleanItem.stats = legacyItem.stats;
      if (legacyItem.effects && legacyItem.effects.length > 0)
        cleanItem.effects = legacyItem.effects;

      migratedCount++;
    }

    // Replace in main object
    equipment[id] = cleanItem;

    // 3. i18n Sync: Use the original item name from equipment.json before it was cleaned
    if (!enMap[id]) enMap[id] = item.name || id;
    if (koMap[id] === undefined) koMap[id] = ""; // Only introduce key if it doesn't exist
  }

  // Final Save
  writeJsonSync(EQUIPMENT_FILE, equipment, { spaces: 2 });
  writeJsonSync(enLocaleFile, enMap, { spaces: 2 });
  writeJsonSync(koLocaleFile, koMap, { spaces: 2 });

  // cleanup legacy mapping file if exists
  const oldMapping = path.join(DATA_DIR, "mapping.json");
  if (existsSync(oldMapping)) {
    fs.removeSync(oldMapping);
    console.log("[*] Removed legacy mapping.json");
  }

  console.log(`[+] Precision Migration complete!`);
  console.log(` -> Precision Merged Items: ${migratedCount}`);
  console.log(` -> Total Items Processed: ${Object.keys(equipment).length}`);
  console.log(` -> i18n Locales synced (en & ko)`);
}

migrate();
