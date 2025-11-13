import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';
import { NGX_ECHARTS_CONFIG, NgxEchartsModule } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { LoaderService } from '../../../shared/services/loader.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  providers: [ { provide: NGX_ECHARTS_CONFIG, useFactory: () => ({ echarts: echarts }), }],
  imports: [CommonModule, NgApexchartsModule, FormsModule, ReactiveFormsModule, NgxEchartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  kpiData = [
    { title: 'Success Rate', value: '0%', change: '0%', trend: 'up', icon: 'fa-regular fa-circle-check', color: 'bg-success-subtle text-success', subTextClass: 'text-success'},
    { title: 'Failure Rate', value: '0%', change: '0%', trend: 'up', icon: 'fa-solid fa-circle-exclamation', color: 'bg-danger-subtle text-danger', subTextClass: 'text-danger'},
    { title: 'Total Flowboards', value: '0', change: '0', trend: 'up', icon: 'fe fe-git-branch', color: 'bg-info-subtle text-info', subTextClass: 'text-info'},
    { title: 'Total Taskplans', value: '0', change: '0', trend: 'up', icon: 'fa-solid fa-chart-diagram', color: 'bg-warning-subtle text-warning', subTextClass: 'text-warning'},
  ];
  flowData: any[] = [];
  recentActivity: any = {};
  chartMode : string = 'flowboard';
  mixedOptions: any = {};
  pieOptions: any = {};
  activeTab: 'success' | 'failed' | 'running' | 'recent' = 'recent';
  chartOptions: EChartsOption = {};
  barChartData : any = {};
  pieChartData: any = {};
  isLoading = true;
  skeletonKpi = Array(4);
  skeletonFlow = Array(5);

  constructor(private workbenchService: WorkbenchService, private toasterservice: ToastrService, private loaderService: LoaderService, private router: Router) {
  }

  ngOnInit() {
    this.loaderService.hide();
    this.buildSkeletonBarChart();
    this.buildSkeletonPieChart();
    this.changeChartMode();
    this.getDashboardData();
  }

  setTab() {
    this.flowData = this.recentActivity[this.activeTab] || [];
    this.flowData = this.flowData.slice(0, 5);
  }

  changeChartMode(){
    if(this.chartMode === 'flowboard'){
      this.buildBarChart(this.barChartData.flowboard);
      this.buildPieChart(this.pieChartData.flowboard);
    } else{
      this.buildBarChart(this.barChartData.taskplan);
      this.buildPieChart(this.pieChartData.taskplan);
    }
  }
  getDashboardData() {
    this.isLoading = true;
    this.workbenchService.disableLoaderForNextRequest();
    this.workbenchService.getDashboardData().subscribe({
      next: (data) => {
        data.kpis.forEach((item: any, index: any) => {
          this.kpiData[index].value = ['Success Rate', 'Failure Rate'].includes(item.title) ? item.value+'%' : item.value;
          this.kpiData[index].change = ['Success Rate', 'Failure Rate'].includes(item.title) ? item.change+'%' : item.change;
          this.kpiData[index].trend = item.trend;
        });
        this.barChartData = data.bar;
        this.pieChartData = data.status_distribution;
        this.recentActivity = data.recent_activity;
        this.flowData = this.recentActivity[this.activeTab] || [];
        this.setTab();
        this.buildBarChart(this.barChartData.flowboard);
        this.buildPieChart(this.pieChartData.flowboard);
        this.isLoading = false;
      },
      error: (error) => {
        console.log(error);
        this.toasterservice.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        this.isLoading = false;
      }
    })
  }

  buildSkeletonPieChart(): void {
    this.chartOptions = {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        textStyle: { color: '#f9fafb' },
        formatter: 'No Data'
      },
      series: [
        {
          type: 'pie',
          radius: '55%',
          center: ['50%', '50%'],
          // silent: true,
          label: { show: false },
          data: [
            { value: 1.5, name: 'empty' },
            { value: 3, name: 'empty' },
            { value: 3, name: 'empty' }
          ],
          itemStyle: {
            color: '#e5e7eb',
            borderColor: '#c3bdbdff',
            borderWidth: 1
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: (idx: number) => Math.random() * 100
        }
      ]
    };
  }

  buildSkeletonBarChart() {
    const skeletonData = [
      { name: '', total_runs: 3 },
      { name: '', total_runs: 6 },
      { name: '', total_runs: 9 },
      { name: '', total_runs: 2 },
      { name: '', total_runs: 8 }
    ];

    this.mixedOptions = {
      series: [
        {
          name: 'Total Runs',
          data: skeletonData.map(d => d.total_runs)
        }
      ],
      chart: {
        type: 'bar',
        height: 400,
        toolbar: { show: false },
      },
      xaxis: {
        categories: skeletonData.map(d => d.name),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontWeight: 500 } }
      },
      yaxis: {
        labels: { show: false, style: { fontWeight: 500 } }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '45%',
          borderRadius: 8,
          distributed: false
        }
      },
      colors: ["#d3d3d3"],
      fill: {
        type: "solid",
        colors: ["#d3d3d3"]
      },
      states: {
        hover: {
          filter: {
            type: 'none'   // 👈 prevents color change on hover
          }
        },
        active: {
          filter: {
            type: 'none'   // 👈 prevents dimming when active/selected
          }
        }
      },
      dataLabels: { enabled: false },
      grid: { show: false },
      tooltip: {
        theme: 'dark',
        y: {
          formatter: () => 'No Data'
        },
        x: {
          formatter: () => 'No Data'
        }
      },
      legend: { show: false }
    };
  }

  buildBarChart(data: any[]) {
    if (!data || data.length === 0) {
      this.buildSkeletonBarChart();
      return;
    }

    this.mixedOptions = {
      series: [
        {
          name: 'Total Runs',
          data: data.map(d => d.total_runs)
        }
      ],
      chart: {
        type: 'bar',
        height: 400,
        toolbar: { show: false },
        foreColor: '#64748b'
      },
      xaxis: {
        categories: data.map(d => d.name),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { show: false }
      },
      yaxis: {
        labels: { show: false }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '40%',
          borderRadius: 8,
          distributed: true
        }
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.5,
          gradientToColors: ['#3b82f6'],
          inverseColors: false,
          opacityFrom: 0.9,
          opacityTo: 0.6,
          stops: [0, 100]
        }
      },
      colors: ['#60a5fa'],
      dataLabels: { enabled: false },
      grid: { show: false },
      tooltip: {
        theme: 'dark',
        y: {
          formatter: (val: number) => val
        },
        x: {
          formatter: (val: string) => val
        }
      },
      legend: { show: false }
    };
  }

  buildPieChart(data: any[]) {
    if (!data || data.length === 0) {
      this.buildSkeletonPieChart();
      return;
    }

    const itemStyle = [
      {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#19e9a4' },
          { offset: 1, color: '#89efca' }
        ])
      }, // Success
      {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#f42323' },
          { offset: 1, color: '#f07474' }
        ])
      }, // Failed
      {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#2c5ef4' },
          { offset: 1, color: '#7292f0' }
        ])
      } // Running
    ];

    this.chartOptions = {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        textStyle: { color: '#f9fafb' },
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        bottom: 0,
        textStyle: {
          color: (name: string, legendItem: any, options: any) => {
            const series = options?.series?.[0];
            if (series && series.data) {
              const item = series.data.find((d: any) => d.name === name);
              return item?.itemStyle?.color || '#000';
            }
            return '#000';
          }
        }
      } as any,
      series: [
        {
          type: 'pie',
          radius: '55%',
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            formatter: '{b} {d}%',
            fontSize: 13,
            color: (params: any) => params.color,
            fontWeight: 500
          },
          labelLine: {
            smooth: 0.3,
            lineStyle: {
              color: (params: any) => params.color
            }
          },
          data: data.map((d, index) => ({
            name: d.name,
            value: d.value,
            itemStyle: itemStyle[index]
          })),
          emphasis: {
            scale: true,
            scaleSize: 8,
            itemStyle: {
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            label: {
              shadowColor: 'transparent',
              shadowBlur: 0
            }
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: (idx: number) => Math.random() * 100,
        }
      ] as any,
      graphic: {
        type: 'text',
        left: 'center',
        top: 'center',
        style: {
          fill: '#6b7280',
          fontSize: 16,
          fontWeight: 'bold'
        }
      }
    };
  }

  goToFlowboard(id:any){
    const encodedId = btoa(id.toString());
    this.router.navigate(['/datamplify/flowboardList/flowboard/' + encodedId]);
  }
  goToTaskplan(id:any){
    const encodedId = btoa(id.toString());
    this.router.navigate(['/datamplify/taskplanList/taskplan/' + encodedId]);
  }
}
