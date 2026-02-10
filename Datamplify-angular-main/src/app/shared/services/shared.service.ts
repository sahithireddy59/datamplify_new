import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  [x: string]: any;
  private downloadRequestSource = new Subject<void>();
  private refreshRequestSource = new Subject<void>();

  downloadRequested$ = this.downloadRequestSource.asObservable();
  refreshRequested$ = this.refreshRequestSource.asObservable();

  private localStorageValue = new BehaviorSubject<string | null>(localStorage.getItem('myValue'));
  public localStorageValue$ = this.localStorageValue.asObservable();

  private duplicatedFlow: any = null;
  isFlowboardCopied: boolean = false;

  private isEmbedMode: boolean = false;

  setDuplicatedFlow(flowData: any): void {
    this.duplicatedFlow = flowData;
    this.isFlowboardCopied = true;
  }
  getDuplicatedFlow(): any {
    return this.duplicatedFlow;
  }

  clearDuplicatedFlow(): void {
    this.duplicatedFlow = null;
    this.isFlowboardCopied = false;
  }

  setEmbedMode(isEmbed: boolean): void {
    this.isEmbedMode = isEmbed;
  }

  getEmbedMode(): boolean {
    return this.isEmbedMode;
  }

  setValue(newValue: string): void {
    localStorage.setItem('myValue', newValue);
    this.localStorageValue.next(newValue); // Notify subscribers
  }

  // Method to get the current value
  getValue(): string | null {
    return this.localStorageValue.getValue();
  }


  download() {
    this.downloadRequestSource.next();
  }

  refresh() {
    this.refreshRequestSource.next(); // Notify subscribers that a refresh has been requested

  }
}