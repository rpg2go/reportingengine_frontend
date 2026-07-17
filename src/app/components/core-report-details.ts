import { Component, OnInit, signal, computed, model, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { GranularityPickerComponent } from './granularity-picker';
import { CoreTimeEngineComponent } from './core-time-engine';

@Component({
  selector: 'app-core-report-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    GranularityPickerComponent,
    CoreTimeEngineComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './core-report-details.html',
  styleUrls: ['./core-report-details.css']
})
export class CoreReportDetailsComponent implements OnInit {
  // Model and Input bindings for synchronization with parent
  reportId = model<string>('');
  reportName = model<string>('');
  reportVersion = input<number>(1);
  status = input<string>('draft');
  isLocked = input<boolean>(false);
  
  // Shared Form Group and option inputs
  reportForm = input.required<FormGroup>();
  dynamicGranularityOptions = input<any[]>([]);
  availableReportingDates = input<string[]>([]);
  
  // Timeframe and reporting date models
  reportingDate = model<string>('');
  timeframeStart = model<string>('');
  timeframeEnd = model<string>('');
  timeframeMode = model<'custom' | 'today_minus_2' | 'today_minus_1' | 'today'>('today_minus_2');

  // Polymorphic time configuration properties mapping
  reportingDateType = model<string>('DYNAMIC');
  reportingDateStatic = model<string>('');
  reportingDateExpression = model<string>('T-2');

  timeframeStartType = model<string>('FIXED');
  timeframeStartStatic = model<string>('2022-01-01');
  timeframeStartExpression = model<string>('');

  timeframeEndType = model<string>('DYNAMIC');
  timeframeEndStatic = model<string>('');
  timeframeEndExpression = model<string>('T-2');
  
  // General filters configurations
  generalFilterScopes = input<any[]>([]);
  isGeneralFilterRawMode = input<boolean>(false);
  generalFilterExpr = input<string>('');

  // Event emitters
  triggerValidation = output<void>();
  configureGeneralFilters = output<void>();

  // Dropdown select value tracking
  reportingDateSelectValue = signal<string>('T-2');
  customReportingDate = signal<string>('');

  timeframeModeSelectValue = signal<string>('today_minus_2');

  ngOnInit(): void {
    // Dynamic reporting date initialization (defaults to 'T-2')
    if (!this.reportingDate()) {
      this.reportingDate.set('T-2');
    }

    // Initialize dropdown select state based on initial model values
    const currentRepDate = this.reportingDate();
    if (currentRepDate === 'T' || currentRepDate === 'T-1' || currentRepDate === 'T-2') {
      this.reportingDateSelectValue.set(currentRepDate);
    } else {
      this.reportingDateSelectValue.set('custom');
      this.customReportingDate.set(currentRepDate);
    }

    const currentTfMode = this.timeframeMode();
    this.timeframeModeSelectValue.set(currentTfMode);
    if (!this.customReportingDate()) {
      this.customReportingDate.set(this.dateOffsetString(-2));
    }
  }

  // Helper date offset generator relative to today
  dateOffsetString(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  }

  // Real-time evaluation of Reporting Date
  resolvedReportingDateText = computed(() => {
    const d = this.reportingDate();
    if (d === 'T') return this.dateOffsetString(0);
    if (d === 'T-1') return this.dateOffsetString(-1);
    if (d === 'T-2') return this.dateOffsetString(-2);
    return d || '—';
  });

  // Real-time evaluation of timeframe To Date
  resolvedTimeframeEndText = computed(() => {
    const mode = this.timeframeMode();
    if (mode === 'today') return this.dateOffsetString(0);
    if (mode === 'today_minus_1') return this.dateOffsetString(-1);
    if (mode === 'today_minus_2') return this.dateOffsetString(-2);
    return this.timeframeEnd() || '—';
  });

  // Handle Reporting Date select dropdown change
  onReportingDateDropdownChange(val: string): void {
    this.reportingDateSelectValue.set(val);
    if (val === 'T' || val === 'T-1' || val === 'T-2') {
      this.reportingDate.set(val);
    } else {
      this.reportingDate.set(this.customReportingDate());
    }
    this.triggerValidation.emit();
  }

  // Handle Custom Reporting Date input change
  onCustomReportingDateChange(date: string): void {
    this.customReportingDate.set(date);
    this.reportingDate.set(date);
    this.triggerValidation.emit();
  }

  // Handle Timeframe mode select dropdown change
  onTimeframeModeDropdownChange(mode: 'today' | 'today_minus_1' | 'today_minus_2' | 'custom'): void {
    this.timeframeModeSelectValue.set(mode);
    this.timeframeMode.set(mode);
    
    if (mode === 'today') {
      this.timeframeEnd.set(this.dateOffsetString(0));
    } else if (mode === 'today_minus_1') {
      this.timeframeEnd.set(this.dateOffsetString(-1));
    } else if (mode === 'today_minus_2') {
      this.timeframeEnd.set(this.dateOffsetString(-2));
    } else {
      // Default custom end date to yesterday if not set
      if (!this.timeframeEnd()) {
        this.timeframeEnd.set(this.dateOffsetString(-1));
      }
    }
    this.triggerValidation.emit();
  }

  // Handle Custom Timeframe End input change
  onCustomTimeframeEndChange(date: string): void {
    this.timeframeEnd.set(date);
    this.triggerValidation.emit();
  }

  onTimeframeConfigChange(cfg: any): void {
    this.reportingDateType.set(cfg.reportingDateType);
    this.reportingDateStatic.set(cfg.reportingDateStatic);
    this.reportingDateExpression.set(cfg.reportingDateExpression);
    this.timeframeStartType.set(cfg.timeframeStartType);
    this.timeframeStartStatic.set(cfg.timeframeStartStatic);
    this.timeframeStartExpression.set(cfg.timeframeStartExpression);
    this.timeframeEndType.set(cfg.timeframeEndType);
    this.timeframeEndStatic.set(cfg.timeframeEndStatic);
    this.timeframeEndExpression.set(cfg.timeframeEndExpression);

    if (cfg.reportingDateType === 'FIXED') {
      this.reportingDate.set(cfg.reportingDateStatic);
    } else {
      this.reportingDate.set(cfg.reportingDateExpression);
    }

    if (cfg.timeframeStartType === 'FIXED') {
      this.timeframeStart.set(cfg.timeframeStartStatic);
    } else {
      this.timeframeStart.set(cfg.timeframeStartExpression);
    }

    if (cfg.timeframeEndType === 'FIXED') {
      this.timeframeEnd.set(cfg.timeframeEndStatic);
    } else {
      this.timeframeEnd.set(cfg.timeframeEndExpression);
    }

    this.triggerValidation.emit();
  }

  onReportNameChange(name: string): void {
    this.reportName.set(name);
    this.triggerValidation.emit();
  }

  onConfigureGeneralFilters(): void {
    this.configureGeneralFilters.emit();
  }

  getGeneralFilterSummary(group: any): string {
    if (!group) return '—';
    if (Array.isArray(group)) {
      return group.map((f, idx) => {
        const condStr = `${f.dimTable ? f.dimTable + '.' : ''}${f.attribute} ${f.operator} ${f.value}`;
        if (idx < group.length - 1) {
          return `${condStr} ${f.conjunction || 'AND'}`;
        }
        return condStr;
      }).join(' ');
    }
    
    const parts: string[] = [];
    if (group.rules) {
      for (const rule of group.rules) {
        if (!rule.columnName) continue;
        const col = rule.tableName ? `${rule.tableName}.${rule.columnName}` : rule.columnName;
        const op = rule.operator || 'is';
        const vals = rule.value || [];
        
        let summary = '';
        if (op === 'is blank' || op === 'is not blank' || op === 'is null' || op === 'is not null') {
          summary = `${col} ${op}`;
        } else {
          const displayOp = op === 'is' ? '=' : op;
          const valStr = vals.length > 0 ? (vals.length === 1 ? `'${vals[0]}'` : `('${vals.join("', '")}')`) : 'NULL';
          summary = `${col} ${displayOp} ${valStr}`;
        }
        parts.push(summary);
      }
    }
    if (group.childGroups) {
      for (const child of group.childGroups) {
        const childStr = this.getGeneralFilterSummary(child);
        if (childStr && childStr !== '—') {
          parts.push(childStr);
        }
      }
    }
    if (parts.length === 0) return '—';
    const conj = ` ${group.logicalOperator || 'AND'} `;
    return parts.length === 1 ? parts[0] : `(${parts.join(conj)})`;
  }
}
