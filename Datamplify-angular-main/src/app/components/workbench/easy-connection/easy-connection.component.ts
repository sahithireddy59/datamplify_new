import { Component } from '@angular/core';
import { SharedModule } from '../../../shared/sharedmodule';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../../shared/services/loader.service';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-easy-connection',
  standalone: true,
  imports: [SharedModule, FormsModule, CommonModule, NgxPaginationModule, NgbModule],
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
  selectedCategory: string | null = null;
  selectedConnectionType: string | null = null;
  showRelational = false;
  showLLM = false;
  showMultiDim = false;
  showNoSQL = false;
  showFiles = false;
  showIntegrations = false;
  viewNewConnection = false;
  selectedConnection: string | null = null;
  existingConnections: any = [];
  skeletons = Array(9);
  selectedMicroSoftAuthType: string | null = null;
  sqlLitePath: string='';
  pathError: boolean = false;
  isExistingConnectionsEdit: boolean = false;
  
  // Data sources from API
  availableDataSources: any = {
    databases: [],
    files: [],
    remote_files: []
  };
  selectedDatabaseType: number | null = null;


  constructor(private loaderService: LoaderService, private workbenchService: WorkbenchService, private toasterservice: ToastrService,
    private modalService: NgbModal, private router: Router,private sanitizer: DomSanitizer) {
    if (this.router.url.startsWith('/datamplify/easyConnection/newConnection')) {
      this.showList = false;
      this.viewNewConnection = true;
    }
  }

  ngOnInit() {
    this.loaderService.hide();
    console.log('🚀 Component initialized, calling loadDataSources...');
    this.loadDataSources();
    if(this.showList){
      this.getConnectionList();
    }
  }

  // Manual method to test API
  testDataSourcesAPI() {
    console.log('🧪 Testing DataSources API manually...');
    this.loadDataSources();
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

  getSchemaList(){
    let object = {
      database_type: 1,
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

  DatabaseConnection() {
    console.log('🔍 Selected Database Type ID:', this.selectedDatabaseType);
    console.log('🔍 Available Data Sources:', this.availableDataSources);
    console.log('🔍 Edit Preview Data:', this.editPreviewData);
    
    // Force correct database type for existing connections
    let databaseType = this.selectedDatabaseType || 1;
    if (this.isEditPreview && this.editPreviewData?.server_type) {
      const serverTypeMapping: { [key: string]: number } = {
        'POSTGRESQL': 1,
        'MYSQL': 6,
        'MONGODB': 7,
        'ORACLE': 8
      };
      databaseType = serverTypeMapping[this.editPreviewData.server_type] || 1;
      console.log(`🔧 Forcing database type to ${databaseType} for ${this.editPreviewData.server_type}`);
    }
    
    let object = {
      database_type: databaseType,
      hostname: this.serverName,
      port: this.portName,
      username: this.userName,
      password: this.password,
      database: this.databaseName,
      connection_name: this.displayName,
      service_name: null,
      schema: this.selectedSchema
    }
    console.log('📤 Sending connection object:', object);

    this.workbenchService.databaseConnection(object).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
        console.log('Connection successful:', response);
        this.resetForm();
        this.routeToViewConnection();
      },
      error: (error) => {
        this.toasterservice.error(error.error.message,'error',{ positionClass: 'toast-top-right'});
        console.error('Connection failed:', error);
      }
    });
  }

  updateDatabaseConnection(hierarchyId:any) {
    let object = {
      database_type: 1,
      hostname: this.serverName,
      port: this.portName,
      username: this.userName,
      password: this.password,
      database: this.databaseName,
      connection_name: this.displayName,
      service_name: null,
      schema: this.selectedSchema
    }
    console.log(object);

    this.workbenchService.updateDatabaseConnection(hierarchyId,object).subscribe({
      next: (response) => {
        this.toasterservice.success(response.message,'success',{ positionClass: 'toast-top-right'});
        console.log('Connection successful:', response);
        this.resetForm();
        this.isEditPreview = false;
        this.getConnectionList();
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
        
        // Set the correct database type based on server_type from response
        const serverTypeMapping: { [key: string]: number } = {
          'POSTGRESQL': 1,
          'MYSQL': 6,
          'MONGODB': 7,
          'ORACLE': 8
        };
        
        this.selectedDatabaseType = serverTypeMapping[response.server_type] || 1;
        console.log(`🔧 Edit connection: Set selectedDatabaseType to ${this.selectedDatabaseType} for ${response.server_type}`);
        
        if(!isExistingConnection){
          this.isEditPreview = true;
          this.selectedConnection = response.server_type || 'POSTGRESQL';
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
            }
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
    }
    input.value = '';
  }

  fileConnection(modal: any, hierarchyId?: string) {
    if (!this.selectedFile || !this.displayName) return;

    const formData = new FormData();
    formData.append('file_path', this.selectedFile);
    formData.append('file_type', '2');
    formData.append('connection_name', this.displayName);

    const request$ = hierarchyId ? this.workbenchService.updateFileConnection(formData, hierarchyId) : this.workbenchService.fileConnection(formData);

    request$.subscribe({
      next: (response) => {
        this.toasterservice.success(response.message, 'Success', { positionClass: 'toast-top-right' });
        console.log('CSV upload successful:', response);
        this.resetForm();
        if(this.isEditPreview){
          this.isEditPreview = false;
          this.getConnectionList();
        } else{
          this.routeToViewConnection();
        }
      },
      error: (error) => {
        this.toasterservice.error(error.error.message, 'Error', { positionClass: 'toast-top-right' });
        console.error('CSV upload failed:', error);
      }
    });
  }

  getFileConnection(hierarchyId: any, modal:any, isExistingConnection?: boolean) {
    this.workbenchService.getFileConnection(hierarchyId).subscribe({
      next: (response: any) => {
        console.log(response);
        this.editPreviewData = response;
        // this.openUploadModal(modal);
        this.displayName = response.connection_name;
        this.isExistingConnectionsEdit = isExistingConnection ?? false;
        if(!isExistingConnection){
          this.isEditPreview = true;
          this.selectedConnection = 'CSV';
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
            }
          },
          error: (err) => {
            this.toasterservice.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
            console.error('Error fetching connection data:', err);
          }
        });
      }
    })
  }

  getConnectionList() {
    this.isLoading = true;
    console.log('📋 Getting ALL connection list (no type filter)...');
    this.workbenchService.disableLoaderForNextRequest();
    this.workbenchService.getConnectionsList(this.page, this.pageSize, this.searchConnections).subscribe({
      next: (data) => {
        console.log('📋 Connection list response:', data);
        console.log('📋 Found connections:', data.data?.length || 0);
        data.data?.forEach((conn: any, index: number) => {
          console.log(`   ${index + 1}. ${conn.display_name} (${conn.server_type})`);
          if (conn.server_type === 'MONGODB') {
            console.log('🍃 MongoDB connection details:', conn);
          }
        });
        this.connectionList = data.data || [];
        this.totalItems = data.total_items;
        this.isLoading = false;
        
        console.log('📋 Final connectionList assigned:', this.connectionList);
        console.log('📋 MongoDB connections in list:', this.connectionList.filter(c => c.server_type === 'MONGODB'));
      },
      error: (error) => {
        console.error('❌ Error fetching connections:', error);
        this.isLoading = false;
      }
    });
  }

  resetForm() {
    this.serverName = '';
    this.portName = '';
    this.databaseName = '';
    this.userName = '';
    this.displayName = '';
    this.password = '';
    this.selectedSchema = 'public';
    this.editPreviewData = null;
    this.selectedFile = null;
    this.displayName = '';
    this.selectedConnection = null;
    this.errorCheck();
    this.serverError = false;
    this.portError = false;
    this.databaseError = false;
    this.userNameError= false;
    this.displayNameError = false;
    this.passwordError= false;
    this.pathError = false;
    this.isExistingConnectionsEdit = false;
  }

  onPageSizeChange() {
      const totalPages = Math.ceil(this.totalItems / this.pageSize);
      if (this.page > totalPages) {
        this.page = 1;
      }
      this.getConnectionList();
  }

  routeToNewConnection(){
    this.router.navigate(['/datamplify/easyConnection/newConnection']);
  }
  
  routeToViewConnection(){
    this.router.navigate(['/datamplify/easyConnection']);
  }

  connectionListIcons: any = {
    POSTGRESQL: { type: 'image', value: './assets/images/icons_new/POSTGRESQL.svg' },
    MYSQL: { type: 'image', value: './assets/images/icons_new/MYSQL.svg' },
    MONGODB: { type: 'emoji', value: '🍃' },
    CSV: {type: 'image', value: './assets/images/icons_new/CSV.svg'},
    SFTP: {type: 'image', value: './assets/images/icons_new/SFTP.png'}
  };
  categories = [
    { name: 'Relational Database', image: './assets/images/icons/Rational.svg', description: 'Traditional SQL databases like MySQL, PostgreSQL',count:'5' },
    // { name: 'LLM Integrations', icon: '🤖', description: 'AI & Large Language Model integrations',count:'6' },
    // { name: 'Multi-dimensional Database', icon: '📊', description: 'OLAP & analytical data stores',count:'2' },
    // { name: 'NoSQL Database', icon: '📡', description: 'Document, Key-Value, Graph & Wide-column databases',count:'3' },
    { name: 'File Source', icon: '📂', description: 'CSV, Excel & JSON files',count:'2' },
    // { name: 'Integrations', icon: '🔗', description: 'Third-party services',count:'15' },
    { name: 'Remote Server', icon: '🌐', description: 'Connect to external servers or APIs for data access', count: '2' }
  ];
  connectionTypes: { [key: string]: { name: string; icon?: string; description: string; image?: string; svg?: string }[] } = {
    "Relational Database": [
      { name: "POSTGRESQL", image: './assets/images/icons_new/POSTGRESQL.svg', description: "Advanced open-source relational database" },
      { name: "MYSQL", image:'./assets/images/icons_new/MYSQL.svg', description: "Relational database" },
      { name: "MONGODB", icon: "🍃", description: "NoSQL document database" },
      { name: "ORACLE", image: './assets/images/icons_new/ORACLE.svg', description: "Enterprise relational database" },
      { name: "SQLite", image:'./assets/images/icons_new/SQLITE.svg', description: "Lightweight embedded database" },
      { name: "Microsoft SQL SERVER", image: './assets/images/icons_new/MICROSOFTSQLSERVER.svg', description: "Microsoft relational database" },
      // { name: "Snow Flake", icon: "❄️", description: "Cloud data warehouse" }
    ],
    "File Source": [
      { name: "CSV", image: "./assets/images/icons_new/CSV.svg", description: "Comma-separated values file" },
      { name: "Excel", image: "./assets/images/icons_new/EXCEL.svg", description: "Spreadsheet file format" }
    ],
    "Remote Server": [
      { name: "SFTP", image: "./assets/images/icons_new/SFTP.png", description: "Secure File Transfer Protocol server" },
      { name: "FTP", image: "./assets/images/icons_new/FTP.png", description: "File Transfer Protocol server" },
      // { name: "API", image: "./assets/images/icons_new/API.svg", description: "Connect to REST or GraphQL endpoints" }
    ]
  };

  getSafeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  categorySelect(categoryName: string) {
    this.selectedCategory = categoryName;
    console.log('🏷️ Selected Category:', this.selectedCategory);
    console.log('🔗 Available Connection Types for this category:', this.connectionTypes[categoryName]);
    this.viewNewConnection = false;
    this.showRelational = false;
    this.showLLM = false;
    this.showMultiDim = false;
    this.showNoSQL = false;
    this.showFiles = false;
    this.showIntegrations = false;
    switch (categoryName) {
      case 'Relational Database':
        this.showRelational = true;
        break;
      case 'Files Source':
        this.showFiles = true;
        break;
    }
  }
  goBackToCategories() {
    this.showRelational = false;
    this.showLLM = false;
    this.showMultiDim = false;
    this.showNoSQL = false;
    this.showFiles = false;
    this.showIntegrations = false;
    this.viewNewConnection = true;
    this.selectedCategory = null;
  }
  selectConnection(connName: string) {
    console.log('🎯 Selected Connection:', connName);
    this.selectedConnection = connName;
    this.getSpecificConnections(this.selectedConnection);
  }
  getSpecificConnections(selectedConnection:any){
    this.isLoading = true;
    let connectionId;
    if(selectedConnection === 'POSTGRESQL'){
      connectionId = 1;
    } else if(selectedConnection === 'MYSQL') {
      connectionId = 6; // MYSQL ID from API response
    } else if(selectedConnection === 'MONGODB') {
      connectionId = 7; // MongoDB ID from your database
    } else if(selectedConnection === 'CSV') {
      connectionId = 2;
    } else if(selectedConnection === 'SFTP') {
      connectionId = 3;
    }
    
    console.log(`🔍 Getting connections for ${selectedConnection} (ID: ${connectionId})...`);
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
    this.showRelational = false;
    this.showLLM = false;
    this.showMultiDim = false;
    this.showNoSQL = false;
    this.showFiles = false;
    this.showIntegrations = false;
    this.viewNewConnection = false;
    this.selectedConnection = null;
    this.existingConnections = [];

    switch (this.selectedCategory) {
      case 'Relational Database':
        this.showRelational = true;
        break;
      case 'Files Source':
        this.showFiles = true;
        break;
    }
  }

  loadDataSources() {
    console.log('🔄 Starting to load data sources...');
    
    this.workbenchService.getDataSources().subscribe({
      next: (response) => {
        console.log('📦 Raw API response:', response);
        this.availableDataSources = response;
        console.log('✅ Data sources stored in component:', this.availableDataSources);
        
        // Check databases array
        if (response.databases && Array.isArray(response.databases)) {
          console.log(`📊 Found ${response.databases.length} databases:`);
          response.databases.forEach((db: any, index: number) => {
            console.log(`   ${index + 1}. ID: ${db.id}, Name: ${db.name}, Type: ${db.type}`);
          });
          
          // Log MongoDB availability
          const mongoDb = response.databases.find((db: any) => db.name.toLowerCase() === 'mongodb');
          if (mongoDb) {
            console.log('🎯 ✅ MongoDB found with ID:', mongoDb.id);
          } else {
            console.log('❌ MongoDB not found in databases array');
          }
        } else {
          console.log('❌ No databases array in response or it\'s not an array');
        }
      },
      error: (error) => {
        console.error('❌ Failed to load data sources:', error);
        console.error('Error details:', error.error);
        this.toasterservice.error('Failed to load database types', 'Error', { positionClass: 'toast-top-right' });
      }
    });
  }

  getDefaultPort(): string {
    if (!this.selectedDatabaseType) return '5432';
    
    const selectedDb = this.availableDataSources.databases?.find((db: any) => db.id == this.selectedDatabaseType);
    if (!selectedDb) return '5432';
    
    switch (selectedDb.name.toUpperCase()) {
      case 'POSTGRESQL': return '5432';
      case 'MYSQL': return '3306';
      case 'MONGODB': return '27017';
      case 'ORACLE': return '1521';
      case 'SQL SERVER': return '1433';
      case 'REDIS': return '6379';
      default: return '5432';
    }
  }

  getPortPlaceholder(): string {
    const port = this.getDefaultPort();
    const selectedDb = this.availableDataSources.databases?.find((db: any) => db.id == this.selectedDatabaseType);
    const dbName = selectedDb?.name || 'Database';
    return `e.g. ${port} (${dbName} default)`;
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
        this.routeToViewConnection();
      },
      error: (error) => {
        this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.error('Connection failed:', error);
      }
    });
  }

  updateSFTPConnection(id: any) {
    // update logic similar to create
  }
}
