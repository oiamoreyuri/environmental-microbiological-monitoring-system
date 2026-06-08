# Environmental Monitoring System

Automated environmental microbiological monitoring system built with Google Apps Script, Google Sheets, Google Forms, and Looker Studio.

Developed as part of a Food Safety Management System (FSMS) compliant with **FSSC 22000 v6** and **ISO 22000:2019**.

---

## Problem

Food manufacturing facilities operating under FSSC 22000 are required to maintain an environmental monitoring program covering microbiological indicators across production zones. Common pain points in smaller operations include:

- Results recorded manually in spreadsheets with no single source of truth
- Conformity status filled in by hand, prone to human error
- No objective criteria for trend analysis
- No automatic notifications when non-conformances occur
- Reports generated manually without standardization

This system solves all of the above at zero infrastructure cost, running entirely within Google Workspace.

---

## Solution overview

```
Google Forms (data entry — mobile-friendly)
        ↓
Apps Script — onFormSubmit trigger
        ↓
┌─────────────────────────────────────────┐
│           Google Sheets                 │
│                                         │
│  SAMPLING_POINTS   ← master table       │
│  SCHEDULE          ← planned vs actual  │
│  RESULTS           ← immutable log      │
│  ACTIONS           ← CAPAs & resamples  │
│  CONFIG            ← system parameters  │
│  SYSTEM_LOG        ← audit trail        │
└─────────────────────────────────────────┘
        ↓                    ↓
  Email notifications   Looker Studio
                         (dashboard)
        ↓
  Monthly PDF report
  (saved to Drive)
```

---

## Tech stack

- **Google Apps Script** — business logic, automations, triggers
- **Google Sheets** — structured database
- **Google Forms** — field data entry interface
- **Looker Studio** — trend analysis dashboard
- **Google Drive** — PDF report storage
- **clasp** — local development and version control bridge
- **VS Code** — code editor
- **GitHub** — version control

---

## Module architecture

Each `.gs` file has a single responsibility. No module accesses Sheets by tab name directly — always through the module responsible for that tab.

| Module | Responsibility |
|---|---|
| `Code.gs` | Entry point, triggers, WebApp handler |
| `Config.gs` | Reads CONFIG tab, exposes system constants |
| `SamplingPoints.gs` | Reads and validates SAMPLING_POINTS |
| `Schedule.gs` | Generates and updates the sampling schedule |
| `Results.gs` | Receives form data, writes to RESULTS |
| `Calculations.gs` | Pure logic: status, percentage, trend, recurrence |
| `Actions.gs` | Opens and manages corrective actions |
| `Notifications.gs` | Composes and sends email alerts |
| `Report.gs` | Generates monthly PDF, saves to Drive |
| `Log.gs` | Writes events to SYSTEM_LOG |
| `Utils.gs` | Reusable utility functions, no external dependencies |
| `Dev.gs` | Development and testing utilities (not triggered) |

**Design rule:** `Calculations.gs` and `Notifications.gs` are pure modules — they receive data as parameters and return results. They never access Sheets or external services directly. This makes them easy to test and maintain independently.

---

## Result classification logic

| Status | Criterion | Automatic action |
|---|---|---|
| Conforming | < 70% of limit | Record. No action. |
| Alert | 70% to 99% of limit | Mandatory observation recorded. |
| Non-Conforming | ≥ 100% of limit | Resample within 5 business days. Auto email. |
| Critical | ≥ 300% of limit | Mandatory CAPA. Email to full chain. |

**Salmonella:** any detection (Present) is automatically Critical regardless of threshold.

---

## Trend detection rules

| Rule | Condition | Action |
|---|---|---|
| Upward trend | 3 consecutive increasing results at the same point | Internal alert + sanitation review |
| Recurrence | 2 NCs at the same point within 6 months | Mandatory CAPA regardless of resample result |

---

## Program KPIs

| KPI | Target |
|---|---|
| Overall conformity rate | ≥ 95% |
| Schedule adherence | ≥ 90% |
| Recurrence rate | 0% |
| Average NC response time | ≤ 5 business days |
| Corrective action effectiveness | ≥ 90% |

---

## Applicable standards

- FSSC 22000 v6
- ISO 22000:2019 (clauses 8.8, 9.3)
- ISO/TS 22002-1:2009 (clause 12)
- ALCOA++ (data integrity principles)
- 21 CFR Part 11 (electronic records traceability)

---

## Getting started

```bash
# Clone the repository
git clone https://github.com/oiamoreyuri/environmental-microbiological-monitoring-system.git
cd environmental-microbiological-monitoring-system

# Install clasp
npm install -g @google/clasp

# Authenticate
clasp login

# Link to your Apps Script project
clasp clone <YOUR_SCRIPT_ID>

# Push changes
clasp push
```

### Configuration

All operational parameters are stored in the **CONFIG tab** of the Sheets file — no code changes needed for setup. Copy `config.example.json` to understand the required parameters before populating the CONFIG tab.

Sampling points, zones, limits, and frequencies are defined in the **SAMPLING_POINTS tab**. The system reads these at runtime — adding a new point requires only a new row in that tab.

---

## Repository structure

```
environmental-monitoring-system/
│
├── .clasp.json
├── .gitignore
├── README.md
├── CONTEXT.md
├── CHANGELOG.md
├── config.example.json     ← parameter reference (no real values)
│
└── src/
    ├── Code.gs
    ├── Config.gs
    ├── SamplingPoints.gs
    ├── Schedule.gs
    ├── Dev.gs
    ├── Results.gs
    ├── Calculations.gs
    ├── Actions.gs
    ├── Notifications.gs
    ├── Report.gs
    ├── Log.gs
    └── Utils.gs
```

---

## Status do projeto

**Versão atual:** 0.4.0

### Concluído
- Sistema completo: Forms → Apps Script → Sheets → Looker Studio
- 190 pontos de amostragem em 18 setores
- Cronograma 2026 gerado (1.416 entradas)
- Dados históricos 2022–2026 importados (5.589 registros)
- Dashboard Looker Studio (3 páginas)
- Grace period de 7 dias para alertas de atraso
- Lembretes de coleta por e-mail (semanal + diário)
- PS.LAB.02 Rev. 05 redigido

### Pendente
- Alias numérico sequencial nos pontos (P001, P002...)
- Importação manual de 152 registros com POINT_ID em branco
- FOR.PS.LAB.02-02 (planilha de contingência)
- Backup diário CSV para rede local
- Cadastro de pontos SAL + atualização do Forms
- Release 1.0.0

### Roadmap

- [ ] Formulário HTML offline com sincronização automática para contingência de
  indisponibilidade de internet (Service Worker + IndexedDB + endpoint doPost()
  no Apps Script). Estimativa: 19–29h. Pré-requisito: estabilização do sistema
  após certificação FSSC 22000 Stage 2.

---

## License

MIT License — free to use, adapt, and distribute with attribution.
