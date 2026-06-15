import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SemanticJoin {
  join_id?: string;
  explore_name?: string;
  to_view?: string;
  dim_view_name?: string;
  dimView?: string;
  join_type?: string;
  joinType?: string;
  join_sql?: string;
  joinSql?: string;
  sql?: string;
}

@Component({
  selector: 'app-semantic-network',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './semantic-network.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .fact-card {
      background: var(--color-apple-card, #1E293B);
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-left: 4px solid #4F46E5; /* Indigo-600 */
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-card);
    }
    :host-context(html.light) .fact-card {
      background: #F8FAFC;
      border-color: #E2E8F0;
      border-left-color: #4F46E5;
    }
    .dim-card {
      background: var(--color-apple-card, #1E293B);
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 12px;
      padding: 16px;
      flex-grow: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: var(--shadow-card);
      transition: all 0.2s ease;
    }
    .dim-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
    :host-context(html.light) .dim-card {
      background: #FFFFFF;
      border-color: #EBF0F5; /* slate-150 */
    }
    .border-slate-150 {
      border-color: var(--border-color, rgba(255,255,255,0.08));
    }
    :host-context(html.light) .border-slate-150 {
      border-color: #EBF0F5;
    }
    .dim-node-row {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .node-connector-horizontal {
      width: 24px;
      height: 2px;
      border-top: 2px dashed rgba(255, 255, 255, 0.15);
      flex-shrink: 0;
    }
    :host-context(html.light) .node-connector-horizontal {
      border-top-color: #CBD5E1;
    }
    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 12px;
      font-family: monospace;
    }
    .badge-muted {
      background: rgba(255, 255, 255, 0.05);
      color: #94A3B8;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    :host-context(html.light) .badge-muted {
      background: #F1F5F9;
      color: #64748B;
      border-color: #E2E8F0;
    }
    code {
      font-family: monospace;
      font-size: 10px;
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 6px;
      border-radius: 4px;
      color: #E2E8F0;
    }
    :host-context(html.light) code {
      background: #F8FAFC;
      color: #475569;
    }
    .text-indigo-600 {
      color: #818CF8;
    }
    :host-context(html.light) .text-indigo-600 {
      color: #4F46E5;
    }
  `]
})
export class SemanticNetworkComponent {
  factTable = input.required<string>();
  joins = input<SemanticJoin[]>([]);

  formatFactTable(name: string | undefined): string {
    if (!name) return 'analytics.fact_sales';
    let formatted = name.toLowerCase();
    if (formatted.startsWith('view_')) {
      formatted = 'fact_' + formatted.substring(5);
    } else if (!formatted.startsWith('fact_') && !formatted.includes('.')) {
      formatted = 'fact_' + formatted;
    }
    if (!formatted.includes('.')) {
      return `analytics.${formatted}`;
    }
    return formatted;
  }

  formatViewName(name: string | undefined): string {
    if (!name) return '';
    let formatted = name;
    if (formatted.startsWith('view_')) {
      formatted = 'dim_' + formatted.slice(5);
    }
    return formatted
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getJoinSql(join: any): string {
    if (join.join_sql || join.sql || join.joinSql) {
      return join.join_sql || join.sql || join.joinSql;
    }
    const view = (join.to_view || join.dim_view_name || join.dimView || '').toLowerCase();
    if (view.includes('customer')) {
      return 'customer_id = dim_customers.id';
    }
    if (view.includes('date')) {
      return 'date_key = dim_date.date_key';
    }
    if (view.includes('location')) {
      return 'location_id = dim_location.id';
    }
    const cleanView = view.startsWith('view_') ? view.slice(5) : view.startsWith('dim_') ? view.slice(4) : view;
    return `customer_id = dim_${cleanView}.id`;
  }

  getJoinType(join: any): string {
    const rawType = join.join_type || join.joinType || '';
    if (rawType) {
      return rawType.toUpperCase().includes('JOIN') ? rawType.toUpperCase() : `${rawType.toUpperCase()} JOIN`;
    }
    return 'LEFT OUTER JOIN';
  }
}
