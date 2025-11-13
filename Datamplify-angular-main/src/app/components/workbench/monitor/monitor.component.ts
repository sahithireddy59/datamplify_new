import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import type { EChartsOption } from 'echarts';
import { NGX_ECHARTS_CONFIG, NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgxPaginationModule } from 'ngx-pagination';
import { forkJoin } from 'rxjs';
import { EtlLoggerViewComponent } from '../etl-logger-view/etl-logger-view.component';

interface TaskRunStatus {
  status: string;
  runId: string;
  runAfter: string;
  duration: number;
}

interface SidebarTaskStatus {
  name: string;
  hasFailureInHistory?: boolean;
  statuses: TaskRunStatus[];
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  providers: [ { provide: NGX_ECHARTS_CONFIG, useFactory: () => ({ echarts: echarts }), }, DatePipe],
  imports: [ CommonModule, FormsModule, NgxEchartsModule, NgbModule, NgxPaginationModule, EtlLoggerViewComponent ],
  templateUrl: './monitor.component.html',
  styleUrl: './monitor.component.scss'
})
export class MonitorComponent {
  activeTab: 'overview' | 'runs' | 'tasks' = 'overview';
  lastXRuns: any = 5;
  dagId: string = '';
  sideNavBarData: any;
  tasksIds: string[] = [];
  sidebarChartOptions: EChartsOption = {};
  tasksRunStatuses: SidebarTaskStatus[] = [];
  unWantedTasks: any[] = ['__global_param_store__', '__init_global_params', 'cleanup_temporary_tables', 'dag_success_marker'];
  dagName: string = '';
  schedule: string = '';
  latestRunTimestamp: string = '';
  nextRunTimestamp: string = '';
  mainChartTitle: string = 'Run Performance (Last 14 Runs)';
  runs: any[] = [];
  filteredRuns: any[] = [];
  chartOptions: EChartsOption = {};
  avgDurationOfRuns: any = 0;
  bestDurationOfRuns: number = 0;
  worstDurationOfRuns: number = 0;
  selectedStateFilter: string = 'All States';
  selectedRunTypeFilter: string = 'All Run Types';
  orderBy: string = '-run_after';
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  tasks: any[] = [];
  filteredTasks: any[] = [];
  taskInstanceLogs: any[] = [];
  filteredTaskInstanceLogs: any[] = [];
  selectedTask: any = null;
  availableTasks: string[] = [];
  isFullLogView: boolean = false;
  runTaskInstances: any[] = [];
  filteredRunTaskInstances: any[] = [];
  isLoading : boolean = false;
  isFlowboard: boolean = false;

  constructor(private workbenchService: WorkbenchService, private toasterService: ToastrService, private router: Router, private route: ActivatedRoute, private datePipe: DatePipe) {
    if (this.router.url.startsWith('/datamplify/monitorList/monitor')) {
      if (route.snapshot.params['id1']) {
        const id = atob(route.snapshot.params['id1']);
        this.dagId = id.toString();
      }
    }
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.getTasksAndRunsStatus(this.dagId);
    this.getHeaderDataOfOverallRun(this.dagId);
    this.getRunsList(this.dagId, 14, 1, '', '', '-run_after');
  }

  refreshMonitorData(){
    this.activeTab = 'overview';
    this.getTasksAndRunsStatus(this.dagId);
    this.getHeaderDataOfOverallRun(this.dagId);
    this.getRunsList(this.dagId, 14, 1, '', '', '-run_after');
  }

