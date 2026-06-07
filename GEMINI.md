# Project Handoff - Report Template Engine Front-End (Angular UI)

This document serves as the UI/UX architecture reference, implementation state, and configuration blueprint for all developer/agent interactions on this frontend workspace.

---

## 📌 Context Overview

- **Objective**: Build a premium, metadata-driven visual report layout builder.
- **Phase 1 (Completed)**: Standalone components, responsive CSS dark-theme layout, drag-and-drop row reordering, and step-based wizards.
- **Phase 2 (Completed)**: Real-time execution status badges (draft, published, running status tags) and run spinner integration (visual loading feedback during ingestion, layout compilation, and database execution queries).

---

## 🛠️ Technology Stack

| Component | Technology | Version / Port / Details |
| :--- | :--- | :--- |
| **Frontend** | Angular | v21.2.0 (Standalone components, TypeScript) |
| **Styling** | CSS | Vanilla CSS deep-slate dark-mode design |
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
   - The UI blocks layout configurations (saving columns or rows) where labels start with formula triggers (`=`, `+`, `-`, `@`). Additionally, the datagrid export to CSV sanitizes pivoted cell metrics to prevent client-side formula execution inside spreadsheet programs.

---

## 📂 Codebase Tour

Use the links below to navigate directly to the frontend source files:

### Frontend Component Views (`src/app/components/`)
- [login.ts](src/app/components/login.ts) — Secure login viewport with credential validation.
- [dashboard.ts](src/app/components/dashboard.ts) — Catalog overview and multipart spreadsheet uploader.
- [report-builder.ts](src/app/components/report-builder.ts) — Interactive drag-and-drop report layout builder with live SQL preview.
- [report-detail.ts](src/app/components/report-detail.ts) — Configuration inspector and execution download panel.
- [report-viewer.ts](src/app/components/report-viewer.ts) — Reports Execution Hub to run reports and view calculated datagrids.
- [semantic.ts](src/app/components/semantic.ts) — Interactive DWH logical explore/join metadata browser.
- [sidebar.ts](src/app/components/sidebar.ts) — Collapsible responsive navigation bar.
- [field-picker.ts](src/app/components/field-picker.ts) — Fact and dimension field picker modal.
- [row-filter.ts](src/app/components/row-filter.ts) — Query condition filter configuration component.
- [value-picker.ts](src/app/components/value-picker.ts) — Autocomplete lookup dropdown component.

### Directives & Guards & Interceptors
- [col-resizer.directive.ts](src/app/directives/col-resizer.directive.ts) — Directive for adjusting datagrid column widths.
- [auth.guard.ts](src/app/guards/auth.guard.ts) — Router guard to secure authenticated routes.
- [auth.interceptor.ts](src/app/interceptors/auth.interceptor.ts) — Automatically injects Basic Auth header into API requests.

### Data & State Services (`src/app/services/`)
- [auth.service.ts](src/app/services/auth.service.ts) — Handles user sessions, local storage, and Auth header interceptor logic.
- [report.service.ts](src/app/services/report.service.ts) — Manages DTO mutations, file uploads, schema fetching, and report execution.

### Utilities (`src/app/utils/`)
- [date-formatter.ts](src/app/utils/date-formatter.ts) — Safe date parsing, normalization, and formatting helpers.
- [report-parser.ts](src/app/utils/report-parser.ts) — Expression parser/serializer for filters and measures.
- [search-analyzer.ts](src/app/utils/search-analyzer.ts) — Fuzzy matcher and token weight analyzer for searches.

---

## 🚀 How to Bootstrap the Dev Environment

### 1. Pre-requisites
Ensure you have **Node.js v18+** and **npm** installed.

### 2. Install Dependencies
```bash
npm install
```

### 3. Launch Development Server
Starts Angular CLI on port `4200` with proxy rules applied:
```bash
npm start
```
*Note: Make sure your backend service is running locally on port `8101`.*

### 4. Build for Production
To generate the optimized static assets under `dist/frontend/browser/`:
```bash
npm run build
```

---

## 🌐 Production Nginx Deployment

The Angular build is containerized using the [Dockerfile](Dockerfile) which runs Nginx and serves static assets.
- **Dynamic Proxying**: Nginx acts as a reverse proxy forwarding `/api` calls to the backend.
- **Backend Host Configuration**: At startup, `run.sh` updates `nginx.conf.template` with the backend environment host `BACKEND_HOST`, resolving upstream gateway timeouts.
