import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-core-time-engine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './core-time-engine.html',
  styleUrls: []
})
export class CoreTimeEngineComponent implements OnInit {
  // Input configuration model matching the report metadata structure
  @Input() reportId: string = '';
  @Input() version: number = 1;

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
    this.reportingDateType = type;
    this.onModelChange();
  }

  setTimeframeStartType(type: string): void {
    this.timeframeStartType = type;
    this.onModelChange();
  }

  setTimeframeEndType(type: string): void {
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
