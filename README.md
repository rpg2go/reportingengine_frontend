# Reporting Platform — Angular Frontend

This is a modern, responsive single-page application (SPA) built using **Angular 21 (standalone components)**. It acts as the interactive user interface for the Reporting Engine, connecting to the Spring Boot Java backend.

The interface features a **premium glassmorphic dark-mode design** with customized animations, layout structures, and real-time report configuration grids.

---

## 🎨 Key Features & Components

The application is structured into standalone components routed dynamically under [app.routes.ts](src/app/app.routes.ts):

1. **Sign In (`/login`)** — [LoginComponent](src/app/components/login.ts):
   - Secure interface validating user credentials.
   - Leverages Basic Auth headers via [AuthService](src/app/services/auth.service.ts).

2. **Reports Catalog (`/dashboard`)** — [DashboardComponent](src/app/components/dashboard.ts):
   - Browse a catalog of active and draft report templates loaded in the database metadata tables.
   - Upload and ingest new Excel templates (`.xlsx`) directly using drag-and-drop or file selection.
   - Auto-refreshes the catalog dynamically upon template ingestion.

3. **Report Builder (`/reports/new/edit` or `/reports/:id/edit`)** — [ReportBuilderComponent](src/app/components/report-builder.ts):
   - Interactive drag-and-drop template designer for configuring columns (`DATE`, `DATA`, `CALC`) and rows (`label`, `data`, `calc`).
   - Integrates with [FieldPickerComponent](src/app/components/field-picker.ts) and [RowFilterComponent](src/app/components/row-filter.ts) to choose source fields and design query filter criteria.
   - Dynamic real-time preview of the compiled SQL script.

4. **Template Visualizer (`/reports/:id`)** — [ReportDetailComponent](src/app/components/report-detail.ts):
   - View details of columns and rows for a specific report layout configuration.
   - Select a Reference Date and run the reporting engine.
   - Direct download of compiled and POI-styled spreadsheet binaries.

5. **Reports Execution Hub (`/viewer` or `/viewer/:id`)** — [ReportViewerComponent](src/app/components/report-viewer.ts):
   - Select a report template, override filters, choose a reporting date, and run execution in real-time.
   - Render calculated report models as interactive datagrids with resizable columns via [ColResizerDirective](src/app/directives/col-resizer.directive.ts).
   - Export calculated grids directly to CSV formats with built-in formula injection sanitization.

6. **Semantic Layer Browser (`/semantic`)** — [SemanticViewerComponent](src/app/components/semantic.ts):
   - Inspect the logical metadata definitions in the semantic registry.
   - Browse **Explores & Joins** to see how fact and dimension tables are logically mapped together (e.g., join conditions).
   - Browse **Views & Schema Mapping** to inspect defined **Dimensions** (with physical column names) and **Measures** (with SQL aggregation expressions and types).

---

## ⚙️ Development Guide

### Prerequisites

To build, test, and run the frontend, ensure your development environment has the following installed:

*   **Node.js (LTS v24.x):** Runtimes for Angular compiling.
*   **npm:** Package manager (specifically tested and packaged with `npm@11.8.0`).
*   **Angular CLI:** (Installed globally or run via local project scripts).
*   **Python v3.10+ & Pip:** Required for running the ADK validation agent.

---

### Step-by-Step Multi-OS Environment Setup

