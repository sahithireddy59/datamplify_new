// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
export const environment = {
  // production: true,
  firebase: {
    apiKey: "***************************************",
    authDomain: "************************",
    projectId: "***********************************",
    storageBucket: "************************",
    messagingSenderId: "*********************",
    appId: "*******************************************",
    measurementId: "*********************"
  },
  production: false,
    apiUrl: 'http://127.0.0.1:8000/api/v1',
    airflowApiUrl: 'http://127.0.0.1:8081',
    //datamplify dev -- local
    //datamplify dev -- public
    //apiUrl: 'http://138.252.68.41:80/v1'
    //datamplify dev -- private
    // apiUrl: 'http://172.16.17.158:80/v1'
    //datamplify QA
    // apiUrl: 'https://api.qa.datamplify.ai/v1',
    // airflowApiUrl: 'http://138.252.68.46:8080',
};


/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
