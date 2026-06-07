# Reporting Platform — Angular Frontend

This is a modern, responsive single-page application (SPA) built using **Angular 21 (standalone components)**. It acts as the interactive user interface for the Reporting Engine, connecting to the Spring Boot Java backend.

The interface features a **premium glassmorphic dark-mode design** with customized animations, layout structures, and real-time report configuration grids.

---

## 🎨 Key Features & Components

The application is structured into standalone components routed dynamically under `src/app/app.routes.ts`:

1. **Sign In (`/login`)** — [LoginComponent](file:///G:/workspace/ReportTemplate_FrontEnd/src/app/components/login.ts):
   - Secure interface validating user authentication.
   - Leverages Basic Auth headers via [AuthService](file:///G:/workspace/ReportTemplate_FrontEnd/src/app/services/auth.service.ts).

2. **Reports Catalog (`/dashboard`)** — [DashboardComponent](file:///G:/workspace/ReportTemplate_FrontEnd/src/app/components/dashboard.ts):
   - Browse a catalog of active and draft report templates loaded in the database metadata tables.
   - Upload and ingest new Excel templates (`.xlsx`) directly using drag-and-drop or file selection.
   - Auto-refreshes the catalog dynamically upon template ingestion.

3. **Template Visualizer (`/reports/:id`)** — [ReportDetailComponent](file:///G:/workspace/ReportTemplate_FrontEnd/src/app/components/report-detail.ts):
   - View full details of the columns (types: `DATE`, `DATA`, `CALC`) and rows (types: `label`, `data`, `calc`) for a specific report layout.
   - Select a Reference Date (e.g., `2025-12-31`) and run the reporting engine.
   - Downloads the compiled, calculated, and POI-styled spreadsheet directly to the user's local downloads folder.

4. **Semantic Layer Browser (`/semantic`)** — [SemanticViewerComponent](file:///G:/workspace/ReportTemplate_FrontEnd/src/app/components/semantic.ts):
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
ReportTemplate_FrontEnd/
├── .agents/             # ADK validation agents configuration & code
│   ├── agents/          # Validator specifications
│   └── validation/      # Executable validation agent (agent.py, tools.py)
├── src/app/
│   ├── components/      # Standalone view components
│   │   ├── login.ts     # User auth view
│   │   ├── dashboard.ts # Main catalog page & spreadsheet uploader
│   │   ├── report-detail.ts # In-depth layout visualizer & run executor
│   │   └── semantic.ts  # LookML-equivalent metadata registry browser
│   ├── guards/
│   │   └── auth.guard.ts# Route guard to block unauthenticated access
│   ├── services/
│   │   ├── auth.service.ts # Session storage & authorization header manager
│   │   └── report.service.ts # HTTP REST client mapping to the Spring Boot API
│   ├── app.config.ts    # Application providers (HttpClient, Router, etc.)
│   ├── app.html         # Shell containing <router-outlet>
│   ├── app.routes.ts    # Standalone routing table definition
│   └── app.ts           # Core app component bootloader
├── angular.json         # Angular CLI configuration
├── Dockerfile           # Serves built files via Nginx
├── package.json         # Node.js dependencies configuration
└── GEMINI.md            # Frontend architecture reference and guide
```
