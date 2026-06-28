import { Component, ChangeDetectionStrategy, input, output, model, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RowConditionGroupComponent, RowFilterGroup } from './row-condition-group';
import { TableFilterScope } from '../interfaces/general-filter.interface';

@Component({
  selector: 'app-general-filter-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RowConditionGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './general-filters-workspace.html',
  styles: [`
    .fixed { position: fixed !important; }
    .inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
    .z-\\[9999\\] { z-index: 9999 !important; }
    .bg-slate-900\\/40 { background-color: rgba(15, 23, 42, 0.4) !important; }
    .backdrop-blur-md { backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; }
    .flex { display: flex !important; }
    .items-center { align-items: center !important; }
    .justify-center { justify-content: center !important; }
    .w-full { width: 100% !important; }
    .max-w-gfw { max-width: 1472px !important; }
    .max-h-\\[85vh\\] { max-height: 85vh !important; }
    .h-\\[640px\\] { height: 640px !important; }
    .bg-white { background-color: #FFFFFF !important; }
    .rounded-2xl { border-radius: 1rem !important; }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; }
    .flex-col { flex-direction: column !important; }
    .border { border: 1px solid #E2E8F0 !important; }
    .border-slate-200 { border-color: #E2E8F0 !important; }
    .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
    .py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
    .border-b { border-bottom-width: 1px !important; }
    .border-slate-100 { border-color: #F1F5F9 !important; }
    .justify-between { justify-content: space-between !important; }
    .bg-slate-50 { background-color: #F8FAFC !important; }
    .rounded-t-2xl { border-top-left-radius: 1rem !important; border-top-right-radius: 1rem !important; }
    .text-base { font-size: 1rem !important; }
    .font-bold { font-weight: 700 !important; }
    .text-slate-800 { color: #1E293B !important; }
    .text-xs { font-size: 0.75rem !important; }
    .text-slate-400 { color: #94A3B8 !important; }
    .text-slate-600 { color: #475569 !important; }
    .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
    .p-1\\.5 { padding: 0.375rem !important; }
    .rounded-lg { border-radius: 0.5rem !important; }
    .hover\\:bg-slate-100:hover { background-color: #F1F5F9 !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .overflow-hidden { overflow: hidden !important; }
    .w-1\\/4 { width: 25% !important; }
    .border-r { border-right-width: 1px !important; }
    .bg-slate-50\\/50 { background-color: rgba(248, 250, 252, 0.5) !important; }
    .p-4 { padding: 1rem !important; }
    .gap-3 { gap: 0.75rem !important; }
    .overflow-y-auto { overflow-y: auto !important; }
    .uppercase { text-transform: uppercase !important; }
    .tracking-wider { letter-spacing: 0.05em !important; }
    .gap-1\\.5 { gap: 0.375rem !important; }
    .idx { cursor: pointer !important; }
    .border-l-indigo-600 { border-left-color: #4F46E5 !important; }
    .bg-white-scope { background-color: #FFFFFF !important; }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important; }
    .p-3 { padding: 0.75rem !important; }
    .cursor-pointer { cursor: pointer !important; }
    .hover\\:bg-white:hover { background-color: #FFFFFF !important; }
    .transition-all { transition-property: all !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
    .border-l-4 { border-left-width: 4px !important; }
    .font-semibold { font-weight: 600 !important; }
    .text-slate-700 { color: #334155 !important; }
    .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .text-\\[10px\\] { font-size: 10px !important; }
    .text-\\[11px\\] { font-size: 11px !important; }
    .min-w-0 { min-width: 0 !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .hover\\:text-red-500:hover { color: #EF4444 !important; }
    .p-1 { padding: 0.25rem !important; }
    .mt-auto { margin-top: auto !important; }
    .pt-3 { padding-top: 0.75rem !important; }
    .border-t { border-top-width: 1px !important; }
    .outline-none { outline: 2px solid transparent !important; outline-offset: 2px !important; }
    .p-6 { padding: 1.5rem !important; }
    .mb-4 { margin-bottom: 1rem !important; }
    .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06) !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important; }
    .text-indigo-600 { color: #4F46E5 !important; }
    .pr-1 { padding-right: 0.25rem !important; }
    .items-center-canvas { align-items: center !important; }
    .gap-2 { gap: 0.5rem !important; }
    .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
    .text-indigo-600-btn { color: #4F46E5 !important; }
    .hover\\:underline:hover { text-decoration-line: underline !important; }
    .bg-indigo-600 { background-color: #4F46E5 !important; }
    .hover\\:bg-indigo-700:hover { background-color: #4338CA !important; }
    .text-white { color: #FFFFFF !important; }
    .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
    .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #E2E8F0;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #CBD5E1;
    }
    /* Left border specific style */
    .scope-item {
      border-left: 4px solid transparent !important;
      color: #334155 !important;
    }
    .scope-item.active {
      border-left-color: #4F46E5 !important;
      border-left-width: 4px !important;
      background-color: #FFFFFF !important;
      color: #334155 !important;
    }
  `]
})
export class GeneralFilterModalComponent {
  isOpen = model<boolean>(false);
  scopes = model<TableFilterScope[]>([]);
  isRawMode = model<boolean>(false);
  legacyFilterExpr = model<string>('');
  
