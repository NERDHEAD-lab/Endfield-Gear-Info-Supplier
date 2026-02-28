import puppeteer from "puppeteer-core";
import * as chromeLauncher from "chrome-launcher";
import fs from "fs-extra";
const {
  ensureDirSync,
  existsSync,
  readJsonSync,
  writeJsonSync,
  readdirSync,
  removeSync,
  statSync,
  createWriteStream,
  writeFileSync,
} = fs;
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import * as TJS from "typescript-json-schema";
import { EquipmentData, MappingData, RarityType } from "./types/equipment.js";

const RARITY_MAP: Record<number, RarityType> = {
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
const EQUIPMENT_FILE = path.join(DATA_DIR, "equipment.json");
const LOCALES_DIR = path.join(__dirname, "..", "locales");
const EN_LOCALE_FILE = path.join(LOCALES_DIR, "en", "equipment-name.json");
const KO_LOCALE_FILE = path.join(LOCALES_DIR, "ko", "equipment-name.json");

// Ensure data dir exists
ensureDirSync(DATA_DIR);

function normalizeKey(str: string): string {
  /**
   * Normalize item name to a standard ID format.
   * "Bonekrusha Figurine T1" -> "BONEKRUSHA_FIGURINE_T1"
   */
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generate JSON Schemas based on TypeScript interfaces.
 */
async function generateSchemas() {
  console.log("[*] Generating JSON Schemas for data validation...");
  const settings: TJS.PartialArgs = {
    required: true,
  };
  const compilerOptions: TJS.CompilerOptions = {
    strictNullChecks: true,
    esModuleInterop: true,
  };

  // TJS requires the path to the TS file
  const program = TJS.getProgramFromFiles(
    [path.resolve(__dirname, "types/equipment.ts")],
    compilerOptions,
  );

  const equipmentSchema = TJS.generateSchema(
    program,
    "EquipmentData",
    settings,
  );

  if (equipmentSchema) {
    writeJsonSync(
      path.join(DATA_DIR, "equipment.schema.json"),
      equipmentSchema,
      { spaces: 2 },
    );
    console.log("-> Created equipment.schema.json");
  }
}

async function scrapeData() {
  const chromePath = chromeLauncher.Launcher.getInstallations()[0];
  if (!chromePath) throw new Error("No Chrome installation found");

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("[1/4] Navigating to SKPort...");
  await page.goto("https://wiki.skport.com/endfield/catalog?typeMainId=1", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Switch Language to English
  await page.evaluate(async () => {
    const spans = Array.from(document.querySelectorAll("span, div, p"));
    const langBtn = spans.find(
      (el) =>
        (el.textContent || "").trim().includes("한국어") &&
        el.children.length === 0,
    );
    if (langBtn) {
      const btn =
        langBtn.closest("button") ||
        langBtn.closest('div[class*="lang"]') ||
        langBtn.parentElement;
      if (btn instanceof HTMLElement) btn.click();
    }
  });

  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(async () => {
    const spans = Array.from(document.querySelectorAll("span, div, p, li"));
    const engBtn = spans.find(
      (el) => (el.textContent || "").trim() === "English",
    );
    if (engBtn instanceof HTMLElement) engBtn.click();
  });

  await new Promise((r) => setTimeout(r, 5000));
  console.log("[2/4] Switched to English, moving to Gear tab...");

  // Accept Cookies
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const allowBtn = buttons.find((b) =>
      (b.textContent || "").trim().includes("Allow all"),
    );
    if (allowBtn) allowBtn.click();
  });

  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll("div, span, a"));
    const gearLink = spans.find(
      (el) =>
        (el.textContent || "").trim() === "Gear" && el.children.length === 0,
    );
    if (gearLink instanceof HTMLElement) gearLink.click();
  });

  console.log("[3/4] Fetching equipment data...");
  await new Promise((r) => setTimeout(r, 4000));

  // Infinite scroll to load all items
  let previousHeight: number = await page.evaluate(
    () => document.body.scrollHeight,
  );
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((resolve) => setTimeout(resolve, 600));
    let newHeight: number = await page.evaluate(
      () => document.body.scrollHeight,
    );
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
  }

  const extracted = await page.evaluate(() => {
    const results: any[] = [];
    const elements = document.querySelectorAll("*");

    elements.forEach((el) => {
      const bg = window.getComputedStyle(el).backgroundImage;
      let src = "";
      if (bg && bg !== "none" && bg.includes("url")) {
        src = bg.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
      } else if (el instanceof HTMLImageElement && el.src) {
        src = el.src;
      }

      if (
        !src ||
        src.includes("data:image") ||
        !src.includes("http") ||
        src.includes("skport-fe-static") ||
        src.includes("favicon")
      )
        return;

      let enName = "";
      let rarity = null;
      let parent: HTMLElement | null =
        el instanceof HTMLElement ? el : el.parentElement;

      // Search for name and metadata in parent tree
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        const t = parent.innerText;

        if (
          t &&
          t.length > 2 &&
          t.length < 100 &&
          !t.includes("Allow all") &&
          !t.includes("English")
        ) {
          enName = t.split("\n")[0].trim();

          const imgs = parent.querySelectorAll("img");
          imgs.forEach((img) => {
            if (img.src.includes("rarity")) {
              const match = /rarity_(\d)/.exec(img.src);
              if (match) rarity = Number.parseInt(match[1]);
            }
          });
          break;
        }
        parent = parent.parentElement;
      }

      if (enName && src && enName.length < 50) {
        results.push({
          name_en: enName.replace("Equipment Type", "").trim(),
          img: src,
          rarity: rarity || 0,
        });
      }
    });

    return results;
  });

  await browser.close();

  const uniqueItems: {
    [key: string]: { en_name: string; img: string; rarity: RarityType };
  } = {};
  extracted.forEach((item) => {
    if (item.name_en && item.img) {
      const key = item.name_en
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      uniqueItems[key] = {
        en_name: item.name_en,
        img: item.img,
        rarity: RARITY_MAP[item.rarity] || "Unknown",
      };
    }
  });

  return uniqueItems;
}

