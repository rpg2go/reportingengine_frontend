import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { LiveLayoutPreviewComponent } from './live-layout-preview';
import { Injector, runInInjectionContext, signal } from '@angular/core';

describe('LiveLayoutPreviewComponent', () => {
  let component: LiveLayoutPreviewComponent;

  it('should calculate previewHeaderRows and previewLeafColumns correctly', () => {
    const injector = Injector.create({ providers: [] });

    runInInjectionContext(injector, () => {
      component = new LiveLayoutPreviewComponent();
    });

    // Provide columns and rows via signal inputs overrides
    (component as any).columns = signal([
      { colId: 'C1', label: 'Parent Header', colType: 'HEADER', tierLevel: 'L1', parentId: '' },
      { colId: 'C2', label: 'Child A', colType: 'WTD', tierLevel: 'L2', parentId: 'C1', rollingN: 3 },
      { colId: 'C3', label: 'Child B', colType: 'MTD', tierLevel: 'L2', parentId: 'C1', rollingN: 6 },
      { colId: 'C4', label: 'Standalone Header', colType: 'HEADER', tierLevel: 'L1', parentId: '' }
    ]);

    (component as any).reportingDate = signal('2026-05-26');
    (component as any).granularities = signal([]);
    (component as any).previewTrigger = signal(0);

    const headers = component.previewHeaderRows();
    expect(headers.row1.length).toBe(2); // C1 (parent) and C4 (standalone)
    expect(headers.row2.length).toBe(2); // C2 and C3 (children)

    // C1 colspan = 2 (two children), rowspan = 1 (has children)
    const c1 = headers.row1.find(h => h.colId === 'C1');
    expect(c1.colspan).toBe(2);
    expect(c1.rowspan).toBe(1);

    // C4 rowspan = 2 (standalone L1)
    const c4 = headers.row1.find(h => h.colId === 'C4');
    expect(c4.rowspan).toBe(2);
    expect(c4.colspan).toBe(1);

    const leaves = component.previewLeafColumns();
    expect(leaves.length).toBe(3); // C2, C3, C4
    expect(leaves[0].colId).toBe('C2');
    expect(leaves[1].colId).toBe('C3');
    expect(leaves[2].colId).toBe('C4');
  });
});
