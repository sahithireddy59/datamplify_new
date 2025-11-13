import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/sharedmodule';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-configure',
  standalone: true,
  imports: [CommonModule, SharedModule, NgbModule, FormsModule],
  templateUrl: './configure.component.html',
  styleUrl: './configure.component.scss',
})
export class ConfigureComponent {
  activeTab: string = 'userManagement';
  rolesFilter: string = 'All Roles'
  rolesList: string[] = ['All Roles', 'Administrator', 'Team Member', 'Viewer'];

  // Dummy data for the User Management tab
  users = [
    { name: 'Sahithi (You)', initial: 'S', email: 'sahithi@datamplify.com', role: 'Administrator', status: 'Active', lastActive: 'Now', permissions: [{ name: 'Full Administrative Access', icon: 'bi-shield-check' }] },
    { name: 'John Smith', initial: 'J', email: 'john.smith@company.com', role: 'Team Member', status: 'Active', lastActive: '2 hours ago', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'EasyConnect', icon: 'bi-hdd-stack' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'TaskPlan', icon: 'bi-card-checklist' }, { name: 'Monitoring', icon: 'bi-activity' }] },
    { name: 'Emily Johnson', initial: 'E', email: 'emily.johnson@company.com', role: 'Team Member', status: 'Active', lastActive: '1 day ago', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'EasyConnect', icon: 'bi-hdd-stack' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'Scheduler', icon: 'bi-calendar-week' }] },
    { name: 'Michael Brown', initial: 'M', email: 'michael.brown@company.com', role: 'Viewer', status: 'Active', lastActive: '3 days ago', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'Monitoring', icon: 'bi-activity' }] },
    { name: 'Sarah Wilson', initial: 'S', email: 'sarah.wilson@company.com', role: 'Team Member', status: 'Pending', lastActive: 'Never', permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'TaskPlan', icon: 'bi-card-checklist' }] }
  ];

  // Dummy data for the Permissions tab
  roles = [
    { name: 'Administrator', icon: 'fa-solid fa-crown', description: 'Full access to all features and user management', accessType: 'Full Administrative Access', permissions: [] },
    { name: 'Team Member', icon: 'fa-solid fa-people-group', description: 'Access to most features, cannot manage users', accessType: null, permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'EasyConnect', icon: 'bi-hdd-stack' }, { name: 'Flowboard', icon: 'bi-diagram-3' }, { name: 'TaskPlan', icon: 'bi-card-checklist' }, { name: 'Monitoring', icon: 'bi-activity' }] },
    { name: 'Viewer', icon: 'fa-regular fa-eye', description: 'Read-only access to selected features', accessType: null, permissions: [{ name: 'Dashboard', icon: 'bi-grid-1x2' }, { name: 'Monitoring', icon: 'bi-activity' }] }
  ];

  /**
   * Sets the currently active tab.
   * @param tab The name of the tab to activate ('userManagement', 'permissions', etc.)
   */
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  /**
   * Returns the appropriate Bootstrap badge class based on the user's role.
   * @param role The user role string.
   */
  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'Administrator': return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
      case 'Team Member': return 'bg-primary-subtle text-primary-emphasis border border-primary-subtle';
      case 'Viewer': return 'bg-info-subtle text-info-emphasis border border-info-subtle';
      default: return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
    }
  }

  /**
   * Returns the appropriate Bootstrap badge class based on the user's status.
   * @param status The user status string ('Active' or 'Pending').
   */
  getStatusBadgeClass(status: string): string {
    return status === 'Active'
      ? 'bg-success-subtle text-success-emphasis border border-success-subtle'
      : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  }

  permissions = [
    { name: 'Dashboard', desc: 'View KPIs and analytics', icon: 'bi bi-grid', enabled: true },
    { name: 'EasyConnect', desc: 'Manage data connections', icon: 'bi bi-plug', enabled: false },
    { name: 'Flowboard', desc: 'Create and edit pipelines', icon: 'bi bi-diagram-3', enabled: false },
    { name: 'TaskPlan', desc: 'Manage tasks and workflows', icon: 'bi bi-list-task', enabled: false },
    { name: 'Scheduler', desc: 'Schedule and automate jobs', icon: 'bi bi-clock-history', enabled: false },
    { name: 'Monitoring', desc: 'Monitor system health', icon: 'bi bi-activity', enabled: false }
  ];
  isInviteUser: boolean = false;

  openPopup(){
    this.isInviteUser = true;
  }

  closePopup() {
    this.isInviteUser = false;
    console.log('Popup closed');
  }

  generateLink() {
    console.log('Generate link clicked');
  }
}
