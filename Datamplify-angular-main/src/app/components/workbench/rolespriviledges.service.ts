import { Injectable } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RolespriviledgesService {
  currentUserPreviledgeIds!:any[];

  setRoleBasedPreviledges(previlages: any[]) {
    this.currentUserPreviledgeIds = previlages.map(obj => obj.id);
    let encryptPreviledgesData = btoa(JSON.stringify(this.currentUserPreviledgeIds));
    localStorage.setItem("previledges",encryptPreviledgesData);
  }

  isAnyNumberPresent(arr1: number[]): boolean {
    try {
      if(this.currentUserPreviledgeIds && this.currentUserPreviledgeIds.length){
        return arr1.some(num => this.currentUserPreviledgeIds.includes(num));
      } 
      const encryptPreviledgesData = localStorage.getItem("previledges");
      if(encryptPreviledgesData){
        let data = atob(encryptPreviledgesData);
        this.currentUserPreviledgeIds = JSON.parse(data);
        return arr1.some(num => this.currentUserPreviledgeIds.includes(num));
      } else {
        this.authService.logOut();
      }
    } catch (error) {
      this.authService.logOut();
    }
    return false;
  }

  userHasPriviledge(previledgeId : number) {
    try {
      if(this.currentUserPreviledgeIds && this.currentUserPreviledgeIds.length){
        return this.currentUserPreviledgeIds.includes(previledgeId);
      } 
      const encryptPreviledgesData = localStorage.getItem("previledges");
      if(encryptPreviledgesData){
        let data = atob(encryptPreviledgesData);
        this.currentUserPreviledgeIds = JSON.parse(data);
        return this.currentUserPreviledgeIds.includes(previledgeId);
      } else {
        this.authService.logOut();
      }
    } catch (error) {
      this.authService.logOut();
    }
  

    return false;
  }

  constructor(private authService : AuthService) { }
}
