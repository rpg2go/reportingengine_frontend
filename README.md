# Reporting Platform — Angular Frontend

A premium, metadata-driven visual report layout builder built with **Angular 21 (standalone components)**. It serves as the interactive UI for the Reporting Engine, connecting to a Spring Boot Java backend over a proxied REST API.

The interface features a **deep-slate dark-mode design** with real-time reactive state via Angular Signals, drag-and-drop layout editing, and a Jira-style immutable release pipeline for report versioning.

---

## 🎨 Key Features & Components

The application is structured into standalone components routed lazily under [app.routes.ts](src/app/app.routes.ts):

### 1. Sign In (`/login`) — [LoginComponent](src/app/components/login.ts)

- Secure credential form with Basic Auth header injection.
- Redirects authenticated users to the dashboard automatically.

### 2. Reports Catalog (`/dashboard`) — [ReportsCatalogComponent](src/app/components/reports-catalog.ts)

- Browse report templates in a **Dual-Pane Split Workspace Layout** with a fixed 300px explorer left rail.
- Organize items into collapsible groups: ⭐ **Favorite Reports** (supporting drag-reorder and pin toggling) and 📁 **All Catalog Templates** (searchable list).
- Redesigned Right Canvas zone showing selected report details with explicit status badges, version labels, and monospaced data source table paths.
- Upload and ingest new Excel report templates (`.xlsx`) via file picker.
- Dynamic auto-refresh of catalog and details inspect views upon ingestion.

### 3. Report Builder (`/reports/new/edit` or `/reports/:id/edit`) — [ReportBuilderComponent](src/app/components/report-builder.ts)

- Interactive drag-and-drop designer for configuring columns (`WTD`, `MTD`, `QTD`, `YTD`, `ROLLING`, `CALC`, `HEADER`) and rows (`section`, `data`, `calc`, `blank`).
- Dynamic rows setup viewport section height (constrained between a minimum of 450px and a maximum of 860px) with custom high-contrast scrollbars for seamless grid editing.
- Full-screen field picker via [FieldPickerComponent](src/app/components/field-picker.ts) for selecting fact table measures and dimension attributes.
- Advanced filter builder via [RowFilterComponent](src/app/components/row-filter.ts) and [RowConditionGroupComponent](src/app/components/row-condition-group.ts).
- Granularity configuration via [GranularityPickerComponent](src/app/components/granularity-picker.ts) for group-by dimension breakdowns.
- **Real-time SQL preview** with dynamic rainbow bracket highlighting via [BracketRainbowPipe](src/app/pipes/bracket-rainbow.pipe.ts).
- **Lifecycle actions** driven by the current report status:
  - `DRAFT` → **Submit for Review** button transitions to `IN_REVIEW`.
  - `IN_REVIEW` → **Reject** (returns to `DRAFT`) or **Publish** (freezes version permanently).
  - `PUBLISHED` → **Read-only view** with a **Fork to New Draft** button.
- **Immutability enforcement**: `PUBLISHED` and `IN_REVIEW` versions are fully locked — all form fields are disabled.

### 4. Report Detail (`/reports/:id`) — [ReportDetailComponent](src/app/components/report-detail.ts)

- Read-only configuration inspector showing all columns, rows, and metadata for a report.
- Displays the current lifecycle status badge.
- Select a Reference Date and trigger a direct Excel download of the compiled report (POI-styled `.xlsx`).

### 5. Reports Execution Hub (`/viewer` or `/viewer/:id`) — [ExecutionHubComponent](src/app/components/execution-hub.ts)

- Split-pane explorer: left sidebar lists **one report entry per `reportId`** (always the latest version), right canvas shows the active workspace.
- Select a reporting date via the [CalendarPickerComponent](src/app/components/calendar-picker.ts) popover (only dates available in the DWH `dim_date` table are selectable).
- Override runtime quick-filters per report before execution.
- Renders calculated report data as an interactive datagrid with resizable columns via [ColResizerDirective](src/app/directives/col-resizer.directive.ts).
- Granularity sub-rows expand beneath parent data rows when group-by dimensions are configured.
- Export executed grids to `.xlsx` with built-in formula-injection sanitization.

### 6. Semantic Layer Browser (`/semantic`) — [SemanticViewerComponent](src/app/components/semantic.ts)

- Browse **Explores & Joins**: inspect how fact and dimension tables are logically mapped (join type, join SQL).
- Browse **Views & Schema Mapping**: inspect defined **Dimensions** (physical column names) and **Measures** (SQL aggregation expressions and types).

