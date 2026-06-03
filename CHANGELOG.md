# CHANGELOG

All significant changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] — 2026-06-03

### Changed

**SAMPLING_POINTS tab — full restructuring**

Migration script `Migration_2026_06.gs` (one-time, idempotent) performs three operations:

#### 1. Removed 28 legacy sampling points
- Points removed: all `*-PAR-PIS-*` combined wall/floor points (replaced by separate PAR and PISO points), plus legacy `PREP-04-*` and `ENV-04-*` points being reorganized.

#### 2. Renamed 5 sectors
| Old name | New name |
|---|---|
| SD 1 | Spray Dryer 1 |
| SD 2 | Spray Dryer 2 |
| SD 3 | Spray Dryer 3 |
| SD 4 | Spray Dryer 4 |
| SD Piloto | Spray Dryer Piloto |

#### 3. Added 111 new sampling points across 17 areas
- Sala de Preparo 1–3 (9 points)
- Sala de Envase 1–3 (14 points)
- Spray Dryer 1–4 + Piloto (44 points)
- Homogeneização (11 points)
- Extração/Evaporação I–II (24 points)
- Flash Dryer (6 points)
- P&D (6 points — new area)
- Sala Alergênicos (5 points — new area)

#### Frequency standardization
All frequency values now use English labels to match Schedule.gs validation:
`Mensal → Monthly`, `Bimestral → Bimonthly`, `Trimestral → Quarterly`, `Semestral → Biannual`, `Quinzenal → Biweekly`.

**Note:** `Biweekly` is not yet supported by `_calculatePlannedDates()` in Schedule.gs. A new case must be added before the next schedule generation. Affects 4 points: EXT-I/II-BOM-SUC-01 and EXT-I/II-PAS-01.

#### Column structure updated
SAMPLING_POINTS now uses 10 columns:
`POINT_ID | Sector | Zone | Area | Limit_MA | Limit_BL | Limit_SAL | Active | Full_Name | Frequency`

Previous 15-column structure (with Sample_Type, Assays, Collection_Method, Inactive_Date, Inactive_Reason) was simplified. `SamplingPoints.gs` may need corresponding update to reflect the new column indices.

---

## [0.2.1] — 2026-06-02

### Fixed

**UTC timezone date serialization — Collection_Date gravava dia anterior**

Google Apps Script serializa objetos `Date` em UTC ao passá-los para `appendRow()`.
No fuso UTC-3 (America/Sao_Paulo), uma data criada à meia-noite local era interpretada
como 21:00 do dia anterior em UTC, e o Sheets gravava o dia errado.

Duas correções foram aplicadas:

#### Code.gs — `_extractFormData()`

- **Causa raiz:** O Google Forms Date picker retorna a data via `getResponse()` no
  formato ISO `YYYY-MM-DD` (com traço). O parser só tratava `DD/MM/YYYY` (com barra)
  via `split('/')`. Com apenas 1 parte, caía no fallback `new Date("YYYY-MM-DD")`,
  que o V8 interpreta como meia-noite UTC → 21:00 do dia anterior em UTC-3.
- **Correção:** Adicionado parsing explícito para formato ISO (`split('-')`), com
  construção de Date ao meio-dia (`12, 0, 0`) em todos os caminhos.
- **Safety net:** `setHours(12, 0, 0, 0)` aplicado após qualquer branch de parsing,
  garantindo que offsets negativos nunca cruzem a fronteira do dia.

#### Results.gs — `writeResult()`

- **Causa raiz:** `record.collectionDate` (objeto Date) era passado diretamente para
  `appendRow()`, onde o Sheets serializa em UTC.
- **Correção:** Adicionado type guard com `formatDate()` para converter Date válido
  em string `DD/MM/YYYY` antes da gravação. Valores não-Date passam inalterados
  para evitar quebra por tipo inesperado.

```javascript
// Antes (gravava dia anterior em UTC-3):
record.collectionDate,  // Collection_Date

// Depois:
(record.collectionDate instanceof Date && !isNaN(record.collectionDate))
  ? formatDate(record.collectionDate)
  : record.collectionDate,  // Collection_Date
```

### Verificação

- Submetido Forms com data 02/06/2026 após fix.
- Confirmado no RESULTS: `Collection_Date = 02/06/2026` ✓
- Confirmado: `COLLECTION_ID = UNSCHEDULED-02/06/2026` ✓

### Backlog registrado
- Importação de dados históricos (2025 e 2026 pré-sistema): pendente para após release 1.0.0. Ver CONTEXT.md para detalhes da abordagem.

---

## [0.2.0] — 2026-05-29

### Added

