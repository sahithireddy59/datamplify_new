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
  selector: 'app-monitor-list',
  standalone: true,
  imports: [SharedModule,CommonModule,FormsModule,NgbModule,NgxPaginationModule,DatePipe],
  templateUrl: './monitor-list.component.html',
  styleUrl: './monitor-list.component.scss'
})
export class MonitorListComponent {
  gridView = true;
  page: any = 1;
  pageSize: any = 9;
  totalItems: any;
  search: string = '';
  monitorsList: any[] = [];
  listSkeletons = Array(9);
  kpiSkeletons = Array(3);
  isLoading: boolean = false;
  kpiCards: any[] = [
    {
      title: "Running Pipelines",
      value: 0,
      valueClass: "text-info",
      icon: "fe fe-play text-info",
      iconBg: "bg-info-subtle",
      subText: "Active now",
      subTextClass: "text-info"
    },
    {
      title: "Completed Today",
      value: 0,
      valueClass: "text-success",
      icon: "fa-regular fa-circle-check text-success",
      iconBg: "bg-success-subtle",
      subText: "0%",
      subTextClass: "text-success"
    },
    {
      title: "Failed Tasks",
      value: 0,
      valueClass: "text-danger",
      icon: "fa-solid fa-circle-exclamation text-danger",
      iconBg: "bg-danger-subtle",
      subText: "0%",
      subTextClass: "text-danger"
    },
  ];

  constructor(private toasterService: ToastrService, private workbechService: WorkbenchService, private loaderService: LoaderService, private router: Router, private route: ActivatedRoute) {
  }

  ngOnInit() {
    this.loaderService.hide();
    this.getMonitorList();
    this.getKpiData();
  }

  getMonitorList() {
    this.isLoading = true;
    this.workbechService.disableLoaderForNextRequest();
    this.workbechService.getMonitorList(this.page, this.pageSize, this.search).subscribe({
      next: (data: any) => {
        console.log(data);
        this.monitorsList = data.runs_list.data;
        this.totalItems = data.runs_list.total_records;
        this.page = data.runs_list.page_number
        this.pageSize = data.runs_list.page_size;
        this.isLoading = false;
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
        this.isLoading = false;
      }
    });
  }

  getKpiData(){
    this.isLoading = true;
    this.workbechService.disableLoaderForNextRequest();
    this.workbechService.getMonitorKpiData().subscribe({
      next: (data: any) => {
        console.log(data);
        this.kpiCards[0].value = data.Running;
        this.kpiCards[1].value = data.success;
        this.kpiCards[1].subText = data.success_rate+'%';
        this.kpiCards[2].value = data.failed;
        this.kpiCards[2].subText = data.failure_rate+'%';
        this.isLoading = false;
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
        this.isLoading = false;
      }
    });
  }

  goToMonitor(id: any) {
    const encodedId = btoa(id.toString());
    this.router.navigate(['/datamplify/monitorList/monitor/' + encodedId]);
  }

  onPageSizeChange() {
    // Reset to page 1 if you're on the last page and items may not fit
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (this.page > totalPages) {
      this.page = 1;
    }
    this.getMonitorList();
  }
}
