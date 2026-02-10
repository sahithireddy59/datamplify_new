import { Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { LoaderComponent } from './shared/loader/loader.component';
import { PermissionService } from './services/permission.service';
import { EmbedAuthService } from './shared/services/embed-auth.service';
import { WorkbenchService } from './components/workbench/workbench.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,LoaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Datamplify';
  private sdkInitialized = false;
  isEmbedMode: boolean = false;
  private isPermissionsLoaded: boolean = false;

  constructor(private permissionService: PermissionService, private embedAuthService: EmbedAuthService, private workbenchService: WorkbenchService) {}

  ngOnInit() {
    this.isEmbedMode = window.self !== window.top;

    if(this.isLoggedIn()){
      this.restorePermissionsFromStorage();
    }
    if (this.isEmbedMode) {
      this.initSDKListener();
    }
  }

  isLoggedIn(): boolean {
    if (this.isEmbedMode) {
      return this.embedAuthService.isLoggedIn();
    }

    const user = localStorage.getItem('currentUser');

    if (user) {
      const parsed = JSON.parse(user);
      if (parsed && parsed.Token) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  restorePermissionsFromStorage() {
    let stored = JSON.parse(localStorage.getItem('permissions') || '[]');
    // stored = [1, 22, 15, 25, 26]
    this.permissionService.setPermissions(stored);
  }

  initSDKListener() {
    window.addEventListener("message", (event: MessageEvent) => {
      if (!event.data || event.data.source !== "DATAMPLIFY_SDK") return;
      switch (event.data.type) {
        case "INIT_CONFIG":
          if (this.sdkInitialized) return;
          this.sdkInitialized = true;
          if (event.data.sdkType === 'client-credentials') {
            const accessToken = event.data?.accessToken;
            if (!accessToken) {
              console.error("SDK did not send accessToken");
              return;
            }
            this.embedAuthService.setToken(event.data.accessToken);
            this.getPermissionsList();
          }
          this.embedAuthService.setEmbedType(event.data.sdkType);
          if(event.data.sdkType === 'authorization-code'){
            window.parent.postMessage({ source: "DATAMPLIFY_APP", type: "send_accessToken" }, "*");
          }
        break;

        case "accessToken": 
          this.embedAuthService.setToken(event.data.accessToken);
        break;

        case "token":
          console.log("Received tokens:", event.data.payload);
          this.embedAuthService.setToken(event.data.payload.accesstoken);
          if(!this.isPermissionsLoaded){
            this.getPermissionsList();
            this.isPermissionsLoaded = true;
          }
        break;

        case "importConnections":
          this.embedAuthService.emitImportConnections(event.data.payload.apiData);
        break;

        case "theme":
          console.log("Received theme:", event.data.payload);
          const html = document.documentElement;

          // Force override after Switcher applies settings
          html.setAttribute('data-menu-styles', event.data.payload);
          html.setAttribute('data-theme-mode', event.data.payload);
          html.setAttribute('data-header-styles', event.data.payload);
        break;
      }
    });

    window.parent.postMessage(
      {
        source: "DATAMPLIFY_APP",
        type: "APP_READY",
        payload: { is_app_loaded: true }
      },
      "*"
    );
  }

  getPermissionsList() {
    this.workbenchService.getPermissionsList().subscribe({
      next: (data: any) => {
        console.log(data);
        this.permissionService.setPermissions(data.privileges);
      },
      error: (error: any) => {
        console.log(error);
      }
    });
  }
}
