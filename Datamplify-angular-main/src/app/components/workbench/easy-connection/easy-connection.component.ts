import { Component, TemplateRef, ViewChild } from '@angular/core';
import { SharedModule } from '../../../shared/sharedmodule';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../../shared/services/loader.service';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PermissionService } from '../../../services/permission.service';
import { NavigationService } from '../../../shared/services/navigation.service';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { EmbedAuthService } from '../../../shared/services/embed-auth.service';
import { Subject, take, takeUntil } from 'rxjs';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { NgSelectModule } from '@ng-select/ng-select';
import { GA_DIMENSIONS, GA_METRICS, NINJA_RMM_SCOPES, ZOHO_COUNTRIES, JIRA_SCOPES, HUBSPOT_SCOPES } from '../../../shared/models/easy-connect-usable.model';

export interface IDropdownSettings {
    singleSelection?: boolean;
    idField?: string;
    textField?: string;
    disabledField?: string;
    enableCheckAll?: boolean;
    selectAllText?: string;
    unSelectAllText?: string;
    allowSearchFilter?: boolean;
    clearSearchFilter?: boolean;
    maxHeight?: number;
    itemsShowLimit?: number;
    limitSelection?: number;
    searchPlaceholderText?: string;
    noDataAvailablePlaceholderText?: string;
    noFilteredDataAvailablePlaceholderText?: string;
    closeDropDownOnSelection?: boolean;
    showSelectedItemsAtTop?: boolean;
    defaultOpen?: boolean;
    allowRemoteDataSearch?: boolean;
}

@Component({
  selector: 'app-easy-connection',
  standalone: true,
  imports: [SharedModule, FormsModule, CommonModule, NgxPaginationModule, NgbModule, HasPermissionDirective, ScrollingModule, NgMultiSelectDropDownModule, NgSelectModule ],
  templateUrl: './easy-connection.component.html',
  styleUrl: './easy-connection.component.scss'
})
export class EasyConnectionComponent {
  serverName: string = '';
  portName: string = '';
  databaseName: string = '';
  userName: string = ''
  displayName: string = '';
  password: string = '';
  selectedSchema: string = 'public';
  selectedFile: File | null = null;
  schemaList: any[] = [];
  
