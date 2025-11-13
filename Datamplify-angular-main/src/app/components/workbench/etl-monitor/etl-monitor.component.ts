import { Component, ElementRef, NgModule, Renderer2, ViewChild, OnInit } from '@angular/core';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule, DatePipe } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { NGX_ECHARTS_CONFIG, NgxEchartsModule } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';
import { EtlLoggerViewComponent } from '../etl-logger-view/etl-logger-view.component';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SharedModule } from '../../../shared/sharedmodule';

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
interface RunTaskInstance {
  id: string;
  taskId: string;
  state: 'success' | 'failed' | 'running' | 'skipped' | 'upstream_failed' | 'queued';
  startDate?: Date;
  endDate?: Date;
  duration?: string;
}

@Component({
  selector: 'app-etl-monitor',
  standalone: true,
  providers: [ { provide: NGX_ECHARTS_CONFIG, useFactory: () => ({ echarts: echarts }), }, DatePipe],
  imports: [NgbNavModule, CommonModule, NgbModule, FormsModule, NgxEchartsModule, EtlLoggerViewComponent, SharedModule],
  templateUrl: './etl-monitor.component.html',
  styleUrl: './etl-monitor.component.scss'
})
export class EtlMonitorComponent {
  
  // --- Sidebar Data ---
  sidebarChartTitle: string = 'Overall Run Health (Last 5 Runs)';
  sidebarChartOptions: EChartsOption = {};
  tasksRunStatuses: SidebarTaskStatus[] = [];
  runStatuses: TaskRunStatus[] = [];
  lastXRuns: any = 5;
  sideNavBarData: any;

  // --- Main Header Data ---
  dagId: string = '';
  dagName: string = '';
  schedule: string = '';
  latestRunTimestamp: string = '';
  nextRunTimestamp: string = '';

  // --- Tab Management ---
  activeTabId: number = 1;

  // --- Overview Tab Data ---
  mainChartTitle: string = 'Run Performance (Last 14 Runs)';
  chartOptions: EChartsOption = {};

  // --- Runs Tab Data ---
  selectedStateFilter: string = 'All States';
  selectedRunTypeFilter: string = 'All Run Types';
  sortColumnRun: string = 'run_after';
  sortDirection: 'asc' | 'desc' = 'desc';
  runs: any[] = [];
  filteredRuns: any[] = [];
  orderBy: string = '-run_after';

  // --- Tasks Tab Data ---
  tasksIds: string[] = [];
  tasks: any[] = [];
  filteredTasks: any[] = [];

  // --- Resizable Sidebar Elements ---
  @ViewChild('resizeContainer') resizeContainer!: ElementRef;
  @ViewChild('sidebar') sidebar!: ElementRef;
  @ViewChild('divider') divider!: ElementRef;
  @ViewChild('main') main!: ElementRef;

    // --- Run Details Pane Data ---
  selectedRunForDetails: any = null;
  activeDetailsTabId: string = 'task_instances';
  runTaskInstances: any[] = [];
  filteredRunTaskInstances: any[] = [];

  private isResizing = false;
  selectedTaskInstanceForDetails: any;
  taskInstanceLogs: any[] = [];
  filteredTaskInstanceLogs: any[] = [];
  activeTaskInstanceDetailsTabId: any;
  unWantedTasks: any[] = ['__global_param_store__', '__init_global_params', 'cleanup_temporary_tables'];

  constructor( private workbenchService: WorkbenchService, private toasterService: ToastrService, private router: Router, private route: ActivatedRoute, private datePipe: DatePipe) {
    if (this.router.url.startsWith('/datamplify/monitorList/monitor')) {
      if (route.snapshot.params['id1']) {
        const id = atob(route.snapshot.params['id1']);
        this.dagId = id.toString();
      }
    }
   }

  ngOnInit(): void {
    this.getTasksAndRunsStatus(this.dagId);
    this.getHeaderDataOfOverallRun(this.dagId);
    this.getRunsList(this.dagId, 14, '', '', '-run_after');
  }

