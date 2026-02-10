import { Component, ViewChild } from '@angular/core';
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
import { NavigationService } from '../../../shared/services/navigation.service';

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
  unWantedTasks: any[] = ['__global_param_store__', '__init_global_params', 'cleanup_temporary_tables', 'dag_success_marker', 'CLEAN_UP_ALL_DONE', 'CLEAN_UP_ON_FAILURE'];
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
  @ViewChild('barChart') barChart: any;

  constructor(private workbenchService: WorkbenchService, private toasterService: ToastrService, private router: Router, private route: ActivatedRoute, private datePipe: DatePipe, private navigationService: NavigationService) {
    const url = this.navigationService.getNormalizedUrl(this.router.url);
    if (url.startsWith('/datamplify/monitorList/monitor')) {
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
    this.navigationService.navigate(['datamplify','monitorList']);
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

        setTimeout(() => this.onTabChanged(), 300);
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

  onTabChanged() {
    if (this.barChart?.chartInstance) {
      this.barChart.chartInstance.resize();
    }
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
    if (this.isFlowboard) {
      this.navigationService.navigate(['datamplify', 'monitor', 'DagBoard', encodedId]);
    } else {
      this.navigationService.navigate(['datamplify', 'monitor', 'TaskRunPlan', encodedId]);
    }
  }
}
