import { Component, input, model, signal, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-sql-preview-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="sql-modal-overlay animate-fade-in" (click)="closeSqlModal()">
        <div class="sql-modal-card animate-scale-up" (click)="$event.stopPropagation()">
          <div class="sql-modal-header">
            <div>
              <h2>‹› Compiled Query Preview</h2>
              <p class="modal-subtitle">
                Dry-run matrix compilation. View query before saving configuration.
              </p>
            </div>
            <button class="modal-close-btn" (click)="closeSqlModal()">✕</button>
          </div>
          <div class="sql-modal-body">
            @if (isLoading()) {
              <div class="modal-loading">
                <span class="spinner"></span>
                <span>Compiling report matrix query...</span>
              </div>
            } @else {
              <div class="sql-viewer-wrapper">
                <div class="sql-viewer-actions">
                  <span class="file-tag">PGSQL</span>
                  <button (click)="copySqlToClipboard()" class="copy-btn">
                    {{ isCopied() ? '✓ Copied!' : '📋 Copy to Clipboard' }}
                  </button>
                </div>
                <pre><code class="language-sql" [innerHTML]="highlightedSql()"></code></pre>
              </div>
            }
          </div>
          <div class="sql-modal-footer">
            <button (click)="closeSqlModal()" class="footer-close-btn">Close Preview</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    /* SQL Preview Modal Overlay */
    .sql-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .sql-modal-card {
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
      background: var(--color-apple-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sql-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sql-modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-apple-text);
    }
    .modal-subtitle {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: var(--color-apple-grey);
    }
    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--color-apple-grey);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    .modal-close-btn:hover {
      color: var(--color-apple-text);
      background: var(--border-color);
    }
    .sql-modal-body {
      padding: 24px;
      flex: 1;
      overflow-y: auto;
    }
    .modal-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 80px 0;
      color: var(--color-apple-grey);
      font-size: 14px;
    }
    .sql-viewer-wrapper {
      display: flex;
      flex-direction: column;
      background: #0f172a;
      border-radius: 12px;
      border: 1px solid #1e293b;
      overflow: hidden;
    }
    .sql-viewer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: #1e293b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .file-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #818cf8;
      background: rgba(99, 102, 241, 0.15);
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .copy-btn {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
    .sql-viewer-wrapper pre {
      margin: 0;
      padding: 16px 20px;
      overflow-x: auto;
      max-height: 400px;
      background: #0f172a;
    }
    .sql-viewer-wrapper code {
      font-family: 'Fira Code', 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.6;
      white-space: pre;
    }
    .sql-viewer-wrapper code .sql-keyword {
      color: #38bdf8;
      font-weight: 700;
    }
    .sql-viewer-wrapper code .sql-string {
      color: #fbbf24;
    }
    .sql-viewer-wrapper code .sql-number {
      color: #fb7185;
    }
    .sql-viewer-wrapper code .sql-comment {
      color: #64748b;
      font-style: italic;
    }
    .sql-viewer-wrapper code .sql-table {
      color: #34d399;
      font-weight: 600;
    }
    .sql-modal-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: flex-end;
      background: rgba(30, 41, 59, 0.5);
    }
    .footer-close-btn {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .footer-close-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      border-top-color: var(--color-apple-blue);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .animate-fade-in {
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .animate-scale-up {
      animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `
})
/**
 * SqlPreviewModalComponent
 *
 * Full-screen modal that renders the dry-run compiled SQL query for a report
 * configuration, enabling developers and analysts to inspect the generated SQL
 * before actually executing it.
 *
 * Purpose:
 *  Displays the output of `POST /api/reports/preview-sql` in a syntax-highlighted
 *  code viewer with copy-to-clipboard functionality. Shown as an overlay modal
 *  from within the `ReportBuilderComponent`.
 *
 * Usage:
 *   <app-sql-preview-modal
 *     [(isOpen)]="showSqlModal"
 *     [isLoading]="sqlLoading()"
 *     [sql]="previewSql()"
 *   />
 *
 * Used by:
 *  - ReportBuilderComponent — triggered via the "Preview SQL" action button.
 *
 * Inputs:
 *  - `isOpen`     — Required two-way model; controls modal visibility.
 *  - `isLoading`  — When true, shows an animated spinner instead of the SQL panel.
 *  - `sql`        — The raw SQL string to display; passed from the preview endpoint.
 *
 * Internal state:
 *  - `isCopied`     — Signal; true for 2 seconds after a successful clipboard write.
 *  - `highlightedSql` — Computed; the `sql` string processed through the
 *    `getHighlightedSql()` sanitizer which wraps keywords, identifiers, numbers,
 *    comments, and table names in `<span>` elements for syntax color highlighting.
 *
 * Notes:
 *  - The highlighting is done entirely on the frontend via RegEx patterns —
 *    no external library is used.
 *  - The modal is XSS-safe: raw SQL is HTML-escaped before span injection.
 */
export class SqlPreviewModalComponent {
  isOpen = model.required<boolean>();
  isLoading = input<boolean>(false);
  sql = input<string>('');

  isCopied = signal<boolean>(false);

  highlightedSql = computed(() => {
    return this.getHighlightedSql(this.sql());
  });

  closeSqlModal(): void {
    this.isOpen.set(false);
  }

  copySqlToClipboard(): Promise<void> | void {
    const sqlText = this.sql();
    if (sqlText) {
      return navigator.clipboard
        .writeText(sqlText)
        .then(() => {
          this.isCopied.set(true);
          setTimeout(() => this.isCopied.set(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
        });
    }
  }

  private getHighlightedSql(sql: string): string {
    if (!sql) return '';

    // Escape HTML characters to prevent XSS
    let escaped = sql
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // RegEx patterns
    const commentRegex = /(--.*)/g;
    const stringRegex = /('[^']*'|"[^"]*")/g;
    const numberRegex = /\b(\d+(?:\.\d+)?)\b/g;

    const keywords = [
      'WITH', 'SELECT', 'CAST', 'AS', 'FROM', 'LEFT JOIN', 'JOIN', 'ON', 'GROUP BY',
      'UNION ALL', 'UNION DISTINCT', 'UNION', 'WHERE', 'AND', 'OR', 'COALESCE',
      'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'DOUBLE PRECISION', 'INTEGER', 'NULL', 'FALSE', 'TRUE', 'IS NOT', 'IS', 'LIKE',
      'NOT LIKE', 'DISTINCT'
    ];
    keywords.sort((a, b) => b.length - a.length);
    const keywordsPattern = keywords.map(kw => kw.replace(/ /g, '\\s+')).join('|');
    const keywordRegex = new RegExp(`\\b(${keywordsPattern})\\b`, 'gi');

    const schemaTableRegex = /\b(analytics\.[a-zA-Z0-9_]+|cte_[a-zA-Z0-9_]+)\b/g;

    const placeholders: string[] = [];

    // Replace comments
    escaped = escaped.replace(commentRegex, (match) => {
      placeholders.push(`<span class="sql-comment">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });

    // Replace strings
    escaped = escaped.replace(stringRegex, (match) => {
      placeholders.push(`<span class="sql-string">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });

    // Replace keywords
    escaped = escaped.replace(keywordRegex, (match) => {
      return `<span class="sql-keyword">${match.toUpperCase()}</span>`;
    });

    // Replace schema table names
    escaped = escaped.replace(schemaTableRegex, (match) => {
      return `<span class="sql-table">${match}</span>`;
    });

    // Replace numbers
    escaped = escaped.replace(numberRegex, (match) => {
      return `<span class="sql-number">${match}</span>`;
    });

    // Restore placeholders
    for (let i = placeholders.length - 1; i >= 0; i--) {
      escaped = escaped.replace(new RegExp(`___PLACEHOLDER_${i}___`, 'g'), placeholders[i]);
    }

    return escaped;
  }
}
