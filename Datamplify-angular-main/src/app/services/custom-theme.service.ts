import { Injectable } from '@angular/core';
import _ from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class CustomThemeService {

  currentTheme : any;
  apiCustomTheme : any;

  constructor() { }

  setApiCustomTheme(customTheme : any){
    this.apiCustomTheme = _.cloneDeep(customTheme);
  }

  getApiCustomTheme(){
    if(this.apiCustomTheme){
      return this.apiCustomTheme;
    }
    return JSON.parse(localStorage.getItem("apiCustomTheme")!);
  }

  setThemeVariable(variable: string, value: string): void {
    if(this.currentTheme){
    this.currentTheme[variable] = value;
    localStorage.setItem('customTheme', JSON.stringify(this.currentTheme)); 
    } else {
      this.currentTheme = JSON.parse(localStorage.getItem("customTheme") ?? '""');;
    }
  }

  setCurrentTheme(customTheme : any){
    this.currentTheme = customTheme;
  }

  getCurrentTheme(){
    if(this.currentTheme){
      return this.currentTheme;
    }
    return JSON.parse(localStorage.getItem("customTheme")!);
  }
}