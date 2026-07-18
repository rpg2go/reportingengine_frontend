import {
  Component,
  ChangeDetectionStrategy,
  model,
  input,
  computed,
  signal,
  HostListener,
  ElementRef,
  inject,
  OnInit,
  forwardRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { ReportService } from '../services/report.service';

export interface GranularityOption {
  value: string;
  tableName: string;
  columnName: string;
  dataType: string;
}

export interface TableGroup {
  tableName: string;
  cleanTableName: string;
  options: GranularityOption[];
  isExpanded: boolean;
}

@Component({
  selector: 'app-granularity-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './granularity-picker.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GranularityPickerComponent),
      multi: true
    }
  ],
  styles: [`
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    /* ── Trigger / Input housing ─────────────────────────────────── */
    .gp-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 32px;
      width: 100%;
      padding: 4px 8px 4px 10px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-sizing: border-box;
      gap: 6px;
    }

    .gp-trigger:hover,
    .gp-trigger.open {
      border-color: var(--color-apple-blue);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.20);
    }

    /* ── Selected chips strip ────────────────────────────────────── */
    .gp-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      flex: 1;
      align-items: center;
      min-width: 0;
    }

    .gp-placeholder {
      font-size: 12px;
      color: var(--color-apple-grey);
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gp-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 6px;
      background: rgba(0, 118, 223, 0.14);
      border: 1px solid rgba(0, 118, 223, 0.28);
      color: var(--color-apple-blue);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      font-family: monospace;
      white-space: nowrap;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background 0.15s ease;
    }

    .gp-chip:hover {
      background: rgba(0, 118, 223, 0.22);
    }

    .gp-chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      border: none;
      background: transparent;
      color: var(--color-apple-blue);
      cursor: pointer;
      padding: 0;
      font-size: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.15s ease;
    }

    .gp-chip-remove:hover {
      background: rgba(0, 118, 223, 0.25);
    }

    .gp-arrow {
      font-size: 10px;
      color: var(--color-apple-grey);
      flex-shrink: 0;
      user-select: none;
    }

    /* ── Popover panel ───────────────────────────────────────────── */
    .gp-popover {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      /* Escape the narrow form-group cell: grow to content but cap at viewport */
      width: auto;
      min-width: max(100%, 420px);
      max-width: min(560px, 90vw);
      background: var(--color-apple-card);
      border: 1px solid rgba(0, 118, 223, 0.20);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      z-index: 100;
      overflow: hidden;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      animation: gpFadeIn 0.15s ease-out;
    }

    @keyframes gpFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Search bar ──────────────────────────────────────────────── */
    .gp-search-wrapper {
      padding: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .gp-search-input {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 5px 10px;
      color: var(--color-apple-text);
      outline: none;
      font-size: 12px;
      font-family: inherit;
      box-sizing: border-box;
      transition: all 0.15s ease;
    }

    .gp-search-input:focus {
      border-color: var(--color-apple-blue);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.20);
    }

    .gp-search-input::placeholder {
      color: var(--color-apple-grey);
      opacity: 0.7;
    }

    /* ── Options scroll container ────────────────────────────────── */
    .gp-options-list {
      max-height: 260px;
      overflow-y: auto;
      padding: 4px 0;
      overscroll-behavior: contain;
    }

    /* ── Table group header ──────────────────────────────────────── */
    .gp-group-header {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-apple-grey);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      background: var(--input-bg);
      border-top: 1px solid var(--border-color);
      margin-top: 4px;
    }

    .gp-group-header:first-child {
      border-top: none;
      margin-top: 0;
    }

    .gp-group-header:hover {
      background: rgba(0, 118, 223, 0.08);
      color: var(--color-apple-text);
    }

    .gp-folder-indicator {
      display: inline-block;
      font-size: 8px;
      color: var(--color-apple-grey);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: 8px;
      user-select: none;
    }

    .gp-folder-indicator.expanded {
      transform: rotate(90deg);
      color: var(--color-apple-blue);
    }

    .gp-folder-name {
      flex-grow: 1;
      font-size: 11px;
      font-weight: 700;
    }

    .gp-table-badge {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(0, 118, 223, 0.12);
      color: var(--color-apple-blue);
      border: 1px solid rgba(0, 118, 223, 0.22);
      font-family: monospace;
    }

    /* ── Fields container ────────────────────────────────────────── */
    .gp-fields-container {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 0 4px 8px;
      border-left: 1px dashed var(--border-color);
      margin-left: 16px;
    }

    /* ── Individual option row ───────────────────────────────────── */
    .gp-option-item {
      display: flex;
      align-items: center;
      padding: 5px 12px;
      min-height: 36px;  /* touch-target compliance — §2 */
      cursor: pointer;
      font-size: 12px;
      color: var(--color-apple-text);
      transition: all 0.15s ease;
      gap: 6px;
      border-radius: 4px;
    }

    .gp-option-item:hover,
    .gp-option-item.active {
      background: var(--color-apple-blue) !important;
      color: white !important;
    }

    .gp-option-item.selected {
      background: rgba(0, 118, 223, 0.18);
      color: var(--color-apple-blue);
      font-weight: 600;
    }

    /* Checkbox */
    .gp-checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1.5px solid var(--border-color);
      background: var(--input-bg);
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .gp-checkbox.checked {
      background: var(--color-apple-blue);
      border-color: var(--color-apple-blue);
    }

    .gp-checkbox-tick {
      font-size: 9px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
    }

    /* Left label area */
    .gp-option-category-muted {
      color: var(--color-apple-grey);
      font-size: 11px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .gp-option-name {
      font-weight: 500;
      color: var(--color-apple-text);
      /* Allow wrapping so long column identifiers are fully visible — §6 truncation-strategy */
      white-space: normal;
      word-break: break-all;
      overflow-wrap: break-word;
      flex-grow: 1;
      font-family: monospace;
      min-width: 0;
    }

    .gp-option-item:hover .gp-option-category-muted,
    .gp-option-item.active .gp-option-category-muted {
      color: rgba(255, 255, 255, 0.7);
    }

    .gp-option-item:hover .gp-option-name,
    .gp-option-item.active .gp-option-name {
      color: white;
    }

    .gp-option-item.selected .gp-option-name {
      color: var(--color-apple-blue);
    }

    /* Right-aligned data type badge */
    .gp-option-type {
      font-size: 9px;
      color: var(--color-apple-grey);
      font-family: monospace;
      margin-left: auto;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .gp-option-item:hover .gp-option-type,
    .gp-option-item.active .gp-option-type {
      color: rgba(255, 255, 255, 0.65);
    }

    /* ── Empty state ─────────────────────────────────────────────── */
    .gp-no-results {
      padding: 16px;
      text-align: center;
      color: var(--color-apple-grey);
      font-size: 12px;
      font-style: italic;
    }

    /* ── Trigger clear-all icon button ──────────────────────────── */
    .gp-clear-all-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: none;
      background: transparent;
      color: var(--color-apple-grey);
      cursor: pointer;
      font-size: 11px;
      border-radius: 50%;
      flex-shrink: 0;
      padding: 0;
      transition: all 0.15s ease;
      line-height: 1;
    }

    .gp-clear-all-btn:hover {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
    }

    /* ── Popover footer ──────────────────────────────────────────── */
    .gp-popover-footer {
      padding: 6px 10px;
      border-top: 1px solid var(--border-color);
      background: var(--input-bg);
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .gp-footer-clear-btn {
      border: none;
      background: transparent;
      color: var(--color-apple-grey);
      font-size: 11px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .gp-footer-clear-btn:hover {
      background: rgba(239, 68, 68, 0.10);
      color: #ef4444;
    }

    /* ── Light theme overrides ───────────────────────────────────── */
    :host-context(html.light) .gp-chip {
      background: #E0E7FF;
      border-color: #C7D2FE;
      color: #3730A3;
    }
    :host-context(html.light) .gp-chip-remove { color: #3730A3; }
    :host-context(html.light) .gp-popover {
      background: #FFFFFF;
      border-color: #CBD5E1;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    :host-context(html.light) .gp-group-header {
      background: #F8FAFC;
      border-top-color: #E2E8F0;
      color: #475569;
    }
    :host-context(html.light) .gp-group-header:hover { background: #EEF2F6; color: #4F46E5; }
    :host-context(html.light) .gp-folder-indicator { color: #64748B; }
    :host-context(html.light) .gp-folder-indicator.expanded { color: #4F46E5; }
    :host-context(html.light) .gp-table-badge { background: #EEF2F6; color: #475569; border-color: #D1D5DB; }
    :host-context(html.light) .gp-fields-container { border-left-color: #E2E8F0; }
    :host-context(html.light) .gp-option-item { color: #334155; }
    :host-context(html.light) .gp-option-item:hover,
    :host-context(html.light) .gp-option-item.active { background: #4F46E5 !important; color: #FFFFFF !important; }
    :host-context(html.light) .gp-option-item.selected { background: #E0E7FF; color: #4338CA; }
    :host-context(html.light) .gp-option-category-muted { color: #64748B; }
    :host-context(html.light) .gp-option-name { color: #334155; }
    :host-context(html.light) .gp-option-item:hover .gp-option-name,
    :host-context(html.light) .gp-option-item.active .gp-option-name { color: #FFFFFF; }
    :host-context(html.light) .gp-option-item.selected .gp-option-name { color: #4338CA; }
    :host-context(html.light) .gp-option-type { color: #64748B; }
    :host-context(html.light) .gp-no-results { color: #64748B; }
    :host-context(html.light) .gp-checkbox { border-color: #CBD5E1; background: #F8FAFC; }
    :host-context(html.light) .gp-checkbox.checked { background: #4F46E5; border-color: #4F46E5; }
    :host-context(html.light) .gp-popover-footer { background: #F8FAFC; border-top-color: #E2E8F0; }
    :host-context(html.light) .gp-footer-clear-btn { color: #64748B; }
    :host-context(html.light) .gp-footer-clear-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
    :host-context(html.light) .gp-clear-all-btn { color: #94A3B8; }
    :host-context(html.light) .gp-clear-all-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
  ]
})
/**
 * GranularityPickerComponent
 *
 * Multi-select group-by dimension picker for configuring the row granularity
 * breakout of a report. Implements `ControlValueAccessor` so it can be used
 * inside Angular reactive forms or template-driven forms via `ngModel`.
 *
 * Purpose:
 *  Allows the user to select one or more DWH dimension columns to group the
 *  analytical query by (e.g., `dim_region.region_name`, `dim_date.month_name`).
 *  Results are shown as removable chips in the trigger area.
 *
 * Usage (inside report-builder step 1 header section):
 *   <app-granularity-picker
 *     [options]="dynamicGranularityOptions"
 *     [(value)]="granularityValue"
 *   ></app-granularity-picker>
 *
 * Used by:
 *  - CoreReportDetailsComponent — step 1 header configuration panel.
 *
 * Inputs (signal-based):
 *  - `options`  — `{ value: string; label: string }[]` pre-built from the schema catalog.
 *  - `value`    — Two-way model; comma-separated selected column references.
 *
 * ControlValueAccessor:
 *  Implements `writeValue`, `registerOnChange`, `registerOnTouched`, and
 *  `setDisabledState` for full forms integration.
 *
 * Internal behavior:
 *  - Options are grouped by `tableName` and rendered in collapsible table groups.
 *  - A live text filter (`searchText` signal) narrows visible options.
 *  - On `ngOnInit`, fetches the schema catalog to build a `dataTypeMap` used for
 *    per-chip data-type annotations (e.g., "date", "integer").
 *  - Expanded groups are tracked in a `Set<string>` signal; each table group
 *    auto-expands when the search filter is active.
 *  - Outside-click via `@HostListener` auto-closes the dropdown panel.
 */
export class GranularityPickerComponent implements OnInit, ControlValueAccessor {
  options = input<{ value: string; label: string }[]>([]);
  value = model<string>('');

  isOpen = signal<boolean>(false);
  searchText = signal<string>('');
  expandedGroups = signal<Set<string>>(new Set());

  private elementRef = inject(ElementRef);
  private reportService = inject(ReportService);

  // CVA callbacks
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};
  disabled = false;

  dataTypeMap = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.reportService.getSchemaCatalog().subscribe({
      next: (model) => {
        if (!model) return;
        const map: Record<string, string> = {};

        if (Array.isArray(model.dimensions)) {
          model.dimensions.forEach((dim: any) => {
            if (dim.column_ref) {
              const dType = dim.dataType || dim.data_type || dim.type;
              if (dType) map[dim.column_ref.toLowerCase().trim()] = dType;
            }
          });
        }

        if (Array.isArray(model.measures)) {
          model.measures.forEach((meas: any) => {
            if (meas.sql_expr) {
              const dType = meas.dataType || meas.data_type || meas.type;
              if (dType) map[meas.sql_expr.toLowerCase().trim()] = dType;
            }
          });
        }

        this.dataTypeMap.set(map);
      },
      error: (err) => {
        console.error('Failed to load schema catalog for granularity picker', err);
      }
    });
  }

  /** Chip display: "tableName -➔ columnName" */
  chipLabel(val: string): string {
    const parts = val.split('.');
    return parts.length > 1 ? `${parts[0]} -➔ ${parts.slice(1).join('.')}` : val;
  }

  selectedValues = computed(() => {
    const val = this.value() || '';
    return val.split(',').map(s => s.trim()).filter(Boolean);
  });

  parsedOptions = computed<GranularityOption[]>(() => {
    return (this.options() || []).map(opt => {
      const parts = opt.value.split('.');
      const tableName = parts.length > 1 ? parts[0] : 'General';
      const columnName = parts.length > 1 ? parts.slice(1).join('.') : opt.value;
      return { value: opt.value, tableName, columnName, dataType: this.getDataType(opt.value) };
    });
  });

  groupedOptions = computed(() => {
    const query = this.searchText().toLowerCase().trim();
    const expanded = this.expandedGroups();
    const groupsMap = new Map<string, GranularityOption[]>();

    this.parsedOptions().forEach(opt => {
      if (!groupsMap.has(opt.tableName)) groupsMap.set(opt.tableName, []);
      groupsMap.get(opt.tableName)!.push(opt);
    });

    const result: TableGroup[] = [];
    groupsMap.forEach((options, tableName) => {
      const filtered = query
        ? options.filter(o =>
            o.columnName.toLowerCase().includes(query) ||
            o.tableName.toLowerCase().includes(query) ||
            o.value.toLowerCase().includes(query)
          )
        : options;

      if (filtered.length > 0) {
        result.push({
          tableName,
          cleanTableName: tableName === 'General' ? 'General Fields' : tableName,
          options: filtered,
          isExpanded: query ? true : expanded.has(tableName)
        });
      }
    });

    return result.sort((a, b) => a.cleanTableName.localeCompare(b.cleanTableName));
  });

  getDataType(value: string): string {
    const key = value.toLowerCase().trim();

    const foundOpt = this.options().find(o => o.value.toLowerCase().trim() === key) as any;
    if (foundOpt) {
      const dt = foundOpt.dataType || foundOpt.data_type || foundOpt.type;
      if (dt) return dt;
    }

    if (this.dataTypeMap()[key]) return this.dataTypeMap()[key];

    const col = key.split('.').pop() ?? key;
    if (col.endsWith('_id') || col.endsWith('_key') || col === 'id' || col === 'key') return 'integer';
    if (col.endsWith('_date') || col.endsWith('_at') || col === 'reporting_date') return 'date';
    if (col.includes('amount') || col.includes('price') || col.includes('balance') || col === 'value') return 'numeric';
    if (col.startsWith('is_') || col.startsWith('has_')) return 'boolean';

    return 'character varying';
  }

  toggleDropdown(event: MouseEvent): void {
    if (this.disabled) return;
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  toggleGroup(tableName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedGroups.update(set => {
      const next = new Set(set);
      next.has(tableName) ? next.delete(tableName) : next.add(tableName);
      return next;
    });
  }

  toggleSelection(val: string, event: MouseEvent): void {
    if (this.disabled) return;
    event.stopPropagation();
    const current = this.selectedValues();
    const updated = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    this.value.set(updated.join(','));
    this.onChange(updated);
    this.onTouched();
  }

  removeValue(val: string, event: MouseEvent): void {
    if (this.disabled) return;
    event.stopPropagation();
    const updated = this.selectedValues().filter(v => v !== val);
    this.value.set(updated.join(','));
    this.onChange(updated);
    this.onTouched();
  }

  clearAll(event: MouseEvent): void {
    if (this.disabled) return;
    event.stopPropagation();
    this.value.set('');
    this.onChange([]);
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  // ── ControlValueAccessor ──────────────────────────────────────────
  writeValue(val: any): void {
    const str = Array.isArray(val) ? val.join(',') : (typeof val === 'string' ? val : '');
    if (this.value() !== str) this.value.set(str);
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}