**All 11 Apps Script modules implemented**

- `Utils.gs` — utility functions, holiday logic via HOLIDAYS sheet tab
  (no hardcoded dates — editable annually by quality team)
- `Config.gs` — parameter access layer, SHEET_NAMES constants, internal cache
- `SamplingPoints.gs` — master table access, deactivation requires mandatory
  date and justification fields (ALCOA++ compliance)
- `Calculations.gs` — pure logic module (no Sheets I/O): status classification,
  upward trend detection, recurrence count, action type and recipient
  level determination. CAPA triggered on 3rd NC in 6-month window,
  Critical result, or Salmonella detection
- `Log.gs` — structured event logging to SYSTEM_LOG tab
- `Actions.gs` — corrective action lifecycle with automatic deadlines:
  Resample in business days (Resample_Deadline_Days),
  CAPA in calendar days (CAPA_Deadline_Days)
- `Notifications.gs` — pure module (no Sheets I/O): HTML email alerts
  for NC, trend, overdue collections, overdue actions,
  annual holiday reminder, and monthly report delivery
- `Schedule.gs` — annual schedule generation from SAMPLING_POINTS,
  overdue collection detection, collection-to-schedule linking by month/year
- `Results.gs` — 13-step orchestration flow (validate → calculate → write
  → schedule → trend → recurrence → action → notify → log),
  immutable result log, correction records with recalculated status
- `Report.gs` — monthly PDF with KPI cards and NC detail table,
  auto Drive folder structure (Environmental Monitoring Reports/YEAR/)
- `Code.gs` — entry point: onFormSubmit trigger, daily check (overdue
  collections + actions + holiday reminder), monthly report trigger,
  annual schedule trigger, programmatic trigger installation,
  dev test utility

**Business logic refinements**

- CAPA opens only on 3rd NC in 6-month window, Critical, or Salmonella.
  Single NC never opens CAPA directly — avoids excessive overhead
  for isolated events that may not represent systemic failure
- detectRecurrence() returns NC count (number) instead of boolean,
  enabling graduated escalation: 2nd NC alerts manager, 3rd NC opens CAPA
- CAPA deadline in calendar days, Resample deadline in business days
- Annual holiday reminder: daily email from Jan 1st until HOLIDAYS tab
  contains at least one entry for the current year

### Próximos passos

- [ ] Create Google Sheets file with all 6 tabs + HOLIDAYS tab
- [ ] Create Google Forms for data entry
- [ ] Link Forms to Sheets
- [ ] clasp push and initial tests
- [ ] Populate SAMPLING_POINTS tab with real data
- [ ] Populate HOLIDAYS tab (2025 and 2026)
- [ ] Populate CONFIG tab with operational parameters
- [ ] End-to-end tests with real data
- [ ] Connect Looker Studio dashboard
- [ ] Revise PS.LAB. 02 to Rev. 05
- [ ] Final documentation and v1.0.0 release

---

## [0.1.0] — 2026-05-27

### Added

**Architecture and initial documentation**

- Problem definition: environmental monitoring programs in food manufacturing
  facilities commonly operate with dispersed data, manually calculated
  conformity status, no objective trend criteria, and no automation for
  non-conformance response.

- Stack decision: Google Sheets + Apps Script + Looker Studio, with future
  integration path to external systems via Google Sheets API v4
  (REST, no proprietary dependencies).

- Complete database schema (6 tabs):
  - `SAMPLING_POINTS` — master reference table for points, limits, and frequencies
  - `SCHEDULE` — planned vs actual collections, auto-generated by script
  - `RESULTS` — immutable log, one row per assay per collection
  - `ACTIONS` — CAPAs, resamples, and observations linked to origin result
  - `CONFIG` — editable system parameters, no code changes needed for setup
  - `SYSTEM_LOG` — Apps Script event audit trail

- Modular architecture of 11 `.gs` files, each with single responsibility.

- Business logic defined: 4-level status classification, trend detection rules,
  5 program KPIs, notification routing by status level.

- Design principles: single responsibility, no magic numbers, pure logic
  separation, fail-safe defaults, extensibility via SAMPLING_POINTS tab.

**Design decisions recorded**

- Alert threshold (70%) and Critical threshold (300%) with auditable
  technical justification.
- Unique point IDs to eliminate naming inconsistencies.
- Immutable RESULTS log — corrections via new rows, never edits.
- Seasonality rule (T3) present in architecture, inactive until
  2-year historical baseline is available.

---

## Versioning convention

- `0.x.0` — pre-production development phases
- `1.0.0` — system in production, replacing manual records
- `1.x.0` — new features added in production
- `1.0.x` — bug fixes in production