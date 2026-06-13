import { Component, ChangeDetectionStrategy, signal, computed, input, model, effect, output, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CalendarDay {
  date: Date | null;
  dateStr: string;
  dayNum: number | null;
  isSelectable: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-calendar-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-picker.html',
  styles: [`
    :host {
      display: block;
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 100;
      animation: calendarFadeIn 0.15s ease-out;
    }
    @keyframes calendarFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .calendar-popover-panel {
      width: 280px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }
    
    .calendar-popover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .calendar-month-year {
      font-weight: 700;
      font-size: 13px;
      color: #1e293b;
    }
    
    .month-nav-btn {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .month-nav-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    
    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    
    .day-cell {
      background: transparent;
      border: none;
      border-radius: 6px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding: 6px 0;
      transition: all 0.15s ease;
      text-align: center;
    }

    .empty-cell {
      visibility: hidden;
    }

    .calendar-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
    }

    /* Tailwind utility mappings for calendar picker grid cells */
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .mb-3 { margin-bottom: 0.75rem; }
    .grid { display: grid; }
    .grid-cols-7 { grid-template-columns: repeat(7, 1fr); }
    .text-center { text-align: center; }
    .text-\\[10px\\] { font-size: 10px; }
    .text-slate-400 { color: #94a3b8; }
    .mb-2 { margin-bottom: 0.5rem; }
    .uppercase { text-transform: uppercase; }
    .tracking-wider { letter-spacing: 0.05em; }
    .gap-1 { gap: 0.25rem; }
    .text-xs { font-size: 0.75rem; }
    .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
    .rounded { border-radius: 0.25rem; }
    .transition-all { transition-property: all; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    .text-slate-800 { color: #1e293b; }
    .font-bold { font-weight: 700; }
    .hover\\:bg-indigo-50:hover { background-color: rgba(79, 70, 229, 0.08); color: #4f46e5; }
    .cursor-pointer { cursor: pointer; }
    .bg-indigo-600 { background-color: #4f46e5; }
    .text-white { color: #ffffff; }
    .text-slate-300 { color: #cbd5e1; }
    .pointer-events-none { pointer-events: none; }

    .bg-transparent { background-color: transparent; }
    .hover\\:bg-slate-50:hover { background-color: #f8fafc; }
    .text-slate-700 { color: #334155; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .outline-none { outline: none; }
    .bg-slate-50 { background-color: #f8fafc; }
    .hover\\:bg-slate-100:hover { background-color: #f1f5f9; }
    .text-slate-600 { color: #475569; }
    .hover\\:text-indigo-600:hover { color: #4f46e5; }
    .font-semibold { font-weight: 600; }
    .border { border: 1px solid #e2e8f0; }
    .border-slate-200 { border-color: #e2e8f0; }
    .border-slate-100 { border-color: #f1f5f9; }
    .border-t { border-top: 1px solid #e2e8f0; }
    .mt-3 { margin-top: 0.75rem; }
    .pt-2 { padding-top: 0.5rem; }
  `]
})
export class CalendarPickerComponent {
  availableDates = input<string[]>([]); // Injected dim_date cache signal array
  selectedDate = model<string>(''); // Currently selected date (YYYY-MM-DD)
  dateSelected = output<string>();

  calendarYear = signal<number>(new Date().getFullYear());
  calendarMonth = signal<number>(new Date().getMonth());

  maxSafetyDate = signal<Date>(new Date('2026-12-31'));
  readonly MIN_DATE = '2024-01-01';

  constructor() {
    effect(() => {
      const selected = this.selectedDate();
      if (selected && /^\d{4}-\d{2}-\d{2}$/.test(selected)) {
        const year = parseInt(selected.substring(0, 4), 10);
        const month = parseInt(selected.substring(5, 7), 10) - 1;
        untracked(() => {
          if (this.calendarYear() !== year) {
            this.calendarYear.set(year);
          }
          if (this.calendarMonth() !== month) {
            this.calendarMonth.set(month);
          }
        });
      }
    });
  }

  years = computed(() => {
    const centerYear = 2026;
    const range: number[] = [];
    for (let y = centerYear - 5; y <= centerYear + 5; y++) {
      range.push(y);
    }
    return range;
  });

  onMonthChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.calendarMonth.set(Number(select.value));
  }

  onYearChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.calendarYear.set(Number(select.value));
  }

  jumpToToday(): void {
    const today = new Date();
    this.calendarYear.set(today.getFullYear());
    this.calendarMonth.set(today.getMonth());
    this.selectedDate.set(this.formatDateString(today));
  }

  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  calendarDays = computed(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    
    const days: CalendarDay[] = [];
    
    // First day of current month (0 = Sunday, 6 = Saturday)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Number of days in current month
    const numDays = new Date(year, month + 1, 0).getDate();
    
    // Prev month padding cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        date: null,
        dateStr: '',
        dayNum: null,
        isSelectable: false,
        isSelected: false
      });
    }
    
    // Month days
    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, month, day);
      const dStr = this.formatDateString(d);
      
      days.push({
        date: d,
        dateStr: dStr,
        dayNum: day,
        isSelectable: this.isDateSelectable(d),
        isSelected: this.selectedDate() === dStr
      });
    }
    
    return days;
  });

  isDateSelectable(date: Date): boolean {
    if (!date) return false;
    const dateStr = this.formatDateString(date);
    
    // Normalize date to midnight local time for safe comparison with maxSafetyDate
    const dNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const maxDate = this.maxSafetyDate();
    const maxNormalized = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    
    const isWithinWindow = dateStr >= this.MIN_DATE && dNormalized.getTime() <= maxNormalized.getTime();
    
    // Look up against available dim_date cache signal array
    const existsInCache = this.availableDates().includes(dateStr);
    
    return isWithinWindow && existsInCache;
  }

  formatDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  prevMonth(): void {
    if (this.calendarMonth() === 0) {
      this.calendarMonth.set(11);
      this.calendarYear.update((y) => y - 1);
    } else {
      this.calendarMonth.update((m) => m - 1);
    }
  }

  nextMonth(): void {
    if (this.calendarMonth() === 11) {
      this.calendarMonth.set(0);
      this.calendarYear.update((y) => y + 1);
    } else {
      this.calendarMonth.update((m) => m + 1);
    }
  }

  selectDay(day: CalendarDay): void {
    if (!day.isSelectable) return;
    this.selectedDate.set(day.dateStr);
    this.dateSelected.emit(day.dateStr);
  }
}
