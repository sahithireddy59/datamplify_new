import { Injectable, OnDestroy} from '@angular/core';
import { Subject, BehaviorSubject, fromEvent } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ViewTemplateDrivenService } from '../../components/workbench/view-template-driven.service';

// Menu
export interface Menu {
  headTitle?: string;
  headTitle2?: string;
  path?: string;
  title?: string;
  icon?: string;
  type?: string;
  badgeValue?: string;
  badgeClass?: string;
  active?: boolean;
  selected?: boolean;
  bookmark?: boolean;
  children?: Menu[];
  children2?: Menu[];
  Menusub?: boolean;
  target?: boolean;
  menutype?:string;
  nochild?: any,
}
@Injectable({
  providedIn: 'root',
})
export class NavService implements OnDestroy {
  private unsubscriber: Subject<any> = new Subject();
  public screenWidth: BehaviorSubject<number> = new BehaviorSubject(
    window.innerWidth
  );

  // Search Box
  public search = false;

  // Language
  public language = false;

  // Mega Menu
  public megaMenu = false;
  public levelMenu = false;
  public megaMenuColapse: boolean = window.innerWidth < 1199 ? true : false;

  // Collapse Sidebar
  public collapseSidebar: boolean = window.innerWidth < 991 ? true : false;

  // For Horizontal Layout Mobile
  public horizontal: boolean = window.innerWidth < 991 ? false : true;

  // Full screen
  public fullScreen = false;
  active: any;

  constructor(private router: Router,private viewTemplate:ViewTemplateDrivenService) {
    this.setScreenWidth(window.innerWidth);
    fromEvent(window, 'resize')
      .pipe(debounceTime(1000), takeUntil(this.unsubscriber))
      .subscribe((evt: any) => {
        this.setScreenWidth(evt.target.innerWidth);
        if (evt.target.innerWidth < 991) {
          this.collapseSidebar = true;
          this.megaMenu = false;
          this.levelMenu = false;
        }
        if (evt.target.innerWidth < 1199) {
          this.megaMenuColapse = true;
        }
      });
    if (window.innerWidth < 991) {
      // Detect Route change sidebar close
      this.router.events.subscribe((event) => {
        this.collapseSidebar = true;
        this.megaMenu = false;
        this.levelMenu = false;
      });
    }
  }
  ngOnDestroy() {
    this.unsubscriber.next;
    this.unsubscriber.complete();
  }

  private setScreenWidth(width: number): void {
    this.screenWidth.next(width);
  }

