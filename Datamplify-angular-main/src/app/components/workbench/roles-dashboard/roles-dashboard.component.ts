import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgxPaginationModule } from 'ngx-pagination';
import { SharedModule } from '../../../shared/sharedmodule';
import { WorkbenchService } from '../workbench.service';
import Swal from 'sweetalert2';
import { InsightsButtonComponent } from '../insights-button/insights-button.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-roles-dashboard',
  standalone: true,
  imports: [SharedModule,CommonModule,FormsModule,NgbModule,NgxPaginationModule,ReactiveFormsModule,InsightsButtonComponent],
  templateUrl: './roles-dashboard.component.html',
  styleUrl: './roles-dashboard.component.scss'
})
export class RolesDashboardComponent {
  gridView = true;
  roleName:any;
  itemsPerPage:any;
  pageNo = 1;
  page: number = 1;
  totalItems:any;
  savedRolesList =[] as any;
   previlagesList =[] as any;
  selectControl = new FormControl([]);
  selectedArray = [] as any;
  originalSelectedArray = [] as any;
  selectControlSelected = new FormControl([]);
  searchPrevilage:any;
  searchrole:any;
  searchSelectedPrevilage:any;
  roleTitle='';
  roleId:any;
  selectedIds = [] as any;
  updateRole = false;
  assaignedUsers =[] as any;
  addRoleDiv = false;
constructor(public modalService:NgbModal,private workbechService:WorkbenchService,private router:Router,private route:ActivatedRoute,private toasterservice:ToastrService){
  if(this.router.url.includes('/datamplify/roles/add-role')){
    this.addRoleDiv = true;
    this.getPrevilagesList();
  }
  if(this.router.url.includes('/datamplify/dashboard/role-edit')){
    // this.addRoleDiv = true;
    // this.getPrevilagesList();
    if (route.snapshot.params['id1'] ) {
      const roleId = +atob(route.snapshot.params['id1']);
      this.addRoleDiv = true;
      this.updateRole = true;
      this.getPrevilagesList();
      this.getRoleIdDetails(roleId);
    }
  }
  if(this.router.url.includes('/datamplify/roles/roles-list')){
    this.addRoleDiv = false;
  }
}


ngOnInit(){
  this.getSavedRolesList();
}

// addRolesModal(OpenmdoModal: any) {
//   this.modalService.open(OpenmdoModal);
// }
addRolesDivOpen(){
// this.addRoleDiv = true;
this.router.navigate(['/datamplify/roles/add-role'])
}
updateRolesDivOpen(id:any){
  const encodedRoleId = btoa(id.toString());
  // this.addRoleDiv = true;
  this.router.navigate(['/datamplify/dashboard/role-edit/'+encodedRoleId]);
  // this.updateRole = true;
  }

searchRoleList(){
  this.pageNo=1;
  this.getSavedRolesList();
} 
pageChangegetRolesList(page:any){
this.pageNo=page;
this.getSavedRolesList();
}
getSavedRolesList(){
  const obj ={
     search:this.roleName,
     page_no:this.pageNo,
     page_count:this.itemsPerPage
  }
  if(obj.search ===''||obj.search === null){
    delete obj.search
  }
  this.workbechService.getSavedRolesList(obj).subscribe({
    next:(data)=>{
      console.log(data);
      this.savedRolesList=data.sheets;
      this.itemsPerPage = data.items_per_page;
      this.totalItems = data.total_items
     },
    error:(error)=>{
      console.log(error);
      Swal.fire({
        icon: 'error',
        title: 'oops!',
        text: error.error.message,
        width: '400px',
      })
    }
  }) 
  this.updateRole = false;
}
getPrevilagesList(){
  const obj ={
    search : this.searchPrevilage
  }
  if(obj.search === '' || obj.search === null){
    delete obj.search
  }
  this.workbechService.getPrevilagesList(obj).subscribe({
    next:(data)=>{
      console.log(data);
      this. previlagesList=data;
      this.removeIdsFromprevilageListOnEdit();
     },
    error:(error)=>{
      console.log(error);
      Swal.fire({
        icon: 'error',
        title: 'oops!',
        text: error.error.message,
        width: '400px',
      })
    }
  }) 
}
moveSelectedItems() {
  const selectedIds:any = this.selectControl.value;

  // Filter and move the selected items
  this.selectedArray = this.selectedArray.concat(
    this. previlagesList.filter((item: { id: any; }) => selectedIds.includes(item.id))
  );
console.log('getselectedprevilages',this.selectedArray)
  // remo the selected items from the original array
  this. previlagesList = this. previlagesList.filter((item: { id: any; }) => !selectedIds.includes(item.id));
  this.originalSelectedArray = [...this.selectedArray];
  this.selectControl.setValue([]);
}


selectAllAndMove() {
  // Select all IDs
  const allIds = this. previlagesList.map((item: { id: any; }) => item.id);

  // adding itms in selctdarray
  this.selectedArray = this.selectedArray.concat(this. previlagesList);
  this. previlagesList = [];
  this.originalSelectedArray = [...this.selectedArray];
  // clr selected
  this.selectControl.setValue([]);
}

moveBackSelectedItems() {
  const selectedIds:any = this.selectControlSelected.value;

  selectedIds.forEach((id: number) => {
    // item to move back
    const itemToMoveBack = this.selectedArray.find((item: { id: number; }) => item.id === id);

    if (itemToMoveBack) {
      // finding orgnl positionid
      const originalIndex = this.previlagesList.findIndex((item: { id: number; }) => item.id > id);
      
      if (originalIndex === -1) {
        this.previlagesList.push(itemToMoveBack);
      } else {
        this.previlagesList.splice(originalIndex, 0, itemToMoveBack);
      }

      // remve from selctdarray
      this.selectedArray = this.selectedArray.filter((item: { id: number; }) => item.id !== id);
      this.originalSelectedArray = [...this.selectedArray];

    }
  });

  this.selectControlSelected.setValue([]);
}

removeAllSelected() {
  // Clear the selected array
  this.selectedArray = [];
  this.selectControlSelected.setValue([]);
  this.getPrevilagesList();
  this.originalSelectedArray=[]
}

searchInSelectedArray() {
  const query = this.searchSelectedPrevilage.toLowerCase();
  if(query === ''){
    this.selectedArray = [...this.originalSelectedArray];
  }else{
  this.selectedArray = this.selectedArray.filter((item: { previlage: string; }) =>
    item.previlage.toLowerCase().includes(query)
  );
  }
}

getOriginalSelectedIds(): number[] {
  return this.originalSelectedArray.map((item: { id: any; }) => item.id);
}

addRoles(){
// this.selectedIds= this.originalSelectedArray.map((item: { id: any; }) => item.id);
console.log(this.selectedIds)
if(this.roleTitle === ''){
  Swal.fire({
    icon: 'error',
    title: 'oops!',
    text: 'Please add title',
    width: '400px',
  })
}else{
  const Obj = {
    role_name:this.roleTitle,
    previlages:this.getOriginalSelectedIds()
  }
  this.workbechService.addPrevilage(Obj).subscribe({
    next:(data)=>{
      console.log(data);
      this.toasterservice.success(data.message,'success',{ positionClass: 'toast-top-right'});
      this.router.navigate(['/datamplify/roles/roles-list'])
     },
    error:(error)=>{
      console.log(error);
      Swal.fire({
        icon: 'error',
        title: 'oops!',
        text: error.error.message,
        width: '400px',
      })
    }
  }) 
}
}
deleteRole(id:any){
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  }).then((result)=>{
    if(result.isConfirmed){
      this.workbechService.deleteRole(id)
      .subscribe(
        {
          next:(data:any) => {
            console.log(data);      
            if(data){
              // Swal.fire({
              //   icon: 'success',
              //   title: 'Deleted!',
              //   text: 'Role Deleted Successfully',
              //   width: '400px',
              // })
              this.toasterservice.success('Role Deleted Successfully','success',{ positionClass: 'toast-top-right'});
            }
            this.getSavedRolesList();
          },
          error:(error:any)=>{
            Swal.fire({
              icon: 'warning',
              text: error.error.message,
              width: '300px',
            })
            console.log(error)
          }
        } 
      )
    }})
}
getRoleIdDetails(id:any){
  this.workbechService.getRoleIdDetails(id).subscribe({
    next:(data)=>{
      console.log(data);
      this.roleId=id;
      this.roleTitle = data.role_name;
      this.selectedArray = data.previlages;
      this.assaignedUsers = data.users
      this.removeIdsFromprevilageListOnEdit();
      this.updateRole = true
     },
    error:(error)=>{
      console.log(error);
      Swal.fire({
        icon: 'error',
        title: 'oops!',
        text: error.error.message,
        width: '400px',
      })
    }
  }) 
}
removeIdsFromprevilageListOnEdit(){
  if(this.previlagesList){
    const selectedIds:any = this.selectedArray.map((item: { id: any; }) => item.id);
  this. previlagesList = this. previlagesList.filter((item: { id: any; }) => !selectedIds.includes(item.id));
  }
  this.originalSelectedArray = [...this.selectedArray];

}
editRoles(){
  const obj ={
    role:this.roleTitle,
    previlage_list:this.getOriginalSelectedIds()
  }
  this.workbechService.editRoleDetails(this.roleId,obj).subscribe({
    next:(data)=>{
      this.modalService.dismissAll();
      console.log(data);
      // Swal.fire({
      //   icon: 'success',
      //   title: 'Done!',
      //   text: data.message,
      //   width: '400px',
      // })
      this.toasterservice.success(data.message,'success',{ positionClass: 'toast-top-right'});
     },
    error:(error)=>{
      this.modalService.dismissAll();
      console.log(error);
      Swal.fire({
        icon: 'error',
        title: 'oops!',
        text: error.error.message,
        width: '400px',
      })
    }
  }) 
}
viewSavedRoles(){
  this.router.navigate(['/datamplify/roles/roles-list'])
}
}
