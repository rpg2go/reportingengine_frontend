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
  isLastChild?: boolean;
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
   * Returns the ISO 8601 week number (1–53) for a given date as "WK{n}".
   * Covers the full 52-week year so week numbers are globally unambiguous.
   *
   * Algorithm: shift the date to the nearest Thursday (ISO rule), then compute
   * how many complete weeks have elapsed since Jan 1 of that Thursday's year.
   */
  private static formatISOWeek(date: Date): string {
    // Work in UTC to avoid DST-boundary surprises
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // ISO weekday: Mon=1 … Sun=7
    const dayOfWeek = d.getUTCDay() || 7;
    // Shift to Thursday of the same ISO week (the anchor day for ISO week numbering)
    d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
    // Jan 1 of the year that owns this Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Number of complete weeks elapsed
    const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `WK${isoWeek}`;
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

    for (let i = rollingN; i >= 1; i--) {
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

        case 'QUARTER': {
          const target = new Date(ref.getFullYear(), ref.getMonth() - i * 3, 1);
          const quarter = Math.floor(target.getMonth() / 3) + 1;
          label = `Q${quarter} ${target.getFullYear()}`;
          break;
        }

        case 'YEAR': {
          const target = new Date(ref.getFullYear() - i, 0, 1);
          label = `${target.getFullYear()}`;
          break;
        }

        case 'WEEK':
        default: {
          const refMonday = this.getMonday(ref);
          const targetMonday = new Date(refMonday.getTime());
          targetMonday.setDate(refMonday.getDate() - i * 7);

          // Use "WKn Mon" format (e.g. "WK4 Jun") instead of a full date range.
          // The week number is the ordinal week within the Monday's calendar month.
          label = this.formatISOWeek(targetMonday);
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