  get totalPages() {
    return Math.ceil(this.filteredRuns.length / this.pageSize);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  goBackToMonitorList(){
    this.router.navigate(['/datamplify/monitorList']);
  }

  getTasksAndRunsStatus(dagId: string) {
    this.workbenchService.getRunAndTaskStatus(dagId, this.lastXRuns).subscribe({
      next: (data: any) => {
        console.log(data);
        this.sideNavBarData = data;
        this.setSideNavBarData(data);
        this.tasksIds = data.structure.nodes.map((task: any) => task.id);
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  setSideNavBarData(data: any) {
    const chartData = this.getRunStatus(data).map((run, index: any) => {
      let color = '';
      switch (run.status.toLowerCase()) {
        case 'success':
          color = '#28a745'; // green
          break;
        case 'failed':
          color = '#dc3545'; // red
          break;
        case 'running':
          color = '#17a2b8'; // blue
          break;
        default:
          color = '#6c757d'; // gray for unknowns
      }

      return {
        value: run.duration,
        name: this.datePipe.transform(run.runAfter, 'yyyy-MM-dd HH:mm:ss')+'',
        itemStyle: { color },
        status: run.status
      };
    });

    this.sidebarChartOptions = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(30,30,30,0.85)',
        borderWidth: 0,
        textStyle: {
          color: '#fff',
          fontSize: 13,
        },
        formatter: (params: any) => {
          return `
        <div style="padding:4px 8px;">
          <strong style="color:#ddd;">Run:</strong> ${params.name}<br/>
          <strong style="color:#ddd;">Status:</strong> <span style="color:${params.color}">${params.data.status}</span><br/>
          <strong style="color:#ddd;">Duration:</strong> ${params.value} sec
        </div>`;
        }
      },
      // title: {
      //   text: 'Task Runs',
      //   subtext: 'Run Durations & Status',
      //   left: 'center',
      //   top: '5%',
      //   textStyle: {
      //     color: '#fff',
      //     fontSize: 16,
      //     fontWeight: 'bold'
      //   },
      //   subtextStyle: {
      //     color: '#777',
      //     fontSize: 12
      //   }
      // },
      series: [
        {
          name: 'Run Duration',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 3,
            // borderColor: '#fff',
            // borderWidth: 2,
            shadowBlur: 15,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
          },
          label: {
            show: true,
            position: 'inside',
            formatter: '{d}%',
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff',
            textBorderWidth: 1,
            textBorderColor: 'rgba(0,0,0,0.3)'
          },
          labelLine: {
            show: false
          },
          emphasis: {
            scale: true,
            scaleSize: 10,
            itemStyle: {
              shadowBlur: 25,
              shadowColor: 'rgba(0, 0, 0, 0.25)'
            }
          },
          data: chartData.map((d: any) => ({
            ...d,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: d.itemStyle.color },
                  { offset: 1, color: this.lightenColor(d.itemStyle.color, 30) }
                ]
              }
            }
          }))
        }
      ]
    };

    console.log(this.sidebarChartOptions);

    this.tasksRunStatuses = this.setSideBarTaskStatus(data);
  }

  lightenColor(hex: string, percent: number) {
    let num = parseInt(hex.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
    return "#" + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }

  getRunStatus(runs: any): TaskRunStatus[] {
    if (!runs?.dag_runs) return [];

    return runs.dag_runs.map((run: any) => {
      const start = new Date(run.start_date).getTime();
      const end = new Date(run.end_date).getTime();
      const duration = (end - start) / 1000; // convert ms to seconds

      return {
        runId: run.dag_run_id,
        runAfter: run.run_after,
        status: run.state,
        duration: Number(duration.toFixed(2))
      };
    });
  }

  setSideBarTaskStatus(apiResponse: any): SidebarTaskStatus[] {
    const taskStatusesMap: { [taskName: string]: SidebarTaskStatus } = {};

    // Initialize task statuses from the 'structure.nodes' array.
    apiResponse.structure.nodes.forEach((node: any) => {
      if (node.type === 'task') {
        taskStatusesMap[node.label] = {
          name: node.label,
          hasFailureInHistory: false, // Assume no failures initially
          statuses: []
        };
      }
    });

    apiResponse.dag_runs.forEach((dagRun: any) => {
      dagRun.task_instances.forEach((taskInstance: any) => {
        const taskName = taskInstance.task_id;

        if (!taskStatusesMap[taskName]) {
          // If task is not in the node structure, add it. This handles cases where task definition might be separate from execution data.
          taskStatusesMap[taskName] = {
            name: taskName,
            hasFailureInHistory: false, // Assume no failures initially
            statuses: []
          };
        }

        const taskStatus = taskStatusesMap[taskName];

        const status = taskInstance.state === 'success' ? 'success' : 'failed'; // Simplified status mapping

        if (status === 'failed') {
          taskStatus.hasFailureInHistory = true;
        }
        // Calculate duration
        const startDate = new Date(taskInstance.start_date).getTime();
        const endDate = new Date(taskInstance.end_date).getTime();
        const duration = endDate - startDate;
        taskStatus.statuses.push({ status: status, runId: dagRun.dag_run_id, duration: duration, runAfter: dagRun.run_after });
      });
    });

    return Object.values(taskStatusesMap);
  }

  getHeaderDataOfOverallRun(dagId: string) {
    this.isLoading = true;
    this.workbenchService.getRecentDagRuns(dagId).subscribe({
      next: (data: any) => {
        console.log(data);
        this.dagId = data.dags[0].dag_id;
        this.dagName = data.dags[0].description;
        this.schedule = data.dags[0].timetable_summary;
        this.latestRunTimestamp = data.dags[0].latest_dag_runs[0].run_after;
        this.nextRunTimestamp = data.dags[0].next_dagrun_run_after;
        this.isFlowboard = data.dags[0].relative_fileloc.toLowerCase().includes('flowboard');
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getRunsList(dagId: string, limit: number, currentPage: number, state: string, runType: string, orderBy: string) {
    this.isLoading = true;
    this.workbenchService.getDagRuns(dagId, limit, currentPage, state, runType, orderBy).subscribe({
      next: (data: any) => {
        console.log(data);
        this.runs = data.dag_runs;
        this.totalItems = data.total_entries;
//         this.runs = [
//     {
//         "dag_run_id": "manual__2025-09-05T08:26:29.821813+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-05T08:26:29.737000Z",
//         "queued_at": "2025-09-05T08:26:35.002150Z",
//         "start_date": "2025-09-05T08:26:46.202333Z",
//         "end_date": "2025-09-05T08:29:11.141780Z",
//         "data_interval_start": "2025-09-05T08:26:29.737000Z",
//         "data_interval_end": "2025-09-05T08:26:29.737000Z",
//         "run_after": "2025-09-05T08:26:29.737000Z",
//         "last_scheduling_decision": "2025-09-05T08:29:10.899828Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T07:04:59.530794+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T07:04:57.969000Z",
//         "queued_at": "2025-09-03T07:05:01.666466Z",
//         "start_date": "2025-09-03T07:05:07.544477Z",
//         "end_date": "2025-09-03T07:07:11.259181Z",
//         "data_interval_start": "2025-09-03T07:04:57.969000Z",
//         "data_interval_end": "2025-09-03T07:04:57.969000Z",
//         "run_after": "2025-09-03T07:04:57.969000Z",
//         "last_scheduling_decision": "2025-09-03T07:07:11.017051Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T06:39:24.638327+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T06:39:23.759000Z",
//         "queued_at": "2025-09-03T06:39:28.777606Z",
//         "start_date": "2025-09-03T06:39:44.460946Z",
//         "end_date": "2025-09-03T06:41:45.996791Z",
//         "data_interval_start": "2025-09-03T06:39:23.759000Z",
//         "data_interval_end": "2025-09-03T06:39:23.759000Z",
//         "run_after": "2025-09-03T06:39:23.759000Z",
//         "last_scheduling_decision": "2025-09-03T06:41:45.758890Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T06:12:45.877071+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T06:12:30.401000Z",
//         "queued_at": "2025-09-03T06:12:52.920438Z",
//         "start_date": "2025-09-03T06:13:03.205643Z",
//         "end_date": "2025-09-03T06:15:01.829411Z",
//         "data_interval_start": "2025-09-03T06:12:30.401000Z",
//         "data_interval_end": "2025-09-03T06:12:30.401000Z",
//         "run_after": "2025-09-03T06:12:30.401000Z",
//         "last_scheduling_decision": "2025-09-03T06:15:01.595386Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T05:29:44.308202+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T05:29:43.397000Z",
//         "queued_at": "2025-09-03T05:29:45.508574Z",
//         "start_date": "2025-09-03T05:29:58.275109Z",
//         "end_date": "2025-09-03T05:32:01.378514Z",
//         "data_interval_start": "2025-09-03T05:29:43.397000Z",
//         "data_interval_end": "2025-09-03T05:29:43.397000Z",
//         "run_after": "2025-09-03T05:29:43.397000Z",
//         "last_scheduling_decision": "2025-09-03T05:32:01.133739Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T05:26:24.033693+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T05:26:23.043000Z",
//         "queued_at": "2025-09-03T05:26:26.175359Z",
//         "start_date": "2025-09-03T05:26:39.772610Z",
//         "end_date": "2025-09-03T05:28:44.976991Z",
//         "data_interval_start": "2025-09-03T05:26:23.043000Z",
//         "data_interval_end": "2025-09-03T05:26:23.043000Z",
//         "run_after": "2025-09-03T05:26:23.043000Z",
//         "last_scheduling_decision": "2025-09-03T05:28:44.733260Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T05:16:50.530295+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T05:16:49.701000Z",
//         "queued_at": "2025-09-03T05:16:52.715512Z",
//         "start_date": "2025-09-03T05:21:46.272303Z",
//         "end_date": "2025-09-03T05:24:35.490276Z",
//         "data_interval_start": "2025-09-03T05:16:49.701000Z",
//         "data_interval_end": "2025-09-03T05:16:49.701000Z",
//         "run_after": "2025-09-03T05:16:49.701000Z",
//         "last_scheduling_decision": "2025-09-03T05:24:35.246697Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T05:05:09.684810+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T05:05:07.903000Z",
//         "queued_at": "2025-09-03T05:05:11.859940Z",
//         "start_date": "2025-09-03T05:21:46.032436Z",
//         "end_date": "2025-09-03T05:24:34.280422Z",
//         "data_interval_start": "2025-09-03T05:05:07.903000Z",
//         "data_interval_end": "2025-09-03T05:05:07.903000Z",
//         "run_after": "2025-09-03T05:05:07.903000Z",
//         "last_scheduling_decision": "2025-09-03T05:24:34.038102Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-03T04:52:26.324098+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-03T04:52:22.107000Z",
//         "queued_at": "2025-09-03T04:52:28.483180Z",
//         "start_date": "2025-09-03T04:52:38.736052Z",
//         "end_date": "2025-09-03T04:54:57.373262Z",
//         "data_interval_start": "2025-09-03T04:52:22.107000Z",
//         "data_interval_end": "2025-09-03T04:52:22.107000Z",
//         "run_after": "2025-09-03T04:52:22.107000Z",
//         "last_scheduling_decision": "2025-09-03T04:54:57.119506Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T12:26:56.267644+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T12:26:55.580000Z",
//         "queued_at": "2025-09-02T12:26:59.963980Z",
//         "start_date": "2025-09-02T12:27:14.945252Z",
//         "end_date": "2025-09-02T12:29:21.992616Z",
//         "data_interval_start": "2025-09-02T12:26:55.580000Z",
//         "data_interval_end": "2025-09-02T12:26:55.580000Z",
//         "run_after": "2025-09-02T12:26:55.580000Z",
//         "last_scheduling_decision": "2025-09-02T12:29:21.754552Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T12:22:14.558964+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T12:22:13.853000Z",
//         "queued_at": "2025-09-02T12:22:16.709582Z",
//         "start_date": "2025-09-02T12:22:28.492220Z",
//         "end_date": "2025-09-02T12:25:07.277234Z",
//         "data_interval_start": "2025-09-02T12:22:13.853000Z",
//         "data_interval_end": "2025-09-02T12:22:13.853000Z",
//         "run_after": "2025-09-02T12:22:13.853000Z",
//         "last_scheduling_decision": "2025-09-02T12:25:07.040583Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:49:13.619755+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:49:12.746000Z",
//         "queued_at": "2025-09-02T11:49:15.770729Z",
//         "start_date": "2025-09-02T11:49:23.385109Z",
//         "end_date": "2025-09-02T11:51:26.938948Z",
//         "data_interval_start": "2025-09-02T11:49:12.746000Z",
//         "data_interval_end": "2025-09-02T11:49:12.746000Z",
//         "run_after": "2025-09-02T11:49:12.746000Z",
//         "last_scheduling_decision": "2025-09-02T11:51:26.697419Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:31:11.949439+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:31:10.825000Z",
//         "queued_at": "2025-09-02T11:31:14.120545Z",
//         "start_date": "2025-09-02T11:31:22.147816Z",
//         "end_date": "2025-09-02T11:33:27.769186Z",
//         "data_interval_start": "2025-09-02T11:31:10.825000Z",
//         "data_interval_end": "2025-09-02T11:31:10.825000Z",
//         "run_after": "2025-09-02T11:31:10.825000Z",
//         "last_scheduling_decision": "2025-09-02T11:33:27.525532Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
//     {
//         "dag_run_id": "manual__2025-09-02T11:33:33.295440+00:00",
//         "dag_id": "172161619-20250822103532-8",
//         "logical_date": "2025-09-02T11:33:32.520000Z",
//         "queued_at": "2025-09-02T11:33:35.440639Z",
//         "start_date": "2025-09-02T11:33:41.545985Z",
//         "end_date": "2025-09-02T11:35:50.246702Z",
//         "data_interval_start": "2025-09-02T11:33:32.520000Z",
//         "data_interval_end": "2025-09-02T11:33:32.520000Z",
//         "run_after": "2025-09-02T11:33:32.520000Z",
//         "last_scheduling_decision": "2025-09-02T11:35:50.001021Z",
//         "run_type": "manual",
//         "state": "failed",
//         "triggered_by": "rest_api",
//         "conf": {},
//         "note": null,
//         "dag_versions": [
//             {
//                 "id": "0198d15c-f6a9-74ca-965d-c37cb42137ae",
//                 "version_number": 1,
//                 "dag_id": "172161619-20250822103532-8",
//                 "bundle_name": "dags-folder",
//                 "bundle_version": null,
//                 "created_at": "2025-08-22T10:39:47.369849Z",
//                 "bundle_url": null
//             }
//         ]
//     },
// ]
        this.runs.forEach((run: any) => {
          const start = new Date(run.start_date).getTime();
          const end = new Date(run.end_date).getTime();
          const durationSec = start && end ? Math.max(0, (end - start) / 1000) : 0;
          run.duration = Number(durationSec.toFixed(2));
        });
        this.buildBarchart()
        this.mainChartTitle = `Run Performance (Last ${this.runs.length} Runs)`;
        this.filteredRuns = [...this.runs];
        this.isLoading = false;
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
        this.isLoading = false;
      }
    });
  }

  buildBarchart() {
    const runs = this.runs || [];

    const xLabels: string[] = [];
    const durations: number[] = [];
    const colors: string[] = [];

    // Mapping state to color
    const stateColors: { [key: string]: string } = {
      success: '#198754',   // green
      failed: '#dc3545',    // red
      running: '#0dcaf0',   // blue
      queued: '#6c757d',    // gray
      'upstream_failed': '#ffc107', // yellow
    };

    runs.forEach((run, index) => {
      const runLabel = this.datePipe.transform(run.run_after, 'yyyy-MM-dd HH:mm:ss');
      xLabels.push(runLabel ?? '');

      const start = new Date(run.start_date).getTime();
      const end = new Date(run.end_date).getTime();
      const durationSec = start && end ? Math.max(0, (end - start) / 1000) : 0;
      durations.push(Number(durationSec.toFixed(2)));

      const color = stateColors[run.state?.toLowerCase()] || '#6c757d';
      colors.push(color);
    });
    const total = durations.reduce((acc, val) => acc + val, 0);
    this.avgDurationOfRuns = durations.length > 0 ? (total / durations.length).toFixed(2) : 0;
    this.bestDurationOfRuns = Math.min(...durations);
    this.worstDurationOfRuns = Math.max(...durations);
    
    // const customBlack = this.getCssVarValue('--default-text-color');
    this.chartOptions = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(0,0,0,0.05)' }
        },
        backgroundColor: 'rgba(30,30,30,0.85)',
        borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 13 },
        formatter: (params: any) => {
          const p = params[0];
          return `
        <div style="padding:4px 8px;">
          <strong style="color:#ddd;">Run:</strong> ${p.axisValue}<br/>
          <strong style="color:#ddd;">Duration:</strong> ${p.value} sec
        </div>`;
        }
      },
      grid: { left: '5%', right: '5%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: '#ccc' } },
        axisLabel: {
          show: false,
          rotate: 47,
          fontSize: 12,
          color: '#fff'
        }
      },
      yAxis: {
        type: 'value',
        name: 'Duration (s)',
        axisLine: { show: true, lineStyle: { color: '#ccc' } },
        splitLine: { show: false },
        axisLabel: { color: '#fff' },
        axisTick: { show: true }
      },
      series: [
        {
          name: 'Duration (s)',
          type: 'bar',
          barWidth: '55%',
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.15)',
            color: (params: any) => ({
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: colors[params.dataIndex] },
                { offset: 1, color: this.lightenColor(colors[params.dataIndex], 30) }
              ]
            })
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 15,
              shadowColor: 'rgba(0, 0, 0, 0.25)',
              // scale: true
            }
          },
          data: durations
        }
      ]
    };
  }

  getCssVarValue(varName: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  getTaskListData() {
    const requests = this.tasksIds.map((taskId: any) =>
      this.workbenchService.getTaskInstancesList(this.dagId, '~', taskId)
    );

    forkJoin(requests).subscribe({
      next: (results: any[]) => {

        this.tasks = results.map(result => {
          const taskInstance = result.task_instances[0];

          const maxDuration = Math.max(...result.task_instances.map((i: any) => i.duration || 0)) || 1;

          const miniChartData = (result.task_instances || []).map((instance: any) => ({
            status: instance.state,
            duration: instance.duration,
            heightPercentage: Math.max(10, Math.round((instance.duration || 0) / maxDuration * 100))
          }));

          taskInstance.miniChartData = miniChartData;

          return taskInstance;
        });

        this.filteredTasks = [...this.tasks].filter((task:any)=> !this.unWantedTasks.includes(task.task_id));
        this.availableTasks = this.filteredTasks.filter((task:any)=> !this.unWantedTasks.includes(task.task_id)).map((task:any)=> task.task_id);
        console.log(this.filteredTasks);
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getLogsOfTaskInstance(dagId: string, runId: string, taskId: string) {
     this.workbenchService.getLogsOfTaskInstance(dagId,runId,taskId).subscribe({
      next: (data: any) => {
        console.log(data);
        this.taskInstanceLogs = data.content
        this.filteredTaskInstanceLogs = [...this.taskInstanceLogs];
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getTaskListOfRun(dagId: string, runId: string) {
    this.workbenchService.getTaskInstances(dagId,runId).subscribe({
      next: (data: any) => {
        console.log(data);
        this.runTaskInstances = data.task_instances;
        this.runTaskInstances.forEach((task:any)=>{
          const start = new Date(task.start_date).getTime();
          const end = new Date(task.end_date).getTime();
          const durationSec = start && end ? Math.max(0, (end - start) / 1000) : 0;
          task.duration = Number(durationSec.toFixed(2));
        });

        this.filteredTasks = [...this.runTaskInstances].filter((task:any)=> !this.unWantedTasks.includes(task.task_id));
        this.availableTasks = this.filteredTasks.filter((task:any)=> !this.unWantedTasks.includes(task.task_id)).map((task:any)=> task.task_id);
        console.log(this.filteredTasks);
        this.activeTab = 'tasks';
        this.filteredTaskInstanceLogs = [];
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  runPipeline(){
    const encodedId = btoa(this.dagId.toString());
    if(this.isFlowboard){
      this.router.navigate(['/datamplify/monitor/flowboard/' + encodedId]);
    } else{
      this.router.navigate(['/datamplify/monitor/taskplan/' + encodedId]);
    }
  }
}
