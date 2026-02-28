/**
 * Stat categories (4 core attributes).
 */
export type StatType = "STRENGTH" | "AGILITY" | "INTELLECT" | "WILL";

/**
 * Effect types collected from legacy samples (23 types).
 */
export type EffectType =
  | "ALL_SKILL_DMG"
  | "ALL_SKILL_DMG_DEALT_BONUS"
  | "ARTS_DMG_DEALT_BONUS"
  | "ARTS_INTENSITY"
  | "ATTACK"
  | "BASIC_ATTACK_DMG_BONUS"
  | "BATTLE_SKILL_DMG_BONUS"
  | "COMBO_SKILL_DMG"
  | "COMBO_SKILL_DMG_BONUS"
  | "CRIT_RATE"
  | "CRYO_AND_ELECTRIC_DMG"
  | "CRYO_AND_ELECTRIC_DMG_DEALT_BONUS"
  | "DMG_BONUS_VS._STAGGERED"
  | "FINAL_DMG_REDUCTION"
  | "HEAT_AND_NATURE_DMG_DEALT_BONUS"
  | "HP"
  | "MAIN_ATTRIBUTE"
  | "PHYSICAL_DMG_BONUS"
  | "SECONDARY_ATTRIBUTE"
  | "SUB-ATTR"
  | "TREATMENT_BONUS"
  | "ULTIMATE_DMG_BONUS"
  | "ULTIMATE_GAIN_EFFICIENCY";

export interface Stat {
  /** @TJS-type string */
  type: StatType;
  value: number;
}

export interface Effect {
  /** @TJS-type string */
  type: EffectType;
  value: number;
  isPercentage: boolean;
}

/**
 * Rarity levels as named strings.
 */
export type RarityType =
  | "Gold"
  | "Purple"
  | "Blue"
  | "Green"
  | "White"
  | "Unknown";

/**
 * Restricted gear type categories.
 */
export type GearType = "ARMOR" | "GLOVES" | "KIT" | "Unknown";

/**
 * Core equipment data structure.
 */
export interface Equipment {
  /** Item identifier */
  id: string;
  /** Rarity level */
  rarity: RarityType;
  /** Required level */
  level: number;
  /** Detailed gear type category */
  gearType: GearType;
  /** Set name the gear belongs to */
  set: string;
  /** Defense value (Armors only) */
  defense?: number;
  /** Primary stats */
  stats: Stat[];
  /** Special effects/passives */
  effects: Effect[];
  /** Direct URL to source image */
  imgUrl: string;
}

export interface EquipmentData {
  /** Map of equipment ID to its details */
  [id: string]: Equipment;
}

/**
 * Mapping data structure for translation.
 * Key: Item ID, Value: Translated Name
 */
export interface MappingData {
  [id: string]: string;
}
