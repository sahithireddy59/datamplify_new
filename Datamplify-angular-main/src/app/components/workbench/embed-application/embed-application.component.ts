import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule  } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SharedModule } from '../../../shared/sharedmodule';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-embed-application',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './embed-application.component.html',
  styleUrl: './embed-application.component.scss'
})
export class EmbedApplicationComponent {
  generatedCode: SafeHtml | null = null;
  rawCodeText: string = '';
  copyButtonText: string = 'Copy';
  disableAppName: boolean = false;
  appName: any = '';
  clientId: any = '';
  clientSecret: any = '';
  type: any = '';
  redirectUrl:any = '';
  targetUrl: any = 'http://localhost:4201/';
  isClientCopied: boolean = false;

  constructor(private sanitizer: DomSanitizer, private workbechService: WorkbenchService, private toasterService: ToastrService) {
  }

  ngOnInit(){
    this.getAppDetails();
  }

  generateScript() {
    const { appName, clientId, targetUrl, type, clientSecret } = { appName: this.appName, clientId: this.clientId, targetUrl: this.targetUrl, type: this.type, clientSecret: this.clientSecret };
    // const apiUrl = 'http://202.65.155.123:80/v1/';
    const apiUrl = 'http://127.0.0.1:8000/v1/';
    let htmlString = '';
    
    // Line 1: SDK script tag (using assets path)
    htmlString += '&lt;<span class="token-tag">script</span> <span class="token-attr">src</span>=<span class="token-str">"assets/sdk/sdk.js"</span>&gt;&lt;/<span class="token-tag">script</span>&gt; \n';
    
    // Line 2: Container div
    htmlString += '&lt;<span class="token-tag">div</span> <span class="token-attr">id</span>=<span class="token-str">"datamplify-container"</span> <span class="token-attr">style</span>=<span class="token-str">"width: 100%; height: 100vh;"</span>&gt;&lt;/<span class="token-tag">div</span>&gt; \n';
    
    // Line 3 onwards: Initialization script
    htmlString += '  <span class="token-comment">// Initialize the Datamplify SDK</span>\n';
    htmlString += `  <span class="token-tag">const</span> datamplify = DatamplifySDK.init({\n`;
    htmlString += `      containerId: <span class="token-str">"datamplify-container"</span>,\n`;
    htmlString += `      appName: <span class="token-str">"${appName}"</span>,\n`;
    htmlString += `      type: <span class="token-str">"${type}"</span>,\n`;
    htmlString += `      clientUrl: <span class="token-str">"${targetUrl}"</span>, \n`;
    if (type === 'client-credentials') {
      htmlString += `      apiUrl: <span class="token-str">"${apiUrl}"</span>, \n`;
      htmlString += `      clientId: <span class="token-str">"${clientId}"</span>,\n`;
      htmlString += `      clientSecret: <span class="token-str">"${clientSecret}"</span>, \n`;
    }
    if (type === 'authorization-code') {
      htmlString += `      onEvent: (<span class="token-tag">event</span>:<span class="token-tag">any</span>) => {\n`;
      htmlString += `          <span class="token-tag">switch</span>(<span class="token-tag">event</span>.type){\n`;
      htmlString += `              <span class="token-tag">case</span> <span class="token-str">"send_accessToken"</span>:\n`;
      htmlString += `                  DatamplifySDK.send(<span class="token-str">"token"</span>, {\n`;
      htmlString += `                      accesstoken: <span class="token-str">"Replace AccessToken Here"</span>,\n`;
      htmlString += `                  });\n`;
      htmlString += `                   <span class="token-tag">break</span>;\n`;
      htmlString += `              <span class="token-tag">case</span> <span class="token-str">"accessTokenExpired"</span>:\n`;
      htmlString += `                  <span class="token-str">Call Above DatamplifySDK.send() Function.</span>\n`;
      htmlString += `                  <span class="token-tag">break</span>;\n`;
      htmlString += `          }\n`;
      htmlString += `      }\n`;
    }
    htmlString += `  })\n`;

    // 1. Create raw text version for clipboard
    // We create a temporary DOM element to strip HTML tags for the copy function
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    this.rawCodeText = tempDiv.textContent || tempDiv.innerText || '';

    // 2. Trust the HTML for display
    this.generatedCode = this.sanitizer.bypassSecurityTrustHtml(htmlString);
  }

  copyCode(text: string, type: 'script' | 'credentials' = 'script') {
    if (!text) return;
    
    navigator.clipboard.writeText(this.rawCodeText).then(() => {
      if (type === 'script') {
        this.copyButtonText = 'Copied!';
        setTimeout(() => this.copyButtonText = 'Copy', 2000);
      }
    });
  }

  getHostAndPort() {
    const { hostname, port } = window.location;
    return port ? 'http://'+hostname+':'+port+ '/' : 'https://'+hostname+ '/'
  }

  getAppDetails() {
    this.workbechService.getEmbeddedScriptData().subscribe({
      next: (responce: any) => {
        console.log(responce);
        if (responce.client_id && responce.redirect_uris && responce.name) {
          this.appName = responce.name;
          this.clientId = responce.client_id;
          this.type = responce.type;
          this.redirectUrl = responce.redirect_uris;
          this.disableAppName = true;
        } else {
          const currentUser = localStorage.getItem('username');
          this.appName = JSON.parse(currentUser!)['userName'];
        }
        this.targetUrl = this.getHostAndPort();
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
      }
    });
  }

  setAppDetails() {
    let object = {
      name: this.appName,
      redirect_uris: this.type === 'authorization-code' ? this.redirectUrl : this.targetUrl,
      type: this.type
    }
    this.workbechService.setEmbeddedScriptData(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.clientId = data.client_id;
        this.clientSecret = data.client_secret;
        this.disableAppName = true;
        const credentialsText = 
        `Client ID: ${this.clientId}
        Client Secret: ${this.clientSecret}`;

        this.copyCode(credentialsText, 'credentials');
        this.toasterService.info('Credentials Copied, Please Store for Future Access!','Info',{ positionClass: 'toast-top-right'});
        this.isClientCopied = true;
        this.generateScript();
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
      }
    });
  }

  setOrValidateClientData(){
    if(this.clientId){
      this.validateClientData();
    } else {
      this.setAppDetails();
    }
  }

  validateClientData() {
    let object = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      app_name: this.appName,
    }
    this.workbechService.validateEmbeddedScriptData(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.type = data.type;
        this.disableAppName = true;
        this.generateScript();
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
      }
    });
  }

  get isGenerateDisabled(): boolean {
    if (!this.type) return true;
    if (!this.disableAppName && (!this.appName || !this.type) ) return true;
    if (this.disableAppName && (!this.clientId || !this.clientSecret)) return true;
    if (this.type === 'authorization-code' && !this.redirectUrl) return true;
    return false;
  }
}
