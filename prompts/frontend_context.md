# Project Context: Front-End (Angular UI) for Hybrid Metadata Reporting Engine

This context document outlines the frontend UI/UX architecture, critical features, and design patterns. Use this as a system prompt/context when prompting an AI assistant (like Antigravity) to build, refactor, or debug features on this workspace.

---

## 1. 🏗️ Problem Statement & Frontend Role

The **Report Template Engine** allows business users to define complex, pixel-perfect financial layouts using configuration rather than writing SQL code.

The **Frontend Angular Application** provides the interactive toolset for users to:
1. **Manage Catalog & Ingestion**: Browse existing reports and upload Excel layout templates.
2. **Build Report Layouts Visually**: Drag-and-drop rows, configure columns, and edit filters without touching the underlying Excel file directly.
3. **Inspect the Semantic Layer**: Interactively browse DWH explores, join relationships, dimensions, and measures.
4. **Trigger Executions**: Select a reference date to compile reports and download standard POI-styled Excel spreadsheets.

---

## 2. 🧩 Architecture & Decoupled Layers

The client application is built with **Angular v21.2.0** using a modern, standalone architecture:

### A. Modular Viewports & Subcomponents (`src/app/components/`)
- [login.ts](src/app/components/login.ts): Handles basic credential authentication and local session storage.
- [dashboard.ts](src/app/components/dashboard.ts): A bento-grid catalog displaying all active templates and an Excel spreadsheet uploader with drag-and-drop support.
- [report-builder.ts](src/app/components/report-builder.ts): The visual builder grid enabling drag-and-drop row reordering, column offset/timeframe configuration, and filter editing.
- [report-detail.ts](src/app/components/report-detail.ts): Detail viewport showing template structures and incorporating a calendar selector to run report compilation and handle file downloads.
- [report-viewer.ts](src/app/components/report-viewer.ts): Reports Execution Hub to run reports and view calculated datagrids.
- [semantic.ts](src/app/components/semantic.ts): A metadata explore viewer that maps Looker-like views, joins, fact/dimension columns, and measures.
- [sidebar.ts](src/app/components/sidebar.ts): Collapsible responsive navigation bar.
- [field-picker.ts](src/app/components/field-picker.ts): Fact and dimension field picker modal.
- [row-filter.ts](src/app/components/row-filter.ts): Query condition filter configuration component.
- [value-picker.ts](src/app/components/value-picker.ts): Autocomplete lookup dropdown component.

### B. Directives & Guards & Interceptors
- [col-resizer.directive.ts](src/app/directives/col-resizer.directive.ts): Directive for adjusting datagrid column widths.
- [auth.guard.ts](src/app/guards/auth.guard.ts): Router guard to secure authenticated routes.
- [auth.interceptor.ts](src/app/interceptors/auth.interceptor.ts): Automatically injects Basic Auth header into API requests.

### C. Core Services (`src/app/services/`)
- [auth.service.ts](src/app/services/auth.service.ts): Manages token generation, HTTP Basic Auth header interceptor setup, and active session status.
- [report.service.ts](src/app/services/report.service.ts): Handles all HTTP request mapping, table metadata schema querying, distinct value lookup, template ingestion, and configuration persistence.

---

## 3. ⚙️ Key Frontend Design Decisions

If you are generating frontend code or adding enhancements, keep these key behaviors in mind:

### 1. Parallel Configuration Loading
In [report-builder.ts](src/app/components/report-builder.ts), table columns, dimensions, and existing report structures are retrieved concurrently via RxJS `forkJoin` to ensure minimal loading screens:
```typescript
forkJoin({
  columns: this.reportService.getTableColumns(table),
  config:  this.reportService.getReportConfig(this.reportId)
}).subscribe(...)
```

### 2. Signal-Based Reactive State
State is managed reactively using modern Angular signals (`signal`, `computed`, `model`, `input`, `output`) and `ChangeDetectionStrategy.OnPush`. This eliminates manual subscription management for local states and avoids redundant ZoneJS checks.

### 3. Column Type Validation for Filter Inputs
Filter values are validated in real-time against PostgreSQL column types returned by `/api/reports/column-types?table=<table>`. The validator `validateFilterValue(type, value)` checks formatting for:
- `integer` (matches numeric values with no decimals).
- `numeric` / `decimal` / `real` / `double` / `float` (matches double/floats).
- `boolean` / `bool` (matches true/false/1/0 case-insensitively).
- `date` / `timestamp` / `time` (matches date formats).

*Invalid inputs are visually indicated in red (`.invalid-input`), and error flags block the global `saveConfig` action.*

### 4. Filter Value Clearing on Selection Change
To prevent type validation mismatches, whenever a user changes the selected table or column/attribute in **Quick Filters**, **General Filters**, or pending **Row Filters**, the value input is automatically reset to empty.

### 5. Local Development Proxy Setup
All backend calls `/api/*` bypass CORS and local DNS lag by routing through `proxy.conf.json` directly to the local IPv4 address `http://127.0.0.1:8101` instead of `localhost`.

### 6. Sub-millisecond Class-Instance Testing
Tests avoid heavy TestBed compilation or DOM renders, and instead instantiate TypeScript component and service classes directly. Always import `@angular/compiler` at the top of spec files to avoid JIT compilation errors in Node environment.

---

## 4. 🎨 UI/UX Design System

The application implements a premium, dark-mode styling system using vanilla CSS:
- **Backgrounds**: Deep slate-900 (`#0f172a`), slate-800 (`#1e293b`).
- **Cards**: Glassmorphism using translucent backgrounds and subtle borders (`rgba(255,255,255,0.05)`).
- **Fonts**: Curated sans-serif typography (`Outfit` / `Inter`).
- **Animations**: Soft hover scales, interactive animations, and micro-transitions (`fadeIn`).

*Note: Component style files must keep CSS code optimized to stay within production budget warning constraints (defined under `anyComponentStyle` inside `angular.json`).*
