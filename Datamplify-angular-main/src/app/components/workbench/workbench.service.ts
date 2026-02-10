import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { get } from 'lodash';
@Injectable({
  providedIn: 'root'
})
export class WorkbenchService {
  private skipLoader = false; // Flag to control the loader
  accessToken: any;
  constructor(private http: HttpClient) { }
  disableLoaderForNextRequest() {
    this.skipLoader = true;
  }

  shouldSkipLoader(): boolean {
    return this.skipLoader;
  }

  resetSkipLoader() {
    this.skipLoader = false; // Reset after request
  }

  saveThemes(obj: any) {
    return this.http.post<any>(`${environment.apiUrl}/usercustomtheme/` + this.accessToken, obj);
  }

  //roles
  getSavedRolesList(obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.put<any>(`${environment.apiUrl}/roleslist/` + this.accessToken, obj);
  }
  getPrevilagesList(obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.put<any>(`${environment.apiUrl}/previlages_list/` + this.accessToken, obj);
  }
  addPrevilage(obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.post<any>(`${environment.apiUrl}/role/` + this.accessToken, obj);
  }
  deleteRole(id: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.delete<any>(`${environment.apiUrl}/deleterole/` + id + '/' + this.accessToken);
  }
  getRoleIdDetails(id: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.get<any>(`${environment.apiUrl}/roledetails/` + id + '/' + this.accessToken);
  }
  editRoleDetails(id: any, obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.put<any>(`${environment.apiUrl}/editroles/` + id + '/' + this.accessToken, obj);
  }
  //users
  getUserList(obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.put<any>(`${environment.apiUrl}/getusersroles/` + this.accessToken, obj);
  }
  getAddedRolesList() {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.get<any>(`${environment.apiUrl}/roleslist/` + this.accessToken);
  }
  addUserwithRoles(obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.post<any>(`${environment.apiUrl}/adduser/` + this.accessToken, obj);
  }
  deleteUser(id: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.delete<any>(`${environment.apiUrl}/deleteuser/` + id + '/' + this.accessToken);
  }

  getUserIdDetails(id: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.get<any>(`${environment.apiUrl}/userdetails/` + id + '/' + this.accessToken);
  }
  editUser(id: any, obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.put<any>(`${environment.apiUrl}/edituser/` + id + '/' + this.accessToken, obj);
  }

  //users and roles
  getRoleDetailsDshboard() {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.get<any>(`${environment.apiUrl}/dashboardroledetails/` + this.accessToken);
  }
  getUsersOnRole(obj: any) {
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.post<any>(`${environment.apiUrl}/multipleroles/` + this.accessToken, obj);
  }

