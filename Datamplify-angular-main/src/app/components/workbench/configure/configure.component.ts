import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SharedModule } from '../../../shared/sharedmodule';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../shared/services/auth.service';
import { PermissionService } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { NgxPaginationModule } from 'ngx-pagination';
import { WorkbenchService } from '../workbench.service';

interface Permission {
  name: string;
  module: string;
  icon: string;
}
@Component({
  selector: 'app-configure',
  standalone: true,
  imports: [CommonModule, SharedModule, NgbModule, FormsModule, HasPermissionDirective, NgxPaginationModule, DatePipe],
  templateUrl: './configure.component.html',
  styleUrl: './configure.component.scss',
})
export class ConfigureComponent {
  activeTab: string = 'userManagement';
  rolesFilter: string = 'All Roles'
  rolesList: string[] = ['All Roles', 'Admin', 'Team Member', 'Viewer'];
  inviteData = {
    email: '',
    username: '',
    role: '',
    message: ''
  };
  isGenerateLink: boolean = false;
  generatedLink: string | null = null;
  canViewConfigure: boolean = true;
  users: any[] = [];
  pageSize: number = 5;
  page: number = 1;
  totalItems: number = 0;
  search: string = '';
  permissionsByModule: Record<string, { id: number; name: string; icon: string }[]> = {
    User: [
      { id: 1, name: 'View Users', icon: 'bi bi-eye' },
      { id: 2, name: 'Create User', icon: 'bi bi-plus-circle' },
      { id: 3, name: 'Edit User', icon: 'bi bi-pencil-square' },
      { id: 4, name: 'Delete User', icon: 'bi bi-trash' },
    ],
    Role: [
      { id: 5, name: 'View Roles', icon: 'bi bi-eye' },
      { id: 6, name: 'Create Role', icon: 'bi bi-plus-circle' },
      { id: 7, name: 'Edit Role', icon: 'bi bi-pencil-square' },
      { id: 8, name: 'Delete Role', icon: 'bi bi-trash' },
    ],
    DagBoard: [
      { id: 9, name: 'View FlowBoards', icon: 'bi bi-eye' },
      { id: 10, name: 'Create DagBoard', icon: 'bi bi-plus-circle' },
      { id: 11, name: 'Edit DagBoard', icon: 'bi bi-pencil-square' },
      { id: 12, name: 'Delete DagBoard', icon: 'bi bi-trash' },
      { id: 13, name: 'Execute DagBoard', icon: 'bi bi-play-circle' },
      { id: 14, name: 'Schedule DagBoard', icon: 'bi bi-calendar-event' },
    ],
    TaskRunPlan: [
      { id: 15, name: 'View TaskRunPlan', icon: 'bi bi-eye' },
      { id: 16, name: 'Create TaskRunPlan', icon: 'bi bi-plus-circle' },
      { id: 17, name: 'Edit TaskRunPlan', icon: 'bi bi-pencil-square' },
      { id: 18, name: 'Delete TaskRunPlan', icon: 'bi bi-trash' },
      { id: 19, name: 'Execute TaskRunPlan', icon: 'bi bi-play-circle' },
      { id: 20, name: 'Schedule TaskRunPlan', icon: 'bi bi-calendar-event' },
    ],
    EasyConnect: [
      { id: 21, name: 'View Connections', icon: 'bi bi-eye' },
      { id: 22, name: 'Create Connection', icon: 'bi bi-plus-circle' },
      { id: 23, name: 'Edit Connection', icon: 'bi bi-pencil-square' },
      { id: 24, name: 'Delete Connection', icon: 'bi bi-trash' },
    ],
    Scheduler: [
      { id: 25, name: 'View Scheduler', icon: 'bi bi-eye' },
      { id: 26, name: 'Create Scheduler', icon: 'bi bi-plus-circle' },
      { id: 27, name: 'Edit Scheduler', icon: 'bi bi-pencil-square' },
      { id: 28, name: 'Delete Scheduler', icon: 'bi bi-trash' },
    ],
    Monitor: [
      { id: 29, name: 'View Monitoring', icon: 'bi bi-eye' },
    ],
  };
  permissionsModules: any;
  selectedModulePermissions: { [userId: string]: any[] } = {};
  selectedModule: { [userId: string]: string } = {};
  isLoading = true;
  skeletons = Array(5);

