import { Component, input, model, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateFormatter } from '../utils/date-formatter';

/**
 * Computes a stable sort key for a column.
 * Prefers the `displayOrder` property if present; otherwise falls back to array index.
 * This is needed because `this.columns` in report-builder does not include `displayOrder`
 * (it's only added in the save payload), so we must not sort by it blindly.
 */
function colSortKey(col: any, idx: number): number {
  return (col.displayOrder != null && col.displayOrder > 0) ? col.displayOrder : idx;
}

@Component({
  selector: 'app-live-layout-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-layout-preview.html',
  styleUrls: ['./live-layout-preview.css'],
})
/**
 * LiveLayoutPreviewComponent
 *
 * Real-time wireframe preview of the report layout grid as the user configures
 * rows and columns in the Report Builder.
 *
 * Purpose:
 *  Renders a miniature, non-interactive table grid showing a realistic header
 *  row (columns) and body rows (data/calc/section/blank types), with dynamic
 *  date labels computed from the selected reporting date and each column's
 *  period offset, rolling grain, and period type configuration.
 *
 * Usage:
 *   <app-live-layout-preview
 *     [columns]="columns()"
 *     [rows]="rows()"
 *     [reportingDate]="reportingDate()"
 *     [granularities]="dynamicGranularityOptions()"
 *     [previewTrigger]="previewTrigger()"
 *   />
 *
 * Used by:
 *  - ReportBuilderComponent — rendered in the "Step 3: Live Preview" panel below the
 *    Rows and Columns setup sections.
 *
 * Inputs:
 *  - `columns`        — The current `ColumnDef[]` array from the builder.
 *  - `rows`           — The current `ReportRow[]` array from the builder.
 *  - `reportingDate`  — ISO date string (YYYY-MM-DD) for computing column date labels.
 *  - `granularities`  — `{ value, label }[]` options used to label granularity rows.
 *  - `previewTrigger` — A numeric counter incremented to force re-render when needed.
 *
 * Column hierarchy:
 *  - L1 columns — Main header columns, sorted by `displayOrder`.
 *  - L2 columns — Sub-columns nested under a L1 parent via `parentId`.
 *  - HEADER-type columns render as a purely visual group header with no date label.
 *
 * Date label logic:
 *  - `_adjustedRefDate()` shifts the reporting date back one year for PREVIOUS_YEAR columns.
 *  - `DateFormatter.resolveColumnDateLabel()` computes the human-readable column header date.
 */
export class LiveLayoutPreviewComponent {
  // Inputs matching ReportBuilderComponent's preview state (signal-based)
  columns = input<any[]>([]);
  rows = input<any[]>([]);
  reportingDate = input<string>('');
  granularities = input<string[]>([]);
  previewTrigger = input<number>(0);

  // ─── Private helper: build canonical column list in display order ─────────

  private _sortedCols(): any[] {
    const raw = this.columns();
    return raw.map((col, idx) => ({ col, idx }))
      .sort((a, b) => colSortKey(a.col, a.idx) - colSortKey(b.col, b.idx))
      .map(x => x.col);
  }

  /**
   * Builds an L2 children map keyed by parent colId (UPPER-TRIMMED).
   * Also returns l1Cols in display order.
   */
  private _buildColumnIndex(cols: any[]): {
    l1Cols: any[];
    l2ChildrenMap: Map<string, any[]>;
  } {
    const l2ChildrenMap = new Map<string, any[]>();
    for (const col of cols) {
      if (col.tierLevel === 'L2' && col.parentId && col.parentId.trim() !== '') {
        const key = col.parentId.trim().toUpperCase();
        if (!l2ChildrenMap.has(key)) {
          l2ChildrenMap.set(key, []);
        }
        l2ChildrenMap.get(key)!.push(col);
      }
    }
    // L1 = explicit L1 tier OR any column that has no tierLevel set (defaults to L1).
    // HEADER-type columns are always L1 parents.
    const l1Cols = cols.filter(c => c.tierLevel !== 'L2');
    return { l1Cols, l2ChildrenMap };
  }

