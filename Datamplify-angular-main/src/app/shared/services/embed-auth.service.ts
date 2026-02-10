import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({ providedIn: 'root' })
export class EmbedAuthService {
    private token: string | null = null;
    private token$ = new BehaviorSubject<string | null>(null);
    private type: string | null = null;
    private importConnectionsSubject = new BehaviorSubject<any[]>([]);
    importConnections$ = this.importConnectionsSubject.asObservable();

    setToken(token: string) {
        this.token = token;
        this.token$.next(this.token);
    }

    getToken(): string | null {
        return this.token;
    }

    tokenChanges$() {
        return this.token$.asObservable();
    }

    invalidateToken() {
        console.log('[EMBED] Token invalidated');
        this.token$.next(null);
    }

    startRefresh() {
        this.invalidateToken();
    }

    clear() {
        this.token = null;
    }

    isLoggedIn(): boolean {
        return !!this.token;
    }

    isEmbedMode() {
        return window.self !== window.top;
    }

    setEmbedType(type: any) {
        this.type = type;
    }

    getEmbedType() {
        return this.type;
    }

    requestTokenFromSdk() {
        if (this.getEmbedType() === 'client-credentials') {
            window.parent.postMessage({ source: "DATAMPLIFY_APP", type: "accessToken", payload: {} }, "*");
        } else {
            window.parent.postMessage({ source: "DATAMPLIFY_APP", type: "accessTokenExpired" }, "*");
        }
    }

    emitImportConnections(data: any) {
        this.importConnectionsSubject.next(data);
    }
}