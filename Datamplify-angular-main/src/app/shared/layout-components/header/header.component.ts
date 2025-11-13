import { ChangeDetectorRef, Component, ElementRef, Input, OnInit, Renderer2 } from '@angular/core';
import { Menu, NavService } from '../../services/navservice';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ViewTemplateDrivenService } from '../../../components/workbench/view-template-driven.service';
import { SharedService } from '../../services/shared.service';
interface Item {
  id: number;
  name: string;
  type: string;
  title: string;
  // Add other properties as needed
}
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  cartItemCount: number = 5;
  notificationCount: number = 4;
  public isCollapsed = true;
  userName: any;
  collapse: any;
  viewRoles = false;
  viewUsers = false;
  @Input() isPublicUrl!:boolean; 
  constructor(public navServices: NavService,public modalService:NgbModal,private cdr: ChangeDetectorRef,private authService:AuthService,private router:Router,
    private elementRef: ElementRef,public renderer:Renderer2,private viewTemplateService:ViewTemplateDrivenService,private sharedService: SharedService) {


  }  SwicherOpen(){
    document.querySelector('.offcanvas-end')?.classList.add('show')
    document.querySelector("body")!.classList.add("overflow:hidden");
    document.querySelector("body")!.classList.add("padding-right:4px");
    const Rightside: any = document.querySelector(".offcanvas-end");
    if (document.querySelector(".switcher-backdrop")?.classList.contains('d-none')) {
      document.querySelector(".switcher-backdrop")?.classList.add("d-block");
      document.querySelector(".switcher-backdrop")?.classList.remove("d-none");
  }
  }
  openSearch(search: any) {
    this.modalService.open(search);
  }
  toggleSidebar() {
    let html = this.elementRef.nativeElement.ownerDocument.documentElement;
    if (localStorage.getItem('data-toggled') == 'true') {
      document.querySelector('html')?.getAttribute('data-toggled') ==
        'icon-overlay-close';
    } else if (html?.getAttribute('data-vertical-style') == 'overlay') {
      document.querySelector('html')?.getAttribute('data-toggled') != null
        ? document.querySelector('html')?.removeAttribute('data-toggled')
        : document
            .querySelector('html')
            ?.setAttribute('data-toggled', 'icon-overlay-close');
    } else if (localStorage.getItem('vexelverticalstyles') == 'closed') {
      html?.setAttribute(
        'data-toggled',
        html?.getAttribute('data-toggled') == 'close-menu-close'
          ? ''
          : 'close-menu-close'
      );
    } else if (localStorage.getItem('vexelverticalstyles') == 'icontext') {
      html?.setAttribute(
        'data-toggled',
        html?.getAttribute('data-toggled') == 'icon-text-close'
          ? ''
          : 'icon-text-close'
      );
    } else if (localStorage.getItem('vexelverticalstyles') == 'detached') {
      html?.setAttribute(
        'data-toggled',
        html?.getAttribute('data-toggled') == 'detached-close'
          ? ''
          : 'detached-close'
      );
    } else if (localStorage.getItem('vexelverticalstyles') == 'doublemenu') {
      html?.setAttribute('data-toggled', html?.getAttribute('data-toggled') == 'double-menu-close' && document.querySelector(".slide.open")?.classList.contains("has-sub")? 'double-menu-open': 'double-menu-close');

      html?.setAttribute(
        'data-toggled',
        html?.getAttribute('data-toggled') == 'double-menu-close'
          ? 'double-menu-open'
          : 'double-menu-close'
      );
    } else if (localStorage.getItem('vexelMenu') == 'menu-click') {
        html?.setAttribute('data-toggled', html?.getAttribute('data-toggled') == 'menu-click-closed' ? '' : 'menu-click-closed');
        
      }
      else if (localStorage.getItem('vexelMenu') == 'menu-hover') {
        html?.setAttribute('data-toggled', html?.getAttribute('data-toggled') == 'menu-hover-closed' ? '' : 'menu-hover-closed');
      }
      else if (localStorage.getItem('vexelMenu') == 'icon-click') {
        html?.setAttribute('data-toggled', html?.getAttribute('data-toggled') == 'icon-click-closed' ? '' : 'icon-click-closed');
      }
      else if (localStorage.getItem('vexelMenu') == 'icon-hover') {
        html?.setAttribute('data-toggled', html?.getAttribute('data-toggled') == 'icon-hover-closed' ? '' : 'icon-hover-closed');
      }
      if (window.innerWidth <= 992) {
        html?.setAttribute(
          'data-toggled',
          html?.getAttribute('data-toggled') == 'open' ? 'close' : 'open'
        );
        if (html?.getAttribute('data-toggled') == 'open') {
          document.querySelector('#responsive-overlay')?.classList.add('active');
        }
      }
  
   
  }
  themeType = 'dark';
  themeChange(type: string, type1: string,type2:string) {
    const html = this.elementRef.nativeElement.ownerDocument.documentElement;
    this.elementRef.nativeElement.ownerDocument.documentElement?.setAttribute('data-theme-mode', type);
    this.elementRef.nativeElement.ownerDocument.documentElement?.setAttribute('style', "");
    localStorage.removeItem("vexel-background-mode-body");
    localStorage.removeItem("vexel-background-mode-dark");
    localStorage.removeItem("vexel-background-mode-light");
    localStorage.removeItem("vexel-background-mode-formcontrol");
    localStorage.removeItem("vexel-background-mode-inputBorder");


    localStorage.setItem('vexeldarktheme', type);
    this.elementRef.nativeElement.ownerDocument.documentElement?.setAttribute('data-header-styles', type1);
    localStorage.setItem('vexelHeader', type1);
    this.elementRef.nativeElement.ownerDocument.documentElement?.setAttribute('data-menu-styles', type2);
    localStorage.setItem('vexel-menu-mode', type2);
    const htmlElement = this.elementRef.nativeElement.ownerDocument.documentElement;

    if (type == 'dark') {
      // html.style.setProperty('--background', '#0b0c11');
      // html.style.setProperty('--primary-color', '#4181f7');
      // html.style.setProperty('--default-text-color', '#4181f7');
      const darkbtn = document.querySelector(
        '#switcher-dark-theme'
      ) as HTMLInputElement;
      darkbtn.checked = true;
      this.renderer.setAttribute(htmlElement, 'data-menu-style','dark');

    } else {
      // html.style.setProperty('--background', '#fff');
      // html.style.setProperty('--primary-color', '#4181f7');
      // html.style.setProperty('--default-text-color', '#4181f7');
      // html.style.setProperty('--menu-bg', '#4181f7');
      // html.style.setProperty('--header-bg', '#4181f7'); 
      const lightbtn = document.querySelector(
        '#switcher-light-theme'
      ) as HTMLInputElement;
      lightbtn.checked = true;
      this.renderer.setAttribute(htmlElement, 'data-menu-style','light');
      localStorage.removeItem("bodyBgRGB");
      localStorage.removeItem("bodyBgRGB2");
      localStorage.removeItem("bodylightRGB");
      localStorage.removeItem("vexellight-background-formcontrol");
      localStorage.removeItem("vexelHeader");
      localStorage.removeItem("vexeldarktheme");
    }
  }
  
    // Theme color Mode
    
  isCartEmpty: boolean = false;
  isNotifyEmpty: boolean = false;

  removeRow(rowId: string) {
    const rowElement = document.getElementById(rowId);
    if (rowElement) {
      rowElement.remove();

      
    }
    this.cartItemCount--;
    this.isCartEmpty = this.cartItemCount === 0;
    
  }
  removeNotify(rowId: string) {
    const rowElement = document.getElementById(rowId);
    if (rowElement) {
      rowElement.remove();

      
    }
    this.notificationCount--;
    this.isNotifyEmpty = this.notificationCount === 0;
  }
  handleCardClick(event:Event): void {
    // Prevent the click event from propagating to the container
    // event.preventDefault();
    event.stopPropagation();
  }
  

  // Search
  // public menuItems!: Menu[];
  //   public items!: Menu[];
  //   public text!: string;
  //   public SearchResultEmpty:boolean = false;

    // ngOnInit(): void {
    //   this.navServices.items.subscribe((menuItems) => {
    //     this.items = menuItems;
    //   });
    //   // To clear and close the search field by clicking on body
    //   document.querySelector('.main-content')?.addEventListener('click',()=>{
    //     this.clearSearch();
    //   })
    //   this.text = '';
    // }
  
  

  // Search
  public menuItems!: Menu[];
  public items!: Menu[];
  public text!: string;
  public SearchResultEmpty:boolean = false;
  ngOnInit() {
    const html = this.elementRef.nativeElement.ownerDocument.documentElement;
    // Set default theme to dark
    // html.setAttribute('data-theme-mode', 'dark');
    // html.style.setProperty('--background', '#0b0c11');
    // html.style.setProperty('--primary-color', '#4181f7');
    // html.style.setProperty('--default-text-color', '#4181f7');
    // localStorage.setItem('vexeldarktheme', 'dark');
    // html.style.setProperty('--menu-bg', '#4181f7');

    // html.style.setProperty('--background', '#0f0f24');
    // html.style.setProperty('--primary-color', '#433c80');
    // html.style.setProperty('--default-text-color', '#FFFFFF');
    // html.style.setProperty('--menu-bg', '#0f0f24');
    // html.style.setProperty('--header-bg', '#0f0f24');
    // html.style.setProperty('--custom-white', '#0f0f24');
    // html.style.setProperty('--default-border', '#433c80');
    // html.style.setProperty('--header-border-color', '#433c80');
    // html.style.setProperty('--light-rgb', '#433c80');

    if(!this.isPublicUrl){
      // this.viewRoles=this.viewTemplateService.ViewRoles();
      // this.viewUsers=this.viewTemplateService.viewUsers();
      const currentUser = localStorage.getItem( 'username' );
      this.userName = JSON.parse( currentUser! )['userName'];
      }
    this.navServices.items.subscribe((menuItems) => {
      this.items = menuItems;
    });

    // let html = this.elementRef.nativeElement.ownerDocument.documentElement;
    // html.setAttribute('data-toggled', 'icon-overlay-close');
  }
  refreshPublicDashboard(){
    this.sharedService.refresh();
  }
  downloadPublicDashbaord(){
    this.sharedService.download();
  }
  logOut() {
    this.authService.logOut().subscribe((res) => {
      if (!res.success) {
        this.router.navigate(['/authentication/signin']);
      }
    });
  }
  routehelpGuide(){
    this.router.navigate(['/datamplify/help-guide']);
  }
    Search(searchText: string) {
      if (!searchText) return this.menuItems = [];
      // items array which stores the elements
      const items:Item[] = [];
      // Converting the text to lower case by using toLowerCase() and trim() used to remove the spaces from starting and ending
      searchText = searchText.toLowerCase().trim();
      this.items.filter((menuItems:Menu) => {
        // checking whether menuItems having title property, if there was no title property it will return
        if (!menuItems?.title) return false;
        //  checking wheteher menuitems type is text or string and checking the titles of menuitems
        if (menuItems.type === 'link' && menuItems.title.toLowerCase().includes(searchText)) {
          // Converting the menuitems title to lowercase and checking whether title is starting with same text of searchText
          if( menuItems.title.toLowerCase().startsWith(searchText)){ // If you want to get all the data with matching to letter entered remove this line(condition and leave items.push(menuItems))
            // If both are matching then the code is pushed to items array
            items.push(menuItems as Item);
          }
        }
        //  checking whether the menuItems having children property or not if there was no children the return
        if (!menuItems.children) return false;
        menuItems.children.filter((subItems:Menu) => {
          if (!subItems?.title) return false; 
          if (subItems.type === 'link' && subItems.title.toLowerCase().includes(searchText)) {
            if( subItems.title.toLowerCase().startsWith(searchText)){         // If you want to get all the data with matching to letter entered remove this line(condition and leave items.push(subItems))
              items.push(subItems as Item);
            }
  
          }
          if (!subItems.children) return false;
          subItems.children.filter((subSubItems:Menu) => {
            if (subSubItems.title?.toLowerCase().includes(searchText)) {
              if( subSubItems.title.toLowerCase().startsWith(searchText)){ // If you want to get all the data with matching to letter entered remove this line(condition and leave items.push(subSubItems))
                items.push(subSubItems as Item);
                
              }
            }
          });
          return true;
        });
        return this.menuItems = items;
      });
      // Used to show the No search result found box if the length of the items is 0
      if(!items.length){
        this.SearchResultEmpty = true;
      }
      else{
        this.SearchResultEmpty = false;
      }
      return true;
    }
    SearchModal(SearchModal: any) {
      this.modalService.open(SearchModal);
    }
    //  Used to clear previous search result
    clearSearch() {    
      const headerSearch = document.querySelector('.header-search');
      if (headerSearch) {
          headerSearch.classList.remove('searchdrop');
      }
      this.text = '';
      this.menuItems = [];
      this.SearchResultEmpty = false;
      return this.text, this.menuItems;
      
    }
  isInputFocused: boolean = false;

  onInputFocus() {
    this.isInputFocused = true;
  }

  onInputBlur() {
    this.isInputFocused = false;
  }
  isFullscreen: boolean = false;

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
  }
  SearchHeader() {
    document
    .querySelector('.header-search')
    ?.classList.toggle('searchdrop');
  }

  routeToUserDashboard(){
    this.router.navigate(['/datamplify/users/users-list'])
  }
  routeToRolesDashboard(){
    this.router.navigate(['/datamplify/roles/roles-list'])
  }

  routeToConfigurePage() {
    this.router.navigate(['/datamplify/configure-page/configure']);
  }
  routeToUpdatePasswordPage(){
    this.router.navigate(['/datamplify/update-password']);
  }
}

