import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private requestCount = 0;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  show() {
    this.requestCount++;
    // console.log('LoaderService: show loader, request count:', this.requestCount); // Detailed log
    this.loadingSubject.next(true);
  }

  hide() {
    if (this.requestCount > 0) {
      this.requestCount--;
    }
    // console.log('LoaderService: hide loader, request count:', this.requestCount); // Detailed log
    if (this.requestCount === 0) {
      this.loadingSubject.next(false);
      // console.log('LoaderService: loader hidden'); // Log when loader is hidden
    }
  }
}
