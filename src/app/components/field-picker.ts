import { Component, ChangeDetectionStrategy, input, output, computed, signal, effect, ElementRef, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchEngineFactory, SearchEngineAnalyzer, SimpleContainsAnalyzer } from '../utils/search-analyzer';

@Component({
  selector: 'app-field-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '[class.is-open]': 'isOpen()',
  },
  templateUrl: './field-picker.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    .field-picker-container {
      position: relative;
      width: 100%;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      position: relative;
      width: 100%;
    }

    .picker-input {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 30px 6px 10px;
      color: var(--color-apple-blue);
      outline: none;
      font-size: 12px;
      font-family: inherit;
      box-sizing: border-box;
      transition: all 0.15s ease;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }

    .picker-input:hover, .picker-input:focus {
      border-color: var(--color-apple-blue);
      background: var(--card-bg);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.20);
    }

    .arrow-btn {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 30px;
      background: transparent;
      border: none;
      color: var(--color-apple-grey);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
    }

    .arrow-btn:hover {
      color: var(--color-apple-text);
    }

    .arrow-icon {
      font-size: 10px;
    }

    .picker-popover-panel {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      width: 100%;
      min-width: 480px;
      background: var(--color-apple-card);
      border: 1px solid rgba(0, 118, 223, 0.20);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      z-index: 50 !important;
      overflow: hidden;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      animation: fadeInPopover 0.15s ease-out;
    }

    @keyframes fadeInPopover {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .picker-options-list {
      max-height: 280px !important;
      overflow-y: auto !important;
      padding: 4px 0;
      overscroll-behavior: contain;
    }

    .picker-group-header {
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
    
    .picker-group-header:first-child {
      border-top: none;
      margin-top: 0;
    }

    .picker-group-header:hover {
      background: rgba(0, 118, 223, 0.08);
      color: var(--color-apple-text);
    }

    .folder-indicator {
      display: inline-block;
      font-size: 8px;
      color: var(--color-apple-grey);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: 8px;
      user-select: none;
    }

    .folder-indicator.expanded, .rotate-90 {
      transform: rotate(90deg) !important;
      color: var(--color-apple-blue) !important;
    }

    .folder-name {
      flex-grow: 1;
    }

    .table-badge-mini {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(0, 118, 223, 0.12);
      color: var(--color-apple-blue);
      border: 1px solid rgba(0, 118, 223, 0.22);
      font-family: monospace;
    }

    .picker-group-fields-container {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 0 4px 8px;
      border-left: 1px dashed var(--border-color);
      margin-left: 16px;
    }

    .picker-option-item {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      color: var(--color-apple-text);
      transition: all 0.15s ease;
      gap: 6px;
      border-radius: 4px;
    }

    .picker-option-item:hover, .picker-option-item.active {
      background: var(--color-apple-blue) !important;
      color: white !important;
    }

    .picker-option-item.selected {
      background: rgba(0, 118, 223, 0.18);
      color: var(--color-apple-blue);
      font-weight: 600;
    }

    .picker-option-category-muted {
      color: var(--color-apple-grey);
      font-size: 11px;
      white-space: nowrap;
    }

    .picker-option-name {
      font-weight: 500;
      color: var(--color-apple-text);
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      flex-grow: 1;
    }
    
    .picker-option-item:hover .picker-option-name,
    .picker-option-item.active .picker-option-name {
      color: white;
    }
    
    .picker-option-item.selected .picker-option-name {
      color: var(--color-apple-blue);
    }

    .picker-option-type {
      font-size: 9px;
      color: var(--color-apple-grey);
      font-family: monospace;
      margin-left: auto;
      flex-shrink: 0;
    }

    .picker-no-results {
      padding: 16px;
      text-align: center;
      color: var(--color-apple-grey);
      font-size: 12px;
      font-style: italic;
    }

    .selected-field-chip {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Light Theme overrides for field-picker component */
    :host-context(html.light) .selected-field-chip {
      background: #E0E7FF;
      border-color: #C7D2FE;
      color: #3730A3;
    }
    :host-context(html.light) .arrow-btn {
      color: #475569;
    }
    :host-context(html.light) .picker-popover-panel {
      background: #FFFFFF;
      border-color: #CBD5E1;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    :host-context(html.light) .picker-group-header {
      background: #F8FAFC;
      border-top-color: #E2E8F0;
      color: #475569;
    }
    :host-context(html.light) .picker-group-header:hover {
      background: #EEF2F6;
      color: #4F46E5;
    }
    :host-context(html.light) .folder-indicator {
      color: #64748B;
    }
    :host-context(html.light) .folder-indicator.expanded,
    :host-context(html.light) .rotate-90 {
      color: #4F46E5 !important;
    }
    :host-context(html.light) .table-badge-mini {
      background: #EEF2F6;
      color: #475569;
      border-color: #D1D5DB;
    }
    :host-context(html.light) .picker-group-fields-container {
      border-left-color: #E2E8F0;
    }
    :host-context(html.light) .picker-option-item {
      color: #334155;
    }
    :host-context(html.light) .picker-option-item:hover,
    :host-context(html.light) .picker-option-item.active {
      background: #4F46E5 !important;
      color: #FFFFFF !important;
    }
    :host-context(html.light) .picker-option-item.selected {
      background: #E0E7FF;
      color: #4338CA;
    }
    :host-context(html.light) .picker-option-category-muted {
      color: #64748B;
    }
    :host-context(html.light) .picker-option-name {
      color: #334155;
    }
    :host-context(html.light) .picker-option-item:hover .picker-option-name,
    :host-context(html.light) .picker-option-item.active .picker-option-name {
      color: #FFFFFF;
    }
    :host-context(html.light) .picker-option-item.selected .picker-option-name {
      color: #4338CA;
    }
    :host-context(html.light) .picker-option-type {
      color: #64748B;
    }
    :host-context(html.light) .picker-no-results {
      color: #64748B;
    }
    :host-context(html.light) .picker-input span.text-slate-500 {
      color: #64748B !important;
    }
  `]
})
/**
 * FieldPickerComponent
 *
 * Searchable combobox for selecting a single DWH column (table.column) from the
 * physical analytics schema catalog tree.
 *
 * Purpose:
 *  Renders a grouped tree of dimension/fact tables with their columns. The user
 *  types to filter by field or table name, then clicks or keyboards to select
 *  a field. The chosen value is emitted as a fully-qualified path, e.g.
 *  `analytics.fact_sales.amount`.
 *
 * Usage (inside rows-setup measure definition cell):
 *   <app-field-picker
 *     [dwhCatalog]="fieldGroups"
 *     [selectedValue]="row.targetField"
 *     (onSelect)="onFieldSelected($event)"
 *     [disabled]="isLocked()"
 *   />
 *
 * Used by:
 *  - RowsSetupComponent — in each `data` row's Measure Definition cell to choose
 *    the target aggregation column.
 *
 * Inputs (via aliases):
 *  - `dwhCatalog` (alias for `fields`) — `FieldGroup[]` from the report-builder schema.
 *  - `selectedValue` (alias for `value`) — The currently selected `table.column` string.
 *  - `placeholder`   — Placeholder text (default: '-- select field --').
 *  - `disabled`      — When true, blocks all interaction.
 *
 * Outputs:
 *  - `onSelect` (alias for `valueChange`) — Emits the selected `table.column` path.
 *
 * Behavior:
 *  - Uses `SearchEngineAnalyzer` (fuzzy search) from `search-analyzer.ts` to score
 *    and rank matches; falls back to `SimpleContainsAnalyzer` if factory fails.
 *  - Keyboard navigation: ArrowUp/Down to move highlight, Enter to select, Escape to close.
 *  - `@ViewChild('comboboxInput')` — auto-focused when the dropdown opens.
 *  - Outside-click via `(document:click)` host binding closes the panel.
 */
export class FieldPickerComponent implements OnInit {
  value = input<string>('', { alias: 'selectedValue' });
  fields = input<any[]>([], { alias: 'dwhCatalog' });
  placeholder = input<string>('-- select field --');
  disabled = input<boolean>(false);
  valueChange = output<string>({ alias: 'onSelect' });

  @ViewChild('comboboxInput') comboboxInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('optionsList') optionsListRef?: ElementRef<HTMLDivElement>;

  private elementRef = inject(ElementRef);

  isOpen = signal(false);
  localSearchQuery = signal('');
  activeIndex = signal(-1);
  expandedTables = signal<Set<string>>(new Set());
  
  searchAnalyzer!: SearchEngineAnalyzer;

  ngOnInit() {
    try {
      this.searchAnalyzer = SearchEngineFactory.getSearchEngineAnalyzer(null);
    } catch (e) {
      console.warn('SearchEngineFactory failed to initialize. Falling back to SimpleContainsAnalyzer.', e);
      this.searchAnalyzer = new SimpleContainsAnalyzer();
    }
  }

  displayLabel = computed(() => {
    const val = this.value();
    if (!val) return '';
    const parts = val.split('.');
    if (parts.length < 2) return val;
    const tableName = parts.slice(0, -1).join('.');
    const fieldName = parts[parts.length - 1];

    const groups = this.fields();
    const group = groups.find((g: any) => g.sourceTable === tableName);
    if (group) {
      const field = group.fields.find((f: any) => f.name === fieldName);
      if (field) {
        return `${group.category} -> ${field.name}`;
      }
    }
    return val;
  });

  visibleTree = computed(() => {
    const term = this.localSearchQuery().toLowerCase().trim();
    const groups = this.fields();
    const openSet = this.expandedTables();
    const analyzer = this.searchAnalyzer || new SimpleContainsAnalyzer();
    
    if (!term) {
      return groups.map(g => ({
        category: g.category,
        sourceTable: g.sourceTable,
        fields: g.fields,
        isExpanded: openSet.has(g.sourceTable)
      }));
    }

    return groups.map(g => {
      const categoryMatches = analyzer.analyze(g.category, term) || analyzer.analyze(g.sourceTable, term);
      const matchedFields = categoryMatches 
        ? g.fields 
        : g.fields.filter((f: any) => 
            analyzer.analyze(f.name, term) || 
            analyzer.analyze(f.displayName, term)
          );

      return {
        category: g.category,
        sourceTable: g.sourceTable,
        fields: matchedFields,
        isExpanded: true
      };
    }).filter(g => g.fields.length > 0);
  });

  flatVisibleOptions = computed(() => {
    const tree = this.visibleTree();
    const list: any[] = [];
    
    tree.forEach(g => {
      if (g.isExpanded) {
        g.fields.forEach((f: any) => {
          list.push({
            value: `${g.sourceTable}.${f.name}`,
            sourceTable: g.sourceTable,
            name: f.name,
            category: g.category,
            type: f.type || 'varchar'
          });
        });
      }
    });
    
    return list;
  });

  onInputChange(text: string) {
    this.localSearchQuery.set(text);
    if (!this.isOpen()) {
      this.isOpen.set(true);
    }

    this.activeIndex.set(-1);
    const list = this.flatVisibleOptions();
    if (list.length > 0) {
      this.activeIndex.set(0);
    }
  }

  onInputFocus() {
    if (this.disabled()) {
      return;
    }
    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.localSearchQuery.set('');
      
      const currentVal = this.value();
      if (currentVal && currentVal.includes('.')) {
        const parts = currentVal.split('.');
        const tableName = parts.slice(0, -1).join('.');
        
        this.expandedTables.update(set => {
          if (!set.has(tableName)) {
            const newSet = new Set(set);
            newSet.add(tableName);
            return newSet;
          }
          return set;
        });
        
        setTimeout(() => {
          const list = this.flatVisibleOptions();
          const selectedIdx = list.findIndex(item => item.value === currentVal);
          if (selectedIdx !== -1) {
            this.activeIndex.set(selectedIdx);
            this.scrollToActive();
          }
        });
      } else {
        this.activeIndex.set(-1);
      }
    }

    setTimeout(() => {
      this.comboboxInputRef?.nativeElement?.focus();
    }, 0);
  }

  toggleDropdown(event: MouseEvent) {
    if (this.disabled()) {
      return;
    }
    event.stopPropagation();
    if (this.isOpen()) {
      this.close();
    } else {
      this.onInputFocus();
    }
  }

  toggleTable(tableName: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.expandedTables.update(set => {
      const newSet = new Set(set);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  }

  selectOption(val: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.valueChange.emit(val);
    this.localSearchQuery.set('');
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  close() {
    this.isOpen.set(false);
    this.localSearchQuery.set('');
    this.activeIndex.set(-1);
  }

  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // If the target element is detached from the document, it was likely removed during a synchronous template update/re-render.
    // In this case, do not trigger a close operation.
    if (target && !target.ownerDocument?.contains(target)) {
      return;
    }
    const clickedInside = this.elementRef.nativeElement.contains(target);
    if (!clickedInside) {
      this.close();
    }
  }

  isFieldActive(table: string, fieldName: string): boolean {
    const list = this.flatVisibleOptions();
    const idx = this.activeIndex();
    if (idx >= 0 && idx < list.length) {
      const activeItem = list[idx];
      return activeItem.sourceTable === table && activeItem.name === fieldName;
    }
    return false;
  }

  isSelected(table: string, fieldName: string): boolean {
    return this.value() === `${table}.${fieldName}`;
  }

  selectField(group: any, field: any, event: MouseEvent) {
    // 1. Stop browser event bubbling immediately
    event.stopPropagation();
    event.preventDefault();

    // 2. Emit chosen column metadata back through event output channel
    const columnName = `${group.sourceTable}.${field.name}`;
    this.valueChange.emit(columnName);

    // 3. Completely clear out temporary search query and flip visibility to closed
    this.localSearchQuery.set('');
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  onFieldHover(table: string, fieldName: string) {
    const list = this.flatVisibleOptions();
    const idx = list.findIndex(item => item.sourceTable === table && item.name === fieldName);
    if (idx !== -1) {
      this.activeIndex.set(idx);
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    const list = this.flatVisibleOptions();
    if (list.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIdx = this.activeIndex() + 1;
      if (nextIdx < list.length) {
        this.activeIndex.set(nextIdx);
        this.scrollToActive();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIdx = this.activeIndex() - 1;
      if (prevIdx >= 0) {
        this.activeIndex.set(prevIdx);
        this.scrollToActive();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const currentIdx = this.activeIndex();
      if (currentIdx >= 0 && currentIdx < list.length) {
        this.selectOption(list[currentIdx].value, event);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  scrollToActive() {
    setTimeout(() => {
      const listEl = this.optionsListRef?.nativeElement;
      if (!listEl) return;
      const activeEl = listEl.querySelector('.picker-option-item.active');
      if (!activeEl) return;

      const listRect = listEl.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      if (activeRect.bottom > listRect.bottom) {
        listEl.scrollTop += (activeRect.bottom - listRect.bottom);
      } else if (activeRect.top < listRect.top) {
        listEl.scrollTop -= (listRect.top - activeRect.top);
      }
    });
  }
}