  MENUITEMS: Menu[] = [
    // Dashboard
  //   { headTitle: 'MAIN' },
  //   {
  //     title: 'Dashboard',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"></path>
  // </svg>`,
  //     type: 'link',
  //     active: false,
  //     nochild: true,
  //     path:"/dashboard"
    
  //   },
    // { headTitle: 'Server' },
    {
  //     title: 'SQL',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="side-menu__icon">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16zm0-11.47L17.74 9 12 13.47 6.26 9 12 4.53z">
  //     </path>
  // </svg>`,
  //     type: 'sub',
  //     type: 'link',
  //     active: false,
  //    children: [
  //       {
  //         title: 'Profile',
  //         type: 'link',
  //         active: false,
  //         path:'/pages/profile'
         
  //       },
  //       {
  //         title: 'Notification List',
  //         type: 'link',
  //         active: false,
  //         path:"/pages/notification-list"
        
  //       },
  //       {
  //         title: 'Mail Inbox',
  //         type: 'link',
  //         active: false,
  //         path:"/pages/mail-inbox"
        
  //       },
  //       {
  //         title: 'Gallery',
  //         type: 'link',
  //         active: false,
  //         path:"/pages/gallery"
        
  //       },
  //       {
  //         title: 'Extension',
  //         type: 'sub',
  //         active: false,
  //         selected:false,
  //         children: [
  //           { path: '/pages/extension/about-company', title: 'About Company', type: 'link' },
  //           { path: '/pages/extension/faqs', title: 'FAQS', type: 'link' },
  //           { path: '/pages/extension/terms', title: 'Terms', type: 'link' },
  //           { path: '/pages/extension/invoice', title: 'Invoice', type: 'link' },
  //           { path: '/pages/extension/pricing-tables', title: 'Pricing Tables', type: 'link' },
  //           { path: '/pages/extension/settings', title: 'Settings', type: 'link' },
  //           { path: '/pages/extension/blog', title: 'Blog', type: 'link' },
  //           { path: '/pages/extension/blog-details', title: 'Blog Details', type: 'link' },
  //           { path: '/pages/extension/blog-post', title: 'Blog Post', type: 'link' },
  //           { path: '/pages/extension/empty-page', title: 'Empty Page', type: 'link' },
  //         ],
  //       },
  //       {
  //         title: 'File Manager',
  //         type: 'sub',
  //         Menusub: true,
  //         active: false,
  //         children: [
  //           { path: '/pages/file-manager/filemanager', title: 'File Manager', type: 'link' },
  //           { path: '/pages/file-manager/filemanager-list', title: 'File Manager List', type: 'link' },
           
  //         ],
  //       },
  //       {
  //         title: 'Ecommerce',
  //         type: 'sub',
  //         Menusub: true,
  //         active: false,
  //         children: [
  //           {
  //             path: '/pages/ecommerce/shop',
  //             title: 'Shop',
  //             type: 'link',
  //           },
  //           {
  //             path: '/pages/ecommerce/product-details',
  //             title: 'Product Details',
  //             type: 'link',
  //           },
  //           { path: '/pages/ecommerce/shopping-cart', 
  //           title: 'Shopping Cart', 
  //           type: 'link' 
  //         },
  //         {
  //           path: '/pages/ecommerce/add-product',
  //           title: 'Add Product',
  //           type: 'link',
  //         },
  //         { path: '/pages/ecommerce/wishlist', 
  //         title: 'Wishlist',
  //          type: 'link'
  //          },
  //          { path: '/pages/ecommerce/checkout',
  //           title: 'CheckOut',
  //            type: 'link' },   
  //         ],
  //       },
     
  //     ],
    },
    {
     /*  title: 'MySQL',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" class="side-menu__icon" fill="#000000">
      <path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z">
      </path>
  </svg>`,
      type: 'sub',
        type: 'link',
      Menusub: true,
      active: false,
     children: [
        {
          title: 'LogIn',
          Menusub: true,
          active: false,
           path: '/authentication/login',  type: 'link' 
          },

          {
            title: 'Register',
            Menusub: true,
            active: false,
             path: '/authentication/register',  type: 'link' 
            },
            {
              title: 'Forgot Password',
              Menusub: true,
              active: false,
               path: '/authentication/forgot-password',  type: 'link' 
              },
              {
                title: 'Lock Screen',
                Menusub: true,
                active: false,
                 path: '/authentication/lock-screen',  type: 'link' 
                },
                {
                  title: 'Under Maintenance',
                  Menusub: true,
                  active: false,
                   path: '/authentication/under-maintainance',  type: 'link' 
                  },
        
        {
          title: 'Error Pages',
          type: 'sub',
          Menusub: true,
          active: false,
          children: [
            { path: '/error-pages/error400', title: '400', type: 'link' },
            { path: '/error-pages/error401', title: '401', type: 'link' },
            { path: '/error-pages/error403', title: '403', type: 'link' },
            { path: '/error-pages/error404', title: '404', type: 'link' },
            { path: '/error-pages/error500', title: '500', type: 'link' },
            { path: '/error-pages/error503', title: '503', type: 'link' },
          ],
        },
     
      ],*/
    },

  //   {
  //     title: 'Data Source',
  //     type: 'sub',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" class="side-menu__icon">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z">
  //     </path>
  // </svg>`,
  //     Menusub: true,
  //     active: false,
  //      children: [
  //       { path: 'workbench/work-bench', title: 'Form Elements', type: 'link' },
  //       { path: '/form-module/form-layouts', title: 'Form Layouts', type: 'link' },
  //       { path: '/form-module/form-advanced', title: 'Form Advanced', type: 'link' },
  //       { path: '/form-module/form-editor', title: 'Form Editor', type: 'link' },
  //       { path: '/form-module/form-validation', title: 'Form Validation', type: 'link' },
  //       { path: '/form-module/form-input-spinners', title: 'Form Input Spinners', type: 'link' },
  //       { path: '/form-module/select2', title: 'Select-2', type: 'link' },
  //       //  this.childrenss[0]

  //      ],
  //     //children:this.childrenss[0]
  //   },



    //Widgets
    {
      title: 'Home',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"></path>
  // </svg>`,
      icon: `<i class="fe fe-home side-menu__icon"></i>`,
      active: false,
      badgeClass: 'badge badge-sm bg-secondary badge-hide',
      badgeValue: 'new',
      path: 'datamplify/home',
      type: 'link',
      nochild: true,
    },
    {
      title: 'EasyConnect',
      // icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-link-2"><path fill="none" d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path><line fill="none" x1="8" y1="12" x2="16" y2="12"></line></svg>`,
      icon: `<i class="fe fe-link-2 side-menu__icon"></i>`,
      active: false,
      badgeClass: 'badge badge-sm bg-secondary badge-hide',
      badgeValue: 'new',
      path: 'datamplify/easyConnection',
      type: 'link',
      nochild: true, 
    },
    {
      title: 'DagBoard',
      // icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-git-branch"><line fill="none" x1="6" y1="3" x2="6" y2="15"></line><circle fill="none" cx="18" cy="6" r="3"></circle><circle fill="none" cx="6" cy="18" r="3"></circle><path fill="none" d="M18 9a9 9 0 0 1-9 9"></path></svg>`,
      icon: `<i class="fe fe-git-branch side-menu__icon"></i>`,
      active: false,
      badgeClass: 'badge badge-sm bg-secondary badge-hide',
      badgeValue: 'new',
      path: 'datamplify/DagBoardList',
      type: 'link',
      nochild: true,
    },
    {
      title: 'TaskRunPlan',
      icon: `<i class="fa-solid fa-chart-diagram side-menu__icon"></i>`,
      active: false,
      badgeClass: 'badge badge-sm bg-secondary badge-hide',
      badgeValue: 'new',
      path: 'datamplify/TaskRunPlanList',
      type: 'link',
      nochild: true,
    },
    {
      title: 'Scheduler',
      icon: `<i class="fe fe-clock side-menu__icon"></i>`,
      active: false,
      badgeClass: 'badge badge-sm bg-secondary badge-hide',
      badgeValue: 'new',
      path: 'datamplify/scheduler',
      type: 'link',
      nochild: true,
    },
    {
      title: 'Monitoring',
      icon: `<i class="fe fe-monitor side-menu__icon"></i>`,
      active: false,
      badgeClass: 'badge badge-sm bg-secondary badge-hide',
      badgeValue: 'new',
      path: 'datamplify/monitorList',
      type: 'link',
      nochild: true,
    },
  //   {
  //     title: 'ETL',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M11 7h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zM20.1 3H3.9c-.5 0-.9.4-.9.9v16.2c0 .4.4.9.9.9h16.2c.4 0 .9-.5.9-.9V3.9c0-.5-.5-.9-.9-.9zM19 19H5V5h14v14z">
  //     </path>
  // </svg>`,
  //     active: false,
  //     badgeClass: 'badge badge-sm bg-secondary badge-hide',
  //     badgeValue: 'new',
  //     path: 'datamplify/etlList',
  //     type: 'link',
  //     nochild: true,
  //   },
    //component


  //   {
  //     title: 'Drog & Drop',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" enable-background="new 0 0 24 24" viewBox="0 0 24 24" fill="#000000">
  //     <g>
  //         <rect fill="none" height="24" width="24"></rect>
  //     </g>
  //     <g>
  //         <g>
  //             <path d="M6,15c-0.83,0-1.58,0.34-2.12,0.88C2.7,17.06,2,22,2,22s4.94-0.7,6.12-1.88C8.66,19.58,9,18.83,9,18C9,16.34,7.66,15,6,15 z M6.71,18.71c-0.28,0.28-2.17,0.76-2.17,0.76s0.47-1.88,0.76-2.17C5.47,17.11,5.72,17,6,17c0.55,0,1,0.45,1,1 C7,18.28,6.89,18.53,6.71,18.71z M17.42,13.65L17.42,13.65c6.36-6.36,4.24-11.31,4.24-11.31s-4.95-2.12-11.31,4.24l-2.49-0.5 C7.21,5.95,6.53,6.16,6.05,6.63L2,10.69l5,2.14L11.17,17l2.14,5l4.05-4.05c0.47-0.47,0.68-1.15,0.55-1.81L17.42,13.65z M7.41,10.83L5.5,10.01l1.97-1.97l1.44,0.29C8.34,9.16,7.83,10.03,7.41,10.83z M13.99,18.5l-0.82-1.91 c0.8-0.42,1.67-0.93,2.49-1.5l0.29,1.44L13.99,18.5z M16,12.24c-1.32,1.32-3.38,2.4-4.04,2.73l-2.93-2.93 c0.32-0.65,1.4-2.71,2.73-4.04c4.68-4.68,8.23-3.99,8.23-3.99S20.68,7.56,16,12.24z M15,11c1.1,0,2-0.9,2-2s-0.9-2-2-2s-2,0.9-2,2 S13.9,11,15,11z"></path>
  //         </g>
  //     </g>
  // </svg>`,
  //     active: false,
  //     badgeClass: 'badge badge-sm bg-secondary badge-hide',
  //     badgeValue: 'new',
  //     path: '/widgets',
  //     type: 'link',
  //     nochild: true,
  //   },
  //   { headTitle: 'Files' },
  //   {
  //     title: 'Text File',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
  //     <g>
  //         <rect fill="none" height="24" width="24"></rect>
  //     </g>
  //     <g>
  //         <g>
  //             <path d="M12,2C6.48,2,2,6.48,2,12c0,5.52,4.48,10,10,10s10-4.48,10-10 C22,6.48,17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8c0-4.41,3.59-8,8-8s8,3.59,8,8C20,16.41,16.41,20,12,20z" fill-rule="evenodd"></path>
  //             <path d="M13.49,11.38c0.43-1.22,0.17-2.64-0.81-3.62c-1.11-1.11-2.79-1.3-4.1-0.59 l2.35,2.35l-1.41,1.41L7.17,8.58c-0.71,1.32-0.52,2.99,0.59,4.1c0.98,0.98,2.4,1.24,3.62,0.81l3.41,3.41c0.2,0.2,0.51,0.2,0.71,0 l1.4-1.4c0.2-0.2,0.2-0.51,0-0.71L13.49,11.38z" fill-rule="evenodd"></path>
  //         </g>
  //     </g>
  // </svg>`,
  
  //    // type: 'sub',
  //    // Menusub: true,
  //    type: 'link',
  //     active: false,
  //     /*children: [
  //       { path: '/uikit/alerts', title: 'Alerts', type: 'link' },
  //       { path: '/uikit/buttons', title: 'Buttons', type: 'link' },
  //       { path: '/uikit/colors', title: 'Colors', type: 'link' },
  //       { path: '/uikit/avatars', title: 'Avatars', type: 'link' },
  //       { path: '/uikit/dropdowns', title: 'Dropdowns', type: 'link' },
  //       { path: '/uikit/listgroup', title: 'Listgroup', type: 'link' },
  //       { path: '/uikit/tags', title: 'Tags', type: 'link' },
  //       { path: '/uikit/pagination', title: 'pagination', type: 'link' },
  //       { path: '/uikit/navigation', title: 'Navigation', type: 'link' },
  //       { path: '/uikit/typography', title: 'Typography', type: 'link' },
  //       { path: '/uikit/breadcrumbs', title: 'Breadcrumb', type: 'link' },
  //       { path: '/uikit/badges-pills', title: 'Badges/Pills', type: 'link' },
  //       { path: '/uikit/offcanvas', title: 'Offcanvas', type: 'link' },
  //       { path: '/uikit/toast', title: 'Toast', type: 'link' },
  //       { path: '/uikit/media-object', title: 'Media Object', type: 'link' },
  //       { path: '/uikit/scrollspy', title: 'Scrollspy', type: 'link' },
  //       { path: '/uikit/accordions', title: 'Accordions', type: 'link' },
  //       { path: '/uikit/tabs', title: 'Tabs', type: 'link' },
  //       { path: '/uikit/modal', title: 'Modal', type: 'link' },
  //       { path: '/uikit/tooltip-popover',title: 'Tooltip & popovers', type: 'link', },
  //       { path: '/uikit/progress', title: 'progress', type: 'link' },
  //       { path: '/uikit/carousels', title: 'Carousels', type: 'link' },
  //     ],*/
  //   },
  //   {
  //     title: 'Json File',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" class="side-menu__icon">
  //     <g>
  //         <rect fill="none" height="24" width="24"></rect>
  //     </g>
  //     <g>
  //         <g></g>
  //         <g>
  //             <circle cx="15.5" cy="9.5" r="1.5"></circle>
  //             <circle cx="8.5" cy="9.5" r="1.5"></circle>
  //             <path d="M12,18c2.28,0,4.22-1.66,5-4H7C7.78,16.34,9.72,18,12,18z"></path>
  //             <path d="M11.99,2C6.47,2,2,6.48,2,12c0,5.52,4.47,10,9.99,10C17.52,22,22,17.52,22,12C22,6.48,17.52,2,11.99,2z M12,20 c-4.42,0-8-3.58-8-8c0-4.42,3.58-8,8-8s8,3.58,8,8C20,16.42,16.42,20,12,20z"></path>
  //         </g>
  //     </g>
  // </svg>`,
  //    // type: 'sub',
  //    // Menusub: true,
  //    type: 'link',
  //     active: false,
  //    /* children: [
  //       { path: '/icons/font-awesome-icons', title: 'Font Awesome Icons', type: 'link' },
  //       { path: '/icons/material-design-icons', title: 'Material Design Icons', type: 'link' },
  //       { path: '/icons/simple-line-icons', title: 'Simple Line Icons', type: 'link' },
  //       { path: '/icons/feather-icons', title: 'Feather Icons', type: 'link' },
  //       { path: '/icons/ionic-icons', title: 'Ionic Icons', type: 'link' },
  //       { path: '/icons/flag-icons', title: 'Flag Icons', type: 'link' },
  //       { path: '/icons/pe7-icons', title: 'Pe7 Icons', type: 'link' },
  //       { path: '/icons/typicon-icons', title: 'Typicon Icons', type: 'link' },
  //       { path: '/icons/weather-icons', title: 'Weather Icons', type: 'link' },
  //       { path: '/icons/bootstrap-icons', title: 'Bootstrap Icons', type: 'link' },
  //     ],*/
  //   },

  
    //Advanced
  //   {
  //     title: 'Excel File',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" viewBox="0 0 24 24">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M16.66 4.52l2.83 2.83-2.83 2.83-2.83-2.83 2.83-2.83M9 5v4H5V5h4m10 10v4h-4v-4h4M9 15v4H5v-4h4m7.66-13.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65zM11 3H3v8h8V3zm10 10h-8v8h8v-8zm-10 0H3v8h8v-8z">
  //     </path>
  // </svg>`,
  //    // type: 'sub',
  //    // Menusub: true,
  //    type: 'link',
  //     active: false,
  //    /* children: [
  //       { path: '/adminui/card-design', title: 'Card Design', type: 'link' },
  //       { path: '/adminui/full-calendar', title: 'Full Calender', type: 'link' },
  //       { path: '/adminui/chat', title: 'Chat', type: 'link' },
  //       { path: '/adminui/notifications', title: 'Notifications', type: 'link' },
  //       { path: '/adminui/sweetalerts', title: 'Sweet alerts', type: 'link' },
  //       { path: '/adminui/range-slider', title: 'Range slider', type: 'link' },
  //       { path: '/adminui/content-scrollbar', title: 'Content Scrollbar', type: 'link' },
  //       { path: '/adminui/loaders', title: 'Loaders', type: 'link' },
  //       { path: '/adminui/rating', title: 'Rating', type: 'link' },
  //       { path: '/adminui/timeline', title: 'Timeline', type: 'link' },
  //       { path: '/adminui/treeview', title: 'Treeview', type: 'link' },
  //       { path: '/adminui/ribbons', title: 'Ribbons', type: 'link' },
  //       { path: '/adminui/swiperjs', title: 'SwiperJs', type: 'link' },
  //       { path: '/adminui/userlist', title: 'User List', type: 'link' },
  //       { path: '/adminui/search', title: 'Search', type: 'link' },  
  //     ],*/
  //   },
   /* {
      title: 'LandingPage',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" enable-background="new 0 0 24 24" viewBox="0 0 24 24" fill="#000000">
      <g>
          <rect fill="none" height="24" width="24"></rect>
      </g>
      <g>
          <g>
              <path d="M6,15c-0.83,0-1.58,0.34-2.12,0.88C2.7,17.06,2,22,2,22s4.94-0.7,6.12-1.88C8.66,19.58,9,18.83,9,18C9,16.34,7.66,15,6,15 z M6.71,18.71c-0.28,0.28-2.17,0.76-2.17,0.76s0.47-1.88,0.76-2.17C5.47,17.11,5.72,17,6,17c0.55,0,1,0.45,1,1 C7,18.28,6.89,18.53,6.71,18.71z M17.42,13.65L17.42,13.65c6.36-6.36,4.24-11.31,4.24-11.31s-4.95-2.12-11.31,4.24l-2.49-0.5 C7.21,5.95,6.53,6.16,6.05,6.63L2,10.69l5,2.14L11.17,17l2.14,5l4.05-4.05c0.47-0.47,0.68-1.15,0.55-1.81L17.42,13.65z M7.41,10.83L5.5,10.01l1.97-1.97l1.44,0.29C8.34,9.16,7.83,10.03,7.41,10.83z M13.99,18.5l-0.82-1.91 c0.8-0.42,1.67-0.93,2.49-1.5l0.29,1.44L13.99,18.5z M16,12.24c-1.32,1.32-3.38,2.4-4.04,2.73l-2.93-2.93 c0.32-0.65,1.4-2.71,2.73-4.04c4.68-4.68,8.23-3.99,8.23-3.99S20.68,7.56,16,12.24z M15,11c1.1,0,2-0.9,2-2s-0.9-2-2-2s-2,0.9-2,2 S13.9,11,15,11z"></path>
          </g>
      </g>
  </svg>`,
      type: 'link',
      active: false,
      path:"/landingpage"
    
    },
    {
      title: 'NestedMenu',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
      <path d="M0 0h24v24H0V0z" fill="none"></path>
      <path d="M11 7h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zM20.1 3H3.9c-.5 0-.9.4-.9.9v16.2c0 .4.4.9.9.9h16.2c.4 0 .9-.5.9-.9V3.9c0-.5-.5-.9-.9-.9zM19 19H5V5h14v14z">
      </path>
  </svg>`,
      type: 'sub',
      Menusub: false,
      active: false,
      children: [
        {
        
          title: 'Nested-1',
          type: 'empty',
          active: false,
        },
        {
          title: 'Nested-2',
          icon: 'database',
          type: 'sub',
          active: false,
          children: [
            {
            
              title: 'Nested-2-1',
              type: 'empty',
              active: false,
            },
            {
            
              title: 'Nested-2-2',
              type: 'empty',
              active: false,
            },
          ],
        },
      ],
    },*/
  //   { headTitle: 'FORMS & TABLES' },

  //   {
  //     title: 'Forms',
  //     type: 'sub',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" class="side-menu__icon">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z">
  //     </path>
  // </svg>`,
  //     Menusub: true,
  //     active: false,
  //     children: [
  //       { path: '/form-module/form-elements', title: 'Form Elements', type: 'link' },
  //       { path: '/form-module/form-layouts', title: 'Form Layouts', type: 'link' },
  //       { path: '/form-module/form-advanced', title: 'Form Advanced', type: 'link' },
  //       { path: '/form-module/form-editor', title: 'Form Editor', type: 'link' },
  //       { path: '/form-module/form-validation', title: 'Form Validation', type: 'link' },
  //       { path: '/form-module/form-input-spinners', title: 'Form Input Spinners', type: 'link' },
  //       { path: '/form-module/select2', title: 'Select-2', type: 'link' },

  //     ],
  //   },
  //       {
  //         title: 'Tables',
  //         type: 'sub',
  //         icon: `<svg xmlns="http://www.w3.org/2000/svg" class="side-menu__icon" enable-background="new 0 0 24 24" viewBox="0 0 24 24" fill="#000000">
  //         <g>
  //             <rect fill="none" height="24" width="24"></rect>
  //         </g>
  //         <g>
  //             <g>
  //                 <g>
  //                     <path d="M3,3v8h8V3H3z M9,9H5V5h4V9z M3,13v8h8v-8H3z M9,19H5v-4h4V19z M13,3v8h8V3H13z M19,9h-4V5h4V9z M13,13v8h8v-8H13z M19,19h-4v-4h4V19z"></path>
  //                 </g>
  //             </g>
  //         </g>
  //     </svg>`,
  //         Menusub: true,
  //         active: false,
  //         children: [
  //           { path: '/tables/default-tables', title: 'Default Tables', type: 'link' },
  //           { path: '/tables/data-tables', title: 'Data Tables', type: 'link' },
  //           { path: '/tables/gridjs-tables', title: 'Grid Tables', type: 'link' },

  //         ],
  //       },
      
    

   

  //   { headTitle: 'MAPS & CHARTS' },
  //   {
  //     title: 'Maps',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" class="side-menu__icon">
  //     <path d="M0 0h24v24H0z" fill="none"></path>
  //     <path d="M12 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-1.8C18 6.57 15.35 4 12 4s-6 2.57-6 6.2c0 2.34 1.95 5.44 6 9.14 4.05-3.7 6-6.8 6-9.14zM12 2c4.2 0 8 3.22 8 8.2 0 3.32-2.67 7.25-8 11.8-5.33-4.55-8-8.48-8-11.8C4 5.22 7.8 2 12 2z">
  //     </path>
  // </svg>`,
  //     type: 'sub',
  //     Menusub: true,
  //     active: false,
  //     children: [
  //       { path: '/maps/leaflet', title: 'Leaflet Maps', type: 'link' },
  //     ],
  //   },
  //   {
  //     title: 'Charts',
  //     icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" class="side-menu__icon">
  //     <path d="M0 0h24v24H0V0z" fill="none"></path>
  //     <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z">
  //     </path>
  // </svg>`,
  //     type: 'sub',
  //     Menusub: true,
  //     active: false,
  //     children: [
  //       { path: '/charts/apexcharts', title: 'Apexcharts', type: 'link' },
  //       { path: '/charts/chartjs', title: 'chartJs', type: 'link' },
  //       { path: '/charts/echarts', title: 'Echarts', type: 'link' },
  //     ],
  //   },
  
  
  ];
  // Array
  items = new BehaviorSubject<Menu[]>(this.MENUITEMS);
}