  // easy connection
  getSchemaList(object:any){
    return this.http.post<any>(`${environment.apiUrl}/connections/get_schema/`, object, {headers: this.buildHeaders(this.accessToken)});
  }
  databaseConnection(object: any) {
    return this.http.post<any>(`${environment.apiUrl}/connections/Database_connection/`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  updateDatabaseConnection(hierarchyId: any, object: any) {
    return this.http.put<any>(`${environment.apiUrl}/connections/Database_connection/${hierarchyId}`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  fileConnection(formData: FormData) {
    return this.http.post<any>(`${environment.apiUrl}/connections/File_connection/`, formData, { headers: this.buildHeaders(this.accessToken) });
  }

  updateFileConnection(formData: FormData, hierarchyId: any) {
    return this.http.put<any>(`${environment.apiUrl}/connections/File_connection/${hierarchyId}`, formData, { headers: this.buildHeaders(this.accessToken) });
  }

  remoteServerConnection(object:any){
    return this.http.post<any>(`${environment.apiUrl}/connections/remote_file/`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  updateremoteServerConnection(hierarchyId: any, object: any) {
    return this.http.put<any>(`${environment.apiUrl}/connections/remote_connection/${hierarchyId}`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  getConnectionsList(page:any, pageSize:any, search:any) {
    return this.http.get<any>(`${environment.apiUrl}/connections/Connection_list/?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }

  getDatabaseConnection(hierarchyId:any){
    return this.http.get<any>(`${environment.apiUrl}/connections/Database_connection/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getFileConnection(hierarchyId:any){
    return this.http.get<any>(`${environment.apiUrl}/connections/File_connection/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getRemoteServerConnection(hierarchyId:any){
    return this.http.get<any>(`${environment.apiUrl}/connections/remote_connection/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteDatabseConnection(hierarchyId:any){
    return this.http.delete<any>(`${environment.apiUrl}/connections/Database_connection/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteFileConnection(hierarchyId:any){
    return this.http.delete<any>(`${environment.apiUrl}/connections/File_connection/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getExcelSheets(hierarchyId: string) {
    return this.http.get<any>(`${environment.apiUrl}/connections/excel_sheets/${hierarchyId}/`, { headers: this.buildHeaders(this.accessToken) });
  }

  updateExcelSheets(hierarchyId: string, selectedSheets: string[]) {
    return this.http.put<any>(`${environment.apiUrl}/connections/excel_sheets/${hierarchyId}/`, 
      { selected_sheets: selectedSheets }, 
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  getFileSchema(hierarchyId: string) {
    return this.http.get<any>(`${environment.apiUrl}/connections/file_schema/${hierarchyId}/`, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteRemoteServerConnection(hierarchyId:any){
    return this.http.delete<any>(`${environment.apiUrl}/connections/remote_connection/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getIntegrationsUrl(type: any, country?: any) {
    return this.http.post<any>(`${environment.apiUrl}/connections/integration_url/${type}${type.includes('zoho') ? `?country=${country}` : ''}`, {headers: this.buildHeaders(this.accessToken)});
  }

  integrationConnection(object: any, type: any) {
    return this.http.post<any>(`${environment.apiUrl}/connections/Integration/${type}`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  updateIntegrationConnection(object: any, hierarchyId: any) {
    return this.http.put<any>(`${environment.apiUrl}/connections/Integrations/${hierarchyId}`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  getIntegrationConnection(hierarchyId: any) {
    return this.http.get<any>(`${environment.apiUrl}/connections/Integrations/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteIntegrationConnection(hierarchyId: any) {
    return this.http.delete<any>(`${environment.apiUrl}/connections/Integrations/${hierarchyId}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getIntegrationEndpoints(hierarchyId:any){
    return this.http.get<any>(`${environment.apiUrl}/connections/Integration_tables/${hierarchyId}`, {headers: this.buildHeaders(this.accessToken)});
  }

  getIntegrationSchemaList(object:any){
    return this.http.post<any>(`${environment.apiUrl}/connections/Integration_schema/`, object, {headers: this.buildHeaders(this.accessToken)});
  }

  //etl
  saveEtl(object: any) {
    return this.http.post<any>(`${environment.apiUrl}/flowboard/flow/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  updateEtl(object: any) {
    return this.http.put<any>(`${environment.apiUrl}/flowboard/flow/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getEtlDataFlow(id: any, type: any) {
    return this.http.get<any>(`${environment.apiUrl}/flowboard/flow/` + id, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteFlowboard(id: any) {
    return this.http.delete<any>(`${environment.apiUrl}/flowboard/flow/` + id, { headers: this.buildHeaders(this.accessToken) });
  }

  saveTaskPlan(object: any) {
    return this.http.post<any>(`${environment.apiUrl}/taskplan/task/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  updateTaskPlan(object: any) {
    return this.http.put<any>(`${environment.apiUrl}/taskplan/task/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getTaskPlan(id: any, type: any) {
    return this.http.get<any>(`${environment.apiUrl}/taskplan/task/` + id, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteTaskPlan(id: any) {
    return this.http.delete<any>(`${environment.apiUrl}/taskplan/task/` + id, { headers: this.buildHeaders(this.accessToken) });
  }

  getFlowboardList(page: any, pageSize: any, search: any) {
    return this.http.get<any>(`${environment.apiUrl}/flowboard/list/` + `?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }

  getTaskPlanList(page: any, pageSize: any, search: any) {
    return this.http.get<any>(`${environment.apiUrl}/taskplan/list/` + `?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }

  runEtl(dagId: any, type:string) {
    return this.http.post<any>(`${environment.apiUrl}/monitor/Trigger/${dagId}?type=${type}`, {}, { headers: this.buildHeaders(this.accessToken) });
  }

  getDataFlowStatus(object: any) {
    return this.http.post<any>(`${environment.apiUrl}/monitor/status/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getDataFlowLogs(object: any) {
    return this.http.post<any>(`${environment.apiUrl}/monitor/task_status/`, object, { headers: this.buildHeaders(this.accessToken) });
  }
  getConnectionsForEtl(type: any) {
    return this.http.get<any>(`${environment.apiUrl}/connections/ETL_connection_list/` + `?type=${type}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getTablesForDataTransformation(hierarchyId: any) {
    return this.http.get<any>(`${environment.apiUrl}/connections/Server_tables/${hierarchyId}/`, { headers: this.buildHeaders(this.accessToken) });
  }

  getDataObjectsForFile(id: any) {
    return this.http.get<any>(`${environment.apiUrl}/connections/file_schema/${id}/`, { headers: this.buildHeaders(this.accessToken) });
  }
  getFilesForServer(from: any) {
    return this.http.get<any>(`${environment.apiUrl}/connections/ListFiles/?path=${from}`,{ headers: this.buildHeaders(this.accessToken) });
  }
  getDataObjectsFromServer(object: any) {
    return this.http.post<any>(`${environment.apiUrl}/connections/server_files/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getDashboardData() {
    return this.http.get<any>(`${environment.apiUrl}/monitor/Home`, { headers: this.buildHeaders(this.accessToken) });
  }

  getMonitorKpiData(){
    return this.http.get<any>(`${environment.apiUrl}/monitor/kpi_values/`, { headers: this.buildHeaders(this.accessToken) });
  }

  getMonitorList(page: any, pageSize: any, search: any){
    return this.http.get<any>(`${environment.apiUrl}/monitor/rescent_runs/` + `?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }

  getSchedulerList(page: any, pageSize: any, search: any, status: any){
    return this.http.get<any>(`${environment.apiUrl}/schedule/schedule` + `?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``) + (status ? `&status=${status}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }

  saveScheduler(object: any){
    return this.http.post<any>(`${environment.apiUrl}/schedule/schedule`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  updateScheduler(id:any, object: any){
    return this.http.put<any>(`${environment.apiUrl}/schedule/schedule_update/${id}`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  deleteScheduler(id: any){
    return this.http.delete<any>(`${environment.apiUrl}/schedule/schedule_update/${id}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getSchedukerKpisData(){
    return this.http.get<any>(`${environment.apiUrl}/schedule/kpis/`, { headers: this.buildHeaders(this.accessToken) });
  }

  getScheduler(id: any){
    return this.http.get<any>(`${environment.apiUrl}/schedule/ScheduleDetail/${id}`, { headers: this.buildHeaders(this.accessToken) });
  }

  getUpcommingRuns(page: any, pageSize: any, search: any){
    return this.http.get<any>(`${environment.apiUrl}/schedule/upcoming_runs/` + `?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }

  changeSchedulerStatus(object: any){
    return this.http.patch<any>(`${environment.apiUrl}/schedule/status_Update/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getRemoteServerFiles(object:any){
    return this.http.post<any>(`${environment.apiUrl}/flowboard/server_files/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getRemoteServerFileData(object:any){
    return this.http.post<any>(`${environment.apiUrl}/flowboard/file_schema/`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  setEmbeddedScriptData(object:any){
    return this.http.post<any>(`${environment.apiUrl}/authentication/oauth2/application`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getEmbeddedScriptData() {
    return this.http.get<any>(`${environment.apiUrl}/authentication/oauth2/application`, { headers: this.buildHeaders(this.accessToken) });
  }

  validateEmbeddedScriptData(object:any) {
    return this.http.post<any>(`${environment.apiUrl}/authentication/validate/client`, object, { headers: this.buildHeaders(this.accessToken) });
  }

  getPermissionsList(){
    return this.http.get<any>(`${environment.apiUrl}/authentication/user`, { headers: this.buildHeaders(this.accessToken) });
  }

  // Airflow API
  airflowToken: string | null = '';
  username: string = '';

  getHeaders(): Observable<HttpHeaders> {
    const token = this.getStoredAirflowToken();
    // const token = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlzcyI6W10sImF1ZCI6ImFwYWNoZS1haXJmbG93IiwibmJmIjoxNzU5MTMzODI5LCJleHAiOjE3NTkyMjAyMjksImlhdCI6MTc1OTEzMzgyOX0.02JT5qbP7p0Ru2ennWynAWoh2o4irACTzvi8C4dBr3nCWQ-hqfdtHG24rQCfI9vC2EzWJaOQQKcChIHIE3AL3w';
    if (token) {
      return of(this.buildHeaders(token));
    } else {
      return this.getAirFlowApiToken().pipe(
        tap(res => this.storeAirflowToken(res.token)),
        map(res => this.buildHeaders(res.token))
      );
    }
  }

  private buildHeaders(token: string) {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    });
    return headers;
  }


  getUserName() {
    const usernameItem = localStorage.getItem('username');
    const usernameObj = usernameItem ? JSON.parse(usernameItem ?? '') : null;
    this.username = usernameObj?.userName ?? '';
  }

  getAirFlowApiToken() {
    return this.http.get<any>(`${environment.apiUrl}/monitor/airflow_token/`);
  }

  storeAirflowToken(token: string) {
    localStorage.setItem('airflowToken', token);
  }

  getStoredAirflowToken(): string | null {
    return localStorage.getItem('airflowToken');
  }

  clearAirflowToken() {
    localStorage.removeItem('airflowToken');
  }

  private retryWithTokenRefresh<T>(requestFn: () => Observable<T>): Observable<T> {
    return requestFn().pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.getAirFlowApiToken().pipe(
            switchMap(res => {
              const newToken = res.token;
              this.storeAirflowToken(newToken);
              return requestFn();
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  //monitor List
  getDags(limit: number, pageNo: number, searchTerm: string) {
    const offset = (pageNo - 1) * limit;
    this.getUserName();
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags?limit=${limit}&offset=${offset}&dag_id_pattern=${searchTerm}&tags=${this.username}&order_by=last_run_start_date`))
  }

  //sidebar tasks runs data
  getRunAndTaskStatus(dagId: any, limit: number) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/ui/grid/${dagId}?limit=${limit}&order_by=-run_after`))
  }

  //overview header data
  getRecentDagRuns(dagId: any) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/ui/dags/recent_dag_runs?dag_ids=${dagId}`))
  }

  //dag runs data
  getDagRuns(dagId: string, limit: number, cuurentPage: number, state: string, runType: string, orderBy: string) {
    const offset = (cuurentPage - 1) * limit;
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags/${dagId}/dagRuns?limit=${limit}&offset=${offset}&order_by=${orderBy}` + (state ? `&state=${state}` : ``) + (runType ? `&run_type=${runType}` : ``)))
  }

  //tasks data
  getDagTasks(dagId: string) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags/${dagId}/tasks`))
  }

  //task List data
  getTaskInstancesList(dagId: string, runId: string, taskId: string) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags/${dagId}/dagRuns/${runId}/taskInstances?task_id=${taskId}&order_by=-run_after&limit=14`))
  }

  //task runs status and duration data
  getTaskInstances(dagId: string, runId: string) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags/${dagId}/dagRuns/${runId}/taskInstances`))
  }

  //task and logs headers data
  getTasksHeadersData(dagId: string, runId: string) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags/${dagId}/dagRuns/${runId}`))
  }

  //task logs data
  getLogsOfTaskInstance(dagId: string, runId: string, taskId: string) {
    return this.retryWithTokenRefresh(() => this.http.get(`${environment.airflowApiUrl}/api/v2/dags/${dagId}/dagRuns/${runId}/taskInstances/${taskId}/logs/1?map_index=-1`))
  }
}