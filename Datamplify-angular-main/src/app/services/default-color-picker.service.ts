import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DefaultColorPickerService {

  constructor() { }

  private colorSubject = new BehaviorSubject<string>('#3498db');
  color$ = this.colorSubject.asObservable();

  // Method to update the color
  setColor(newColor: string): void {
    this.colorSubject.next(newColor);
  }

  // Method to get the current color value
  getColor(): string {
    return this.colorSubject.getValue();
  }

}