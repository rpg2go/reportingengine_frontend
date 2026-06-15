# Project Handoff - Report Template Engine Front-End (Angular UI)

This document serves as the UI/UX architecture reference, implementation state, and configuration blueprint for all developer/agent interactions on this frontend workspace.

---

## 📌 Context Overview

- **Objective**: Build a premium, metadata-driven visual report layout builder.
- **Phase 1 (Completed)**: Standalone components, responsive CSS dark-theme layout, drag-and-drop row reordering, and step-based wizards.
- **Phase 2 (Completed)**: Real-time execution status badges (draft, published, running status tags) and run spinner integration (visual loading feedback during ingestion, layout compilation, and database execution queries).
- **Phase 3 (Completed)**: Jira-style immutable release state machine — three-tier lifecycle (`DRAFT` → `IN_REVIEW` → `PUBLISHED`), automatic version fork on publish, database composite-key migration for multi-version child records, and execution hub deduplication (one entry per `reportId`).

---

## 🛠️ Technology Stack

| Component | Technology | Version / Port / Details |
| :--- | :--- | :--- |
| **Frontend** | Angular | v21.2.0 (Standalone components, TypeScript) |
| **Styling** | CSS | Vanilla CSS deep-slate dark-mode design |
| **Test Runner** | Vitest | v3.x — Node-environment class-instance tests |
| **Production Server** | Nginx | Serves static assets on port `8080` |

---

## 📐 Key Design Decisions

1. **Modular Standalone Viewports**:
   - The application relies entirely on modern Angular standalone components to reduce boilerplate and maximize bundle optimization.

2. **Local Proxy Configurations**:
   - For development, all `/api/*` requests route through `proxy.conf.json` targeting the local backend at `http://127.0.0.1:8101` rather than `http://localhost:8101`. On Windows, this bypasses the IPv6-to-IPv4 fallback resolution lag (saving ~1-2 seconds per API roundtrip).

3. **Parallel Config Loading**:
   - The `ngOnInit` routine in `report-builder.ts` fires backend fetches concurrently via RxJS `forkJoin` (getting table schema metadata and report details in parallel). The UI perceived load equals `max(t_tables, t_config)` rather than `t_tables + t_config`.

4. **Decoupled API Paths**:
   - Service calls use relative paths (`/api/auth` and `/api/reports`) instead of hardcoded backend domain names, allowing the same build artifact to be deployed transparently behind an Nginx proxy or gateway (e.g. Cloud Run).

5. **Signal-Based Reactive State**:
   - The frontend leverages modern Angular signals (`signal`, `computed`, `model`, `input`, `output`) and `ChangeDetectionStrategy.OnPush` to manage application state reactively. This avoids unnecessary ZoneJS change detection cycles and drastically improves UI responsiveness.

6. **Formula Injection Sanitization & Validation**:
   - The UI blocks layout configurations (saving columns or rows) where labels start with formula triggers (`=`, `+`, `-`, `@`). Additionally, the datagrid export sanitizes pivoted cell metrics to prevent client-side formula execution inside spreadsheet programs.

7. **Dynamic Rainbow Parentheses Bracket Engine**:
   - Tracks nested bracket characters sequentially to determine their active nesting depth layer and wraps matching parentheses in high-visibility color-coded classes.
   - Synchronizes card container left-highlight borders and padding-aligned parentheses indicators based on nesting depth to visually map complex logical groupings.

8. **Jira-Style Immutable Release State Machine**:
   - Reports progress through three lifecycle states: `DRAFT` (mutable) → `IN_REVIEW` (locked for verification) → `PUBLISHED` (frozen and immutable).
   - Publishing triggers an automatic server-side fork that clones all child records (columns, rows, metrics, formulas, column maps) to a new `DRAFT` version (`v+1`).
   - The UI enforces state at the form level: `IN_REVIEW` and `PUBLISHED` reports disable all edit controls.
   - The Report Builder header renders contextual action buttons based on current status (Submit for Review / Reject / Publish / Fork).

9. **Execution Hub Deduplication**:
   - `GET /api/reports` uses `ReportRepository.findLatestVersionPerReport()` — a correlated JPQL subquery that returns only the max-version row per `reportId`. This prevents duplicate entries in the execution hub sidebar when a report has multiple versions.

10. **Composite Primary Key for Versioning**:
    - The `rpt_report` table uses a composite primary key `(report_id, version)`. All child tables (`rpt_column_def`, `rpt_row`, `rpt_row_metric`, `rpt_row_formula`, `rpt_row_column_map`) include a `version` column and were migrated (migration `015`) to use composite unique constraints incorporating `version`, replacing the old single-column unique indexes.

---

## 📂 Codebase Tour

Use the links below to navigate directly to the frontend source files:

### Frontend Component Views (`src/app/components/`)