async function runBuilder() {
  const isForce = process.argv.includes("--force");

  try {
    const { execSync } = await import("node:child_process");
    try {
      if (!existsSync(DATA_DIR) || readdirSync(DATA_DIR).length === 0) {
        console.log(
          "[*] Trying to fetch existing data from gh-pages branch...",
        );

        let repoUrl = "";
        const pkgPath = path.join(__dirname, "..", "package.json");
        if (existsSync(pkgPath)) {
          const pkg = readJsonSync(pkgPath);
          if (pkg.repository && pkg.repository.url) {
            repoUrl = pkg.repository.url
              .replace("git+", "")
              .replace("git://", "https://");
          }
        }

        if (!repoUrl) {
          repoUrl = execSync("git config --get remote.origin.url", {
            encoding: "utf-8",
          }).trim();
        }

        if (repoUrl) {
          execSync(
            `git clone --depth 1 --branch gh-pages ${repoUrl} "${DATA_DIR}"`,
            { stdio: "ignore" },
          );
          console.log("[*] Successfully restored previous data layer.");
          if (existsSync(path.join(DATA_DIR, ".git"))) {
            removeSync(path.join(DATA_DIR, ".git"));
          }
        }
      }
    } catch (e) {
      console.log("[-] No existing branch data found. Starting fresh.");
    }

    const scrapedData = await scrapeData();
    const scrapedKeys = Object.keys(scrapedData);
    console.log(`[4/4] Scraped ${scrapedKeys.length} unique items.`);

    if (scrapedKeys.length === 0) {
      console.warn(
        "[!] No data scraped. Skipping updates to avoid clearing files.",
      );
      return;
    }

    const equipment: EquipmentData = existsSync(EQUIPMENT_FILE)
      ? readJsonSync(EQUIPMENT_FILE)
      : {};

    const enMap: MappingData = existsSync(EN_LOCALE_FILE)
      ? readJsonSync(EN_LOCALE_FILE)
      : {};
    const koMap: MappingData = existsSync(KO_LOCALE_FILE)
      ? readJsonSync(KO_LOCALE_FILE)
      : {};

    let addedEq = 0;
    for (const [id, data] of Object.entries(scrapedData)) {
      // 1. Sync i18n mapping
      if (!enMap[id]) enMap[id] = data.en_name;
      if (koMap[id] === undefined) koMap[id] = "";

      // 2. Sync equipment.json
      if (!equipment[id]) {
        console.warn(
          `[!] New item detected: ${id}. Added to equipment.json with default values.`,
        );
        equipment[id] = {
          id: id,
          imgUrl: data.img,
          rarity: data.rarity,
          level: 0,
          gearType: "Unknown",
          set: "",
          stats: [],
          effects: [],
        };
        addedEq++;
      } else {
        if (!equipment[id].imgUrl || isForce) equipment[id].imgUrl = data.img;
        if (!equipment[id].rarity || equipment[id].rarity === "Unknown")
          equipment[id].rarity = data.rarity;

        // name synchronization no longer needed as field is removed
      }
    }

    // 3. Warn about items in equipment.json that were not found in this scrape
    const scrapedIds = new Set(Object.keys(scrapedData));
    for (const id of Object.keys(equipment)) {
      if (!scrapedIds.has(id)) {
        console.warn(
          `[!] Item in equipment.json not found on wiki: ${id}. It remains in the file but might be deprecated.`,
        );
      }
    }

    ensureDirSync(path.join(LOCALES_DIR, "en"));
    ensureDirSync(path.join(LOCALES_DIR, "ko"));
    writeJsonSync(EN_LOCALE_FILE, enMap, { spaces: 2 });
    writeJsonSync(KO_LOCALE_FILE, koMap, { spaces: 2 });
    writeJsonSync(EQUIPMENT_FILE, equipment, { spaces: 2 });
    console.log(
      `-> Updated locales and equipment.json. Added ${addedEq} items.`,
    );

    // 3. Download images
    const ASSETS_DIR = path.join(DATA_DIR, "assets");
    ensureDirSync(ASSETS_DIR);

    console.log(`[+] Synchronizing image assets... (Force: ${isForce})`);
    let downloadedCount = 0;
    let skippedCount = 0;

    for (const [id, data] of Object.entries(scrapedData)) {
      if (!data.img) continue;

      let url = data.img;
      if (url.startsWith("//")) url = "https:" + url;
      else if (url.startsWith("/")) url = "https://assets.skport.com" + url;
      url = url.split("?")[0];

      const dest = path.join(ASSETS_DIR, `${id}.webp`);

      if (!isForce && existsSync(dest) && statSync(dest).size > 0) {
        skippedCount++;
        continue;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const options = {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
              Referer: "https://wiki.skport.com/",
            },
          };
          https
            .get(url, options, (res) => {
              if (res.statusCode !== 200)
                return reject(new Error(`Status Code: ${res.statusCode}`));
              const file = createWriteStream(dest);
              res.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve();
              });
            })
            .on("error", reject);
        });
        downloadedCount++;
        process.stdout.write("+");
      } catch (err) {
        process.stdout.write("x");
      }
    }

    console.log(
      `\n-> Image sync complete. Downloaded: ${downloadedCount}, Skipped: ${skippedCount}`,
    );

    // 4. Generate Schemas
    await generateSchemas();

    console.log("Build complete! Data is ready in the ./data directory.");
  } catch (err) {
    console.error("Build Error:", err);
    process.exit(1);
  }
}

runBuilder();
