import { RowFilterGroup } from '../components/row-condition-group';

export interface TableFilterScope {
  tableName: string;
  filtersGroup: RowFilterGroup;
}
