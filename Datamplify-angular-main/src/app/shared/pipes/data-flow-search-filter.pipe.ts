import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dataFlowSearchFilter',
  standalone: true
})
export class DataFlowSearchFilterPipe implements PipeTransform {

  transform(items: any[], searchTerm: string, key: string): any[] {
    if (!items || !searchTerm || !key) return items;
    return items.filter(item =>
      item[key]?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

}