  // Dummy data for the User Management tab
  // users = [
  //   { name: 'Sahithi (You)', initial: 'S', email: 'sahithi@datamplify.com', role: 'Administrator', status: 'Active', lastActive: 'Now', permissions: [{ name: 'Full Administrative Access', icon: 'bi-shield-check' }] },
  //   { name: 'John Smith', initial: 'J', email: 'john.smith@company.com', role: 'Team Member', status: 'Active', lastActive: '2 hours ago', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'EasyConnect', icon: 'bi-hdd-stack' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'TaskPlan', icon: 'bi-card-checklist' }, { name: 'Monitoring', icon: 'bi-activity' }] },
  //   { name: 'Emily Johnson', initial: 'E', email: 'emily.johnson@company.com', role: 'Team Member', status: 'Active', lastActive: '1 day ago', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'EasyConnect', icon: 'bi-hdd-stack' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'Scheduler', icon: 'bi-calendar-week' }] },
  //   { name: 'Michael Brown', initial: 'M', email: 'michael.brown@company.com', role: 'Viewer', status: 'Active', lastActive: '3 days ago', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'Monitoring', icon: 'bi-activity' }] },
  //   { name: 'Sarah Wilson', initial: 'S', email: 'sarah.wilson@company.com', role: 'Team Member', status: 'Pending', lastActive: 'Never', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'TaskPlan', icon: 'bi-card-checklist' }] }
  // ];

  // Dummy data for the Permissions tab
  roles = [
    { name: 'Admin', icon: 'fa-solid fa-crown', description: 'Full access to all features and user management', accessType: 'Full Administrative Access', permissions: [] },
    { name: 'Team Member', icon: 'fa-solid fa-people-group', description: 'Access to most features, cannot manage users', accessType: null, permissions: [{ name: 'Home', icon: 'fe fe-home' }, { name: 'EasyConnect', icon: 'fe fe-link-2' }, { name: 'DagBoard', icon: 'fe fe-git-branch' }, { name: 'TaskRunPlan', icon: 'fa-solid fa-chart-diagram' }, { name: 'Scheduler', icon: 'fe fe-clock' }, { name: 'Monitor', icon: 'fe fe-monitor' }] },
    { name: 'Viewer', icon: 'fa-regular fa-eye', description: 'Read-only access to selected features', accessType: null, permissions: [{ name: 'Home', icon: 'fe fe-home' }, { name: 'EasyConnect', icon: 'fe fe-link-2' }, { name: 'DagBoard', icon: 'fe fe-git-branch' }, { name: 'TaskRunPlan', icon: 'fa-solid fa-chart-diagram' }, { name: 'Scheduler', icon: 'fe fe-clock' }, { name: 'Monitor', icon: 'fe fe-monitor' }] }
  ];

  constructor(private modalService: NgbModal, private toasterService: ToastrService, private authenticationService: AuthService, private permissionService: PermissionService, private workbenchService: WorkbenchService) {
  }

  ngOnInit() {
    this.canViewConfigure = this.permissionService.hasPermission(1);
    if(this.canViewConfigure){
      this.getUsersList();
    }
  }

  openPopup(modal:any){
     this.modalService.open(modal, {
      centered: true,
      windowClass: 'animate__animated animate__zoomIn',
    });
  }

  copyLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      this.toasterService.info('Link copied to clipboard!', 'info', { positionClass: 'toast-top-right' });
    });
  }

  sendInvite(modal?:any) {
    if (!this.inviteData.email || !this.inviteData.username || !this.inviteData.role) {
      alert('Please fill all required fields.');
      return;
    }

    let object = {
      ...this.inviteData,
      generate_link: this.isGenerateLink
    }

    this.authenticationService.inviteNewUser(object).subscribe({
      next: (response: any) => {
        console.log(response);
        if(this.isGenerateLink){
          this.generatedLink = response.invite_link;
          this.toasterService.success('Link Generated Successfully', 'success', { positionClass: 'toast-top-right' });
        } else{
          this.clearInviteForm();
          modal?.close();
          this.toasterService.success('Invite sent Successfully', 'success', { positionClass: 'toast-top-right' });
        }
      },
      error: (err) => {
        if(err.error?.email.length > 0){
          this.toasterService.error(err.error.email[0], 'error', { positionClass: 'toast-top-right' });
        } else{
          this.toasterService.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
        }
      }
    });
  }

  clearInviteForm(){
    this.inviteData = {
      email: '',
      username: '',
      role: '',
      message: ''
    };
    this.isGenerateLink = false;
    this.generatedLink = null;
  }

  getUsersList(){
    this.isLoading = true;
    const role = this.rolesFilter === 'Admin' ? 2 : (this.rolesFilter === 'Team Member' ? 3 : (this.rolesFilter === '' ? 4 : 0));
    this.workbenchService.disableLoaderForNextRequest();
    this.authenticationService.getUsersList(this.page, this.pageSize, this.search, role).subscribe({
      next: (response: any) => {
        console.log(response);
        this.users = response.data;
        this.page = response.page_number;
        this.pageSize = response.page_size;
        this.totalItems = response.total_records;

        const allModules = Object.keys(this.permissionsByModule);
        this.permissionsModules = {}; // reset or initialize

        response.data.forEach((user: any, index:any) => {
          const userModules: any[] = [];

          allModules.forEach((moduleName) => {
            const modulePermissions = this.permissionsByModule[moduleName];
            // check if any permission in this module exists in user's permission list
            const hasPermission = modulePermissions.some((perm) =>
              user.permissions.includes(perm.id)
            );

            if (hasPermission) {
              const icon = moduleName === 'EasyConnect' ? 'fe fe-link-2' : (moduleName === 'DagBoard' ? 'fe fe-git-branch' : (moduleName === 'TaskRunPlan' ? 'fa-solid fa-chart-diagram' : (moduleName === 'Scheduler' ? 'fe fe-clock' : (moduleName === 'Monitor' ? 'fe fe-monitor' : (moduleName === 'User' ? 'fe fe-user' : 'fas fa-cogs' ) ) ) ) )
              let object = { name: moduleName, icon:  icon}
              userModules.push(object);
            }
          });

          // store module names by user's present_user_id
          this.permissionsModules[user.present_user_id] = userModules;
        });
        console.log(this.permissionsModules);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.toasterService.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  onPageSizeChange() {
      const totalPages = Math.ceil(this.totalItems / this.pageSize);
      if (this.page > totalPages) {
        this.page = 1;
      }
      this.getUsersList();
  }

  editUser(user: any){
    user.role_id = user.role === 'Admin' ? 2 : (user.role === 'Team Member' ? 3 : 4);
    let object = {
      user_id: user.present_user_id,
      role_id: user.role_id
    }
    this.authenticationService.editUser(object).subscribe({
      next: (response: any) => {
        console.log(response);
        this.getUsersList();
        this.toasterService.success(response.message, 'success', { positionClass: 'toast-top-right' });
      },
      error: (err) => {
        this.toasterService.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  deleteUser(user: any){
    this.authenticationService.deleteUser(user.id).subscribe({
      next: (response: any) => {
        console.log(response);
        this.getUsersList();
        this.toasterService.success(response.message, 'success', { positionClass: 'toast-top-right' });
      },
      error: (err) => {
        this.toasterService.error(err.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  getSelectedModulePermissions(moduleName:any, userId:any,permissionIds:any){
    this.selectedModule[userId] = moduleName;
    this.selectedModulePermissions[userId] = this.permissionsByModule[moduleName].filter((permission)=> permissionIds.includes(permission.id));
  }
}
