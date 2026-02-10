import { Component } from '@angular/core';
import { SharedModule } from '../../../shared/sharedmodule';
import { CommonModule, DatePipe  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgxPaginationModule } from 'ngx-pagination';
import { ToastrService } from 'ngx-toastr';
import { WorkbenchService } from '../workbench.service';
import { LoaderService } from '../../../shared/services/loader.service';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PermissionService } from '../../../services/permission.service';
import { NavigationService } from '../../../shared/services/navigation.service';

@Component({
  selector: 'app-flowboard-list',
  standalone: true,
  imports: [SharedModule,CommonModule,FormsModule,NgbModule,NgxPaginationModule,DatePipe,HasPermissionDirective],
  templateUrl: './flowboard-list.component.html',
  styleUrl: './flowboard-list.component.scss'
})
export class FlowboardListComponent {
  gridView = true;
  page: any = 1;
  pageSize: any = 9;
  totalItems: any;
  search: string = '';
  dataFlowList: any[] = [];
  skeletons = Array(9);
  isLoading: boolean = false;
  canViewFlowboard: boolean = true;

  constructor(private toasterService: ToastrService, private workbechService: WorkbenchService, private loaderService: LoaderService, private router: Router, private route: ActivatedRoute, private permissionService: PermissionService, private navigationService: NavigationService) {
  }

  ngOnInit() {
    this.loaderService.hide();
    this.canViewFlowboard = this.permissionService.hasPermission(9);
    this.getFlowboardList();
  }

  getFlowboardList() {
    if (this.canViewFlowboard) {
      this.isLoading = true;
      this.workbechService.disableLoaderForNextRequest();
      this.workbechService.getFlowboardList(this.page, this.pageSize, this.search).subscribe({
        next: (data: any) => {
          console.log(data);
          this.dataFlowList = data.data;
          this.totalItems = data?.total_records;
          this.pageSize = data?.page_size;
          this.page = data?.page_number;
          if (this.dataFlowList.length === 0) {
            this.pageSize = 10;
            this.page = 1;
            this.totalItems = 0;
          }
          this.isLoading = false;
        },
        error: (error: any) => {
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          console.log(error);
          this.isLoading = false;
        }
      });
    } else {
      this.toasterService.info('You don’t have permission to view DagBoard', 'info', { positionClass: 'toast-top-right' });
    }
  }

  deleteFlowboard(flow: any) {
    Swal.fire({
      position: "center",
      icon: "question",
      title: `Delete ${flow.Flow_name} DagBoard ?`,
      text: "This action cannot be undone. Are you sure you want to proceed?",
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.workbechService.deleteFlowboard(flow.id).subscribe({
          next: (response) => {
            console.log(response);
            this.getFlowboardList();
            this.toasterService.success(response.message, 'success', { positionClass: 'toast-top-right' });
          },
          error: (error) => {
            console.log(error);
            this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          }
        })
      }
    })
  }

  goToFlowboard() {
    this.navigationService.navigate(['datamplify','DagBoardList','DagBoard']);
  }

  editFlowboard(id: any) {
    const encodedId = btoa(id.toString());
    this.navigationService.navigate(['datamplify','DagBoardList','DagBoard',encodedId]);
  }

  onPageSizeChange() {
    // Reset to page 1 if you're on the last page and items may not fit
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (this.page > totalPages) {
      this.page = 1;
    }
    this.getFlowboardList();
  }
}
