import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  constructor() { }

  private permissions$ = new BehaviorSubject<number[]>([]);

  setPermissions(ids: number[] = []) {
    this.permissions$.next(Array.from(new Set(ids)));
  }

  getPermissions(): number[] {
    return this.permissions$.getValue();
  }

  // Observable for directives to subscribe
  permissionsObservable(): Observable<number[]> {
    return this.permissions$.asObservable();
  }

  hasPermission(id: number): boolean {
    return this.getPermissions().includes(id);
  }

  hasAny(ids: number[] = []): boolean {
    return ids.some(id => this.hasPermission(id));
  }

  // utility to add/remove at runtime
  addPermission(id: number) {
    const current = this.getPermissions();
    if (!current.includes(id)) this.setPermissions([...current, id]);
  }

  removePermission(id: number) {
    this.setPermissions(this.getPermissions().filter(x => x !== id));
  }
}
