import fs from "fs-extra";
const { existsSync, readJsonSync, writeFileSync } = fs;
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EquipmentData, MappingData } from "./types/equipment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const EQUIPMENT_FILE = path.join(DATA_DIR, "equipment.json");
const LOCALES_DIR = path.join(__dirname, "..", "locales");
const KO_LOCALE_FILE = path.join(LOCALES_DIR, "ko", "equipment-name.json");
const REPORT_FILE = path.join(__dirname, "..", "report.md");

/**
 * Validate data integrity and generate a markdown report.
 */
async function validate() {
  console.log("[*] Starting data validation...");

  const mappingErrors: string[] = [];
  const equipmentErrors: string[] = [];

  const languages = ["ko", "en"];
  const typeFiles = [
    { key: "rarity", file: "rarity-type.json" },
    { key: "gearType", file: "gear-type.json" },
    { key: "stat", file: "stat-type.json" },
    { key: "effect", file: "effect-type.json" },
  ];

  // 1. Validate Locale Files Consistency
  for (const lang of languages) {
    const langDir = path.join(LOCALES_DIR, lang);
    if (!existsSync(langDir)) {
      mappingErrors.push(`- \`locales/${lang}\` 폴더가 존재하지 않습니다.`);
      continue;
    }

    // Item names
    const nameFile = path.join(langDir, "equipment-name.json");
    if (existsSync(nameFile)) {
      const nameMap: MappingData = readJsonSync(nameFile);
      for (const [id, name] of Object.entries(nameMap)) {
        if (!name || name.trim() === "") {
          mappingErrors.push(
            `- **[${lang}] ${id}**: 이름 번역 누락 (equipment-name.json)`,
          );
        }
      }
    }
  }

  // 2. Validate equipment.json and Type Mappings
  if (existsSync(EQUIPMENT_FILE)) {
    const equipment: EquipmentData = readJsonSync(EQUIPMENT_FILE);

    // Load all type maps for all languages
    const typeMaps: Record<string, Record<string, any>> = {};
    for (const lang of languages) {
      for (const tf of typeFiles) {
        const filePath = path.join(LOCALES_DIR, lang, tf.file);
        const mapKey = `${lang}:${tf.key}`;
        typeMaps[mapKey] = existsSync(filePath) ? readJsonSync(filePath) : {};
      }
    }

    for (const [id, item] of Object.entries(equipment)) {
      const missingFields: string[] = [];
      const typeMappingMissing: string[] = [];

      // Basic Field Checks
      const validRarities = [
        "Gold",
        "Purple",
        "Blue",
        "Green",
        "White",
        "Unknown",
      ];
      if (!item.rarity || !validRarities.includes(item.rarity)) {
        missingFields.push("`rarity` (invalid or missing)");
      } else {
        // Check rarity translation
        for (const lang of languages) {
          if (!typeMaps[`${lang}:rarity`][item.rarity]) {
            typeMappingMissing.push(`[${lang}] rarity:${item.rarity}`);
          }
        }
      }

      if (!item.level || item.level === 0)
        missingFields.push("`level` (is 0 or missing)");

      if (!item.gearType || item.gearType === "Unknown") {
        missingFields.push("`gearType` (is Unknown or missing)");
      } else {
        // Check gearType translation
        for (const lang of languages) {
          if (!typeMaps[`${lang}:gearType`][item.gearType]) {
            typeMappingMissing.push(`[${lang}] gearType:${item.gearType}`);
          }
        }
      }

      if (!item.set || item.set.trim() === "")
        missingFields.push("`set` (missing)");

      // Stats Validation
      if (!item.stats || item.stats.length !== 2) {
        missingFields.push("`stats` (count is not 2)");
      } else {
        for (const stat of item.stats) {
          for (const lang of languages) {
            if (!typeMaps[`${lang}:stat`][stat.type]) {
              typeMappingMissing.push(`[${lang}] stat:${stat.type}`);
            }
          }
        }
      }

      // Effects Validation
      if (!item.effects || item.effects.length !== 1) {
        // Enforce exactly 1 effect as per user request
        missingFields.push("`effects` (count is not 1)");
      } else {
        for (const effect of item.effects) {
          for (const lang of languages) {
            if (!typeMaps[`${lang}:effect`][effect.type]) {
              typeMappingMissing.push(`[${lang}] effect:${effect.type}`);
            }
          }
        }
      }

      if (missingFields.length > 0) {
        equipmentErrors.push(
          `- **${id}**: 정보 누락 (${missingFields.join(", ")})`,
        );
      }
      if (typeMappingMissing.length > 0) {
        mappingErrors.push(
          `- **${id}**: 타입 번역 누락 (${[...new Set(typeMappingMissing)].join(", ")})`,
        );
      }
    }
  } else {
    equipmentErrors.push("- `equipment.json` 파일이 존재하지 않습니다.");
  }

  // 3. Generate report.md
  let reportContent = "# 📋 데이터 검증 보고서 (Data Validation Report)\n\n";

  if (mappingErrors.length === 0 && equipmentErrors.length === 0) {
    reportContent += "✅ 모든 데이터가 정상적으로 수집/입력되었습니다.\n";
  } else {
    reportContent +=
      "데이터 검증 과정에서 미비한 점이 발견되었습니다. 아래 내용을 보완해 주세요.\n\n";

    if (mappingErrors.length > 0) {
      reportContent += "## 🌐 Locales (번역 및 타입 매핑 누락)\n";
      reportContent += mappingErrors.join("\n") + "\n\n";
    }

    if (equipmentErrors.length > 0) {
      reportContent += "## 🛠 equipment.json (정보 누락)\n";
      reportContent += equipmentErrors.join("\n") + "\n\n";
    }

    reportContent += "> [!IMPORTANT]\n";
    reportContent +=
      "> 위 누락된 정보들이 모두 채워져야 메인 브랜치에 병합이 가능합니다.\n";
  }

  writeFileSync(REPORT_FILE, reportContent);
  console.log(`[*] Validation report generated at: ${REPORT_FILE}`);

  if (mappingErrors.length > 0 || equipmentErrors.length > 0) {
    console.error(
      `[!] Validation failed. Found ${mappingErrors.length + equipmentErrors.length} issues.`,
    );
    process.exit(1);
  } else {
    console.log("[+] Validation successful!");
  }
}

validate();
