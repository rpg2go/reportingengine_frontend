import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FILTER_HELP_ENTRIES, FilterHelpEntry } from '../constants/filter-help.constants';

/**
 * FilterHelpPanelComponent
 *
 * Shared standalone component that renders the collapsible ⓘ Quick Reference panel.
 * Used by both:
 *  - RowFilterComponent      (Quick Filter / row-level filter builder)
 *  - GeneralFilterModalComponent  (General Filters Workspace)
 *
 * Usage:
 *   <app-filter-help-panel [theme]="'light'" />   ← inside the General Filters modal
 *   <app-filter-help-panel [theme]="'dark'" />    ← inside the row-level dark-themed modal
 *
 * The entries are driven entirely from FILTER_HELP_ENTRIES in filter-help.constants.ts.
 * To add, remove or reword a help entry, edit that file — both modals update automatically.
 */
@Component({
  selector: 'app-filter-help-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="'filter-help-panel filter-help-panel--' + theme()">
      <p class="fhp-title">Quick Reference — Filter Builder</p>
      @for (entry of entries; track entry.term) {
        <div class="fhp-row">
          <span class="fhp-term">{{ entry.term }}</span>
          <span class="fhp-desc" [innerHTML]="entry.description"></span>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Base panel layout ─────────────────────────────────────────────────────── */
    .filter-help-panel {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.625rem;
      border-radius: 0.75rem;
      padding: 0.875rem 1rem;
      animation: fhpFadeIn 0.15s ease-out;
      flex-shrink: 0;
    }
    @keyframes fhpFadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Light theme (General Filters Workspace) ───────────────────────────────── */
    .filter-help-panel--light {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      margin: 0 1.5rem 0.75rem;
    }

    /* ── Dark theme (Row-level Quick Filter builder) ───────────────────────────── */
    .filter-help-panel--dark {
      background: rgba(248, 250, 252, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* ── Shared typography ─────────────────────────────────────────────────────── */
    .fhp-title {
      grid-column: 1 / -1;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0 0 0.2rem;
    }
    .filter-help-panel--light .fhp-title  { color: #94A3B8; }
    .filter-help-panel--dark  .fhp-title  { color: rgba(148, 163, 184, 0.8); }

    .fhp-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .fhp-term {
      display: inline-flex;
      align-items: center;
      border-radius: 5px;
      padding: 1px 7px;
      font-size: 10px;
      font-weight: 700;
      width: fit-content;
      margin-bottom: 2px;
    }
    .filter-help-panel--light .fhp-term { background: #EEF2FF; color: #4F46E5; }
    .filter-help-panel--dark  .fhp-term { background: rgba(99, 102, 241, 0.15); color: #818CF8; }

    .fhp-desc {
      font-size: 10.5px;
      line-height: 1.45;
    }
    .filter-help-panel--light .fhp-desc { color: #475569; }
    .filter-help-panel--dark  .fhp-desc { color: #94A3B8; }
  `],
})
export class FilterHelpPanelComponent {
  /**
   * Controls color scheme of the panel.
   * - 'light' → for white-background modals (General Filters Workspace)
   * - 'dark'  → for dark-background modals (Quick Filter row builder)
   */
  theme = input<'light' | 'dark'>('light');

  /** Help entries imported from the shared constants file. */
  readonly entries: FilterHelpEntry[] = FILTER_HELP_ENTRIES;
}
