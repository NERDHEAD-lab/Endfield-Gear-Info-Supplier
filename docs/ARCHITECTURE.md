# Endfield Gear Info Supplier Architecture

## 1. Project Context

- **Description**: 엔드필드(Endfield) 장비 정보를 위키(wiki.skport.com)에서 스크래핑하여 JSON 형식과 구조화된 데이터(이미지 포함)로 제공하는 자동화 도구입니다.
- **Tech Stack**:
  - Node.js (Runtime)
  - TypeScript (Language, ESNext)
  - Puppeteer (Web Scraping)
  - fs-extra (File Operations)
  - tsx (Direct TS execution)
- **Build & Management Commands**:
  - `npm run build`: 기본 빌드 및 스크래핑 실행.
  - `npm run validate`: 데이터 무결성 검증 및 `report.md` 생성.
  - `npm run migrate`: 레거시 데이터 마이그레이션.
  - `npx tsx scripts/sync_type_translations.ts`: 스키마 기반 타입 번역 동기화.

## 2. Directory Structure

- `/src/`: 핵심 소스 코드.
  - `types/equipment.ts`: 전역 타입 정의 및 스키마의 Source of Truth.
  - `build.ts`: 메인 빌드 로직 및 스키마 생성.
  - `validate.ts`: 데이터 및 i18n 정합성 검증 엔진.
- `/scripts/`: 데이터 관리 및 동기화 유틸리티 스크립트.
- `/locales/`: 다국어(i18n) 데이터 디렉터리.
  - `{en,ko}/equipment-name.json`: 장비 이름 매핑.
  - `{en,ko}/{stat,effect,rarity,gear}-type.json`: 시스템 유틸리티 타입 번역.
- `/data/`: 최종 생성 데이터.
  - `equipment.json`: 장비 세부 정보 (Map 구조).
  - `*.schema.json`: TJS 기반 JSON 스키마 파일.
  - `/assets/`: 장비 이미지 저장소.

## 3. Architecture Decision Records (ADR)

- **(2026-02-27) TypeScript 마이그레이션**: 타입 안정성 확보를 위해 TS 도입.
- **(2026-02-28) i18n 시스템 및 스키마 강화**:
  - 장비 이름과 시스템 타입(Stat, Effect 등)을 별도 로케일 파일로 분리하여 관리 효율성 증대.
  - `StatType`을 실제 `stats` 필드 기반 4종(`STRENGTH`, `AGILITY`, `INTELLECT`, `WILL`)으로 엄격히 제한.
  - `GearType`에 `Unknown` 상태를 명시적으로 허용하여 데이터 누락을 검증 단계에서 포착 가능하도록 설계.
  - `EffectType`은 실제 데이터 전수 조사를 통해 23종으로 확정.

## 4. Coding Conventions

- **언어**: TypeScript ESNext.
- **모듈 시스템**: ES Modules (`type: "module"`).
- **데이터 원칙**: No Lazy Coding. 모든 장비 데이터는 `Equipment` 인터페이스를 엄격히 준수하며, 누락 시 `Unknown` 상태 유지를 원칙으로 함 (강제 기본값 할당 지양).

## 5. Documentation Map

- `README.md`: 프로젝트 사용법 및 설정 가이드.
- `docs/ARCHITECTURE.md`: 시스템 설계 및 기술 결정 이력 (본 문서).
- `report.md`: 검증 결과 보고서 (자동 생성).