  private _adjustedRefDate(col: any): string {
    const raw = this.reportingDate() || new Date().toISOString().split('T')[0];
    let offset = 0;
    let grain = 'WEEK';
    if (col.colType === 'ROLLING') {
      offset = col.periodOffset || 0;
      grain = col.rollingGrain || 'WEEK';
    } else if (col.tierLevel === 'L2' && col.parentId) {
      const parentKey = col.parentId.trim().toUpperCase();
      const parent = this.columns().find(c => c.colId.trim().toUpperCase() === parentKey);
      if (parent && parent.colType === 'ROLLING') {
        offset = parent.periodOffset || 0;
        grain = parent.rollingGrain || 'WEEK';
      }
    }
    if (offset !== 0) {
      const parts = raw.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month - 1, day);
        
        const g = grain.toUpperCase();
        if (g === 'DAY') {
          d.setDate(d.getDate() + offset);
        } else if (g === 'WEEK') {
          d.setDate(d.getDate() + offset * 7);
        } else if (g === 'MONTH') {
          d.setMonth(d.getMonth() + offset);
        } else if (g === 'QUARTER') {
          d.setMonth(d.getMonth() + offset * 3);
        } else if (g === 'YEAR') {
          d.setFullYear(d.getFullYear() + offset);
        }
        
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        return `${yStr}-${mStr}-${dStr}`;
      }
    }
    return raw;
  }

  // ─── Computed signals ─────────────────────────────────────────────────────

  expandedColumns = computed(() => {
    this.previewTrigger();
    const cols = this._sortedCols();
    const expanded: any[] = [];

    for (const col of cols) {
      const refDate = this._adjustedRefDate(col);
      if (col.colType === 'ROLLING') {
        const subCols = DateFormatter.getRollingSubColumns(refDate, col, col.rollingN || 1, col.rollingGrain || 'WEEK');
        expanded.push(...subCols);
      } else if (col.tierLevel !== 'L2') {
        // Skip HEADER-type L1 banner columns from the flat expanded list;
        // only include them if they have no L2 children (i.e., standalone).
        expanded.push({ ...col, isExpandedSubCol: false });
      }
    }
    return expanded;
  });

  previewHeaderRows = computed(() => {
    this.previewTrigger();
    const cols = this._sortedCols();
    const { l1Cols, l2ChildrenMap } = this._buildColumnIndex(cols);

    const row1: any[] = [];
    const row2: any[] = [];

    for (const col of l1Cols) {
      const refDate = this._adjustedRefDate(col);

      if (col.colType === 'ROLLING') {
        // ROLLING parent → children are dynamically-generated date sub-columns
        const subCols = DateFormatter.getRollingSubColumns(refDate, col, col.rollingN || 1, col.rollingGrain || 'WEEK');
        row1.push({
          ...col,
          colspan: subCols.length,
          colSpan: subCols.length,
          rowspan: 1,
          rowSpan: 1,
          isParent: true,
          isLastChild: true,
        });
        subCols.forEach((sub, idx) => {
          row2.push({
            ...sub,
            colspan: 1,
            colSpan: 1,
            rowspan: 1,
            rowSpan: 1,
            isChild: true,
            isLastChild: idx === subCols.length - 1,
          });
        });

      } else if (col.colType === 'HEADER') {
        // HEADER-type L1 parent → look for explicitly assigned L2 children.
        // A child may itself be a ROLLING column — in that case we expand its
        // date sub-columns into row2 and count them towards the parent colspan.
        const children = l2ChildrenMap.get(col.colId.trim().toUpperCase()) || [];
        if (children.length > 0) {
          let totalColspan = 0;
          const row2Cells: any[] = [];

          for (const child of children) {
            const childRefDate = this._adjustedRefDate(child);
            if (child.colType === 'ROLLING') {
              const subCols = DateFormatter.getRollingSubColumns(
                childRefDate, child, child.rollingN || 1, child.rollingGrain || 'WEEK'
              );
              totalColspan += subCols.length;
              subCols.forEach((sub, idx) => {
                row2Cells.push({
                  ...sub,
                  colspan: 1,
                  colSpan: 1,
                  rowspan: 1,
                  rowSpan: 1,
                  isChild: true,
                  isLastChild: false, // will determine absolute last below
                });
              });
            } else {
              totalColspan += 1;
              row2Cells.push({
                ...child,
                colspan: 1,
                colSpan: 1,
                rowspan: 1,
                rowSpan: 1,
                isChild: true,
                isLastChild: false,
              });
            }
          }

          if (row2Cells.length > 0) {
            row2Cells[row2Cells.length - 1].isLastChild = true;
          }

          row1.push({
            ...col,
            colspan: totalColspan,
            colSpan: totalColspan,
            rowspan: 1,
            rowSpan: 1,
            isParent: true,
            isLastChild: true,
          });
          row2.push(...row2Cells);
        } else {
          // HEADER with no children yet → show as empty banner spanning 2 rows
          row1.push({
            ...col,
            colspan: 1,
            colSpan: 1,
            rowspan: 2,
            rowSpan: 2,
            isStandalone: true,
            isLastChild: true,
          });
        }

      } else {
        // Ordinary L1 columns — may have explicit L2 children assigned
        const children = l2ChildrenMap.get(col.colId.trim().toUpperCase()) || [];
        if (children.length > 0) {
          row1.push({
            ...col,
            colspan: children.length,
            colSpan: children.length,
            rowspan: 1,
            rowSpan: 1,
            isParent: true,
            isLastChild: true,
          });
          children.forEach((child, idx) => {
            row2.push({
              ...child,
              colspan: 1,
              colSpan: 1,
              rowspan: 1,
              rowSpan: 1,
              isChild: true,
              isLastChild: idx === children.length - 1,
            });
          });
        } else {
          // Truly standalone — spans both header rows vertically
          row1.push({
            ...col,
            colspan: 1,
            colSpan: 1,
            rowspan: 2,
            rowSpan: 2,
            isStandalone: true,
            isLastChild: true,
          });
        }
      }
    }

    // Orphaned L2 (parentId points to a non-existent L1) → render as standalone in row1
    const orphanedL2 = cols.filter(c =>
      c.tierLevel === 'L2' &&
      (!c.parentId || !l1Cols.some(p => p.colId.trim().toUpperCase() === c.parentId.trim().toUpperCase()))
    );
    for (const col of orphanedL2) {
      row1.push({
        ...col,
        colspan: 1,
        colSpan: 1,
        rowspan: 2,
        rowSpan: 2,
        isStandalone: true,
        isLastChild: true,
      });
    }

    return { row1, row2 };
  });

  previewLeafColumns = computed(() => {
    this.previewTrigger();
    const cols = this._sortedCols();
    const { l1Cols, l2ChildrenMap } = this._buildColumnIndex(cols);

    const leaves: any[] = [];

    for (const col of l1Cols) {
      const refDate = this._adjustedRefDate(col);

      if (col.colType === 'ROLLING') {
        const subCols = DateFormatter.getRollingSubColumns(refDate, col, col.rollingN || 1, col.rollingGrain || 'WEEK');
        subCols.forEach((sc, idx) => {
          sc.isLastChild = (idx === subCols.length - 1);
        });
        leaves.push(...subCols);

      } else if (col.colType === 'HEADER') {
        const children = l2ChildrenMap.get(col.colId.trim().toUpperCase()) || [];
        if (children.length > 0) {
          const headerLeaves: any[] = [];
          for (const child of children) {
            const childRefDate = this._adjustedRefDate(child);
            if (child.colType === 'ROLLING') {
              const subCols = DateFormatter.getRollingSubColumns(
                childRefDate, child, child.rollingN || 1, child.rollingGrain || 'WEEK'
              );
              headerLeaves.push(...subCols);
            } else {
              headerLeaves.push(child);
            }
          }
          headerLeaves.forEach((hl, idx) => {
            hl.isLastChild = (idx === headerLeaves.length - 1);
          });
          leaves.push(...headerLeaves);
        } else {
          // No children yet: show the header itself as a placeholder leaf
          col.isLastChild = true;
          leaves.push(col);
        }

      } else {
        const children = l2ChildrenMap.get(col.colId.trim().toUpperCase()) || [];
        if (children.length > 0) {
          children.forEach((c, idx) => {
            c.isLastChild = (idx === children.length - 1);
          });
          leaves.push(...children);
        } else {
          col.isLastChild = true;
          leaves.push(col);
        }
      }
    }

    // Orphaned L2s
    const orphanedL2 = cols.filter(c =>
      c.tierLevel === 'L2' &&
      (!c.parentId || !l1Cols.some(p => p.colId.trim().toUpperCase() === c.parentId.trim().toUpperCase()))
    );
    orphanedL2.forEach((ol, idx) => {
      ol.isLastChild = (idx === orphanedL2.length - 1);
    });
    leaves.push(...orphanedL2);

    return leaves;
  });

  granularityPreviewCols = computed(() => {
    return this.granularities().map((g) => ({
      value: g,
      shortLabel: g.includes('.') ? g.substring(g.lastIndexOf('.') + 1) : g,
      fullPath: g,
    }));
  });



  getTimeframeBadgeLabel(col: any): string {
    let label = col.colType || '';
    if (col.colType === 'ROLLING') {
      label = col.rollingGrain || 'WEEK';
    }
    if (col.rollingN && col.rollingN > 1) {
      label += ` L:${col.rollingN}`;
    }
    if (col.periodOffset && col.periodOffset !== 0) {
      label += ` Off:${col.periodOffset}`;
    }
    return label;
  }

  getBadgeClass(col: any): string {
    if (col.colType === 'HEADER') {
      return 'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200';
    }
    if (col.periodOffset && col.periodOffset !== 0) {
      return 'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100';
    }
    return 'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-indigo-600 border border-indigo-100';
  }
}
