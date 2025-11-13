import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml  } from '@angular/platform-browser';

interface LogEntry {
  lineNumber?: number; // Optional as not always present in the raw data
  timestamp?: string;
  level?: string;
  message?: SafeHtml;
  event?: string; // For the group start/end
  sources?: string[];
  logger?: string;
  ti?: any;  // Task Instance Info
  chan?: string; // Channel
  error_detail?: any[];
}

@Component({
  selector: 'app-etl-logger-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './etl-logger-view.component.html',
  styleUrl: './etl-logger-view.component.scss'
})
export class EtlLoggerViewComponent {
  @Input() logs: any[] = [];

  // isGroupStart(entry: any): boolean {
  //   return entry.event?.startsWith('::group::');
  // }

  // isGroupEnd(entry: any): boolean {
  //   return entry.event?.startsWith('::endgroup::');
  // }

  // isStandardLog(entry: any): boolean {
  //   return !this.isGroupStart(entry) && !this.isGroupEnd(entry);
  // }

  // formatLevel(level: string): string {
  //   return level?.toUpperCase() || 'INFO';
  // }

  // formatTimestamp(ts: string): string {
  //   return ts ? `[${ts}]` : '';
  // }

  // stringify(value: any): string {
  //   if (typeof value === 'string') return value;
  //   try {
  //     return JSON.stringify(value, null, 2);
  //   } catch {
  //     return String(value);
  //   }
  // }

  processedLogs: LogEntry[] = []; // Processed logs for display

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {  // React to changes in the 'logs' input
    if (changes['logs'] && this.logs) {
      this.processedLogs = this.processLogs(this.logs);
    }
  }

  processLogs(rawLogs: any[]): LogEntry[] {
    const processed: LogEntry[] = [];

    rawLogs.forEach((rawLog: any, index: number) => {
      if (rawLog.event?.startsWith('::group::')) {
        // Group Start - Directly use what's in the raw object
        processed.push({
          event: rawLog.event,
          sources: rawLog.sources
        });
      } else if (rawLog.event?.startsWith('::endgroup::')) {
        // Group End - Directly use what's in the raw object
        processed.push({ event: rawLog.event });
      } else {
        // Standard Log - Process and Clean up
        const logEntry: LogEntry = {
          lineNumber: index + 1, // Add line number for easier debugging, adjust if needed based on data
          timestamp: rawLog.timestamp,
          level: this.formatLevel(rawLog.level),
          message: this.sanitizeMessage(rawLog.event || rawLog.message || ''), // Use event or message.
          logger: rawLog.logger,
          ti: rawLog.ti,
          chan: rawLog.chan,
          error_detail: rawLog.error_detail,
        };
        processed.push(logEntry);
      }
    });
    return processed;
  }

  isGroupStart(entry: LogEntry) {
    return entry.event?.startsWith('::group::');
  }

  isGroupEnd(entry: LogEntry) {
    return entry.event?.startsWith('::endgroup::');
  }

  isStandardLog(entry: LogEntry) {
    return !this.isGroupStart(entry) && !this.isGroupEnd(entry);
  }

  formatLevel(level: string | undefined) { // Fixed to handle undefined
    return level?.toUpperCase() || 'INFO';
  }

  formatTimestamp(ts: string | undefined) {  // Fixed to handle undefined
    return ts ? `[${ts}]` : '';
  }

  stringify(value: any) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  // Sanitize and make message safe for HTML.
  sanitizeMessage(message: string): SafeHtml {
    //Basic sanitization.  Further sanitization may be needed.
    const sanitizedMessage = message.replace(/source="/g, 'source="');
    return this.sanitizer.bypassSecurityTrustHtml(sanitizedMessage);
  }
}
