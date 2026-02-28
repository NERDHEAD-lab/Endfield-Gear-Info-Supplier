import fs from "fs-extra";
const { readFileSync, readJsonSync, writeJsonSync, existsSync } = fs;
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_TS = path.join(__dirname, "lagacy-sample", "index.ts");
const SCHEMA_TS = path.join(__dirname, "..", "src", "types", "equipment.ts");
const DATA_DIR = path.join(__dirname, "..", "data");
const LOCALES_DIR = path.join(DATA_DIR, "locales");

/**
 * Dynamically extract valid IDs from src/types/equipment.ts
 */
function extractSchemaIds(schemaContent: string): any {
  const extract = (typeName: string) => {
    const regex = new RegExp(`export type ${typeName}\\s*=\\s*([^;]+);`);
    const match = schemaContent.match(regex);
    if (!match) return [];

    // Split by | and clean up quotes/whitespace
    return match[1]
      .split("|")
      .map((id) => id.trim().replace(/^["']|["']$/g, ""))
      .filter((id) => id !== "");
  };

  return {
    "stat-type.json": extract("StatType"),
    "gear-type.json": extract("GearType"),
    "rarity-type.json": extract("RarityType"),
    "effect-type.json": extract("EffectType"),
  };
}

const TYPE_CONFIG = [
  { prefix: "stat", file: "stat-type.json" },
  { prefix: "effect", file: "effect-type.json" },
  { prefix: "part", file: "gear-type.json" },
  { prefix: "rarity", file: "rarity-type.json" },
];

/**
 * Hardcoded fallbacks for types not present or named differently in index.ts
 */
const DEFAULT_MAPPINGS: Record<
  string,
  Record<string, { ko: string; en: string }>
> = {
  "stat-type.json": {
    STRENGTH: { ko: "힘", en: "Strength" },
    AGILITY: { ko: "민첩", en: "Agility" },
    INTELLECT: { ko: "지능", en: "Intellect" },
    WILL: { ko: "의지", en: "Will" },
  },
  "gear-type.json": {
    ARMOR: { ko: "방어구", en: "Armor" },
    KIT: { ko: "부품", en: "Kit" },
    GLOVES: { ko: "글러브", en: "Gloves" },
    Unknown: { ko: "미정", en: "Unknown" },
  },
  "rarity-type.json": {
    Gold: { ko: "금색", en: "Gold" },
    Purple: { ko: "보라색", en: "Purple" },
    Blue: { ko: "파란색", en: "Blue" },
    Green: { ko: "초록색", en: "Green" },
    White: { ko: "흰색", en: "White" },
    Unknown: { ko: "알 수 없음", en: "Unknown" },
  },
  "effect-type.json": {
    HP: { ko: "생명력", en: "HP" },
    CRIT_RATE: { ko: "치명타율", en: "Crit Rate" },
    ATTACK: { ko: "공격력", en: "Attack" },
    FINAL_DMG_REDUCTION: { ko: "최종 피해 감소", en: "Final DMG Reduction" },
    BATTLE_SKILL_DMG_BONUS: {
      ko: "전투 기술 피해 보너스",
      en: "Battle Skill DMG Bonus",
    },
    COMBO_SKILL_DMG_BONUS: {
      ko: "콤보 기술 피해 보너스",
      en: "Combo Skill DMG Bonus",
    },
    PHYSICAL_DMG_BONUS: { ko: "물리 피해 보너스", en: "Physical DMG Bonus" },
    TREATMENT_BONUS: { ko: "치료 보너스", en: "Treatment Bonus" },
    ARTS_DMG_DEALT_BONUS: {
      ko: "아츠 피해 보너스",
      en: "Arts DMG Dealt Bonus",
    },
    COMBO_SKILL_DMG: { ko: "콤보 기술 피해", en: "Combo Skill DMG" },
    CRYO_AND_ELECTRIC_DMG_DEALT_BONUS: {
      ko: "빙결 및 전기 피해 보너스",
      en: "Cryo & Electric DMG Dealt Bonus",
    },
    ALL_SKILL_DMG: { ko: "모든 기술 피해", en: "All Skill DMG" },
    ULTIMATE_GAIN_EFFICIENCY: {
      ko: "궁극기 에너지 획득 효율",
      en: "Ultimate Gain Efficiency",
    },
    ULTIMATE_DMG_BONUS: { ko: "궁극기 피해 보너스", en: "Ultimate DMG Bonus" },
    BASIC_ATTACK_DMG_BONUS: {
      ko: "일반 공격 피해 보너스",
      en: "Basic Attack DMG Bonus",
    },
    ARTS_INTENSITY: { ko: "아츠 강도", en: "Arts Intensity" },
    "SUB-ATTR": { ko: "보조 속성", en: "Sub-Attr" },
    "DMG_BONUS_VS._STAGGERED": {
      ko: "그로기 상태 피해 보너스",
      en: "DMG Bonus vs. Staggered",
    },
    MAIN_ATTRIBUTE: { ko: "주요 속성", en: "Main Attribute" },
    HEAT_AND_NATURE_DMG_DEALT_BONUS: {
      ko: "열기 및 자연 피해 보너스",
      en: "Heat & Nature DMG Dealt Bonus",
    },
    ALL_SKILL_DMG_DEALT_BONUS: {
      ko: "모든 기술 피해 보너스",
      en: "All Skill DMG Dealt Bonus",
    },
    CRYO_AND_ELECTRIC_DMG: {
      ko: "빙결 및 전기 피해",
      en: "Cryo & Electric DMG",
    },
    SECONDARY_ATTRIBUTE: { ko: "보조 속성", en: "Secondary Attribute" },
  },
};

function syncTypes() {
  console.log(
    "[*] Extracting type translations from index.ts (Dynamic Schema Sync)...",
  );
  const content = readFileSync(INDEX_TS, "utf-8");
  const schemaContent = readFileSync(SCHEMA_TS, "utf-8");
  const SCHEMA_VALID_IDS = extractSchemaIds(schemaContent);

  const koStart = content.indexOf("ko: {");
  const enStart = content.indexOf("en: {");

  const koContent = content.substring(koStart, enStart);
  const enContent = content.substring(enStart);

  const langMap: Record<string, string> = {
    ko: koContent,
    en: enContent,
  };

  for (const [lang, sectionContent] of Object.entries(langMap)) {
    console.log(` -> Processing [${lang}]...`);

    for (const config of TYPE_CONFIG) {
      const localePath = path.join(LOCALES_DIR, lang, config.file);
      const validIds =
        SCHEMA_VALID_IDS[config.file as keyof typeof SCHEMA_VALID_IDS] || [];

      const filteredData: Record<string, string> = {};

      // 1. Extract and map from index.ts
      const regex = new RegExp(
        `"${config.prefix}\\.([^"]+)":\\s*"([^"]+)"`,
        "g",
      );
      let match;
      while ((match = regex.exec(sectionContent)) !== null) {
        let id = match[1];
        const value = match[2];

        // Exceptional Normalization
        if (id === "GLOVE") id = "GLOVES";

        if (validIds.includes(id)) {
          filteredData[id] = value;
        }
      }

      // 2. Apply Default Mappings for missing valid IDs
      const defaults = DEFAULT_MAPPINGS[config.file] || {};
      for (const id of validIds) {
        if (!filteredData[id] || filteredData[id] === "") {
          const defaultVal = defaults[id];
          if (defaultVal) {
            filteredData[id] = lang === "ko" ? defaultVal.ko : defaultVal.en;
          } else {
            filteredData[id] = "";
          }
        }
      }

      writeJsonSync(localePath, filteredData, { spaces: 2 });
      console.log(
        `    [+] Saved ${Object.keys(filteredData).length} valid keys in ${lang}/${config.file}`,
      );
    }
  }

  console.log("[+] Strict type translation sync complete!");
}

syncTypes();