  // Excel-specific properties
  availableSheets: string[] = [];
  selectedSheets: string[] = [];
  sheetRelationships: any = {};
  isExcelFile: boolean = false;
  serverError: boolean = false;
  portError: boolean = false;
  databaseError: boolean = false;
  userNameError: boolean = false;
  displayNameError: boolean = false;
  passwordError: boolean = false;
  disableConnectBtn: boolean = true;
  toggleClass = "off-line";
  showPassword = false;
  gridView: boolean = true;
  searchConnections: string = '';
  pageSize: number = 9;
  page: number = 1;
  totalItems: number = 0;
  connectionList: any[] = [];
  showList: boolean = true;
  isEditPreview: boolean = false;
  editPreviewData: any;
  isLoading: boolean = false;
  selectedCategory: string = 'All';
  selectedConnectionType: string | null = null;
  showRelational = false;
  showLLM = false;
  showMultiDim = false;
  showNoSQL = false;
  showFiles = false;
  showIntegrations = false;
  viewNewConnection = false;
  selectedConnection: string | null = null;
  selectedConnectionName: string | null = null;
  existingConnections: any = [];
  skeletons = Array(9);
  selectedMicroSoftAuthType: string | null = null;
  sqlLitePath: string='';
  pathError: boolean = false;
  isExistingConnectionsEdit: boolean = false;
  canViewConnections: boolean = true;
  connectionListIcons: any = {
    POSTGRESQL: { type: 'image', value: './assets/images/icons_new/POSTGRESQL.svg' },
    CSV: {type: 'image', value: './assets/images/icons_new/CSV.svg'},
    SFTP: {type: 'image', value: './assets/images/icons_new/SFTP.png'},
    MONGODB: {type: 'image', value: './assets/images/icons_new/MONGODB.svg'},
    MYSQL: {type: 'image', value: './assets/images/icons_new/MYSQL.svg'},
    ORACLE: {type: 'image', value: './assets/images/icons_new/ORACLE.svg'},
    SQLite: {type: 'image', value: './assets/images/icons_new/SQLITE.svg'},
    MICROSOFTSQLSERVER: {type: 'image', value: './assets/images/icons_new/MICROSOFTSQLSERVER.svg'},
    SNOWFLAKE: {type: 'image', value: './assets/images/icons_new/SNOWFLAKE.svg'},
    Excel: {type: 'image', value: './assets/images/icons_new/EXCEL.svg'},
    FTP: {type: 'image', value: './assets/images/icons_new/FTP.png'},
    QUICKBOOKS: {type: 'image', value: './assets/images/icons_new/QUICKBOOKS.svg'},
    SALESFORCE: {type: 'image', value: './assets/images/icons_new/SALESFORCE.svg'},
    CONNECTWISE: {type: 'image', value: './assets/images/icons_new/CONNECTWISE.svg'},
    HALOPSA: {type: 'image', value: './assets/images/icons_new/HALOPSA.svg'},
    NINJA: {type: 'image', value: './assets/images/icons_new/NINJA.svg'},
    PAX8: {type: 'image', value: './assets/images/icons_new/PAX8.svg'},
    BAMBOOHR: {type: 'image', value: './assets/images/icons_new/BAMBOOHR.svg'},
    JIRA: {type: 'image', value: './assets/images/icons_new/JIRA.svg'},
    SHOPIFY: {type: 'image', value: './assets/images/icons_new/SHOPIFY.svg'},
    TALLY: {type: 'image', value: './assets/images/icons_new/TALLY.svg'},
    // GOOGLESHEET: {type: 'image', value: './assets/images/icons_new/GOOGLE_SHEETS.svg'},
    GOOGLEANALYTIC: {type: 'image', value: './assets/images/icons_new/GOOGLE_ANALYTICS.svg'},
    HUBSPOT: {type: 'image', value: './assets/images/icons_new/HUBSPOT.svg'},
    IMMYBOT: {type: 'image', value: './assets/images/icons_new/IMMYBOT.svg'},
    ZOHO_BOOKS: {type: 'image', value: './assets/images/icons_new/ZOHO_BOOKS.svg'},
    ZOHO_INVENTORY: {type: 'image', value: './assets/images/icons_new/ZOHO_INVENTORY.svg'},
    ZOHO_CRM: {type: 'image', value: './assets/images/icons_new/ZOHO_CRM.svg'},
    DBT: {type: 'image', value: './assets/images/icons_new/DBT.svg'},
  };
  categories = [
    { name: 'Relational Database', image: './assets/images/icons/Rational.svg', description: 'Traditional SQL databases like MySQL, PostgreSQL' },
    // { name: 'LLM Integrations', icon: '🤖', description: 'AI & Large Language Model integrations',count:'6' },
    // { name: 'Multi-dimensional Database', icon: '📊', description: 'OLAP & analytical data stores',count:'2' },
    { name: 'NoSQL Database', image: './assets/images/icons/NoSQl.svg', description: 'Document, Key-Value, Graph & Wide-column databases' },
    { name: 'File Source', icon: '📂', description: 'CSV, Excel & JSON files' },
    { name: 'Remote Server', icon: '🌐', description: 'Connect to external servers or APIs for data access' },
    { name: 'Integrations', icon: '🔗', description: 'Third-party services' }
  ];
  connectionTypes: { [key: string]: { displayName: string; name: string; icon?: string; description: string; image?: string; svg?: string; disabled: boolean }[] } = {
    "Relational Database": [
      { displayName: "PostgreSQL", name: "POSTGRESQL", image: './assets/images/icons_new/POSTGRESQL.svg', description: "Advanced open-source relational database", disabled: false },
      { displayName: "MySQL", name: "MYSQL", image:'./assets/images/icons_new/MYSQL.svg', description: "Relational database", disabled: false },
      { displayName: "Oracle", name: "ORACLE", image: './assets/images/icons_new/ORACLE.svg', description: "Enterprise relational database", disabled: false },
      { displayName: "SQLite", name: "SQLite", image:'./assets/images/icons_new/SQLITE.svg', description: "Lightweight embedded database", disabled: true },
      { displayName: "Microsoft SQL Server", name: "MICROSOFTSQLSERVER", image: './assets/images/icons_new/MICROSOFTSQLSERVER.svg', description: "Microsoft relational database", disabled: false },
      { displayName: "Snowflake", name: "SNOWFLAKE", image:'./assets/images/icons_new/SNOWFLAKE.svg', description: "Cloud-native data warehouse", disabled: false },
    ],
    "NoSQL Database": [
      { displayName: "MongoDB", name: "MONGODB", image: './assets/images/icons_new/MONGODB.svg', description: "NoSQL document database", disabled: false }
    ],
    "File Source": [
      { displayName: "CSV", name: "CSV", image: "./assets/images/icons_new/CSV.svg", description: "Comma-separated values file", disabled: false },
      { displayName: "Excel", name: "EXCEL", image: "./assets/images/icons_new/EXCEL.svg", description: "Spreadsheet file format", disabled: false }
    ],
    "Remote Server": [
      { displayName: "SFTP", name: "SFTP", image: "./assets/images/icons_new/SFTP.png", description: "Secure File Transfer Protocol server", disabled: false },
      { displayName: "FTP", name: "FTP", image: "./assets/images/icons_new/FTP.png", description: "File Transfer Protocol server", disabled: true },
    ],
    "Integrations": [
      { displayName: "QuickBooks", name: "QUICKBOOKS", description: "Accounting software", image: './assets/images/icons_new/QUICKBOOKS.svg', disabled: false },
      { displayName: "Salesforce", name: "SALESFORCE", description: "CRM platform", image: './assets/images/icons_new/SALESFORCE.svg', disabled: false },
      { displayName: "ConnectWise", name: "CONNECTWISE", description: "IT management software", image: './assets/images/icons_new/CONNECTWISE.svg', disabled: false },
      { displayName: "Halopsa", name: "HALOPSA", description: "PSA platform for IT providers", image: './assets/images/icons_new/HALOPSA.svg', disabled: false },
      { displayName: "Ninja", name: "NINJA", description: "IT management & automation tool", image: './assets/images/icons_new/NINJA.svg', disabled: false },
      { displayName: "Pax8", name: "PAX8", description: "Cloud commerce marketplace", image: './assets/images/icons_new/PAX8.svg', disabled: false },
      { displayName: "BambooHR", name: "BAMBOOHR", description: "HR management system", image: './assets/images/icons_new/BAMBOOHR.svg', disabled: false },
      { displayName: "Jira", name: "JIRA", description: "Project management software", image: './assets/images/icons_new/JIRA.svg', disabled: false },
      { displayName: "Shopify", name: "SHOPIFY", description: "E-commerce platform", image: './assets/images/icons_new/SHOPIFY.svg', disabled: false },
      { displayName: "Tally", name: "TALLY", description: "Accounting & ERP software", image: './assets/images/icons_new/TALLY.svg', disabled: false },
      // { displayName: "Google Sheets", name: "GOOGLESHEET", description: "Online spreadsheets", image: './assets/images/icons_new/GOOGLE_SHEETS.svg', disabled: true },
      { displayName: "Google Analytics", name: "GOOGLEANALYTIC", description: "Web analytics service", image: './assets/images/icons_new/GOOGLE_ANALYTICS.svg', disabled: false },
      { displayName: "HubSpot", name: "HUBSPOT", description: "Marketing & CRM platform", image: './assets/images/icons_new/HUBSPOT.svg', disabled: false },
      { displayName: "ImmyBot", name: "IMMYBOT", description: "IT automation tool", image: './assets/images/icons_new/IMMYBOT.svg', disabled: true },
      { displayName: "Zoho Books", name: "ZOHO_BOOKS", description: "Zoho Books platform", image: './assets/images/icons_new/ZOHO_BOOKS.svg', disabled: false },
      { displayName: "Zoho Inventory", name: "ZOHO_INVENTORY", description: "Zoho Inventory platform", image: './assets/images/icons_new/ZOHO_INVENTORY.svg', disabled: false },
      { displayName: "Zoho CRM", name: "ZOHO_CRM", description: "Zoho CRM platform", image: './assets/images/icons_new/ZOHO_CRM.svg', disabled: false },
      { displayName: "DBT", name: "DBT", description: "Data build tool", image: './assets/images/icons_new/DBT.svg', disabled: false },
    ]
  };
  currentStep = 1;
  selectedImportdDb: any = {};
  selectedImportConn: any = {};
  databases = [
    { name: 'PostgreSQL', image: './assets/images/icons_new/POSTGRESQL.svg', type: 1 },
    { name: 'MongoDB', image: './assets/images/icons_new/MONGODB.svg', type: 6 }
  ];
  connections: any[] = [];
  pageNo = 1;
  itemsPerPage = 10;
  hasMore = true;
  isConnectionsLoading = false;
  searchImportConn = '';
  isEmbedAuthorizationCode: boolean = false;
  private destroy$ = new Subject<void>();
  companyId: string = '';
  siteURL: string = '';
  publicKey: string = '';
  privateKey: string = '';
  clientId: string = '';
  clientSecret: string = '';
  selectedScopes: string[] = [];
  apiKey: string = '';
  domainName: string = '';
  accountId: string = '';
  domainUrl: string = '';
  token: string = '';
  redirectUrl: string = '';
  zohoCountry: string = '';
  shopName: string = '';
  subDomainUrl: string = '';
  accountType: string = 'service_account';
  projectId: string = '';
  privateKeyId: string = '';
  clientEmail: string = '';
  clientX509CertUrl: string = '';
  propertyId: string = '';
  selectedDimensions: any[] = [];
  selectedMetrics: any[] = [];
  availableDimensions = GA_DIMENSIONS;
  availableMetrics = GA_METRICS;
  ninjaRMMScopes = NINJA_RMM_SCOPES;
  zohoCountries = ZOHO_COUNTRIES;
  jiraScopes = JIRA_SCOPES;
  hubspotScopes = HUBSPOT_SCOPES;
  jiraDropdownSettings: IDropdownSettings = {
    enableCheckAll: true,
    allowSearchFilter: true,
    itemsShowLimit: 10,
    closeDropDownOnSelection: false
  };
  hubspotDropdownSettings: IDropdownSettings = {
    enableCheckAll: true,
    allowSearchFilter: true,
    itemsShowLimit: 10,
    closeDropDownOnSelection: false
  };