- [login.ts](src/app/components/login.ts) — Secure login viewport with credential validation.
- [dashboard.ts](src/app/components/dashboard.ts) — Catalog overview with status filter tabs and multipart spreadsheet uploader.
- [report-builder.ts](src/app/components/report-builder.ts) — Interactive drag-and-drop report layout builder with live SQL preview and lifecycle action buttons (Submit/Reject/Publish/Fork).
- [report-detail.ts](src/app/components/report-detail.ts) — Read-only configuration inspector with status badge and Excel download panel.
- [execution-hub.ts](src/app/components/execution-hub.ts) — Reports Execution Hub to run reports and view calculated datagrids (one entry per reportId, latest version).
- [semantic.ts](src/app/components/semantic.ts) — Interactive DWH logical explore/join metadata browser.
- [sidebar.ts](src/app/components/sidebar.ts) — Collapsible responsive navigation bar.
- [field-picker.ts](src/app/components/field-picker.ts) — Fact and dimension field picker modal.
- [row-filter.ts](src/app/components/row-filter.ts) — Query condition filter configuration component.
- [row-condition-group.ts](src/app/components/row-condition-group.ts) — Recursive condition group sub-component used within row-filter.
- [granularity-picker.ts](src/app/components/granularity-picker.ts) — Group-by dimension breakout configuration (ControlValueAccessor).
- [calendar-picker.ts](src/app/components/calendar-picker.ts) — DWH-aware date selection popover (only available reporting dates are selectable).
- [value-picker.ts](src/app/components/value-picker.ts) — Autocomplete lookup dropdown component.

### Directives & Guards & Interceptors & Pipes

- [col-resizer.directive.ts](src/app/directives/col-resizer.directive.ts) — Directive for adjusting datagrid column widths.
- [auth.guard.ts](src/app/guards/auth.guard.ts) — Router guard to secure authenticated routes.
- [auth.interceptor.ts](src/app/interceptors/auth.interceptor.ts) — Automatically injects Basic Auth header into API requests.
- [bracket-rainbow.pipe.ts](src/app/pipes/bracket-rainbow.pipe.ts) — Tokenizes logic preview parenthetical characters to render nested rainbow bracket highlight spans.

### Data & State Services (`src/app/services/`)

- [auth.service.ts](src/app/services/auth.service.ts) — Handles user sessions, local storage, and Auth header interceptor logic.
- [report.service.ts](src/app/services/report.service.ts) — Manages DTO mutations, file uploads, schema fetching, report execution, and all lifecycle transition endpoints (submitReview, rejectReport, publishReport, forkReport, getReportVersions).

### Utilities (`src/app/utils/`)

- [date-formatter.ts](src/app/utils/date-formatter.ts) — Safe date parsing, normalization, formatting helpers, and rolling sub-column expansion logic.
- [report-parser.ts](src/app/utils/report-parser.ts) — Expression parser/serializer for filters and measures.
- [search-analyzer.ts](src/app/utils/search-analyzer.ts) — Fuzzy matcher and token weight analyzer for searches.

---

## 🚀 How to Bootstrap the Dev Environment

### 1. Pre-requisites

Ensure you have **Node.js v24+** and **npm** installed.

### 2. Install Dependencies

The `--legacy-peer-deps` flag is required due to a version conflict between `vitest ^3.0.0` and `@angular/build ^21.2.12`:

```bash
npm install --legacy-peer-deps
```

### 3. Launch Development Server

Starts Angular CLI on port `4200` with proxy rules applied:

```bash
npm start
```

*Note: Make sure your backend service is running locally on port `8101`. Default credentials: `admin` / `password`.*

### 4. Build for Production

To generate the optimized static assets under `dist/frontend/browser/`:

```bash
npm run build
```

### 5. Run Tests

```bash
npm test
```

---

## 🌐 Production Nginx Deployment

The Angular build is containerized using the [Dockerfile](Dockerfile) which runs Nginx and serves static assets.

- **Dynamic Proxying**: Nginx acts as a reverse proxy forwarding `/api` calls to the backend.
- **Backend Host Configuration**: At startup, `run.sh` updates `nginx.conf.template` with the backend environment host `BACKEND_HOST`, resolving upstream gateway timeouts.

---

## 🗄️ Database Schema Notes (Backend)

All child tables include a `version` column as part of their composite key. Migration `015_alter_column_def_constraints.sql` dropped old single-column unique constraints and replaced them with versioned composite constraints:

| Table | Composite Unique Key |
|-------|---------------------|
| `rpt_column_def` | `(report_id, version, col_id)` |
| `rpt_row` | `(report_id, version, row_id)` |
| `rpt_row_metric` | `(report_id, version, row_id, measure_id)` |
| `rpt_row_formula` | `(report_id, version, row_id)` |
| `rpt_row_column_map` | `(report_id, version, row_id, col_id)` |
