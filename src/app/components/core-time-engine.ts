import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-core-time-engine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './core-time-engine.html',
  styleUrls: ['./core-time-engine.css']
})
/**
 * CoreTimeEngineComponent
 *
 * Polymorphic date/timeframe configuration widget that renders three independent
 * date slots (Reporting Date, Timeframe Start, Timeframe End), each of which
 * can be set in two modes:
 *  - **FIXED** — Renders a `<input type="date">` for an absolute YYYY-MM-DD value.
 *  - **DYNAMIC** — Renders a text input for a relative macro token (e.g. `T-2`, `T-30`).
 *
 * Purpose:
 *  Provides a unified UI for configuring all time-axis parameters of a report,
 *  used inside CoreReportDetailsComponent as part of Step 1 of the builder.
 *
 * Usage:
 *   <app-core-time-engine
 *     [reportId]="reportId"
 *     [version]="version"
 *     [isLocked]="isLocked"
 *     [reportingDateType]="reportingDateType"
 *     [reportingDateStatic]="reportingDateStatic"
 *     [reportingDateExpression]="reportingDateExpression"
 *     [timeframeStartType]="timeframeStartType"
 *     [timeframeStartStatic]="timeframeStartStatic"
 *     [timeframeStartExpression]="timeframeStartExpression"
 *     [timeframeEndType]="timeframeEndType"
 *     [timeframeEndStatic]="timeframeEndStatic"
 *     [timeframeEndExpression]="timeframeEndExpression"
 *     (timeframeConfigChange)="onTimeframeChange($event)"
 *   />
 *
 * Used by:
 *  - CoreReportDetailsComponent — renders within the Step 1 timeframe card section.
 *
 * Inputs:
 *  - `reportId`   — Current report identifier (informational only, not used in logic).
 *  - `version`    — Current report version number.
 *  - `isLocked`   — When true, all inputs become read-only.
 *  - `reportingDateType` / `reportingDateStatic` / `reportingDateExpression`
 *    — Controls the Reporting Date slot (FIXED or DYNAMIC mode).
 *  - `timeframeStartType` / `*Static` / `*Expression`
 *    — Controls the Timeframe Start slot.
 *  - `timeframeEndType` / `*Static` / `*Expression`
 *    — Controls the Timeframe End slot.
 *
 * Outputs:
 *  - `timeframeConfigChange` — Emits a config object containing all 9 time properties
 *    whenever any field changes. Parent component consumes this to sync model state.
 *
 * Notes:
 *  - `resolveDate()` provides a client-side preview of what the dynamic expression
 *    would evaluate to based on today's date (used in the UI as a hint string).
 */
export class CoreTimeEngineComponent implements OnInit {
  @Input() reportId: string = '';
  @Input() version: number = 1;
  @Input() isLocked: boolean = false;

  // Reporting Date properties mapping
  @Input() reportingDateType: string = 'DYNAMIC'; // 'FIXED' or 'DYNAMIC'
  @Input() reportingDateStatic: string = ''; // YYYY-MM-DD
  @Input() reportingDateExpression: string = 'T-2';

  // Timeframe Start properties mapping
  @Input() timeframeStartType: string = 'FIXED'; // 'FIXED' or 'DYNAMIC'
  @Input() timeframeStartStatic: string = '2022-01-01'; // YYYY-MM-DD
  @Input() timeframeStartExpression: string = 'T-30';

  // Timeframe End properties mapping
  @Input() timeframeEndType: string = 'DYNAMIC'; // 'FIXED' or 'DYNAMIC'
  @Input() timeframeEndStatic: string = ''; // YYYY-MM-DD
  @Input() timeframeEndExpression: string = 'T-2';

  // Output event to report time configuration state updates to parent component
  @Output() timeframeConfigChange = new EventEmitter<any>();

  ngOnInit(): void {
    // Populate default date fields if empty
    const today = new Date().toISOString().split('T')[0];
    if (!this.reportingDateStatic) {
      this.reportingDateStatic = today;
    }
    if (!this.timeframeEndStatic) {
      this.timeframeEndStatic = today;
    }
  }

  // Model update propagators
  setReportingDateType(type: string): void {
    if (this.isLocked) return;
    this.reportingDateType = type;
    this.onModelChange();
  }

  setTimeframeStartType(type: string): void {
    if (this.isLocked) return;
    this.timeframeStartType = type;
    this.onModelChange();
  }

  setTimeframeEndType(type: string): void {
    if (this.isLocked) return;
    this.timeframeEndType = type;
    this.onModelChange();
  }

  onModelChange(): void {
    this.timeframeConfigChange.emit({
      reportingDateType: this.reportingDateType,
      reportingDateStatic: this.reportingDateStatic,
      reportingDateExpression: this.reportingDateExpression,
      timeframeStartType: this.timeframeStartType,
      timeframeStartStatic: this.timeframeStartStatic,
      timeframeStartExpression: this.timeframeStartExpression,
      timeframeEndType: this.timeframeEndType,
      timeframeEndStatic: this.timeframeEndStatic,
      timeframeEndExpression: this.timeframeEndExpression
    });
  }

  /**
   * Resolves a polymorphic time input (Fixed date or Dynamic relative offset)
   * into a readable mock representation for UI rendering.
   *
   * @param type       The input mode selector ('FIXED' or 'DYNAMIC')
   * @param staticDate The calendar absolute input value (YYYY-MM-DD)
   * @param expression The relative dynamic macro token (e.g. 'T-2', 'T-30')
   * @returns          A resolved date string in YYYY-MM-DD format
   */
  resolveDate(type: string, staticDate: string, expression: string): string {
    if (type === 'FIXED') {
      return staticDate ? staticDate : 'N/A';
    }

    // Resolve Dynamic Expression
    const baseDate = new Date();
    if (!expression) {
      return baseDate.toISOString().split('T')[0];
    }

    const cleaned = expression.trim().toUpperCase();
    if (cleaned === 'T') {
      return baseDate.toISOString().split('T')[0];
    }

    // Parse offset value, e.g. "T-2" or "T-30"
    const match = cleaned.match(/^T\s*([+-])\s*(\d+)$/);
    if (match) {
      const operator = match[1];
      const days = parseInt(match[2], 10);
      const offsetDays = operator === '-' ? -days : days;
      
      baseDate.setDate(baseDate.getDate() + offsetDays);
      return baseDate.toISOString().split('T')[0];
    }

    return baseDate.toISOString().split('T')[0];
  }
}