  companyIdError: boolean = false;
  siteURLError: boolean = false;
  publicKeyError: boolean = false;
  privateKeyError: boolean = false;
  clientIdError: boolean = false;
  clientSecretError: boolean = false;
  scopeError: boolean = false;
  apiKeyError: boolean = false;
  domainNameError: boolean = false;
  accountIdError: boolean = false;
  domainUrlError: boolean = false;
  tokenError: boolean = false;
  zohoCountryError: boolean = false;
  shopNameError: boolean = false;
  subDomainUrlError: boolean = false;
  projectIdError: boolean = false;
  privateKeyIdError: boolean = false;
  clientEmailError: boolean = false;
  clientX509CertUrlError: boolean = false;
  propertyIdError: boolean = false;
  dimensionsError: boolean = false;
  metricsError: boolean = false;

  code: string = '';
  state: string = '';
  realmId: string = '';
  isRedirectingUrl: boolean = false;
  type: string = '';
  @ViewChild('integrationSuccess') integrationSuccessTpl!: TemplateRef<any>;
  isIntegrationModalOpen: boolean = false;
  redirectionConnections: any[] = ['QUICKBOOKS', 'SALESFORCE', 'HALOPSA', 'JIRA'];
  modalRef: any;
  countdown = 30;
  countdownInterval: any;

  constructor(private loaderService: LoaderService, private workbenchService: WorkbenchService, private toasterservice: ToastrService,
    private modalService: NgbModal, private router: Router,private sanitizer: DomSanitizer, private permissionService: PermissionService,
    private navigationService: NavigationService, private embedAuthService: EmbedAuthService, private route: ActivatedRoute) {
    const url = this.navigationService.getNormalizedUrl(this.router.url);
    if (url.startsWith('/datamplify/easyConnection/newConnection')) {
      this.showList = false;
      this.viewNewConnection = true;
    } else if(url.startsWith('/datamplify/easyConnection/integrations/')){
      this.route.queryParamMap.pipe(take(1)).subscribe(params => {
        this.code = params.get('code') ?? '';
        this.state = params.get('state') ?? '';
        if (!this.code && !this.state) {
          return;
        }
        this.isRedirectingUrl = true;
        if (route.snapshot.params['type']) {
          const type = route.snapshot.params['type'];
          this.type = type.toString();
        }
        if(this.type === 'quickbooks'){
          this.realmId = params.get('realmId') ?? '';
        } else if(this.type.includes('zoho') && localStorage.getItem('zohoCountry')){
          this.zohoCountry = localStorage.getItem('zohoCountry') ?? '';
          localStorage.removeItem('zohoCountry');
          this.type = localStorage.getItem('zohoIntegrationType') ?? this.type;
          localStorage.removeItem('zohoIntegrationType');
        }
        this.router.navigate([], { relativeTo: this.route, queryParams: { code: null, state: null, realmId: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    }
  }

  ngOnInit() {
    this.loaderService.hide();
    this.canViewConnections = this.permissionService.hasPermission(21);
    if (this.isRedirectingUrl) {
      if (localStorage.getItem('hierarchyId')) {
        const hierarchyId = localStorage.getItem('hierarchyId');
        localStorage.removeItem('hierarchyId');
        this.urlIntegrationsPayload(false, this.type, hierarchyId);
      } else {
        this.showList = false;
        this.viewNewConnection = true;
        setTimeout(() => {
          const timestamp = this.getTimestamp();
          this.displayName = `${this.type}_${timestamp}`;
          this.openIntegrationSuccessModal();
        });
      }
    } else {
      if (this.showList) {
        this.getConnectionList();
      }
    }
    this.isEmbedAuthorizationCode = this.embedAuthService.isEmbedMode() && (this.embedAuthService.getEmbedType() === 'authorization-code');
    if (this.isEmbedAuthorizationCode) {
      this.embedAuthService.importConnections$.pipe(takeUntil(this.destroy$)).subscribe(apiData => {
        if (!apiData) return;
        this.appendConnections(apiData);
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayNameConditionError() {
    if (this.displayName) {
      this.displayNameError = false;
    } else {
      this.displayNameError = true;
    }

    this.errorCheck();
  }
  serverConditionError() {
    if (this.serverName) {
      this.serverError = false;
    } else {
      this.serverError = true;
    }

    this.displayNameConditionError();
    this.errorCheck();
  }
  portConditionError() {
    if (this.portName) {
      this.portError = false;
    } else {
      this.portError = true;
    }
    this.serverConditionError()
    this.errorCheck();
  }
  databaseConditionError() {
    if (this.databaseName) {
      this.databaseError = false;
    } else {
      this.databaseError = true;
    }
    this.portConditionError();
    this.errorCheck();
  }
  userNameConditionError() {
    if (this.userName) {
      this.userNameError = false;
    } else {
      this.userNameError = true;
    }
    this.databaseConditionError();
    this.errorCheck();
  }
  passwordConditionError() {
    if (this.password) {
      this.passwordError = false;
    } else {
      this.passwordError = true;
    }
    this.userNameConditionError();
    this.errorCheck();
  }
  pathConditionError(){
    if(this.sqlLitePath){
      this.pathError = false;
    } else{
      this.pathError = true;
    }
  }
  errorCheck() {
    if(this.selectedConnection === 'SFTP'){
      if (this.serverError || this.portError || this.userNameError || this.displayNameError || this.passwordError) {
        this.disableConnectBtn = true;
      } else if (!(this.serverName && this.portName && this.userName && this.displayName && this.password)) {
        this.disableConnectBtn = true;
      } else {
        this.disableConnectBtn = false;
      }
    } else{
      if (this.serverError || this.portError || this.databaseError || this.userNameError || this.displayNameError || this.passwordError) {
        this.disableConnectBtn = true;
      } else if (!(this.serverName && this.portName && this.databaseName && this.userName && this.displayName && this.password)) {
        this.disableConnectBtn = true;
      } else {
        this.disableConnectBtn = false;
      }
    }
  }

  toggleVisibility() {
    this.showPassword = !this.showPassword;
    if (this.toggleClass === "off-line") {
      this.toggleClass = "line";
    } else {
      this.toggleClass = "off-line";
    }
  }

  getSchemaList(type: any) {
    let object = {
      database_type: type,
      hostname: this.serverName,
      port: this.portName,
      username: this.userName,
      password: this.password,
      database: this.databaseName,
      display_name: this.displayName,
    }
    console.log(object);

    this.workbenchService.getSchemaList(object).subscribe({
      next: (response) => {
        this.schemaList = response.schemas;
      },
      error: (error) => {
        this.toasterservice.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
        console.error('Connection failed:', error);
      }
    });
  }

  DatabaseConnection(type: any, modal?: any) {
    let object: any = {
      database_type: type,
      hostname: this.serverName,
      port: this.portName,
      username: this.userName,
      password: this.password,
      connection_name: this.displayName,
    }
    if (type !== 7) {
      object.database = this.databaseName;
    }
    if([1, 10].includes(type)){
      object.schema = this.selectedSchema;
    } else if(type === 7){
      object.service_name = this.databaseName;
    }
    console.log(object);

    this.workbenchService.databaseConnection(object).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
        console.log('Connection successful:', response);
        this.resetForm();
        this.selectedConnection = null;
        this.routeToViewConnection();
        if(modal){
          modal.close('success');
        }
      },
      error: (error) => {
        this.toasterservice.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
        console.error('Connection failed:', error);
      }
    });
  }

  updateDatabaseConnection(hierarchyId:any, type:any, isExistingConnection: boolean) {
    let object = {}
    if (type === 1) {
      object = {
        database_type: type,
        hostname: this.serverName,
        port: this.portName,
        username: this.userName,
        password: this.password,
        database: this.databaseName,
        connection_name: this.displayName,
        schema: this.selectedSchema
      }
    } else if (type === 6) {
      object = {
        database_type: type,
        hostname: this.serverName,
        port: this.portName,
        username: this.userName,
        password: this.password,
        database: this.databaseName,
        connection_name: this.displayName,
      }
    }
    console.log(object);

    this.workbenchService.updateDatabaseConnection(hierarchyId,object).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
        console.log('Connection successful:', response);
        this.resetForm();
        this.isEditPreview = false;
        if(isExistingConnection){
          this.getSpecificConnections(this.selectedConnection);
        } else{
          this.getConnectionList();
          this.selectedConnection = null;
        }
      },
      error: (error) => {
        this.toasterservice.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
        console.error('Connection failed:', error);
      }
    });
  }

  editPreviewDatabaseConnection(hierarchyId: any, isExistingConnection?: boolean) {
    this.workbenchService.getDatabaseConnection(hierarchyId).subscribe({
      next: (response: any) => {
        console.log(response);
        this.editPreviewData = response;
        this.serverName = response.hostname;
        this.portName = response.port;
        this.databaseName = response.database;
        this.userName = response.username;
        this.displayName = response.connection_name;
        this.password = '';
        this.selectedSchema = response.schema;
        this.isExistingConnectionsEdit = isExistingConnection ?? false;
        if(!isExistingConnection){
          this.isEditPreview = true;
          if(response.database_type === 1){
            this.selectedConnection = 'POSTGRESQL';
          } else if(response.database_type === 6){
            this.selectedConnection = 'MONGODB';
          } else if(response.database_type === 7){
            this.selectedConnection = 'ORACLE';
          } else if(response.database_type === 8){
            this.selectedConnection = 'Microsoft SQL SERVER';
          } else if(response.database_type === 9){
            this.selectedConnection = 'MySQL';
          } else if(response.database_type === 10){
            this.selectedConnection = 'SNOWFLAKE';
          }
        }
      },
      error: (err) => {
        this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
        console.error('Error fetching connection data:', err);
      }
    });
  }

  deleteDatabaseConnection(database:any, isExistingConnection?: boolean){
    Swal.fire({
      position: "center",
      icon: "question",
      title: `Delete ${database.display_name} connection ?`,
      text: "This action cannot be undone. Are you sure you want to proceed?",
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.workbenchService.deleteDatabseConnection(database?.hierarchy_id).subscribe({
          next: (response: any) => {
            this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
            console.log(response);
            if(isExistingConnection){
              this.getSpecificConnections(this.selectedConnection);
            } else{
              this.getConnectionList();
              if(this.isEditPreview) this.isEditPreview = false;
              this.selectedConnection = null;
            }
            this.resetForm();
          },
          error: (err) => {
            this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
            console.error('Error fetching connection data:', err);
          }
        });
      }
    })
  }

  openUploadModal(content: any) {
    this.modalService.open(content, { backdrop: 'static', centered: true });
  }

  onCsvFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      
      // Check if it's an Excel file
      const fileName = this.selectedFile.name.toLowerCase();
      this.isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      
      // Reset Excel-specific data
      if (!this.isExcelFile) {
        this.availableSheets = [];
        this.selectedSheets = [];
        this.sheetRelationships = {};
      }
    }
    input.value = '';
  }