#### 🍎 macOS Setup (using Homebrew & NVM)
1. **Install Homebrew** (if not installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Install NVM & Node.js v24**:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.zshrc # or ~/.bashrc depending on shell
   nvm install 24
   nvm use 24
   ```
3. **Install Angular CLI Globally (Optional)**:
   ```bash
   npm install -g @angular/cli
   ```

#### 🐧 Ubuntu / Debian Setup (using apt & NodeSource)
1. **Configure NodeSource and Install Node.js**:
   ```bash
   sudo apt update
   sudo apt install -y curl git
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
2. **Install Angular CLI Globally (Optional)**:
   ```bash
   sudo npm install -g @angular/cli
   ```

#### 🪟 Windows Setup (using winget via PowerShell Admin)
```powershell
# Install Node.js LTS
winget install --id OpenJS.NodeJS.LTS -e --source winget

# Install Angular CLI globally
npm install -g @angular/cli
```

---

### Setup & Installation (Local Development)

1. **Install Dependencies**:
   Because of a peer dependency conflict between the legacy `vitest` dependency (`^3.0.0`) and `@angular/build` (`^4.0.8` peer requirements), you **must** use the `--legacy-peer-deps` flag:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Start Angular Dev Server**:
   Run the local server with backend proxy integration:
   ```bash
   npm start
   ```
   *This runs `ng serve --proxy-config proxy.conf.json`. The application will be available at [http://127.0.0.1:4200/](http://127.0.0.1:4200/).*

3. **Backend Connection**:
   The application connects to the Spring Boot REST API at **`http://127.0.0.1:8101/api`**. Ensure the backend server is running in parallel.

4. **Building**:
   To build the optimized production package:
   ```bash
   npm run build
   ```
   *Build artifacts will be written to `dist/frontend/browser/`.*

5. **Run ADK Validation Agent**:
   To validate the frontend build, styling guidelines, and accessibility rules:
   ```bash
   adk run .agents/validation
   ```
   *Prompt the agent with: `"Validate the Angular build and UI components"` or `"Audit CSS templates and lints"`.*

6. **Unit Testing**:
   Run the unit test suite using Vitest:
   ```bash
   npm test
   ```
   *This executes `vitest run` in the terminal.*

---

## 📂 Project Structure

```
reportingengine_frontend/
├── .agents/             # ADK validation agents configuration & code
│   ├── agents/          # Validator specifications
│   └── validation/      # Executable validation agent (agent.py, tools.py)
├── src/app/
│   ├── components/      # Standalone view components and subcomponents
│   │   ├── dashboard.ts # Main catalog page & spreadsheet uploader
│   │   ├── field-picker.ts # Modal selector for fact & dimension fields
│   │   ├── login.ts     # User auth view
│   │   ├── report-builder.ts # Interactive drag-and-drop report layout builder
│   │   ├── report-detail.ts # In-depth layout visualizer & run executor
│   │   ├── report-viewer.ts # Reports Execution Hub for running reports
│   │   ├── row-filter.ts # Advanced filter group builder component
│   │   ├── semantic.ts  # LookML-equivalent metadata registry browser
│   │   ├── sidebar.ts   # Collapsible responsive sidebar component
│   │   └── value-picker.ts # Autocomplete fuzzy search dropdown component
│   ├── directives/
│   │   └── col-resizer.directive.ts # Visual column resizing directive
│   ├── guards/
│   │   └── auth.guard.ts# Route guard to block unauthenticated access
│   ├── interceptors/
│   │   └── auth.interceptor.ts # Attaches Authorization header to HTTP calls
│   ├── pipes/
│   │   ├── bracket-rainbow.pipe.ts # dynamic rainbow parenthesis tokenizer pipe
│   │   └── bracket-rainbow.pipe.spec.ts # unit test suite for the rainbow pipe
│   ├── services/
│   │   ├── auth.service.ts # Session storage & authorization header manager
│   │   └── report.service.ts # HTTP REST client mapping to the Spring Boot API
│   ├── utils/
│   │   ├── date-formatter.ts # Date utilities and helpers
│   │   ├── report-parser.ts # Serializes and deserializes report data
│   │   └── search-analyzer.ts # Utility for query parsing and analyzer
│   ├── app.config.ts    # Application providers (HttpClient, Router, etc.)
│   ├── app.css          # Global and design token styles
│   ├── app.html         # Shell containing <router-outlet>
│   ├── app.routes.ts    # Standalone routing table definition
│   └── app.ts           # Core app component bootloader
├── angular.json         # Angular CLI configuration
├── Dockerfile           # Serves built files via Nginx
├── package.json         # Node.js dependencies configuration
├── proxy.conf.json      # Development server backend proxy configuration
├── run.sh               # Bootstrap script for Nginx container startup
├── vitest.config.ts     # Vitest runner configuration
└── GEMINI.md            # Frontend architecture reference and guide
```

---

## Troubleshooting Port Conflicts

When running the application locally, you may encounter port conflicts if the processes are not terminated cleanly (e.g., when a terminal session is closed without stopping the servers).

### 1. Identify Running Processes

To find which process is listening on a specific port:

* **macOS / Linux**:
  ```bash
  lsof -i :8101   # For backend (Port 8101)
  lsof -i :4200   # For frontend (Port 4200)
  ```
  This will print a list of running processes. Look for the `PID` column.

* **Windows**:
  ```powershell
  netstat -ano | findstr :8101
  netstat -ano | findstr :4200
  ```
  The last column in the output represents the process ID (`PID`).

### 2. Kill the Process Manually

Once you have identified the process ID (`PID`):

* **macOS / Linux**:
  ```bash
  kill -9 <PID>
  ```

* **Windows**:
  ```powershell
  taskkill /PID <PID> /F
  ```