---

## 🔄 Report Lifecycle State Machine

Reports follow a three-tier immutable release pipeline:

```
 ┌─────────┐   Submit for Review   ┌───────────┐   Publish   ┌───────────┐
 │  DRAFT  │ ─────────────────────>│ IN_REVIEW │────────────>│ PUBLISHED │
 │(mutable)│<─────────────────────│  (locked) │             │  (frozen) │
 └─────────┘        Reject         └───────────┘             └─────┬─────┘
      ^                                                             │
      └──────────────────── Auto-fork new DRAFT (v+1) ─────────────┘
```

| Status | Editable | Who Acts |
|--------|----------|----------|
| `draft` | Yes — full edit mode | Report author |
| `in_review` | No — locked, read-only | Reviewer: Reject or Publish |
| `published` | No — frozen, immutable row | Anyone: Fork to create new draft |

**On publish**, the backend automatically:
1. Freezes the current version row permanently (status = `published`).
2. Clones all child records (columns, rows, metrics, formulas, column maps) to a new `draft` at `version + 1`.
3. Redirects the UI to the new editable draft.

---

## ⚙️ Development Guide

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | LTS v24.x | Required runtime |
| **npm** | 11.8.0 | Pinned in `packageManager` |
| **Angular CLI** | ^21.2.12 | Installed in `devDependencies` |

---

### macOS Setup (NVM)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 24 && nvm use 24
npm install -g @angular/cli   # optional
```

### Ubuntu / Debian Setup

```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g @angular/cli   # optional
```

### Windows Setup (PowerShell Admin)

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
npm install -g @angular/cli
```

---

### Install & Run Locally