  fileConnection(hierarchyId: any, isExistingConnection: boolean) {
    if (!this.selectedFile || !this.displayName) return;

    const formData = new FormData();
    formData.append('file_path', this.selectedFile);
    
    // Determine file type: 2 for CSV, 28 for Excel
    const fileType = this.isExcelFile ? '28' : '2';
    formData.append('file_type', fileType);
    formData.append('connection_name', this.displayName);

    const request$ = hierarchyId ? this.workbenchService.updateFileConnection(formData, hierarchyId) : this.workbenchService.fileConnection(formData);

    request$.subscribe({
      next: (response) => {
        this.toasterservice.success(response.message, 'Success', { positionClass: 'toast-top-right' });
        console.log('File upload successful:', response);
        
        this.resetForm();
        if (isExistingConnection) {
          this.getSpecificConnections(this.selectedConnection);
          this.isEditPreview = false;
        } else {
          if (this.isEditPreview) {
            this.isEditPreview = false;
            this.getConnectionList();
          } else {
            this.routeToViewConnection();
          }
          this.selectedConnection = null;
        }
      },
      error: (error) => {
        this.toasterservice.error(error.error.message, 'Error', { positionClass: 'toast-top-right' });
        console.error('File upload failed:', error);
      }
    });
  }

  getFileConnection(hierarchyId: any, isExistingConnection?: boolean) {
    this.workbenchService.getFileConnection(hierarchyId).subscribe({
      next: (response: any) => {
        console.log(response);
        this.editPreviewData = response;
        this.displayName = response.connection_name;
        
        // Check if it's an Excel file
        const fileName = response.connection_name.toLowerCase();
        this.isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        
        this.isExistingConnectionsEdit = isExistingConnection ?? false;
        if(!isExistingConnection){
          this.isEditPreview = true;
          this.selectedConnection = this.isExcelFile ? 'EXCEL' : 'CSV';
        }
      },
      error: (err) => {
        this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
        console.error('Error fetching connection data:', err);
      }
    });
  }

