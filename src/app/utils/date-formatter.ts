export interface HeaderConfig {
  colId: string;
  label: string;
  colType: string;
  periodOffset: number;
  rollingN: number | null;
  rollingGrain: string | null;
  formulaExpr: string;
  isExpandedSubCol: boolean;
  parentColId?: string;
}

export class DateFormatter {
  /**
   * Helper to parse a date string in YYYY-MM-DD format without timezone shifts.
   */
  private static parseDate(dateStr: string): Date {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date();
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Formats a single date into "DD MMM" with 2-digit day padding.
   */
  private static formatShortDay(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`;
  }

  /**
   * Formats a date range into "D MMM - D MMM" (unpadded days).
   */
  private static formatWeekRange(start: Date, end: Date): string {
    const startDay = start.getDate();
    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endDay = end.getDate();
    const endMonth = end.toLocaleString('en-US', { month: 'short' });
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }

  /**
   * Formats a date into "Month Name YYYY".
   */
  private static formatMonthYear(date: Date): string {
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  }

  /**
   * Finds the Monday of the week containing the given date.
   */
  private static getMonday(date: Date): Date {
    const result = new Date(date.getTime());
    const day = result.getDay();
    const diff = result.getDate() - (day === 0 ? 6 : day - 1);
    result.setDate(diff);
    return result;
  }

  public static getRollingSubColumns(
    referenceDate: string,
    parentCol: any,
    rollingN: number,
    rollingGrain: string
  ): HeaderConfig[] {
    const ref = this.parseDate(referenceDate);
    const grain = (rollingGrain || 'WEEK').toUpperCase();
    const result: HeaderConfig[] = [];
    const parentColId = parentCol.colId;

    for (let i = 1; i <= rollingN; i++) {
      const subColId = `${parentColId}_${i}`;
      let label = '';

      switch (grain) {
        case 'DAY': {
          const target = new Date(ref.getTime());
          target.setDate(ref.getDate() - i);
          label = this.formatShortDay(target);
          break;
        }

        case 'MONTH': {
          const target = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
          label = this.formatMonthYear(target);
          break;
        }

        case 'WEEK':
        default: {
          const refMonday = this.getMonday(ref);
          const targetMonday = new Date(refMonday.getTime());
          targetMonday.setDate(refMonday.getDate() - i * 7);

          const targetSunday = new Date(targetMonday.getTime());
          targetSunday.setDate(targetMonday.getDate() + 6);

          label = this.formatWeekRange(targetMonday, targetSunday);
          break;
        }
      }

      result.push({
        ...parentCol,
        colId: subColId,
        label: label,
        colType: grain, // The sub-column type can be treated as the grain
        periodOffset: -i,
        rollingN: null,
        rollingGrain: null,
        formulaExpr: '',
        isExpandedSubCol: true,
        parentColId: parentColId
      });
    }

    return result;
  }
}