  dwhCatalog = input<any[]>([]);
  linkedDimensions = input<string[]>([]);
  columnTypes = input<{ [tableName: string]: { [columnName: string]: string } }>({});
  disabled = input<boolean>(false);

  onApply = output<void>();
  onClose = output<void>();

  selectedScopeIndex = signal<number | null>(null);

  constructor() {
    // Auto-select the first scope when the modal opens if nothing is selected yet
    effect(() => {
      const open = this.isOpen();
      const scopes = this.scopes();
      if (open && scopes.length > 0 && this.selectedScopeIndex() === null) {
        untracked(() => this.selectedScopeIndex.set(0));
      }
    });
  }

  activeScope = computed(() => {
    const idx = this.selectedScopeIndex();
    const currentScopes = this.scopes();
    return idx !== null && idx >= 0 && idx < currentScopes.length ? currentScopes[idx] : null;
  });

  availableTables = computed(() => {
    const currentScopes = this.scopes().map(s => s.tableName.toLowerCase());
    const catalog = this.dwhCatalog();
    if (!catalog) return [];
    
    // Return all table names that are not already active in scopes
    return catalog
      .map(c => c.sourceTable)
      .filter(t => t && !currentScopes.includes(t.toLowerCase()));
  });

  formatTableName(tableName: string): string {
    if (!tableName) return '';
    return tableName.replace(/^analytics\./, '');
  }

  addScope(tableName: string): void {
    if (!tableName) return;
    const current = this.scopes();
    const newScope: TableFilterScope = {
      tableName,
      filtersGroup: {
        id: 'g_' + Math.random().toString(36).substring(2, 11),
        logicalOperator: 'AND',
        rules: [],
        childGroups: []
      }
    };
    this.scopes.set([...current, newScope]);
    this.selectedScopeIndex.set(this.scopes().length - 1);
  }

  removeScope(index: number): void {
    const current = this.scopes();
    const next = current.filter((_, i) => i !== index);
    this.scopes.set(next);
    
    const currentIdx = this.selectedScopeIndex();
    if (currentIdx === index) {
      this.selectedScopeIndex.set(next.length > 0 ? 0 : null);
    } else if (currentIdx !== null && currentIdx > index) {
      this.selectedScopeIndex.set(currentIdx - 1);
    }
  }

  selectScope(index: number): void {
    this.selectedScopeIndex.set(index);
  }

  getFilterSummary(group: any): string {
    if (!group) return '';
    return this.buildSummaryString(group);
  }

  private buildSummaryString(group: any): string {
    if (!group) return '';
    const parts: string[] = [];
    if (group.rules) {
      for (const r of group.rules) {
        const valStr = r.value && r.value.length > 0 ? r.value.join(', ') : '...';
        parts.push(`${r.columnName} ${r.operator} [${valStr}]`);
      }
    }
    if (group.childGroups) {
      for (const c of group.childGroups) {
        const childSum = this.buildSummaryString(c);
        if (childSum) parts.push(childSum);
      }
    }
    if (parts.length === 0) return '';
    const op = ` ${group.logicalOperator || 'AND'} `;
    return `(${parts.join(op)})`;
  }

  toggleRawMode(): void {
    this.isRawMode.set(!this.isRawMode());
  }

  saveAndClose(): void {
    this.onApply.emit();
    this.close();
  }

  close(): void {
    this.isOpen.set(false);
    this.onClose.emit();
  }

  onGroupChanged(): void {
    // Force Change Detection updates on the model values
    this.scopes.set([...this.scopes()]);
  }
}