  deleteFileConnection(database:any, isExistingConnection?: boolean){
    Swal.fire({
      position: "center",
      icon: "question",
      title: `Delete ${database.display_name} connection ?`,
      text: "This action cannot be undone. Are you sure you want to proceed?",
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.workbenchService.deleteFileConnection(database?.hierarchy_id).subscribe({
          next: (response: any) => {
            this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
            console.log(response);
            if(isExistingConnection){
              this.getSpecificConnections(this.selectedConnection);
            } else{
              this.getConnectionList();
              if(this.isEditPreview) this.isEditPreview = false;
              this.selectedConnection = null;
            }
            this.resetForm();
          },
          error: (err) => {
            this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
            console.error('Error fetching connection data:', err);
          }
        });
      }
    })
  }

  // Excel-specific methods
  getExcelSheets(hierarchyId: string) {
    this.workbenchService.getExcelSheets(hierarchyId).subscribe({
      next: (response: any) => {
        console.log('Excel sheets:', response);
        this.availableSheets = response.available_sheets || [];
        this.selectedSheets = response.selected_sheets || [];
        this.sheetRelationships = response.sheet_relationships || {};
      },
      error: (err) => {
        this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
        console.error('Error fetching Excel sheets:', err);
      }
    });
  }

  onSheetSelectionChange() {
    // Remove relationships for unselected sheets
    const selectedSet = new Set(this.selectedSheets);
    Object.keys(this.sheetRelationships).forEach(sheet => {
      if (!selectedSet.has(sheet)) {
        delete this.sheetRelationships[sheet];
      }
    });
  }

  onSheetRelationshipChange(sheet: string, parentSheet: string) {
    if (parentSheet && parentSheet !== 'none') {
      this.sheetRelationships[sheet] = parentSheet;
    } else {
      delete this.sheetRelationships[sheet];
    }
  }

  getAvailableParentSheets(currentSheet: string): string[] {
    // Return sheets that can be parents (all selected sheets except current one)
    return this.selectedSheets.filter(sheet => sheet !== currentSheet);
  }

  getConnectionList() {
    if (this.canViewConnections) {
      this.isLoading = true;
      this.workbenchService.disableLoaderForNextRequest();
      this.workbenchService.getConnectionsList(this.page, this.pageSize, this.searchConnections).subscribe({
        next: (response: any) => {
          this.connectionList = response.data;
          this.totalItems = response.total_items ?? 10;
          console.log('Connections fetched successfully:', this.connectionList);
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
          console.error('Error fetching connections:', err);
        }
      });
    } else {
      this.toasterservice.info('You don’t have permission to view Connections', 'info', { positionClass: 'toast-top-right' });
    }
  }

  resetForm() {
    // ---------- OTHER EXISTING RESETS ----------
    this.serverName = '';
    this.portName = '';
    this.databaseName = '';
    this.userName = '';
    this.displayName = '';
    this.password = '';
    this.selectedSchema = 'public';
    this.editPreviewData = null;
    this.selectedFile = null;
    this.schemaList = [];
    this.selectedMicroSoftAuthType = null;
    this.isExistingConnectionsEdit = false;

    this.errorCheck();

    // ---------- BASIC FIELDS ----------
    this.companyId = '';
    this.siteURL = '';
    this.publicKey = '';
    this.privateKey = '';
    this.clientId = '';
    this.clientSecret = '';
    this.selectedScopes = [];
    this.apiKey = '';
    this.domainName = '';
    this.accountId = '';
    this.domainUrl = '';
    this.token = '';
    this.redirectUrl = '';
    this.zohoCountry = '';
    this.shopName = '';
    this.subDomainUrl = '';
    this.accountType = 'service_account';
    this.projectId = '';
    this.privateKeyId = '';
    this.clientEmail = '';
    this.clientX509CertUrl = '';
    this.propertyId = '';

    // ---------- GA FIELDS ----------
    this.selectedDimensions = [];
    this.selectedMetrics = [];

    // ---------- ERROR FLAGS ----------
    this.companyIdError = false;
    this.siteURLError = false;
    this.publicKeyError = false;
    this.privateKeyError = false;
    this.clientIdError = false;
    this.clientSecretError = false;
    this.scopeError = false;
    this.apiKeyError = false;
    this.domainNameError = false;
    this.accountIdError = false;
    this.domainUrlError = false;
    this.tokenError = false;
    this.zohoCountryError = false;
    this.shopNameError = false;
    this.subDomainUrlError = false;
    this.projectIdError = false;
    this.privateKeyIdError = false;
    this.clientEmailError = false;
    this.clientX509CertUrlError = false;
    this.propertyIdError = false;
    this.dimensionsError = false;
    this.metricsError = false;
  }

  onPageSizeChange() {
      const totalPages = Math.ceil(this.totalItems / this.pageSize);
      if (this.page > totalPages) {
        this.page = 1;
      }
      this.getConnectionList();
  }

  routeToNewConnection(){
    this.navigationService.navigate(['datamplify', 'easyConnection', 'newConnection']);
  }
  
  routeToViewConnection(){
    this.navigationService.navigate(['datamplify', 'easyConnection']);
  }

  getSafeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  categorySelect(categoryName: string) {
    this.selectedCategory = categoryName;
    // this.viewNewConnection = false;
    // this.showRelational = false;
    // this.showLLM = false;
    // this.showMultiDim = false;
    // this.showNoSQL = false;
    // this.showFiles = false;
    // this.showIntegrations = false;
    // switch (categoryName) {
    //   case 'Relational Database':
    //     this.showRelational = true;
    //     break;
    //   case 'Files Source':
    //     this.showFiles = true;
    //     break;
    // }
  }
  goBackToCategories() {
    // this.showRelational = false;
    // this.showLLM = false;
    // this.showMultiDim = false;
    // this.showNoSQL = false;
    // this.showFiles = false;
    // this.showIntegrations = false;
    // this.viewNewConnection = true;
    this.selectedCategory = 'All';
  }
  selectConnection(conn: any) {
    this.viewNewConnection = false;
    this.selectedConnection = conn.name;
    this.selectedConnectionName = conn.displayName;
    this.getSpecificConnections(this.selectedConnection);
  }
  getSpecificConnections(selectedConnection:any){
    this.isLoading = true;
    let connectionId;
    if(selectedConnection === 'POSTGRESQL'){
      connectionId = 1;
    } else if(selectedConnection === 'CSV') {
      connectionId = 2;
    } else if(selectedConnection === 'SFTP') {
      connectionId = 3;
    } else if(selectedConnection === 'EXCEL') {
      connectionId = 28;
    } else if(selectedConnection === 'MONGODB') {
      connectionId = 6;
    } else if(selectedConnection === 'ORACLE') {
      connectionId = 7;
    } else if(selectedConnection === 'MICROSOFTSQLSERVER') {
      connectionId = 8;
    } else if(selectedConnection === 'MYSQL') {
      connectionId = 9;
    } else if(selectedConnection === 'SNOWFLAKE') {
      connectionId = 10;
    } else if(selectedConnection === 'NINJA') {
      connectionId = 11;
    } else if(selectedConnection === 'CONNECTWISE') {
      connectionId = 12;
    } else if(selectedConnection === 'HALOPSA') {
      connectionId = 13;
    } else if(selectedConnection === 'SHOPIFY') {
      connectionId = 14;
    } else if(selectedConnection === 'TALLY') {
      connectionId = 15;
    } else if(selectedConnection === 'QUICKBOOKS') {
      connectionId = 16;
    } else if(selectedConnection === 'SALESFORCE') {
      connectionId = 17;
    } else if(selectedConnection === 'JIRA') {
      connectionId = 18;
    } else if(selectedConnection === 'HUBSPOT') {
      connectionId = 19;
    } else if(selectedConnection === 'GOOGLESHEET') {
      connectionId = 20;
    } else if(selectedConnection === 'DBT') {
      connectionId = 21;
    } else if(selectedConnection === 'PAX8') {
      connectionId = 22;
    } else if(selectedConnection === 'BAMBOOHR') {
      connectionId = 23;
    } else if(selectedConnection === 'ZOHO_CRM') {
      connectionId = 24;
    } else if(selectedConnection === 'ZOHO_INVENTORY') {
      connectionId = 25;
    } else if(selectedConnection === 'ZOHO_BOOKS') {
      connectionId = 26;
    } else if(selectedConnection === 'GOOGLEANALYTIC') {
      connectionId = 27;
    }
    this.workbenchService.disableLoaderForNextRequest();
    this.workbenchService.getConnectionsForEtl(connectionId).subscribe({
      next: (data) => {
        console.log(data);
        this.existingConnections = data.data;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.log(error);
        this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        this.isLoading = false;
      }
    });
  }
  getConnectionAsset(connName: string) {
    // Find the connection object from connectionTypes
    for (const category in this.connectionTypes) {
      const found = this.connectionTypes[category].find(c => c.name === connName);
      if (found) {
        if (found.icon) return { type: 'icon', value: found.icon };
        if (found.image) return { type: 'image', value: found.image };
        if (found.svg) return { type: 'svg', value: this.sanitizer.bypassSecurityTrustHtml(found.svg) };
      }
    }
    // fallback
    return { type: 'icon', value: '🔗' };
  }

  goBackToSubCategories() {
    this.viewNewConnection = true;
    this.selectedConnection = null;
    this.existingConnections = [];
  }

  createSFTPConnection() {
    const object = {
      connection_type: 3,
      hostname: this.serverName,
      username: this.userName,
      password: this.password,
      connection_name: this.displayName,
      port: this.portName
    };
    console.log(object);
    
    this.workbenchService.remoteServerConnection(object).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message, 'success', { positionClass: 'toast-top-right' });
        console.log('Connection successful:', response);
        this.resetForm();
        this.selectedConnection = null;
        this.routeToViewConnection();
      },
      error: (error) => {
        this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.error('Connection failed:', error);
      }
    });
  }

  editPreviewSFTP(hierarchyId: any, isExistingConnection?: boolean){
    this.workbenchService.getRemoteServerConnection(hierarchyId).subscribe({
      next: (response: any) => {
        console.log(response);
        this.editPreviewData = response;
        this.serverName = response.hostname;
        this.portName = response.port;
        this.userName = response.username;
        this.displayName = response.connection_name;
        this.password = '';
        this.isExistingConnectionsEdit = isExistingConnection ?? false;
        if(!isExistingConnection){
          this.isEditPreview = true;
          this.selectedConnection = 'SFTP';
        }
      },
      error: (err) => {
        this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
        console.error('Error fetching connection data:', err);
      }
    });
  }

  updateSFTPConnection(hierarchyId: any, isExistingConnection: boolean) {
    let object = {
      connection_type: 3,
      hostname: this.serverName,
      username: this.userName,
      password: this.password,
      connection_name: this.displayName,
      port: this.portName
    }
    console.log(object);

    this.workbenchService.updateremoteServerConnection(hierarchyId,object).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
        console.log('Connection successful:', response);
        this.resetForm();
        this.isEditPreview = false;
        if(isExistingConnection){
          this.getSpecificConnections(this.selectedConnection);
        } else{
          this.getConnectionList();
          this.selectedConnection = null;
        }
      },
      error: (error) => {
        this.toasterservice.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
        console.error('Connection failed:', error);
      }
    });
  }

  deleteSFTPConnection(database: any, isExistingConnection?: boolean) {
    Swal.fire({
      position: "center",
      icon: "question",
      title: `Delete ${database.display_name} connection ?`,
      text: "This action cannot be undone. Are you sure you want to proceed?",
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.workbenchService.deleteRemoteServerConnection(database?.hierarchy_id).subscribe({
          next: (response: any) => {
            this.toasterservice.success(response.message, 'success', { positionClass: 'toast-top-right' });
            console.log(response);
            if (isExistingConnection) {
              this.getSpecificConnections(this.selectedConnection);
            } else {
              this.getConnectionList();
              if(this.isEditPreview) this.isEditPreview = false;
              this.selectedConnection = null;
            }
            this.resetForm();
          },
          error: (err) => {
            this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
            console.error('Error fetching connection data:', err);
          }
        });
      }
    })
  }

  editOrDeleteByType(type: string, isEdit: boolean, connectionData: any, isExistingConnection?: boolean){
    if(type === 'CSV' || type === 'EXCEL'){
      if(isEdit){
        this.getFileConnection(connectionData?.hierarchy_id, isExistingConnection);
      } else {
        this.deleteFileConnection(connectionData, isExistingConnection);
      }
    } else if(['POSTGRESQL', 'MONGODB', 'MYSQL', 'ORACLE', 'MICROSOFTSQLSERVER', 'SNOWFLAKE'].includes(type)){
      if(isEdit){
        this.editPreviewDatabaseConnection(connectionData?.hierarchy_id, isExistingConnection);
      } else {
        this.deleteDatabaseConnection(connectionData, isExistingConnection);
      }
    } else if(type === 'SFTP'){
      if(isEdit){
        this.editPreviewSFTP(connectionData?.hierarchy_id, isExistingConnection);
      } else {
        this.deleteSFTPConnection(connectionData, isExistingConnection);
      }
    } else if(!['POSTGRESQL', 'MONGODB', 'MYSQL', 'ORACLE', 'MICROSOFTSQLSERVER', 'SNOWFLAKE', 'CSV', 'SFTP'].includes(type)){
      if(isEdit){
        if(this.redirectionConnections.includes(type)){
          const redirectionType = type.toLocaleLowerCase();
          this.routeToIntegration(redirectionType, connectionData?.hierarchy_id);
        } else {
          this.editPreviewIntegrationConnection(connectionData?.hierarchy_id, type, isExistingConnection);
        }
      } else {
        this.deleteIntegrationConnection(connectionData, isExistingConnection);
      }
    }
  }

  openImportConnection(model: any) {
    this.modalService.open(model, {
      size: 'md',
      centered: true,
      backdrop: 'static'
    });
  }

  resetImportState() {
    // Stepper
    this.currentStep = 1;

    // Selection
    this.selectedImportdDb = {};
    this.selectedImportConn = {};

    // List & pagination
    this.connections = [];
    this.pageNo = 1;
    this.itemsPerPage = 10;
    this.hasMore = true;
    this.isConnectionsLoading = false;
    this.searchImportConn = '';
  }

  resetConnectionsForSearch() {
    this.connections = [];
    this.pageNo = 1;
    this.hasMore = true;
    this.isLoading = false;
  }

  onCancelOrBack(modal: any) {
    if (this.currentStep === 1) {
      this.resetImportState();
      modal.dismiss('cancel');
    } else {
      this.prevStep();
    }
  }

  searchImportConnections() {
    this.resetConnectionsForSearch();
    this.requestConnections();
  }

  loadInitialConnections() {
    this.pageNo = 1;
    this.connections = [];
    this.hasMore = true;
    this.requestConnections();
  }

  requestConnections() {
    if (this.isConnectionsLoading || !this.hasMore) return;

    this.isConnectionsLoading = true;
    window.parent.postMessage(
      {
        source: "DATAMPLIFY_APP",
        type: "connetionList",
        payload: {
          selectedDatabase: this.selectedImportdDb.name,
          pageNo: this.pageNo,
          itemsPerPage: this.itemsPerPage,
          search: this.searchImportConn
        }
      },
      "*"
    );
  }

  onScrolledIndexChange(index: number) {
    if (index + 1 >= this.connections.length && this.hasMore && !this.isConnectionsLoading) {
      this.requestConnections();
    }
  }

  appendConnections(apiData: any) {
    const newItems = apiData.sheets || [];

    this.connections = [...this.connections, ...newItems];

    const totalPages = apiData.total_pages;
    this.pageNo++;

    this.hasMore = this.pageNo <= totalPages;
    this.isConnectionsLoading = false;
  }

  setSelectedImportConn(connection: any){
    this.selectedImportConn = { ...connection, password: '' };
  }

  nextStep() {
    if (this.currentStep < 3) this.currentStep++;
    if(this.currentStep === 2) this.loadInitialConnections();
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  importNewConnection(modal: any) {
    console.log('Connecting with:', { db: this.selectedImportdDb, connection: this.selectedImportConn});
    this.serverName = this.selectedImportConn.hostname;
    this.portName = this.selectedImportConn.port;
    this.databaseName = this.selectedImportConn.database;
    this.displayName = this.selectedImportConn.display_name;
    this.userName = this.selectedImportConn.username;
    this.password = this.selectedImportConn.password;
    if(this.selectedImportConn?.schema){
      this.selectedSchema = this.selectedImportConn.schema
    }
    this.DatabaseConnection(this.selectedImportdDb.type, modal);
  }

  connectwisePayload(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        company_id: this.companyId,
        site_url: this.siteURL,
        public_key: this.publicKey,
        private_key: this.privateKey,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'connectwise');
    }
  }

  halopsaPayload(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        site_url: this.siteURL,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'halopsa');
    }
  }

  ninjaPayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scopes: this.selectedScopes,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'ninja');
    }
  }

  pax8PayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'pax8');
    }
  }

  dbtPayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        api_token: this.token,
        account_id: this.accountId,
        site_url: this.domainUrl,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'dbt');
    }
  }

  bamboohrPayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        api_token: this.apiKey,
        domain: this.domainName,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'bamboohr');
    }
  }

  shopifyPayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        shop_name: this.shopName,
        api_token: this.token,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'shopify');
    }
  }

  tallyPayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        api_token: this.token,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'tally');
    }
  }

  googleAnalyticsPayload(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        type: this.accountType,
        project_id: this.projectId,
        private_key_id: this.privateKeyId,
        private_key: this.privateKey,
        client_email: this.clientEmail,
        client_id: this.clientId,
        client_x509_cert_url: this.clientX509CertUrl,
        property_id: this.propertyId,
        dimensions: this.selectedDimensions,
        metrics: this.selectedMetrics,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'googleanalytic');
    }
  }

  hubSpotPayLoad(isExistingConnection: boolean, hierarchyId?: any) {
    let object = {
      payload: {
        api_token: this.token,
        display_name: this.displayName
      }
    };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, 'hubspot');
    }
  }

  urlIntegrationsPayload(isExistingConnection: boolean, type: string, hierarchyId?: any){
    let payload: any = {
      code: this.code,
      state: this.state,
    }
    if (!hierarchyId) {
      payload.display_name = this.displayName;
    }
    if (type === 'quickbooks') {
      payload.realm_id = this.realmId;
    } else if (this.type.includes('zoho') && this.zohoCountry) {
      payload.country = this.zohoCountry;
    }
    const object = { payload };
    if(hierarchyId){
      this.updateIntegrationConnection(object, hierarchyId, isExistingConnection);
    }else {
      this.integrationConnection(object, type);
    }
  }

  routeToIntegration(connName: string, hierarchyId?: any) {
    Swal.fire({
      title: 'This will redirect to ' + connName.toUpperCase() + ' SignIn page',
      showCancelButton: true,
      showConfirmButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Ok',
      cancelButtonColor: 'rgba(224, 42, 42, 1)',
    }).then((result) => {
      if (result.isConfirmed) {
        this.loaderService.show();
        this.workbenchService.getIntegrationsUrl(connName, this.zohoCountry).subscribe({
          next: (data) => {
            this.loaderService.show();
            console.log(data);
            if(hierarchyId) {
              localStorage.setItem('hierarchyId', hierarchyId);
            }
            if (connName.includes('zoho') && this.zohoCountry) {
              localStorage.setItem('zohoCountry', this.zohoCountry);
              localStorage.setItem('zohoIntegrationType', connName);
            }
            window.location.replace(data.redirection_url);
          },
          error: (error) => {
            console.log(error);
            this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
            this.loaderService.hide();
          }
        });
      }
    });
  }

  integrationConnection(object: any, type: any) {
    this.workbenchService.integrationConnection(object, type).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message, 'success', { positionClass: 'toast-top-right' }); 
        console.log('Connection successful:', response);
        this.resetForm();
        this.selectedConnection = null;
        this.routeToViewConnection();
      },
      error: (error) => {
        this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        if(this.isRedirectingUrl){
          this.routeToNewConnection();
        }
      }
    });
  }

  updateIntegrationConnection(object: any, hierarchyId: any, isExistingConnection: boolean) {
    this.workbenchService.updateIntegrationConnection(object, hierarchyId).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message, 'success', { positionClass: 'toast-top-right' }); 
        console.log('Connection successful:', response);
        this.resetForm();
        this.isEditPreview = false;
        if(isExistingConnection){
          this.getSpecificConnections(this.selectedConnection);
        } else{
          this.routeToViewConnection();
          this.selectedConnection = null;
        }
      },
      error: (error) => {
        this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        if(isExistingConnection){
          this.getSpecificConnections(this.selectedConnection);
        } else{
          this.routeToViewConnection();
          this.isEditPreview = false;
          this.selectedConnection = null;
        }
      }
    });
  }

  editPreviewIntegrationConnection(hierarchyId: any, type: any, isExistingConnection?: boolean) {
    this.workbenchService.getIntegrationConnection(hierarchyId).subscribe({
      next: (response: any) => {
        this.editPreviewData = response;
        this.editPreviewData.id = hierarchyId;
        this.setIntegrationPreviewData(response);
        this.displayName = response.credentials.display_name;
        this.isExistingConnectionsEdit = isExistingConnection ?? false;
        if(!isExistingConnection){
          this.isEditPreview = true;
          this.selectedConnection = type;
        }
      },
      error: (error) => {
        console.error('Error fetching integration connection:', error);
      }
    });
  }

  deleteIntegrationConnection(database: any, isExistingConnection?: boolean) {
    Swal.fire({
      position: "center",
      icon: "question",
      title: `Delete ${database.display_name} connection ?`,
      text: "This action cannot be undone. Are you sure you want to proceed?",
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.workbenchService.deleteIntegrationConnection(database?.hierarchy_id).subscribe({
          next: (response: any) => {
            this.toasterservice.success(response.message, 'success', { positionClass: 'toast-top-right' });
            console.log(response);
             if (isExistingConnection) {
              this.getSpecificConnections(this.selectedConnection);
            } else {
              this.getConnectionList();
              if(this.isEditPreview) this.isEditPreview = false;
              this.selectedConnection = null;
            }
            this.resetForm();
          },
          error: (error) => {
            this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          }
        });
      }
    });
  }

  setIntegrationPreviewData(data: any) {
    const credentials = data.credentials;
    if (data.integration_type === 'connectwise') {
      this.companyId = credentials.company_id;
      this.siteURL = credentials.site_url;
      this.publicKey = credentials.public_key;
      this.privateKey = credentials.private_key ?? '';
    } else if (data.integration_type === 'ninja') {
      this.clientId = credentials.client_id;
      this.clientSecret = credentials.client_secret ?? '';
      this.selectedScopes = credentials.scopes || [];
    } else if (data.integration_type === 'pax8') {
      this.clientId = credentials.client_id;
      this.clientSecret = credentials.client_secret ?? '';
    } else if (data.integration_type === 'dbt') {
      this.token = credentials.api_token ?? '';
      this.accountId = credentials.account_id;
      this.domainUrl = credentials.site_url;
    } else if (data.integration_type === 'bamboohr') {
      this.apiKey = credentials.api_token ?? '';
      this.domainName = credentials.domain;
    } else if (data.integration_type === 'shopify') {
      this.shopName = credentials.shop_name;
      this.token = credentials.api_token ?? '';
    } else if (data.integration_type === 'tally') {
      this.token = credentials.api_token ?? '';
    } else if (data.integration_type === 'googleanalytic') {
      this.accountType = credentials.type;
      this.projectId = credentials.project_id;
      this.privateKeyId = credentials.private_key_id;
      this.privateKey = credentials.private_key;
      this.clientEmail = credentials.client_email;
      this.clientId = credentials.client_id;
      this.clientX509CertUrl = credentials.client_x509_cert_url;
      this.propertyId = credentials.property_id;
      this.selectedDimensions = credentials.dimensions;
      this.selectedMetrics = credentials.metrics;
    } else if (data.integration_type === 'hubspot') {
      this.token = credentials.api_token ?? '';
    } else if (['zoho_books', 'zoho_inventory', 'zoho_crm'].includes(data.integration_type)){
      this.zohoCountry = this.toTitleCase(credentials.country) ?? '';
    }
  }

  toTitleCase(value: string = ''): string {
    return value
      .toLowerCase()
      .replace(/\b\w/g, char => char?.toUpperCase());
  }

  validateRequired(value: any): boolean {
    return !value;
  }

  validateArrayRequired(arr: any[]): boolean {
    return !Array.isArray(arr) || arr.length === 0;
  }

  displayNameChange() {
    this.displayNameError = this.validateRequired(this.displayName);
  }

  onCompanyIdChange() {
    this.companyIdError = this.validateRequired(this.companyId);
  }

  onSiteUrlChange() {
    this.siteURLError = this.validateRequired(this.siteURL);
  }

  onPublicKeyChange() {
    this.publicKeyError = this.validateRequired(this.publicKey);
  }

  onPrivateKeyChange() {
    this.privateKeyError = this.validateRequired(this.privateKey);
  }

  onClientIdChange() {
    this.clientIdError = this.validateRequired(this.clientId);
  }

  onClientSecretChange() {
    this.clientSecretError = this.validateRequired(this.clientSecret);
  }

  onApiKeyChange() {
    this.apiKeyError = this.validateRequired(this.apiKey);
  }

  onDomainNameChange() {
    this.domainNameError = this.validateRequired(this.domainName);
  }

  onAccountIdChange() {
    this.accountIdError = this.validateRequired(this.accountId);
  }

  onDomainUrlChange() {
    this.domainUrlError = this.validateRequired(this.domainUrl);
  }

  onTokenChange() {
    this.tokenError = this.validateRequired(this.token);
  }

  onZohoCountryChange() {
    this.zohoCountryError = this.validateRequired(this.zohoCountry);
  }

  onShopNameChange() {
    this.shopNameError = this.validateRequired(this.shopName);
  }

  onSubDomainUrlChange() {
    this.subDomainUrlError = this.validateRequired(this.subDomainUrl);
  }

  onProjectIdChange() {
    this.projectIdError = this.validateRequired(this.projectId);
  }

  onPrivateKeyIdChange() {
    this.privateKeyIdError = this.validateRequired(this.privateKeyId);
  }

  onClientEmailChange() {
    this.clientEmailError = this.validateRequired(this.clientEmail);
  }

  onClientX509CertUrlChange() {
    this.clientX509CertUrlError = this.validateRequired(this.clientX509CertUrl);
  }

  onPropertyIdChange() {
    this.propertyIdError = this.validateRequired(this.propertyId);
  }

  onScopeChange(scopes: string[]) {
    this.selectedScopes = scopes || [];
    this.scopeError = this.validateArrayRequired(this.selectedScopes);
  }

  onDimensionsChange() {
    this.dimensionsError = this.validateArrayRequired(this.selectedDimensions);
  }

  onMetricsChange() {
    this.metricsError = this.validateArrayRequired(this.selectedMetrics);
  }

  openIntegrationSuccessModal(){
    this.modalRef = this.modalService.open(this.integrationSuccessTpl, { backdrop: 'static', centered: true });
    this.isIntegrationModalOpen = true;
    this.startCountdown(this.type);

    this.modalRef.closed.subscribe(() => this.cleanupCountdown());
    this.modalRef.dismissed.subscribe(() => this.cleanupCountdown());
  }

  getTimestamp(): string {
    const now = new Date();

    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
  }

  startCountdown(type: string) {
    this.countdown = 30;

    this.countdownInterval = setInterval(() => {
      this.countdown--;

      if (this.countdown === 0 && this.isIntegrationModalOpen) {
        this.cleanupCountdown();
        this.modalRef.close();
        this.urlIntegrationsPayload(false, type);
      }
    }, 1000);
  }

  cleanupCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.isIntegrationModalOpen = false;
  }

  onClose() {
    this.resetForm();

    if (!this.isEditPreview) {
      this.goBackToSubCategories();
    } else {
      this.isEditPreview = false;
      this.selectedConnection = null;
    }
  }
}