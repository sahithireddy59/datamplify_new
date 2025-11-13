import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterIcons',
  standalone:true
})
export class FilterIconsPipe implements PipeTransform {
  transform(iconList: any[], searchText: string): any[] {
    if (!iconList) return [];
    if (!searchText) return iconList;

    searchText = searchText.toLowerCase();
    return iconList.filter((icon) =>
      icon.name.toLowerCase().includes(searchText)
    );
  }
}
