import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { ValidationError } from './report-builder';

@Component({
  selector: 'app-validation-diagnostics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errors().length > 0) {
      <div class="validation-console card animate-fade-in">
        <h3 class="section-title">
          🛑 Validation Diagnostics ({{ errors().length }} Issues Found)
        </h3>
        <p class="section-desc">
          Resolve these logical, formula, or database catalog mismatch errors to ensure query
          and process safety.
        </p>
        <div class="diagnostics-grid">
          @for (
            err of errors();
            track err.elementId + '-' + err.fieldContext + '-' + err.displayMessage
          ) {
            <div
              class="diagnostic-item"
              [class.critical]="err.errorSeverity === 'CRITICAL'"
              [class.warning]="err.errorSeverity === 'WARNING'"
            >
              <span class="item-icon">{{
                err.errorSeverity === 'CRITICAL' ? '🛑' : '⚠️'
              }}</span>
              <div class="item-body">
                <strong>{{ err.elementId }}</strong> ({{ err.fieldContext }}):
                {{ err.displayMessage }}
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
    }
    .section-desc {
      font-size: 14px;
      color: var(--color-apple-grey);
      margin: -10px 0 0 0;
      line-height: 1.5;
    }
    .validation-console {
      margin-bottom: 24px;
      border: 1px solid rgba(239, 68, 68, 0.2);
      background: var(--input-bg) !important;
    }
    .diagnostics-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      padding-right: 8px;
      margin-top: 12px;
    }
    .diagnostic-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      background: var(--border-color);
      border-left: 3px solid transparent;
    }
    .diagnostic-item.critical {
      border-left-color: #ef4444;
      background: rgba(239, 68, 68, 0.05);
      color: #fca5a5;
    }
    .diagnostic-item.warning {
      border-left-color: #f59e0b;
      background: rgba(245, 158, 11, 0.04);
      color: #fde047;
    }
    .item-icon {
      font-size: 15px;
    }
    .item-body {
      flex: 1;
    }
    .animate-fade-in {
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `
})
export class ValidationDiagnosticsComponent {
  errors = input.required<ValidationError[]>();
}
