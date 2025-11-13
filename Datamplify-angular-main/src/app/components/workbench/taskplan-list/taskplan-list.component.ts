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

@Component({
  selector: 'app-taskplan-list',
  standalone: true,
  imports: [SharedModule,CommonModule,FormsModule,NgbModule,NgxPaginationModule,DatePipe],
  templateUrl: './taskplan-list.component.html',
  styleUrl: './taskplan-list.component.scss'
})
export class TaskplanListComponent {
  gridView = true;
  page: any = 1;
  pageSize: any = 9;
  totalItems: any;
  search: string = '';
  jobFlowList: any[] = [];
  skeletons = Array(9);
  isLoading: boolean = false

  constructor(private toasterService: ToastrService, private workbechService: WorkbenchService, private loaderService: LoaderService, private router: Router, private route: ActivatedRoute) {
  }

  ngOnInit() {
    this.loaderService.hide();
    this.getTaskplanList();
  }

  getTaskplanList() {
    this.isLoading = true;
    this.workbechService.disableLoaderForNextRequest();
    this.workbechService.getTaskPlanList(this.page, this.pageSize, this.search).subscribe({
      next: (data: any) => {
        console.log(data);
        this.jobFlowList = data.data;
        this.totalItems = data?.total_records;
        this.pageSize = data?.page_size;
        this.page = data?.page_number;
        if (this.jobFlowList.length === 0) {
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
  }

  deleteTaskPlan(flow: any) {
    Swal.fire({
      position: "center",
      icon: "question",
      title: `Delete ${flow.Task_name} Taskplan ?`,
      text: "This action cannot be undone. Are you sure you want to proceed?",
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.workbechService.deleteTaskPlan(flow.id).subscribe({
          next: (response) => {
            console.log(response);
            this.getTaskplanList();
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

  goToTaskplan() {
    this.router.navigate(['/datamplify/taskplanList/taskplan']);
  }

  editTaskplan(id: any) {
    const encodedId = btoa(id.toString());
    this.router.navigate(['/datamplify/taskplanList/taskplan/' + encodedId]);
  }

  onPageSizeChange() {
    // Reset to page 1 if you're on the last page and items may not fit
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (this.page > totalPages) {
      this.page = 1;
    }
    this.getTaskplanList();
  }
}
