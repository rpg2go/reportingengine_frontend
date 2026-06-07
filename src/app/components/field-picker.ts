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
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 6px 30px 6px 10px;
      color: #38bdf8;
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
      border-color: #6366f1;
      background: rgba(15, 23, 42, 0.6);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }

    .arrow-btn {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 30px;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
    }

    .arrow-btn:hover {
      color: white;
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
      min-width: 280px;
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6);
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
      color: #94a3b8;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      background: rgba(255, 255, 255, 0.02);
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      margin-top: 4px;
    }
    
    .picker-group-header:first-child {
      border-top: none;
      margin-top: 0;
    }

    .picker-group-header:hover {
      background: rgba(99, 102, 241, 0.08);
      color: #f8fafc;
    }

    .folder-indicator {
      display: inline-block;
      font-size: 8px;
      color: #94a3b8;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: 8px;
      user-select: none;
    }

    .folder-indicator.expanded, .rotate-90 {
      transform: rotate(90deg) !important;
      color: #a5b4fc !important;
    }

    .folder-name {
      flex-grow: 1;
    }

    .table-badge-mini {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.25);
      font-family: monospace;
    }

    .picker-group-fields-container {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 0 4px 8px;
      border-left: 1px dashed rgba(255, 255, 255, 0.08);
      margin-left: 16px;
    }

    .picker-option-item {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      color: #cbd5e1;
      transition: all 0.15s ease;
      gap: 6px;
      border-radius: 4px;
    }

    .picker-option-item:hover, .picker-option-item.active {
      background: #2563eb !important;
      color: white !important;
    }

    .picker-option-item.selected {
      background: rgba(99, 102, 241, 0.25);
      color: #a5b4fc;
      font-weight: 600;
    }

    .picker-option-category-muted {
      color: #475569;
      font-size: 11px;
      white-space: nowrap;
    }

    .picker-option-name {
      font-weight: 500;
      color: #cbd5e1;
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
      color: #a5b4fc;
    }

    .picker-option-type {
      font-size: 9px;
      color: #475569;
      font-family: monospace;
      margin-left: auto;
      flex-shrink: 0;
    }

    .picker-no-results {
      padding: 16px;
      text-align: center;
      color: #475569;
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
  `]
})
export class FieldPickerComponent implements OnInit {
  value = input<string>('', { alias: 'selectedValue' });
  fields = input<any[]>([], { alias: 'dwhCatalog' });
  placeholder = input<string>('-- select field --');
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