1. **Install dependencies** — the `--legacy-peer-deps` flag is required due to a peer conflict between `vitest ^3.0.0` and `@angular/build ^21.2.12`:

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Start the Angular dev server** with backend proxy integration:

   ```bash
   npm start
   ```

   Available at [http://127.0.0.1:4200/](http://127.0.0.1:4200/). All `/api/*` requests proxy to `http://127.0.0.1:8101`.

3. **Ensure the Spring Boot backend is running** on port `8101`.

4. **Build for production**:

   ```bash
   npm run build
   ```

   Output written to `dist/frontend/browser/`.

5. **Run unit tests**:

   ```bash
   npm test
   ```

   Executes `vitest run`. See [TESTING.md](TESTING.md) for full testing guidance.

---

## 📂 Project Structure

```
reportingengine_frontend/
├── .agents/                    # ADK validation agent configuration
│   └── validation/             # Executable validation agent (agent.py, tools.py)
├── src/app/
│   ├── components/             # Standalone view components
│   │   ├── calendar-picker.ts      # Date selection popover (DWH-available dates only)
│   │   ├── dashboard.ts            # Catalog overview & template uploader
│   │   ├── execution-hub.ts        # Reports Execution Hub (run & inspect datagrid)
│   │   ├── field-picker.ts         # Fact/dimension field selector modal
│   │   ├── granularity-picker.ts   # Group-by dimension breakout configuration
│   │   ├── login.ts                # User authentication view
│   │   ├── report-builder.ts       # Drag-and-drop layout builder + lifecycle controls
│   │   ├── report-detail.ts        # Read-only config inspector + Excel download
│   │   ├── row-condition-group.ts  # Recursive condition group sub-component
│   │   ├── row-filter.ts           # Query condition filter configuration
│   │   ├── semantic.ts             # Semantic metadata registry browser
│   │   ├── sidebar.ts              # Collapsible responsive navigation sidebar
│   │   └── value-picker.ts         # Autocomplete fuzzy-search dropdown
│   ├── directives/
│   │   └── col-resizer.directive.ts   # Datagrid column width resizing
│   ├── guards/
│   │   └── auth.guard.ts              # Route guard for authenticated-only access
│   ├── interceptors/
│   │   └── auth.interceptor.ts        # Injects Basic Auth header on all API calls
│   ├── pipes/
│   │   └── bracket-rainbow.pipe.ts    # Rainbow-colorized nested parenthesis renderer
│   ├── services/
│   │   ├── auth.service.ts            # Session management & credential storage
│   │   └── report.service.ts          # Full REST API client (see table below)
│   ├── utils/
│   │   ├── date-formatter.ts          # Date parsing, normalization, rolling-column helpers
│   │   ├── report-parser.ts           # Expression parser/serializer for filters & measures
│   │   └── search-analyzer.ts        # Fuzzy token matcher and weight analyzer
│   ├── app.config.ts           # Root providers (HttpClient, Router, interceptors)
│   ├── app.css                 # Global design tokens and dark-mode CSS variables
│   ├── app.html                # App shell (<router-outlet>)
│   ├── app.routes.ts           # Lazy-loaded standalone routing table
│   └── app.ts                  # Root component bootstrapper
├── angular.json                # Angular CLI workspace configuration
├── Dockerfile                  # Nginx container — serves built static assets on port 8080
├── GEMINI.md                   # Architecture reference & agent handoff document
├── nginx.conf.template         # Nginx config template (BACKEND_HOST injected at startup)
├── package.json                # npm dependencies and scripts
├── proxy.conf.json             # Dev-server proxy: /api/* -> http://127.0.0.1:8101
├── run.sh                      # Docker entrypoint — patches nginx.conf and starts Nginx
├── TESTING.md                  # Testing guide and patterns
└── vitest.config.ts            # Vitest runner configuration
```

---

## 🔌 `ReportService` API Surface

All calls use the relative base path `/api/reports`, proxied through Nginx or the dev-server proxy.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `getReports()` | `GET /api/reports` | List all reports (latest version per reportId only) |
| `getReportConfig(id, date, version?)` | `GET /api/reports/:id?date=&version=` | Load full config DTO |
| `saveReport(id, config)` | `PUT /api/reports/:id` | Save column/row configuration |
| `createReport(config)` | `POST /api/reports` | Create a new report record |
| `deleteReport(id)` | `DELETE /api/reports/:id` | Delete report (physical delete if no published history; soft delete across all versions if published version exists) |
| `importTemplate(file)` | `POST /api/reports/import` | Ingest Excel template file |
| `validateReport(config)` | `POST /api/reports/validate` | Validate a config before saving |
| `previewSql(config)` | `POST /api/reports/preview-sql` | Generate live SQL preview |
| `runReport(id, date, version?)` | `POST /api/reports/:id/run` | Download compiled Excel (Blob) |
| `executeReport(id, payload, version?)` | `POST /api/reports/:id/execute` | Run report, return unpivoted grid |
| `getTables()` | `GET /api/reports/tables` | List available fact tables |
| `getTableColumns(table)` | `GET /api/reports/table-columns?table=` | List columns for a table |
| `getColumnTypes(table)` | `GET /api/reports/column-types?table=` | Get column -> type map |
| `getDistinctValues(table, column)` | `GET /api/reports/dimensions/values` | Get distinct dimension values |
| `getReportingDates()` | `GET /api/reports/dimensions/values` | Fetch available DWH reporting dates |
| `getDimensionJoins(factTable)` | `GET /api/reports/dimension-joins` | Get join metadata for a fact table |
| `getSemanticModel()` | `GET /api/reports/semantic-model` | Load full semantic registry |
| `submitReview(id, version)` | `POST /api/reports/:id/version/submit-review` | Transition DRAFT -> IN_REVIEW |
| `rejectReport(id, version)` | `POST /api/reports/:id/version/reject` | Transition IN_REVIEW -> DRAFT |
| `publishReport(id, version)` | `POST /api/reports/:id/version/publish` | Freeze version + auto-fork new draft |
| `forkReport(id, version)` | `POST /api/reports/:id/version/fork` | Manually fork PUBLISHED -> new DRAFT |
| `getReportVersions(id)` | `GET /api/reports/:id/version/list` | List all versions of a report |

---

## 🐛 Troubleshooting

### Port conflicts

```bash
# macOS / Linux
lsof -i :8101   # Backend
lsof -i :4200   # Frontend dev server
kill -9 <PID>
```

```powershell
# Windows
netstat -ano | findstr :8101
taskkill /PID <PID> /F
```

### `npm install` fails with peer dependency errors

Always use the `--legacy-peer-deps` flag:

```bash
npm install --legacy-peer-deps
```

### Backend returns 401 Unauthorized

The Spring Boot backend uses HTTP Basic Auth. Default local credentials: **username** `admin`, **password** `password`. Configure via `SECURITY_ADMIN_USERNAME` / `SECURITY_ADMIN_PASSWORD` environment variables.

### Execution hub shows duplicate report entries

Fixed in `ReportRepository.findLatestVersionPerReport()`. The `GET /api/reports` endpoint now returns only the **latest version per `reportId`**. Hard-refresh the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`) to clear cached data.