  ngAfterViewInit(): void {
    this.initResize();
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

  getHeaderDataOfOverallRun(dagId: string){
    this.workbenchService.getRecentDagRuns(dagId).subscribe({
      next: (data: any) => {
        console.log(data);
        this.dagId = data.dags[0].dag_id;
        this.dagName = data.dags[0].description;
        this.schedule = '';
        this.latestRunTimestamp = data.dags[0].latest_dag_runs[0].run_after;
        this.nextRunTimestamp = '';
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getRunsList(dagId:string, limit:number, state:string, runType:string, orderBy:string){
    this.workbenchService.getDagRuns(dagId, limit, 1, state, runType, orderBy).subscribe({
      next: (data: any) => {
        console.log(data);
        this.runs = data.dag_runs;
        this.runs.forEach((run:any)=>{
          const start = new Date(run.start_date).getTime();
          const end = new Date(run.end_date).getTime();
          const durationSec = start && end ? Math.max(0, (end - start) / 1000) : 0;
          run.duration = Number(durationSec.toFixed(2));
        });
        this.buildBarchart()
        this.mainChartTitle = `Run Performance (Last ${this.runs.length} Runs)`;
        this.filteredRuns = [...this.runs];
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getTaskListData() {
    const requests = this.tasksIds.map((taskId: any) =>
      this.workbenchService.getTaskInstancesList(this.dagId, '~', taskId)
    );

    forkJoin(requests).subscribe({
      next: (results: any[]) => {

        this.tasks = results.map(result => {
          const taskInstance = result.task_instances[0];

          const maxDuration = Math.max(...result.task_instances.map((i:any) => i.duration || 0)) || 1;

          const miniChartData = (result.task_instances || []).map((instance: any) => ({
            status: instance.state,
            duration: instance.duration,
            heightPercentage: Math.max(10, Math.round((instance.duration || 0) / maxDuration * 100))
          }));

          taskInstance.miniChartData = miniChartData;

          return taskInstance;
        });

        this.filteredTasks = [...this.tasks]; // only after all responses are ready
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
        this.filteredRunTaskInstances = [...this.runTaskInstances];
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
      durations.push(durationSec);

      const color = stateColors[run.state?.toLowerCase()] || '#6c757d';
      colors.push(color);
    });

    this.chartOptions = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: xLabels, axisLabel: { rotate: 50 }},
      yAxis: [{ type: 'value', name: 'Duration (s)' }],
      series: [{
        name: 'Duration (s)',
        type: 'bar',
        data: durations.map((val, i) => ({
          value: val,
          itemStyle: { color: colors[i] }
        }))
      }]
    };
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
      tooltip: {
        trigger: 'item',
        formatter: (params: any, index: any) => {
          return `
            <strong>Run:</strong> ${params.name}<br/>
            <strong>Status:</strong> ${params.data.status}<br/>
            <strong>Duration:</strong> ${params.value} sec`;
        }
      },
      series: [
        {
          name: 'Run Duration',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          labelLine: { show: true },
          data: chartData
        }
      ]
    };

    this.tasksRunStatuses = this.setSideBarTaskStatus(data);
  }

  updateSidebarChartAndTasks(): void {
    this.sidebarChartTitle = `Overall Run Health (Last ${this.lastXRuns} Runs)`;
    this.getTasksAndRunsStatus(this.dagId)
  }

  sort(column: string, type: any): void {
    console.log(`Sort by column: ${column} for type: ${type}`);
    const sortColumnProp = 'sortColumnRun';

    if (this[sortColumnProp] === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this[sortColumnProp] = column;
      this.sortDirection = 'asc';
    }
    this.orderBy = (this.sortDirection === 'asc' ? '' : '-')+column;
    this.getRunsList(this.dagId, 100, '', '', this.orderBy)
  }

  // --- Resizable Sidebar Logic ---
  initResize(): void {
    if (!this.divider || !this.sidebar || !this.main || !this.resizeContainer) return;

    this.divider.nativeElement.addEventListener('mousedown', (event: MouseEvent) => {
      this.isResizing = true;
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      event.preventDefault(); // Prevent text selection
    });
  }

  onMouseMove = (event: MouseEvent): void => {
    if (!this.isResizing) return;

    const containerRect = this.resizeContainer.nativeElement.getBoundingClientRect();
    let newSidebarWidth = event.clientX - containerRect.left;

    // Constraints
    const minSidebarWidth = 200; // px
    const maxSidebarWidth = containerRect.width * 0.5; // 50% of container

    if (newSidebarWidth < minSidebarWidth) newSidebarWidth = minSidebarWidth;
    if (newSidebarWidth > maxSidebarWidth) newSidebarWidth = maxSidebarWidth;

    this.sidebar.nativeElement.style.width = `${newSidebarWidth}px`;
    this.sidebar.nativeElement.style.flexBasis = `${newSidebarWidth}px`; // Important for flex items
    this.sidebar.nativeElement.style.maxWidth = `${newSidebarWidth}px`;

    // Adjust main content width (optional, flex should handle it)
    // this.main.nativeElement.style.width = `${containerRect.width - newSidebarWidth - this.divider.nativeElement.offsetWidth}px`;

  }

  onMouseUp = (): void => {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

   // --- Run Details Pane Methods ---
  showRunDetailsPane(run: any): void {
    console.log('Showing details for run:', run);
    this.selectedRunForDetails = run;
    this.selectedTaskInstanceForDetails = null;
    this.activeDetailsTabId = 'task_instances';
    this.getTaskListOfRun(run.dag_id, run.dag_run_id); 
  }

  closeRunDetailsPane(): void {
    this.selectedRunForDetails = null;
    this.runTaskInstances = [];
    this.filteredRunTaskInstances = [];
    this.selectedTaskInstanceForDetails = null;
    this.taskInstanceLogs = [];
    this.filteredTaskInstanceLogs = [];
  }

  filterRunTaskInstances(query: string): void {
    const searchTerm = query.toLowerCase();
    const currentTaskStateFilter = (document.querySelector('#run-details-pane select') as HTMLSelectElement)?.value;

    this.filteredRunTaskInstances = this.runTaskInstances.filter(instance =>
      instance.task_id.toLowerCase().includes(searchTerm) &&
      (!currentTaskStateFilter || instance.state === currentTaskStateFilter)
    );
  }

  filterRunTaskInstancesByState(stateQuery: string): void {
    // Also consider current text filter if any is entered
    const currentTaskTextFilter = (document.querySelector('#run-details-pane input[type="text"]') as HTMLInputElement)?.value.toLowerCase();

    if (!stateQuery) {
        this.filteredRunTaskInstances = this.runTaskInstances.filter(instance =>
            (!currentTaskTextFilter || instance.task_id.toLowerCase().includes(currentTaskTextFilter))
        );
    } else {
        this.filteredRunTaskInstances = this.runTaskInstances.filter(instance =>
            instance.state === stateQuery &&
            (!currentTaskTextFilter || instance.task_id.toLowerCase().includes(currentTaskTextFilter))
        );
    }
  }

  getTaskInstanceStatusClass(status: RunTaskInstance['state']): object {
    return {
      'bg-success text-white': status === 'success',
      'bg-danger text-white': status === 'failed',
      'bg-info text-white': status === 'running',
      'bg-warning text-dark': status === 'skipped' || status === 'upstream_failed',
      'bg-secondary text-white': status === 'queued',
    };
  }

  showTaskInstanceDetails(taskInstance: any): void {
    this.selectedTaskInstanceForDetails = taskInstance;
    this.selectedRunForDetails = null;
    this.activeTaskInstanceDetailsTabId = 'logs'; // Default to logs tab
    this.getLogsOfTaskInstance(taskInstance.dag_id, taskInstance.dag_run_id, taskInstance.task_id);
    // In a real app, you'd fetch logs based on taskInstance.id or other identifiers
    // this.fetchLogsForTaskInstance(taskInstance);
    // Note: selectedRunForDetails should still be set from when the run was initially selected
  }

  backToRunDetails(): void {
    this.selectedTaskInstanceForDetails = null;
    this.taskInstanceLogs = [];
    this.filteredTaskInstanceLogs = [];
  }
}
