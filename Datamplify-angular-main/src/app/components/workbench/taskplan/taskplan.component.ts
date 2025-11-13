import { Component, ElementRef, ViewChild } from '@angular/core';
import { NgbDropdown, NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import Drawflow from 'drawflow';
import { NgSelectModule } from '@ng-select/ng-select';
import { ToastrService } from 'ngx-toastr';
import { WorkbenchService } from '../workbench.service';
import { FormsModule } from '@angular/forms';
import { LoaderService } from '../../../shared/services/loader.service';
import { ActivatedRoute, Router } from '@angular/router';
import { EtlLoggerViewComponent } from '../etl-logger-view/etl-logger-view.component';
import { DataFlowSearchFilterPipe } from '../../../shared/pipes/data-flow-search-filter.pipe';
import { ResizableTopDirective } from '../../../shared/directives/resizable-top.directive';
import { SharedService } from '../../../shared/services/shared.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-taskplan',
  standalone: true,
  imports: [NgbModule, CommonModule, NgSelectModule, FormsModule, EtlLoggerViewComponent, DataFlowSearchFilterPipe, ResizableTopDirective],
  templateUrl: './taskplan.component.html',
  styleUrl: './taskplan.component.scss'
})
export class TaskplanComponent {
  drawflow: any;
  nodeToAdd: string = '';
  isOpen: boolean = true;
  active = 1;
  isNodeSelected: boolean = false;
  selectedNode: any;
  modal: any;
  dataFlowOptions: any[] = [];
  selectedDataFlow: any = null;
  dataObjectOptions: [] = [];
  posX: any;
  posY: any;
  tableTabId: number = 1;
  tableTypeTabId: number = 1;
  nodeTypeCounts: { [key: string]: number } = {};
  etlName: string = '';
  jobFlowId!: string;
  nodeName: string = '';
  isRunEnable: boolean = false;
  objectType: string = 'select';
  jobFlowStatus: any[] = [];
  runId: string = '';
  nodeLogs: any[] = [];
  pollingInterval: any;
  currentNodeColumns: any[] = [];
  logs: any = '';
  isLogShow: boolean = false;
  selectedGroupAttrs: any[] = [];
  groupAttributesList: any[] = [];
  allChecked: boolean = false;
  isSourceClicked: boolean = false;
  isRefrshEnable: boolean = false;
  jobFlowRunStatus: string = '';
  expression: string = '';
  selectedField: any = {};
  groupedColumns: any = {};
  selectedGroup: any = '';
  selectedColumn: any = {};
  selectedIndex: number = -1;
  isCanvasSelected: boolean = false;
  canvasData: any = { parameters: [], sqlParameters: [] };
  isParameter: boolean = false;
  isSQLParameter: boolean = false;
  sourceSearchTerm: string = '';
  groupSearchTerm: string = '';
  attributeSearchTerm: string = '';
  parameterSearchTerm: string = '';
  expEditorSearchTerm: string = '';
  attrSelectionSearchTerm: string = '';
  selectedSourceAttributeIndex: number | null = null;
  selectedGroupAttributeIndex: number | null = null;
  selectedAttributeIndex: number | null = null;
  isCollapsed = false;
  dataPointOptions: any[] = [];
  serverOptions: any[] = [];
  selectedDataPoint: any = null;
  isDataPointChange: boolean = false;
  srcConnections: any[] = [];
  transformations: any[] = [];
  flowboardParams: any[] = [];
  flowboardSqlParams: any[] = [];
  isTaskCommand: boolean = false;
  isDbCommand: boolean = false;
  isLoopCommand: boolean = false;
  isTo: boolean = false;
  isCC: boolean = false;
  isSubject: boolean = false;
  isMessage: boolean = false;
  dataPointPopUpFrom: string = '';
  expEditorAddType: string = 'parameters';
  taskId: string = '';
  functionGroupType: { key: string; value: string }[] = [
    { key: 'All Functions', value: 'allFunctions' },
    { key: 'Analytical', value: 'analytical' },
    { key: 'Array Functions', value: 'arrayFunctions' },
    { key: 'Date and Time Functions', value: 'dateAndTimeFunctions' },
    { key: 'Math Functions', value: 'mathFunctions' },
    { key: 'String Functions', value: 'stringFunctions' },
    { key: 'conditional', value: 'conditional' }
  ];
  allFunctions: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "AVG", value: "AVG() OVER (PARTITION BY ORDER BY  )", syntax: "AVG(value_expression) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "COUNT", value: "COUNT() OVER (PARTITION BY ORDER BY  )", syntax: "COUNT(value_expression) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "DENSE_RANK", value: "DENSE_RANK() OVER (PARTITION BY ORDER BY  )", syntax: "DENSE_RANK() OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER (< partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "FIRST_VALUE", value: "FIRST_VALUE() OVER (PARTITION BY ORDER BY  )", syntax: "FIRST_VALUE(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func( value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )[[frame_spec_clause]] )Func --] First_Value Or Last_Value [value_expression] --] Column references[partition_by_clause] --] PARTITION BY [value_expression] [...] [order_by_clause] --] ORDER BY [value_expression] [asc | desc] [nulls first|last] [...] [frame_spec_clause] --] [frame_extent] [[exclusion clause]] [frame_extent] --] ROWS UNBOUNDED PRECEDING |ROWS [constant] PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE [constant] PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| [constant] PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | [constant] FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| [constant] PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | [constant] FOLLOWING | CURRENT ROW [exclusion_clause] --] EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "LAG", value: "LAG() OVER (PARTITION BY ORDER BY  )", syntax: "LAG([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- Lead Or Lag[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression][partition_by_clause]--ORDER BY [value_expression] [asc | desc] [nulls first|last] [ ...]" },
    { key: "LAST_VALUE", value: "LAST_VALUE() OVER (PARTITION BY ORDER BY  )", syntax: "LAST_VALUE(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func(value_expression [IGNORE NULLS]) OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- First_Value Or Last_Value[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression" },
    { key: "LEAD", value: "LEAD() OVER (PARTITION BY ORDER BY  )", syntax: "LEAD([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- Lead Or Lag[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression][partition_by_clause]-- ORDER BY [value_expression] [asc | desc] [nulls first|last] [ ...]" },
    { key: "MAX", value: "MAX()OVER (PARTITION BY ORDER BY  )", syntax: "MAX([value_expression]) OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "character varying Or Number", description: "Func(value_expression [IGNORE NULLS])OVER( < partition_by_clause > < order_by_clause >[< frame_spec_clause >] )Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "MIN", value: "MIN() OVER (PARTITION BY ORDER BY  )", syntax: "MIN([value_expression]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "character varying Or Number", description: "Func(value_expression [IGNORE NULLS]) OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "NTILE", value: "NTILE() OVER (PARTITION BY ORDER BY  )", syntax: "NTILE()OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or functiontype_Number[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression][partition_by_clause] -- PARTITION BY value_expression [, ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls [first|last]] [, ...]" },
    { key: "PERCENT_RANK", value: "PERCENT_RANK() OVER (PARTITION BY ORDER BY  )", syntax: "PERCENT_RANK(~~) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "RANK", value: "RANK() OVER (PARTITION BY ORDER BY  )", syntax: "RANK(~~) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "ROW_NUMBER", value: "ROW_NUMBER() OVER (PARTITION BY ORDER BY  )", syntax: "ROW_NUMBER(~~) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "STDDEV", value: "STDDEV() OVER (PARTITION BY ORDER BY  )", syntax: "STDDEV([value_expression]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "VARIANCE", value: "VARIANCE() OVER (PARTITION BY ORDER BY  )", syntax: "VARIANCE([value_expression])OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func( value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },

    { key: "ARRAY_APPEND", value: "ARRAY_APPEND()", syntax: "ARRAY_APPEND(anyarray, anyelement)", returnType: "AnyArray", description: "ARRAY_APPEND" },
    { key: "ARRAY_CAT", value: "ARRAY_CAT()", syntax: "ARRAY_CAT(anyarray, anyarray)", returnType: "AnyArray", description: "Append an element to the end of an array" },
    { key: "ARRAY_DIMS", value: "ARRAY_DIMS()", syntax: "ARRAY_DIMS(anyarray)", returnType: "Text", description: "returns a text representation of array's dimensions" },
    { key: "ARRAY_LOWER", value: "ARRAY_LOWER()", syntax: "ARRAY_LOWER(anyarray, int)", returnType: "Number", description: "returns lower bound of the requested array dimension" },
    { key: "ARRAY_PREPEND", value: "ARRAY_PREPEND()", syntax: "ARRAY_PREPEND(anyelement, anyarray)", returnType: "AnyArray", description: "append an element to the beginning of an array" },
    { key: "ARRAY_TO_STRING", value: "ARRAY_TO_STRING()", syntax: "ARRAY_TO_STRING(anyarray, text)", returnType: "Text", description: "concatenates array elements using provided delimiter" },
    { key: "ARRAY_UPPER", value: "ARRAY_UPPER()", syntax: "ARRAY_UPPER(anyarray, int)", returnType: "Number", description: "returns upper bound of the requested array dimension" },
    { key: "STRING_TO_ARRAY", value: "STRING_TO_ARRAY()", syntax: "STRING_TO_ARRAY(text, text)", returnType: "Text[]", description: "splits string into array elements using provided delimiter" },

    { key: "AGE", value: "AGE()", syntax: "AGE(timestamp, timestamp)", returnType: "Interval", description: `Subtract arguments, producing a "symbolic" result that uses years and months . Ex: age(timestamp '2001-04-10', timestamp '1957-06-13')` },
    { key: "CLOCK_TIMESTAMP", value: "CLOCK_TIMESTAMP", syntax: "CLOCK_TIMESTAMP", returnType: "Timestamp with Time zone", description: "Current date and time (changes during statement execution)" },
    { key: "CURRENT_DATE", value: "CURRENT_DATE", syntax: "CURRENT_DATE", returnType: "date", description: "date" },
    { key: "CURRENT_TIME", value: "CURRENT_TIME", syntax: "CURRENT_TIME", returnType: "Time with Time zone", description: "Current time of day" },
    { key: "CURRENT_TIMESTAMP", value: "CURRENT_TIMESTAMP", syntax: "CURRENT_TIMESTAMP", returnType: "Time with Time zone", description: "Current date and time" },
    { key: "DATE_PART", value: "DATE_PART()", syntax: "DATE_PART(text, timestamp)", returnType: "Double precision", description: "Get subfield Ex: date_part('month', interval '2 years 3 months')" },
    { key: "DATE_TRUNC", value: "DATE_TRUNC()", syntax: "DATE_TRUNC(text, timestamp)", returnType: "Timestamp", description: "Truncate to specified precision . EX: date_trunc('hour', timestamp '2001-02-16 20:38:40')" },
    { key: "EXTRACT", value: "EXTRACT(FROM)", syntax: "EXTRACT(character-value(s)(Field Name) FROM date_time-value)", returnType: "Number", description: "Extracts a numeric datetime or time zone field from a datetime or interval value. Feild Description epoch The number of seconds since 1970-01-01 00:00:00-00 The value can be positive or negative. year/years The year field, such as 2007 quarter The quarter of the year (1 to 4) that the specified day is in. month/months The number of the month within the year, from 1 to 12. week The number of the week of the year (1-53) that the specified day is in. day/days The day of the month, from 1 to 31. dow The day of the week, from 1 (Sunday) to 7 (Saturday). doy The day of the year, from 1 to 366. hour/hours The hour of the day, from 0 to 23. minute/minutes The minute of the hour, from 0 to 59. second/seconds The second or the minute, from 0 to 59 millisecond/milliseconds The seconds field, including fractional parts, multiplied by 1000. Note that this includes full seconds. microsecond/microseconds The microsecond field, including fractional parts, multiplied by 1000000. Note that this includes full seconds." },
    { key: "ISFINITE", value: "ISFINITE()", syntax: "ISFINITE(timestamp)", returnType: "Boolean", description: "Get subfield. Ex: isfinite(timestamp '2001-02-16 21:28:30')" },
    { key: "JUSTIFY_DAYS", value: "JUSTIFY_DAYS()", syntax: "JUSTIFY_DAYS(interval)", returnType: "Interval", description: " Adjust interval so 30-day time periods are represented as months. Ex: justify_days(interval '30 days')" },
    { key: "JUSTIFY_HOURS", value: "JUSTIFY_HOURS()", syntax: "JUSTIFY_HOURS(interval)", returnType: "Interval", description: "Adjust interval so 24-hour time periods are represented as days Ex: justify_hours(interval '24 hours')" },
    { key: "JUSTIFY_INTERVAL", value: "JUSTIFY_INTERVAL()", syntax: "JUSTIFY_INTERVAL(interval)", returnType: "Interval", description: "Adjust interval using justify_days and justify_hours, with additional sign adjustments. Ex: justify_interval(interval '24 hours')" },
    { key: "LOCALTIME", value: "LOCALTIME", syntax: "LOCALTIME", returnType: "Time", description: "Current time of day. Ex: localtime" },
    { key: "LOCALTIMESTAMP", value: "LOCALTIMESTAMP", syntax: "LOCALTIMESTAMP", returnType: "Timestamp", description: "Current date and time." },
    { key: "NOW", value: "NOW()", syntax: "NOW()", returnType: "Timestamp with Time zone", description: "Current date and time" },
    { key: "STATEMENT_TIMESTAMP", value: "STATEMENT_TIMESTAMP()", syntax: "STATEMENT_TIMESTAMP()", returnType: "Timestamp with Time zone", description: "timestamp with time zone." },
    { key: "TIMEOFDAY", value: "TIMEOFDAY()", syntax: "TIMEOFDAY()", returnType: "Text", description: "Current date and time" },
    { key: "TO_DATE", value: "TO_DATE()", syntax: "TO_DATE(character-value(s),format)", returnType: "Date", description: "Converts a string to date. Ex: to_date(05 Dec 2000 , DD Mon YYYY )" },
    { key: "TO_TIMESTAMP", value: "TO_TIMESTAMP()", syntax: "TO_TIMESTAMP(character-value(s),format)", returnType: "Timestamp", description: "Converts a string to time stamp. Ex: to_timestamp(05 Dec 2000 , DD Mon YYYY )" },
    { key: "TRANSACTION_TIMESTAMP", value: "TRANSACTION_TIMESTAMP()", syntax: "TRANSACTION_TIMESTAMP()", returnType: "Timestamp with Time zone", description: "Current date and time" },

    { key: "ABS", value: "ABS()", syntax: "ABS(x)", returnType: "Number", description: "Return absolute value. Ex: abs(-17.4)" },
    { key: "CBRT", value: "CBRT()", syntax: "CBRT(dp)", returnType: "Number", description: "Returns CubeRoot Value. Ex: cbrt(27.0)" },
    { key: "CEIL", value: "CEIL()", syntax: "CEIL(dp or numeric)", returnType: "Number", description: "smallest integer not less than argument. Ex: ceil(-42.8)" },
    { key: "CEILING", value: "CEILING()", syntax: "CEILING(dp or numeric)", returnType: "Number", description: "smallest integer not less than argument (alias for ceil). Ex: ceiling(-95.3)" },
    { key: "DEGREES", value: "DEGREES()", syntax: "DEGREES(dp)", returnType: "Number", description: "Returns radians to degrees. Ex: degrees(0.5)" },
    { key: "EXP", value: "EXP()", syntax: "EXP(dp or numeric)", returnType: "Based on Input", description: "Returns exponential value. Ex: exp(1.0)" },
    { key: "FLOOR", value: "FLOOR()", syntax: "FLOOR(dp or numeric)", returnType: "Number", description: "Returns largest integer not greater than argument. Ex: floor(-42.8)" },
    { key: "LN", value: "LN()", syntax: "LN(dp or numeric)", returnType: "Number", description: "Returns Number Value. Ex: ln(2.0)" },
    { key: "LOG", value: "LOG()", syntax: "LOG(b numeric, x numeric)", returnType: "Number", description: "Returns Numeric Value. Ex: log(2.0, 64.0)" },
    { key: "MOD", value: "MOD()", syntax: "MOD(y, x)", returnType: "Number", description: "Returns remainder of y/x value. Ex: mod(9,4)" },
    { key: "PI", value: "PI()", syntax: "PI()", returnType: "Number", description: "Returns Number value. Ex: PI()" },
    { key: "POWER", value: "POWER()", syntax: "POWER(a numeric, b numeric)", returnType: "Number", description: "Returns a Number value. Ex: power(9.0, 3.0)" },
    { key: "RADIANS", value: "RADIANS()", syntax: "RADIANS(dp)", returnType: "Number", description: "Returns degrees to radians. Ex: radians(45.0)" },
    { key: "RANDOM", value: "RANDOM()", syntax: "RANDOM()", returnType: "Number", description: "Returns random value in the range 0.0. Ex: random()" },
    { key: "ROUND", value: "ROUND()", syntax: "ROUND(v numeric, s int)", returnType: "Number", description: " round to s decimal places, and Returns Numeric value. Ex: round(42.4382, 2)" },
    { key: "SETSEED", value: "SETSEED()", syntax: "SETSEED(dp)", returnType: "Number", description: "set seed for subsequent random() calls (value between 0 and 1.0). Ex: setseed(0.54823)" },
    { key: "SIGN", value: "SIGN()", syntax: "SIGN(dp or numeric)", returnType: "Number", description: "Returns Numeric value. Ex: sign(-8.4)" },
    { key: "SQRT", value: "SQRT()", syntax: "SQRT(dp or numeric)", returnType: "Number", description: "Returns square root value. Ex: sqrt(2.0)" },
    { key: "TRUNC", value: "TRUNC()", syntax: "TRUNC(v numeric, s int)", returnType: "Number", description: "Returns Numeric value truncate to s decimal places.Ex:trunc(42.4382, 2)" },
    { key: "WIDTH_BUCKET", value: "WIDTH_BUCKET()", syntax: "WIDTH_BUCKET(op numeric, b1 numeric, b2 numeric, count int)", returnType: "Number", description: "Returns Integer Value. Ex: width_bucket(5.35, 0.024, 10.06, 5)" },

    { key: "BIT_LENGTH", value: "BIT_LENGTH()", syntax: "BIT_LENGTH(string)", returnType: "Number", description: " Number of bits in string. Ex: bit_length('jose')" },
    { key: "BTRIM", value: "BTRIM()", syntax: "BTRIM(string text [, characters text])", returnType: "text", description: "Returns Text value. Ex: btrim('xyxtrimyyx', 'xy')" },
    { key: "CHAIR_LENGTH or CHARACTER_LENGTH", value: " CHAR_LENGTH(string) or CHARACTER_LENGTH(string)", syntax: "CHARACTER_LENGTH(string)", returnType: "Number", description: "Number of characters in string. Ex: char_length('jose')" },
    { key: "CHR", value: "CHR()", syntax: "CHR(int)", returnType: "text", description: "Returns Character with the given ASCII code. Ex: chr(65)" },
    { key: "CONVERT", value: "CONVERT()", syntax: "CONVERT(string text, [src_encoding name,] dest_encoding name)", returnType: "Text", description: "Returns Text value. Ex: convert( 'text_in_utf8', 'UTF8', 'LATIN1')" },
    { key: "DECODE", value: "DECODE()", syntax: "DECODE(string text, type text)", returnType: "String", description: "Decode binary data from string previously encoded with encode. Parameter type is same as in encode. Ex: decode('MTIzAAE=', 'base64')" },
    { key: "ENCODE", value: "ENCODE()", syntax: "ENCODE(data bytea, type text)", returnType: "Text", description: "Encode binary data to different representation,and returns Text value. Ex: encode( '123\\000\\001', 'base64')" },
    { key: "INITCAP", value: "INITCAP()", syntax: "INITCAP(string)", returnType: "Text", description: "Convert the first letter of each word to uppercase and the rest to lowercase.Returns text value. Ex: initcap('hi THOMAS')" },
    { key: "LENGTH", value: "LENGTH()", syntax: "LENGTH(string)", returnType: "Number", description: "Number of characters in string and Returns Interger Value. Ex: length('jose')" },
    { key: "LOWER", value: "LOWER()", syntax: "LOWER(string)", returnType: "Text", description: " Convert string to lower case. Ex: lower('TOM')" },
    { key: "LPAD", value: "LPAD()", syntax: "LPAD(string text, length int [, fill text])", returnType: "Text", description: "Fill up the string to length length by prepending the characters fill (a space by default).Returns Text value. Ex: lpad('hi', 5, 'xy')" },
    { key: "LTRIM", value: "LTRIM()", syntax: "LTRIM(string text [, characters text])", returnType: "Text", description: "Remove the longest string containing only characters from characters.Returns Text value. Ex: ltrim('zzzytrim', 'xyz')" },
    { key: "MD5", value: "MD5()", syntax: "MD5(string)", returnType: "Text", description: "returning the result in hexadecimal. Ex: md5('abc')" },
    { key: "OCTET_LENGTH", value: "OCTET_LENGTH()", syntax: "OCTET_LENGTH(string)", returnType: "Number", description: "Number of bytes in string. Ex: octet_length('jose')" },
    { key: "OVERLAY", value: "OVERLAY()", syntax: "OVERLAY(string placing string from int [for int])", returnType: "Text", description: "Replace substring. Ex: overlay('Txxxxas' placing 'hom' from 2 for 4)" },
    { key: "PG_CLIENT_ENCODING()", value: "PG_CLIENT_ENCODING()", syntax: "pg_client_encoding(string)", returnType: "name", description: "Current client encoding name. Ex: pg_client_encoding()" },
    { key: "POSITION", value: "POSITION()", syntax: "POSITION(substring in string)", returnType: "Number", description: "Location of specified substring. Ex: position('om' in 'Thomas')" },
    { key: "QUOTE_IDENT", value: "QUOTE_IDENT()", syntax: "QUOTE_IDENT(string)", returnType: "Text", description: "Return the given string suitably quoted to be used as an identifier in an SQL statement string. Ex: quote_ident('Foo bar')" },
    { key: "QUOTE_LITERAL", value: "QUOTE_LITERAL()", syntax: "QUOTE_LITERAL(string)", returnType: "Text", description: "Return the given string suitably quoted to be used as a string literal in an SQL statement string. Ex: quote_literal( 'O\'Reilly')" },
    { key: "REGEXP_REPLACE", value: "REGEXP_REPLACE()", syntax: "REGEXP_REPLACE(string text, pattern text, replacement text [,flags text])", returnType: "Text", description: "Replace substring matching POSIX regular expression. Ex: regexp_replace('Thomas', '.[mN]a.', 'M')" },
    { key: "REPEAT", value: "REPEAT()", syntax: "REPEAT(string text, number int)", returnType: "Text", description: "Repeat string the specified number of times. Ex: repeat('Pg', 4)" },
    { key: "REPLACE", value: "REPLACE()", syntax: "REPLACE(string text, from text, to text)", returnType: "Text", description: "Replace all occurrences in string of substring from with substring. Ex: replace( 'abcdefabcdef', 'cd', 'XX')" },
    { key: "RIGHT", value: "RIGHT()", syntax: "RIGHT(str text, n int)", returnType: "String", description: "Return last n characters in the string. When n is negative, return all but first |n| characters." },
    { key: "RPAD", value: "RPAD()", syntax: "RPAD(string text, length int [, fill text])", returnType: "Text", description: "Returns Text value. Ex: rpad('hi', 5, 'xy')" },
    { key: "RTRIM", value: "RTRIM()", syntax: "RTRIM(string text [, characters text])", returnType: "Text", description: "Remove the longest string containing only characters from characters. Ex: rtrim('trimxxxx', 'x')" },
    { key: "SPILT_PART", value: "SPILT_PART()", syntax: "SPLIT_PART(string text, delimiter text, field int)", returnType: "Text", description: "Split string on delimiter and return the given field (counting from one). Ex: split_part('abc~@~def~@~ghi', '~@~', 2" },
    { key: "STRPOS", value: "STRPOS()", syntax: "STRPOS(string, substring)", returnType: "Text", description: "Location of specified substring (same as position(substring in string), but note the reversed argument order). Ex: strpos('high', 'ig'" },
    { key: "SUBSTRING", value: "SUBSTRING()", syntax: "SUBSTRING(string [from int] [for int])", returnType: "Text", description: "Extract substring. Ex: substring('Thomas' from 2 for 3)" },
    { key: "TO_ASCII", value: "TO_ASCII()", syntax: "TO_ASCII(string text [, encoding text])", returnType: "Text", description: "Convert string to ASCII from another encoding. Ex: to_ascii('Karel'))" },
    { key: "TO_HEX", value: "TO_HEX()", syntax: "TO_HEX(number int or bigint", returnType: "Text", description: "Convert number to its equivalent hexadecimal representation. Ex: to_hex(2147483647)" },
    { key: "TRANSLATE", value: "TRANSLATE()", syntax: "TRANSLATE(string text, from text, to text)", returnType: "Text", description: "Any character in string that matches a character in the from set is replaced by the corresponding character in the to set. Ex: translate('12345', '14', 'ax')" },
    { key: "TRIM", value: "TRIM()", syntax: "TRIM([leading | trailing | both] [characters] from string)", returnType: "Text", description: "Remove the longest string containing only the characters (a space by default) from the start/end/both ends of the string. Ex: trim(both 'x' from 'xTomxx')" },
    { key: "UPPER", value: "UPPER()", syntax: "UPPER(string)", returnType: "Text", description: "Convert string to uppercase. Ex: upper('tom')" },
    { key: "string", value: "()", syntax: "string || string", returnType: "Text", description: "String concatenation. Ex: 'Post' || 'greSQL'" },

    { key: "CASE", value: "CASE [test-value]WHEN [comparand-value-1] THEN [result-1]WHEN [comparand-value-2] THEN [result-2]...WHEN [comparand-value-n] THEN [result-n]ELSE [default-result]END", syntax: "CASE [test-value]WHEN [comparand-value-1] THEN [result-1]WHEN [comparand-value-2] THEN [result-2]...WHEN [comparand-value-n] THEN [result-n]ELSE [default-result]ENDTest values, comparand values, and results can be expressions.", returnType: "Type is based on Result", description: "Evaluates a list of conditions and returns one of multiple possible result expressions." },
    { key: "CAST", value: "CAST()", syntax: "Cast ([value] as [data type])", returnType: "Type based on the data type", description: "use cast(value as datatype) to cast a data type from one type to another type. For example, you could convert any numeric data type (byteint, smallint, int, bigint, numeric/decimal, float, double) to any other numeric datatype. The value field can be a column or an expression. Ex: CASE a WHEN 1 THEN 'one' WHEN 2 THEN 'two' ELSE 'other' END" },
    { key: "COALESEC", value: "COALESEC()", syntax: "COALESCE(value [, ...])", returnType: "Number", description: "Returns the first of its arguments that is not null." },
    { key: "GREATEST", value: "GREATEST()", syntax: "GREATEST(int4 value1, int4 value2, ...)", returnType: "Number", description: "Returns the largest of the input values, up to a maximum of four (variable length lists arenot supported)." },
    { key: "LEAST", value: "LEAST()", syntax: "LEAST(int4 value1, int4 value2, ...)", returnType: "Number", description: "Returns the smallest of the input parameters, up to a maximum of four (variable lengthlists are not supported)." },
    { key: "NULLIF", value: "NULLIF()", syntax: "NULLIF(value1, value2)", returnType: "Number", description: "returns a null value if value1 and value2 are equal; otherwise it returns value1. Ex: NULLIF(102, 123)" }
  ];
  analytical: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "AVG", value: "AVG() OVER (PARTITION BY ORDER BY  )", syntax: "AVG(value_expression) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "COUNT", value: "COUNT() OVER (PARTITION BY ORDER BY  )", syntax: "COUNT(value_expression) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "DENSE_RANK", value: "DENSE_RANK() OVER (PARTITION BY ORDER BY  )", syntax: "DENSE_RANK() OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER (< partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "FIRST_VALUE", value: "FIRST_VALUE() OVER (PARTITION BY ORDER BY  )", syntax: "FIRST_VALUE(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func( value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )[[frame_spec_clause]] )Func --] First_Value Or Last_Value [value_expression] --] Column references[partition_by_clause] --] PARTITION BY [value_expression] [...] [order_by_clause] --] ORDER BY [value_expression] [asc | desc] [nulls first|last] [...] [frame_spec_clause] --] [frame_extent] [[exclusion clause]] [frame_extent] --] ROWS UNBOUNDED PRECEDING |ROWS [constant] PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE [constant] PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| [constant] PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | [constant] FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| [constant] PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | [constant] FOLLOWING | CURRENT ROW [exclusion_clause] --] EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "LAG", value: "LAG() OVER (PARTITION BY ORDER BY  )", syntax: "LAG([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- Lead Or Lag[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression][partition_by_clause]--ORDER BY [value_expression] [asc | desc] [nulls first|last] [ ...]" },
    { key: "LAST_VALUE", value: "LAST_VALUE() OVER (PARTITION BY ORDER BY  )", syntax: "LAST_VALUE(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func(value_expression [IGNORE NULLS]) OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- First_Value Or Last_Value[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression" },
    { key: "LEAD", value: "LEAD() OVER (PARTITION BY ORDER BY  )", syntax: "LEAD([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Based on expression (Any datatype is posisble)", description: "Func([value_expression], [[offset] [, [default]]]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- Lead Or Lag[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression][partition_by_clause]-- ORDER BY [value_expression] [asc | desc] [nulls first|last] [ ...]" },
    { key: "MAX", value: "MAX()OVER (PARTITION BY ORDER BY  )", syntax: "MAX([value_expression]) OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "character varying Or Number", description: "Func(value_expression [IGNORE NULLS])OVER( < partition_by_clause > < order_by_clause >[< frame_spec_clause >] )Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "MIN", value: "MIN() OVER (PARTITION BY ORDER BY  )", syntax: "MIN([value_expression]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "character varying Or Number", description: "Func(value_expression [IGNORE NULLS]) OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "NTILE", value: "NTILE() OVER (PARTITION BY ORDER BY  )", syntax: "NTILE()OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or functiontype_Number[value_expression] -- Column references[partition_by_clause] -- PARTITION BY [value_expression][partition_by_clause] -- PARTITION BY value_expression [, ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls [first|last]] [, ...]" },
    { key: "PERCENT_RANK", value: "PERCENT_RANK() OVER (PARTITION BY ORDER BY  )", syntax: "PERCENT_RANK(~~) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "RANK", value: "RANK() OVER (PARTITION BY ORDER BY  )", syntax: "RANK(~~) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "ROW_NUMBER", value: "ROW_NUMBER() OVER (PARTITION BY ORDER BY  )", syntax: "ROW_NUMBER(~~) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func()OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- Ntile,Dense_Rank,Percent_Rank,Cume_Rank, Rank Or Row_Number value_expression -- Column references partition_by_clause -- PARTITION BY value_expression partition_by_clause -- PARTITION BY value_expression [...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [...]" },
    { key: "STDDEV", value: "STDDEV() OVER (PARTITION BY ORDER BY  )", syntax: "STDDEV([value_expression]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func(value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] ) Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" },
    { key: "VARIANCE", value: "VARIANCE() OVER (PARTITION BY ORDER BY  )", syntax: "VARIANCE([value_expression])OVER( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )", returnType: "Number", description: "Func( value_expression [IGNORE NULLS]) OVER ( < partition_by_clause > < order_by_clause > [< frame_spec_clause >] )Func -- First_Value Or Last_Value value_expression -- Column references partition_by_clause -- PARTITION BY value_expression [ ...] order_by_clause -- ORDER BY value_expression [asc | desc] [nulls first|last] [ ...] frame_spec_clause -- frame_extent [exclusion clause] frame_extent -- ROWS UNBOUNDED PRECEDING |ROWS constant PRECEDING |ROWS CURRENT ROW |RANGE UNBOUNDED PRECEDING |RANGE constant PRECEDING |RANGE CURRENT ROW |ROWS BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW |RANGE BETWEEN UNBOUNDED PRECEDING| constant PRECEDING | CURRENT ROW AND UNBOUNDED FOLLOWING | constant FOLLOWING | CURRENT ROW exclusion_clause -- EXCLUDE CURRENT ROW | EXCLUDE TIES | EXCLUDE GROUP | EXCLUDE NO OTHERS" }
  ];
  arrayFunctions: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "ARRAY_APPEND", value: "ARRAY_APPEND()", syntax: "ARRAY_APPEND(anyarray, anyelement)", returnType: "AnyArray", description: "ARRAY_APPEND" },
    { key: "ARRAY_CAT", value: "ARRAY_CAT()", syntax: "ARRAY_CAT(anyarray, anyarray)", returnType: "AnyArray", description: "Append an element to the end of an array" },
    { key: "ARRAY_DIMS", value: "ARRAY_DIMS()", syntax: "ARRAY_DIMS(anyarray)", returnType: "Text", description: "returns a text representation of array's dimensions" },
    { key: "ARRAY_LOWER", value: "ARRAY_LOWER()", syntax: "ARRAY_LOWER(anyarray, int)", returnType: "Number", description: "returns lower bound of the requested array dimension" },
    { key: "ARRAY_PREPEND", value: "ARRAY_PREPEND()", syntax: "ARRAY_PREPEND(anyelement, anyarray)", returnType: "AnyArray", description: "append an element to the beginning of an array" },
    { key: "ARRAY_TO_STRING", value: "ARRAY_TO_STRING()", syntax: "ARRAY_TO_STRING(anyarray, text)", returnType: "Text", description: "concatenates array elements using provided delimiter" },
    { key: "ARRAY_UPPER", value: "ARRAY_UPPER()", syntax: "ARRAY_UPPER(anyarray, int)", returnType: "Number", description: "returns upper bound of the requested array dimension" },
    { key: "STRING_TO_ARRAY", value: "STRING_TO_ARRAY()", syntax: "STRING_TO_ARRAY(text, text)", returnType: "Text[]", description: "splits string into array elements using provided delimiter" }
  ];
  dateAndTimeFunctions: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "AGE", value: "AGE()", syntax: "AGE(timestamp, timestamp)", returnType: "Interval", description: `Subtract arguments, producing a "symbolic" result that uses years and months . Ex: age(timestamp '2001-04-10', timestamp '1957-06-13')` },
    { key: "CLOCK_TIMESTAMP", value: "CLOCK_TIMESTAMP", syntax: "CLOCK_TIMESTAMP", returnType: "Timestamp with Time zone", description: "Current date and time (changes during statement execution)" },
    { key: "CURRENT_DATE", value: "CURRENT_DATE", syntax: "CURRENT_DATE", returnType: "date", description: "date" },
    { key: "CURRENT_TIME", value: "CURRENT_TIME", syntax: "CURRENT_TIME", returnType: "Time with Time zone", description: "Current time of day" },
    { key: "CURRENT_TIMESTAMP", value: "CURRENT_TIMESTAMP", syntax: "CURRENT_TIMESTAMP", returnType: "Time with Time zone", description: "Current date and time" },
    { key: "DATE_PART", value: "DATE_PART()", syntax: "DATE_PART(text, timestamp)", returnType: "Double precision", description: "Get subfield Ex: date_part('month', interval '2 years 3 months')" },
    { key: "DATE_TRUNC", value: "DATE_TRUNC()", syntax: "DATE_TRUNC(text, timestamp)", returnType: "Timestamp", description: "Truncate to specified precision . EX: date_trunc('hour', timestamp '2001-02-16 20:38:40')" },
    { key: "EXTRACT", value: "EXTRACT(FROM)", syntax: "EXTRACT(character-value(s)(Field Name) FROM date_time-value)", returnType: "Number", description: "Extracts a numeric datetime or time zone field from a datetime or interval value. Feild Description epoch The number of seconds since 1970-01-01 00:00:00-00 The value can be positive or negative. year/years The year field, such as 2007 quarter The quarter of the year (1 to 4) that the specified day is in. month/months The number of the month within the year, from 1 to 12. week The number of the week of the year (1-53) that the specified day is in. day/days The day of the month, from 1 to 31. dow The day of the week, from 1 (Sunday) to 7 (Saturday). doy The day of the year, from 1 to 366. hour/hours The hour of the day, from 0 to 23. minute/minutes The minute of the hour, from 0 to 59. second/seconds The second or the minute, from 0 to 59 millisecond/milliseconds The seconds field, including fractional parts, multiplied by 1000. Note that this includes full seconds. microsecond/microseconds The microsecond field, including fractional parts, multiplied by 1000000. Note that this includes full seconds." },
    { key: "ISFINITE", value: "ISFINITE()", syntax: "ISFINITE(timestamp)", returnType: "Boolean", description: "Get subfield. Ex: isfinite(timestamp '2001-02-16 21:28:30')" },
    { key: "JUSTIFY_DAYS", value: "JUSTIFY_DAYS()", syntax: "JUSTIFY_DAYS(interval)", returnType: "Interval", description: " Adjust interval so 30-day time periods are represented as months. Ex: justify_days(interval '30 days')" },
    { key: "JUSTIFY_HOURS", value: "JUSTIFY_HOURS()", syntax: "JUSTIFY_HOURS(interval)", returnType: "Interval", description: "Adjust interval so 24-hour time periods are represented as days Ex: justify_hours(interval '24 hours')" },
    { key: "JUSTIFY_INTERVAL", value: "JUSTIFY_INTERVAL()", syntax: "JUSTIFY_INTERVAL(interval)", returnType: "Interval", description: "Adjust interval using justify_days and justify_hours, with additional sign adjustments. Ex: justify_interval(interval '24 hours')" },
    { key: "LOCALTIME", value: "LOCALTIME", syntax: "LOCALTIME", returnType: "Time", description: "Current time of day. Ex: localtime" },
    { key: "LOCALTIMESTAMP", value: "LOCALTIMESTAMP", syntax: "LOCALTIMESTAMP", returnType: "Timestamp", description: "Current date and time." },
    { key: "NOW", value: "NOW()", syntax: "NOW()", returnType: "Timestamp with Time zone", description: "Current date and time" },
    { key: "STATEMENT_TIMESTAMP", value: "STATEMENT_TIMESTAMP()", syntax: "STATEMENT_TIMESTAMP()", returnType: "Timestamp with Time zone", description: "timestamp with time zone." },
    { key: "TIMEOFDAY", value: "TIMEOFDAY()", syntax: "TIMEOFDAY()", returnType: "Text", description: "Current date and time" },
    { key: "TO_DATE", value: "TO_DATE()", syntax: "TO_DATE(character-value(s),format)", returnType: "Date", description: "Converts a string to date. Ex: to_date(05 Dec 2000 , DD Mon YYYY )" },
    { key: "TO_TIMESTAMP", value: "TO_TIMESTAMP()", syntax: "TO_TIMESTAMP(character-value(s),format)", returnType: "Timestamp", description: "Converts a string to time stamp. Ex: to_timestamp(05 Dec 2000 , DD Mon YYYY )" },
    { key: "TRANSACTION_TIMESTAMP", value: "TRANSACTION_TIMESTAMP()", syntax: "TRANSACTION_TIMESTAMP()", returnType: "Timestamp with Time zone", description: "Current date and time" }
  ];
  mathFunctions: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "ABS", value: "ABS()", syntax: "ABS(x)", returnType: "Number", description: "Return absolute value. Ex: abs(-17.4)" },
    { key: "CBRT", value: "CBRT()", syntax: "CBRT(dp)", returnType: "Number", description: "Returns CubeRoot Value. Ex: cbrt(27.0)" },
    { key: "CEIL", value: "CEIL()", syntax: "CEIL(dp or numeric)", returnType: "Number", description: "smallest integer not less than argument. Ex: ceil(-42.8)" },
    { key: "CEILING", value: "CEILING()", syntax: "CEILING(dp or numeric)", returnType: "Number", description: "smallest integer not less than argument (alias for ceil). Ex: ceiling(-95.3)" },
    { key: "DEGREES", value: "DEGREES()", syntax: "DEGREES(dp)", returnType: "Number", description: "Returns radians to degrees. Ex: degrees(0.5)" },
    { key: "EXP", value: "EXP()", syntax: "EXP(dp or numeric)", returnType: "Based on Input", description: "Returns exponential value. Ex: exp(1.0)" },
    { key: "FLOOR", value: "FLOOR()", syntax: "FLOOR(dp or numeric)", returnType: "Number", description: "Returns largest integer not greater than argument. Ex: floor(-42.8)" },
    { key: "LN", value: "LN()", syntax: "LN(dp or numeric)", returnType: "Number", description: "Returns Number Value. Ex: ln(2.0)" },
    { key: "LOG", value: "LOG()", syntax: "LOG(b numeric, x numeric)", returnType: "Number", description: "Returns Numeric Value. Ex: log(2.0, 64.0)" },
    { key: "MOD", value: "MOD()", syntax: "MOD(y, x)", returnType: "Number", description: "Returns remainder of y/x value. Ex: mod(9,4)" },
    { key: "PI", value: "PI()", syntax: "PI()", returnType: "Number", description: "Returns Number value. Ex: PI()" },
    { key: "POWER", value: "POWER()", syntax: "POWER(a numeric, b numeric)", returnType: "Number", description: "Returns a Number value. Ex: power(9.0, 3.0)" },
    { key: "RADIANS", value: "RADIANS()", syntax: "RADIANS(dp)", returnType: "Number", description: "Returns degrees to radians. Ex: radians(45.0)" },
    { key: "RANDOM", value: "RANDOM()", syntax: "RANDOM()", returnType: "Number", description: "Returns random value in the range 0.0. Ex: random()" },
    { key: "ROUND", value: "ROUND()", syntax: "ROUND(v numeric, s int)", returnType: "Number", description: " round to s decimal places, and Returns Numeric value. Ex: round(42.4382, 2)" },
    { key: "SETSEED", value: "SETSEED()", syntax: "SETSEED(dp)", returnType: "Number", description: "set seed for subsequent random() calls (value between 0 and 1.0). Ex: setseed(0.54823)" },
    { key: "SIGN", value: "SIGN()", syntax: "SIGN(dp or numeric)", returnType: "Number", description: "Returns Numeric value. Ex: sign(-8.4)" },
    { key: "SQRT", value: "SQRT()", syntax: "SQRT(dp or numeric)", returnType: "Number", description: "Returns square root value. Ex: sqrt(2.0)" },
    { key: "TRUNC", value: "TRUNC()", syntax: "TRUNC(v numeric, s int)", returnType: "Number", description: "Returns Numeric value truncate to s decimal places.Ex:trunc(42.4382, 2)" },
    { key: "WIDTH_BUCKET", value: "WIDTH_BUCKET()", syntax: "WIDTH_BUCKET(op numeric, b1 numeric, b2 numeric, count int)", returnType: "Number", description: "Returns Integer Value. Ex: width_bucket(5.35, 0.024, 10.06, 5)" }
  ];
  stringFunctions: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "BIT_LENGTH", value: "BIT_LENGTH()", syntax: "BIT_LENGTH(string)", returnType: "Number", description: " Number of bits in string. Ex: bit_length('jose')" },
    { key: "BTRIM", value: "BTRIM()", syntax: "BTRIM(string text [, characters text])", returnType: "text", description: "Returns Text value. Ex: btrim('xyxtrimyyx', 'xy')" },
    { key: "CHAIR_LENGTH or CHARACTER_LENGTH", value: " CHAR_LENGTH(string) or CHARACTER_LENGTH(string)", syntax: "CHARACTER_LENGTH(string)", returnType: "Number", description: "Number of characters in string. Ex: char_length('jose')" },
    { key: "CHR", value: "CHR()", syntax: "CHR(int)", returnType: "text", description: "Returns Character with the given ASCII code. Ex: chr(65)" },
    { key: "CONVERT", value: "CONVERT()", syntax: "CONVERT(string text, [src_encoding name,] dest_encoding name)", returnType: "Text", description: "Returns Text value. Ex: convert( 'text_in_utf8', 'UTF8', 'LATIN1')" },
    { key: "DECODE", value: "DECODE()", syntax: "DECODE(string text, type text)", returnType: "String", description: "Decode binary data from string previously encoded with encode. Parameter type is same as in encode. Ex: decode('MTIzAAE=', 'base64')" },
    { key: "ENCODE", value: "ENCODE()", syntax: "ENCODE(data bytea, type text)", returnType: "Text", description: "Encode binary data to different representation,and returns Text value. Ex: encode( '123\\000\\001', 'base64')" },
    { key: "INITCAP", value: "INITCAP()", syntax: "INITCAP(string)", returnType: "Text", description: "Convert the first letter of each word to uppercase and the rest to lowercase.Returns text value. Ex: initcap('hi THOMAS')" },
    { key: "LENGTH", value: "LENGTH()", syntax: "LENGTH(string)", returnType: "Number", description: "Number of characters in string and Returns Interger Value. Ex: length('jose')" },
    { key: "LOWER", value: "LOWER()", syntax: "LOWER(string)", returnType: "Text", description: " Convert string to lower case. Ex: lower('TOM')" },
    { key: "LPAD", value: "LPAD()", syntax: "LPAD(string text, length int [, fill text])", returnType: "Text", description: "Fill up the string to length length by prepending the characters fill (a space by default).Returns Text value. Ex: lpad('hi', 5, 'xy')" },
    { key: "LTRIM", value: "LTRIM()", syntax: "LTRIM(string text [, characters text])", returnType: "Text", description: "Remove the longest string containing only characters from characters.Returns Text value. Ex: ltrim('zzzytrim', 'xyz')" },
    { key: "MD5", value: "MD5()", syntax: "MD5(string)", returnType: "Text", description: "returning the result in hexadecimal. Ex: md5('abc')" },
    { key: "OCTET_LENGTH", value: "OCTET_LENGTH()", syntax: "OCTET_LENGTH(string)", returnType: "Number", description: "Number of bytes in string. Ex: octet_length('jose')" },
    { key: "OVERLAY", value: "OVERLAY()", syntax: "OVERLAY(string placing string from int [for int])", returnType: "Text", description: "Replace substring. Ex: overlay('Txxxxas' placing 'hom' from 2 for 4)" },
    { key: "PG_CLIENT_ENCODING()", value: "PG_CLIENT_ENCODING()", syntax: "pg_client_encoding(string)", returnType: "name", description: "Current client encoding name. Ex: pg_client_encoding()" },
    { key: "POSITION", value: "POSITION()", syntax: "POSITION(substring in string)", returnType: "Number", description: "Location of specified substring. Ex: position('om' in 'Thomas')" },
    { key: "QUOTE_IDENT", value: "QUOTE_IDENT()", syntax: "QUOTE_IDENT(string)", returnType: "Text", description: "Return the given string suitably quoted to be used as an identifier in an SQL statement string. Ex: quote_ident('Foo bar')" },
    { key: "QUOTE_LITERAL", value: "QUOTE_LITERAL()", syntax: "QUOTE_LITERAL(string)", returnType: "Text", description: "Return the given string suitably quoted to be used as a string literal in an SQL statement string. Ex: quote_literal( 'O\'Reilly')" },
    { key: "REGEXP_REPLACE", value: "REGEXP_REPLACE()", syntax: "REGEXP_REPLACE(string text, pattern text, replacement text [,flags text])", returnType: "Text", description: "Replace substring matching POSIX regular expression. Ex: regexp_replace('Thomas', '.[mN]a.', 'M')" },
    { key: "REPEAT", value: "REPEAT()", syntax: "REPEAT(string text, number int)", returnType: "Text", description: "Repeat string the specified number of times. Ex: repeat('Pg', 4)" },
    { key: "REPLACE", value: "REPLACE()", syntax: "REPLACE(string text, from text, to text)", returnType: "Text", description: "Replace all occurrences in string of substring from with substring. Ex: replace( 'abcdefabcdef', 'cd', 'XX')" },
    { key: "RIGHT", value: "RIGHT()", syntax: "RIGHT(str text, n int)", returnType: "String", description: "Return last n characters in the string. When n is negative, return all but first |n| characters." },
    { key: "RPAD", value: "RPAD()", syntax: "RPAD(string text, length int [, fill text])", returnType: "Text", description: "Returns Text value. Ex: rpad('hi', 5, 'xy')" },
    { key: "RTRIM", value: "RTRIM()", syntax: "RTRIM(string text [, characters text])", returnType: "Text", description: "Remove the longest string containing only characters from characters. Ex: rtrim('trimxxxx', 'x')" },
    { key: "SPILT_PART", value: "SPILT_PART()", syntax: "SPLIT_PART(string text, delimiter text, field int)", returnType: "Text", description: "Split string on delimiter and return the given field (counting from one). Ex: split_part('abc~@~def~@~ghi', '~@~', 2" },
    { key: "STRPOS", value: "STRPOS()", syntax: "STRPOS(string, substring)", returnType: "Text", description: "Location of specified substring (same as position(substring in string), but note the reversed argument order). Ex: strpos('high', 'ig'" },
    { key: "SUBSTRING", value: "SUBSTRING()", syntax: "SUBSTRING(string [from int] [for int])", returnType: "Text", description: "Extract substring. Ex: substring('Thomas' from 2 for 3)" },
    { key: "TO_ASCII", value: "TO_ASCII()", syntax: "TO_ASCII(string text [, encoding text])", returnType: "Text", description: "Convert string to ASCII from another encoding. Ex: to_ascii('Karel'))" },
    { key: "TO_HEX", value: "TO_HEX()", syntax: "TO_HEX(number int or bigint", returnType: "Text", description: "Convert number to its equivalent hexadecimal representation. Ex: to_hex(2147483647)" },
    { key: "TRANSLATE", value: "TRANSLATE()", syntax: "TRANSLATE(string text, from text, to text)", returnType: "Text", description: "Any character in string that matches a character in the from set is replaced by the corresponding character in the to set. Ex: translate('12345', '14', 'ax')" },
    { key: "TRIM", value: "TRIM()", syntax: "TRIM([leading | trailing | both] [characters] from string)", returnType: "Text", description: "Remove the longest string containing only the characters (a space by default) from the start/end/both ends of the string. Ex: trim(both 'x' from 'xTomxx')" },
    { key: "UPPER", value: "UPPER()", syntax: "UPPER(string)", returnType: "Text", description: "Convert string to uppercase. Ex: upper('tom')" },
    { key: "string", value: "()", syntax: "string || string", returnType: "Text", description: "String concatenation. Ex: 'Post' || 'greSQL'" }
  ];
  conditional: { key: string; value: string; syntax: string; returnType: string; description: string }[] = [
    { key: "CASE", value: "CASE [test-value]WHEN [comparand-value-1] THEN [result-1]WHEN [comparand-value-2] THEN [result-2]...WHEN [comparand-value-n] THEN [result-n]ELSE [default-result]END", syntax: "CASE [test-value]WHEN [comparand-value-1] THEN [result-1]WHEN [comparand-value-2] THEN [result-2]...WHEN [comparand-value-n] THEN [result-n]ELSE [default-result]ENDTest values, comparand values, and results can be expressions.", returnType: "Type is based on Result", description: "Evaluates a list of conditions and returns one of multiple possible result expressions." },
    { key: "CAST", value: "CAST()", syntax: "Cast ([value] as [data type])", returnType: "Type based on the data type", description: "use cast(value as datatype) to cast a data type from one type to another type. For example, you could convert any numeric data type (byteint, smallint, int, bigint, numeric/decimal, float, double) to any other numeric datatype. The value field can be a column or an expression. Ex: CASE a WHEN 1 THEN 'one' WHEN 2 THEN 'two' ELSE 'other' END" },
    { key: "COALESEC", value: "COALESEC()", syntax: "COALESCE(value [, ...])", returnType: "Number", description: "Returns the first of its arguments that is not null." },
    { key: "GREATEST", value: "GREATEST()", syntax: "GREATEST(int4 value1, int4 value2, ...)", returnType: "Number", description: "Returns the largest of the input values, up to a maximum of four (variable length lists arenot supported)." },
    { key: "LEAST", value: "LEAST()", syntax: "LEAST(int4 value1, int4 value2, ...)", returnType: "Number", description: "Returns the smallest of the input parameters, up to a maximum of four (variable lengthlists are not supported)." },
    { key: "NULLIF", value: "NULLIF()", syntax: "NULLIF(value1, value2)", returnType: "Number", description: "returns a null value if value1 and value2 are equal; otherwise it returns value1. Ex: NULLIF(102, 123)" }
  ]
  functions: any = {
    allFunctions: this.allFunctions,
    analytical: this.analytical,
    arrayFunctions: this.arrayFunctions,
    dateAndTimeFunctions: this.dateAndTimeFunctions,
    mathFunctions: this.mathFunctions,
    stringFunctions: this.stringFunctions,
    conditional: this.conditional
  };
  returnTypes: string[] = ['varchar', 'char', 'byteint', 'bigint', 'smallint', 'integer', 'numeric', 'boolean', 'date', 'time with time zone',
    'interval', 'time', 'timestamp', 'decimal', 'real', 'double', 'float', 'nvarchar', 'nchar', 'array[string]', 'array[int]', 'param', 'string', 'datetime'
  ];
  dataTypes: string[] = [
    // Numeric types
    'smallint', 'integer', 'bigint', 'decimal', 'numeric', 'real', 'double precision', 'serial', 'bigserial', 'money',

    // Character types
    'char', 'character', 'varchar', 'character varying', 'text',
  
    // Boolean
    'boolean',
  
    // Date/Time types
    'date', 'time', 'time without time zone', 'time with time zone', 'timestamp', 'timestamp without time zone', 'timestamp with time zone', 'interval',
  
    // UUID
    'uuid',
  
    // Binary data
    'bytea',
  
    // Network types
    'cidr', 'inet', 'macaddr', 'macaddr8',
  
    // JSON types
    'json', 'jsonb',
  
    // Arrays
    'array',
  
    // Range types
    'int4range', 'int8range', 'numrange', 'tsrange', 'tstzrange', 'daterange',
  
    // Geometric types
    'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
  
    // XML
    'xml',
  
    // Full Text Search
    'tsvector', 'tsquery',
  
    // Bit string types
    'bit', 'bit varying',
  
    // Object identifiers
    'oid', 'regproc', 'regprocedure', 'regoper', 'regoperator', 'regclass', 'regtype', 'regrole', 'regnamespace',
  
    // Other
    'name', 'enum', 'composite', 'pg_lsn', 'txid_snapshot', 'unknown'
  ];

  activeTab: string = 'flowboardInstance';
  isEditing: boolean = false;
  isValidFlowName: boolean = false;
  viewMode: string = 'list';
  componentsContent: any = {
    flowboardInstance: [
      { name: 'postgresSQL', icon: 'fa-database', type: 'dataFlow' },
    ],
    tasks: [
      { name: 'Task Command', icon: 'fa-calculator', type: 'taskCommand' },
      { name: 'DB Command', icon: 'fa-coins', type: 'dbCommand' },
      { name: 'Loop', icon: 'fa-filter-circle-xmark', type: 'loop' },
      { name: 'Email Notification', icon: 'fa-filter', type: 'email' }
    ]
  }
  isFromMonitor: boolean = false;
  @ViewChild('nameInput') nameInput!: ElementRef;
  private isComponentDestroyed = false;
  private pollingTimeout: any;

  constructor(private modalService: NgbModal, private toasterService: ToastrService, private workbechService: WorkbenchService,
    private loaderService: LoaderService, private router: Router, private route: ActivatedRoute, private sharedService: SharedService) {

    if (this.router.url.startsWith('/datamplify/taskplanList/taskplan')) {
      if (route.snapshot.params['id1']) {
        const id = atob(route.snapshot.params['id1']);
        this.jobFlowId = id.toString();
      }
    } else if (this.router.url.startsWith('/datamplify/monitor/taskplan')) {
      if (route.snapshot.params['id1']) {
        const id = atob(route.snapshot.params['id1']);
        this.jobFlowId = id.toString();
        this.isFromMonitor = true;
      }
    }
  }

  ngOnInit() {
    this.loaderService.hide();
    this.intializeDrawflow();
  }
  ngOnDestroy() {
    this.isComponentDestroyed = true;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
    }
  }
  intializeDrawflow() {
    setTimeout(() => {
      const container = document.getElementById('drawflow')!;
      this.drawflow = new Drawflow(container);
      this.drawflow.reroute = true;
      this.drawflow.start();
      this.drawflow.zoom = 0.8;
      this.drawflow.zoom_refresh();
      this.drawflow.drawflow.drawflow[this.drawflow.module].canvasData = this.canvasData;

      if (this.jobFlowId) {
        this.getJobFlow();
      }

      if(this.sharedService.isFlowboardCopied){
        this.duplicateTaskplan();
      }

      const canvasElement = container.querySelector('.drawflow') as HTMLElement;

      canvasElement?.addEventListener('click', (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        // Ignore clicks on nodes, ports, and connections
        const isOnNode = target.closest('.drawflow-node');
        const isOnInput = target.closest('.input');
        const isOnOutput = target.closest('.output');
        const isOnConnection = target.closest('svg.connection, .main-path');

        if (!isOnNode && !isOnInput && !isOnOutput && !isOnConnection) {
          console.log('Canvas clicked at:', event.clientX, event.clientY);
          this.isNodeSelected = true;
          this.isCanvasSelected = true;
          this.tableTabId = 8;
          console.log(this.drawflow.drawflow.drawflow[this.drawflow.module].canvasData);
        }
      });

      this.drawflow.on('connectionCreated', (connection: any) => {

        const module = this.drawflow.module;
        const data = this.drawflow.drawflow.drawflow[module].data;

        const { input_id, input_class } = connection;
        const inputNode = data[input_id];
        const inputPort = inputNode.inputs[input_class];
        const nodeType = inputNode.data.type;
        if (!['loop', 'loop_end'].includes(nodeType) && inputPort.connections.length > 1) {
          const lastConnection = inputPort.connections[inputPort.connections.length - 1];

          this.drawflow.removeSingleConnection(lastConnection.node, input_id, lastConnection.input, input_class);

          console.log('Connection limit exceeded for this node type!');
        } else {
          this.getConnectionData(connection);
        }

      });
      this.drawflow.on('connectionSelected', (connection: any) => {
      });

      this.drawflow.on('connectionRemoved', (connection: any) => {
        const { output_id, input_id } = connection;

        const sourceNode = this.drawflow.getNodeFromId(output_id);
        const targetNode = this.drawflow.getNodeFromId(input_id);

        if (targetNode.data.type === 'Joiner') {
          const nodeNamesDropdown = targetNode.data.nodeData.properties.nodeNamesDropdown;
          const sourceNodeName = sourceNode.data.nodeData.general.name;

          const index = nodeNamesDropdown.findIndex((item: any) => item.label === sourceNodeName);
          if (index !== -1) {
            const sourceNodeValue = nodeNamesDropdown[index].value;
            nodeNamesDropdown.splice(index, 1);

            const joinList = targetNode.data.nodeData.properties.joinList;
            const joinIndex = joinList.findIndex((join: any) => join.sourceNodeId === sourceNodeValue);
            if (joinIndex !== -1) {
              joinList.splice(joinIndex, 1);
            }

            if (targetNode.data.nodeData.properties.primaryObject?.value === sourceNodeValue) {
              targetNode.data.nodeData.properties.primaryObject = null;
            }

            if (nodeNamesDropdown.length <= 1) {
              targetNode.data.nodeData.properties.joinList = [];
            }
            this.drawflow.updateNodeDataFromId(targetNode.id, targetNode.data);
          }
        }
        if (this.selectedNode.hasOwnProperty('data')) {
          const node = this.drawflow.getNodeFromId(this.selectedNode.id);
          this.getSelectedNodeData(node);
        }
      });

      this.drawflow.on('nodeSelected', (nodeId: number) => {
        const nodeEl = document.querySelector(`[id="node-${nodeId}"]`);
        this.tableTabId = 1;
        this.isCanvasSelected = false;
        if (nodeEl) {
          nodeEl.addEventListener('click', () => {
            const node = this.drawflow.getNodeFromId(nodeId);
            this.getSelectedNodeData(node);
            if (node.data.type && ['taskCommand', 'loop'].includes(node.data.type) && this.serverOptions.length === 0) {
              if (node.data.type === 'loop' && node?.data?.nodeData?.properties?.type === 'command') {
                this.getDataPointList(3);
              } else if (node.data.type === 'taskCommand') {
                this.getDataPointList(3);
              }
            }
          });
        }
      });

      const allNodes = this.drawflow.drawflow.drawflow[this.drawflow.module].data;
      Object.entries(allNodes).forEach(([id, node]) => {
        console.log('Node ID:', id, 'Node Data:', node);
      });
    }, 100);
  }

  getConnectionData(connection: any) {
    const { output_id, input_id } = connection;

    const sourceNode = this.drawflow.getNodeFromId(output_id);
    const targetNode = this.drawflow.getNodeFromId(input_id);

    console.log('Output Node ID:', output_id);
    console.log('Input Node ID:', input_id);
    console.log('Source Node:', sourceNode);
    console.log('Target Node:', targetNode);
  }

  onDragStart(event: DragEvent, nodeType: string, modal: any) {
    this.nodeToAdd = nodeType;
    this.modal = modal;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const canvas = document.getElementById('drawflow')!;
    const rect = canvas.getBoundingClientRect();
    this.posX = event.clientX - rect.left;
    this.posY = event.clientY - rect.top;

    if (['dataFlow'].includes(this.nodeToAdd)) {
      this.modalService.open(this.modal, {
        centered: true,
        windowClass: 'animate__animated animate__zoomIn',
      });
      this.getDataFlowList();
    } else if(this.nodeToAdd === 'dbCommand') {
      this.changeDataPointPopup(this.modal, this.nodeToAdd);
    } else {
      this.addNode(this.nodeToAdd, this.posX, this.posY);
      if(this.nodeToAdd === 'taskCommand'){
        this.getDataPointList(3);
      }
    }
    setTimeout(() => {
      const allNodes = document.querySelectorAll('.drawflow-node');
      allNodes.forEach(nodeElement => {
        const statusDiv = nodeElement.querySelector('.node-status') as HTMLElement;
        if (statusDiv && statusDiv.textContent && statusDiv.textContent.trim() !== '') {
          // Only clear if there's text (status shown)
          statusDiv.textContent = '';
          statusDiv.style.display = 'none';
          statusDiv.className = 'node-status'; // reset to base
        }
      });
    }, 100);
  }

  addNode(name: string, posX: number, posY: number) {
    // bump per‑type counter
    const count = (this.nodeTypeCounts[name] = (this.nodeTypeCounts[name] || 0) + 1);

    // the common shape of nodeData.nodeData
    const defaults = {
      dataFlow: {},
      general: { name: '' },
      properties: {
        successCodes: '0, 99', retryEnable: false, 
        type: 'sql', dataPoint: null, serverFileId: '', command: '', returnType: 'varchar', delimiter: '', iterationMode: 'sequential', failZeroRowsReturn: false, looperStartJob: '',
        to: '', cc: '', subject: '', attachment: '', message: ''
      },
      command: {
        commandType: 'external', commandDesc: '', timeOut: 0, sleepInterval: 0, serverFileId: '',
        runDBCommandFile: false, continueExecutionFailure: false, dbCommand: '', dbCommandOutputFile: '$$SrcFileDir'
      },
      dataPoints: {dataPoint: this.selectedDataPoint?.display_name ?? '', dataPointSchema: '', selectedDataPoint: this.selectedDataPoint},
      connections: [] as any[],
      transformations: [] as any[],
      dataFlowParameters: {} as any[],
      dataFlowSqlParameters: {} as any[]
    };

    /** per‑type config for icon/alt text, port counts, initial name, etc. */
    interface NodeConfig {
      iconPath: string;
      altText: string;
      inputCount: number;
      outputCount: number;
      name: string;
      extraNodeData?: Partial<typeof defaults>;
    }

    const configs: Record<string, NodeConfig> = {
      dataFlow: {
        iconPath: this.selectedDataFlow?.type === 'POSTGRESQL'
          ? './assets/images/etl/PostgreSQL-etl.svg'
          : './assets/images/etl/PostgreSQL-etl.svg',
        altText: this.selectedDataFlow?.type === 'POSTGRESQL'
          ? 'PostgreSQL'
          : '',
        inputCount: 1,
        outputCount: 1,
        name: this.selectedDataFlow?.Flow_name,
        extraNodeData: {
          dataFlow: this.selectedDataFlow,
          connections: this.srcConnections,
          transformations: this.transformations,
          dataFlowParameters: this.flowboardParams,
          dataFlowSqlParameters: this.flowboardSqlParams
        },
      },
      taskCommand: {
        iconPath: './assets/images/etl/task_command-etl.svg', altText: 'Task Command', inputCount: 1, outputCount: 1, name:
          `Task_Command_Name_${count}`
      },
      dbCommand: {
        iconPath: './assets/images/etl/db_command-etl.svg', altText: 'DB Command', inputCount: 1, outputCount: 1, name:
          `DB_Command_Name_${count}`
      },
      email: {
        iconPath: './assets/images/etl/email-etl.svg', altText: 'Email', inputCount: 1, outputCount: 1, name:
          `Email_Name_${count}`
      },
      loop: {
        iconPath: './assets/images/etl/loop_start-etl.svg', altText: 'Loop', inputCount: 1, outputCount: 1, name:
          `Loop_Name_${count}`
      },
    };

    const config = configs[name];
    if (!config) {
      return;
    }

    const buildAndAdd = (nodeType: string, nodeName: string, x: number, iconPath: string, altText: string, extraData: Partial<typeof defaults> = {} ): number => {
      const nodeData = {
        type: nodeType,
        nodeData: { ...defaults, general: { name: nodeName }, ...extraData }
      };
      if(nodeName.includes('Loop_End_Name_')){
        if(nodeData?.nodeData?.properties?.looperStartJob){
          nodeData.nodeData.properties.looperStartJob = nodeName;
        }
      }
      let label = nodeName;
      if (label.length > 10) {
        label = label.substring(0, 10) + '..';
      }
      const container = document.createElement('div');
      container.innerHTML = `<div class="d-flex flex-column align-items-center">
      <img src=\"${iconPath}\" class=\"node-icon\" alt=\"${altText}\" /><div class=\"node-label\"
        title=\"${nodeName}\">${label}</div><div class=\"node-status\" style=\"display:none;\"></div></div>`;
      return this.drawflow.addNode(nodeType, config.inputCount, config.outputCount, x, posY, nodeType, nodeData, container.innerHTML);
    };

    // add the primary node
    let nodeId = buildAndAdd(name, config.name, posX, config.iconPath, config.altText, config.extraNodeData || {});

    // special ‑ for loop we also add a Loop_End node offset in X
    if (name === 'loop') {
      nodeId = buildAndAdd('loop_end', `Loop_End_Name_${count}`, posX + 300, './assets/images/etl/loop_end-etl.svg', 'Loop End');
    }

    // === unchanged post‑add housekeeping ===
    this.selectedDataFlow = null;
    this.selectedDataPoint = null;
    const allNodes = this.drawflow.drawflow.drawflow[this.drawflow.module].data;
    Object.entries(allNodes).forEach(([id, node]) =>
      console.log('Node ID:', id, 'Node Data:', node)
    );
  }

  updateNode(type: any, nameInput?: any) {
    let data = {};
    let nodeId = '';
    let previousName = '';
    if (type !== 'parameter') {
      nodeId = this.selectedNode.id;
      previousName = this.selectedNode.data.nodeData.general.name;
    }
    if (type === 'general') {
      let general;
      if(nameInput && nameInput?.invalid && nameInput?.touched){
        general = { name: this.selectedNode.data.nodeData.general.name}
      } else{
        general = { name: this.nodeName}
      }
      nodeId = this.selectedNode.id;
      data = {
        ...this.selectedNode.data,
        nodeData: {
          ...this.selectedNode.data.nodeData,
          general: general
        }
      };

      let displayName = this.nodeName;
      if (displayName.length > 8) {
        displayName = displayName.substring(0, 8) + '..';
      }
      this.selectedNode.data.nodeData.general.name = this.nodeName;
      const nodeElement = document.querySelector(`#node-${nodeId}`);
      if (nodeElement) {
        const labelElement = nodeElement.querySelector('.node-label') as HTMLElement;
        if (labelElement) {
          labelElement.innerText = displayName;
          labelElement.setAttribute('title', this.nodeName);
        }
      }
    } else if (type === 'parameter') {
      const module = this.drawflow.module || 'Home';
      this.drawflow.drawflow.drawflow[module].canvasData = this.canvasData;
    } else {
      nodeId = this.selectedNode.id;

      data = {
        ...this.selectedNode.data
      };
    }
    if (type !== 'parameter') {
      this.drawflow.updateNodeDataFromId(nodeId, data);
    }
    console.log(this.drawflow.drawflow.drawflow[this.drawflow.module]);
  }

  getSelectedNodeData(node: any) {
    this.isNodeSelected = true;
    this.selectedNode = node;
    this.nodeName = this.selectedNode.data.nodeData.general.name;
    console.log(this.selectedNode);
    this.selectedAttributeIndex = null;
    this.selectedGroupAttributeIndex = null;
    this.selectedSourceAttributeIndex = null;
    if(this.selectedNode.data.type === 'loop_end'){
      this.tableTabId = 2;
    }
    if (this.isRefrshEnable && !['success', 'failed'].includes(this.jobFlowRunStatus)) {
      this.tableTypeTabId = 2;
      this.getJobFlowLogs(this.nodeName);
    }
  }

  getDataFlowList() {
    this.workbechService.getFlowboardList(1, 1000, '').subscribe({
      next: (data: any) => {
        console.log(data);
        this.dataFlowOptions = data.data;
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getDataPointList(id:any){
    this.workbechService.getConnectionsForEtl(id).subscribe({
      next: (data) => {
        console.log(data);
        if(id === 3){
          this.serverOptions = data.data;
        } else{
          this.dataPointOptions = data.data;
        }
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  saveOrUpdateEtlJobFlow(): void {
    const exportedData = this.drawflow.export();
    const nodes = exportedData.drawflow.Home.data;
    const loopBlockNodeIds = new Set<number>();

    for (const key in nodes) {
      const node = nodes[key];
      if (node.data.type === 'loop') {
        const nodeId = Number(key);
        const loopNodeIds = this.getLoopNodeIdsBetween(nodeId, nodes);
        loopNodeIds.forEach(id => loopBlockNodeIds.add(id));
      }
    }

    const tasks: any[] = [];
    const flows: string[][] = [];
    const visitedEdges = new Set<string>();
    const allTo = new Set<number>();
    const adjacency = new Map<number, number[]>();

    for (const key in nodes) {
      const from = Number(key);
      const outputs = nodes[key].outputs;
      if (!outputs) {
        continue;
      }
      for (const outKey in outputs) {
        for (const conn of outputs[outKey]?.connections ?? []) {
          const to = Number(conn.node);
          allTo.add(to);
          if (!adjacency.has(from)) {
            adjacency.set(from, []);
          }
          adjacency.get(from)!.push(to);
        }
      }
    }

    const sources = Object.keys(nodes)
      .map(id => Number(id))
      .filter(id => !allTo.has(id));

    const queue = [...sources];
    while (queue.length) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];
      for (const target of neighbors) {
        const edgeKey = `${current}-${target}`;
        if (visitedEdges.has(edgeKey)) {
          continue;
        }
        visitedEdges.add(edgeKey);

        const sourceName = this.drawflow.getNodeFromId(current).data.nodeData.general.name;
        const targetName = this.drawflow.getNodeFromId(target).data.nodeData.general.name;
        flows.push([sourceName, targetName]);

        // const taskA = this.generateTasks(current, nodes);
        // if (!tasks.some(t => t.id === taskA.id)) {
        //   tasks.push(taskA);
        // }
        // const taskB = this.generateTasks(target, nodes);
        // if (!tasks.some(t => t.id === taskB.id)) {
        //   tasks.push(taskB);
        // }

        const taskA = this.generateTasks(current, nodes);
        if (!loopBlockNodeIds.has(current) && !tasks.some(t => t.id === taskA.id)) {
          tasks.push(taskA);
        }
        const taskB = this.generateTasks(target, nodes);
        if (!loopBlockNodeIds.has(target) && !tasks.some(t => t.id === taskB.id)) {
          tasks.push(taskB);
        }

        queue.push(target);
      }
    }

    // for (const nodeIdStr in nodes) {
    //   const nodeId = Number(nodeIdStr);
    //   const node = nodes[nodeId];
    //   const existing = tasks.some(t => t.id === node.data.nodeData.general.name);
    //   if (!existing) {
    //     const task = this.generateTasks(nodeId, nodes);
    //     tasks.push(task);
    //   }
    // }

    for (const nodeIdStr in nodes) {
      const nodeId = Number(nodeIdStr);

      // Skip nodes that are part of loop blocks
      if (loopBlockNodeIds.has(nodeId)) continue;

      const node = nodes[nodeId];
      const existing = tasks.some(t => t.id === node.data.nodeData.general.name);
      if (!existing) {
        const task = this.generateTasks(nodeId, nodes);
        tasks.push(task);
      }
    }

    console.log(tasks);
    console.log(flows);

    const params = exportedData?.drawflow?.Home?.canvasData?.parameters?.map((param: any) => ({
      param_name: param?.paramName,
      data_type: param?.dataType,
      value: param?.default || ''
    })) || [];

    const sqlParams = exportedData?.drawflow?.Home?.canvasData?.sqlParameters?.map((param: any) => ({
      param_name: param?.paramName,
      data_type: param?.dataType,
      query: param?.sql,
      value: param?.default ?? '',
      database: param?.dataPoint?.hierarchy_id ?? '',
      dependent_task: param?.dependentJobName === 'intialization' ? param?.dependentJobName : param?.dependentJobName?.data?.nodeData?.general?.name ?? '',
      order: param?.jobOrder ?? ''
    })) || [];

    const etlFlow = {
      dag_name: this.etlName,
      parameters: params,
      sql_parameters: sqlParams,
      tasks,
      flow: flows
    };
    console.log(etlFlow);

    const jsonString = JSON.stringify(exportedData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], 'etl-drawflow.json', { type: 'application/json' });
    const flow_type = 'jobflow';

    const formData = new FormData();
    formData.append('drawflow', file);
    formData.append('task_plan', JSON.stringify(etlFlow));
    formData.append('task_name', this.etlName);

    // formData.append('transformation_flow', file);
    // formData.append('ETL_flow', JSON.stringify(etlFlow));
    // formData.append('flow_type', flow_type);

    if(this.jobFlowId){
      formData.append('id', this.jobFlowId);
      this.workbechService.updateTaskPlan(formData).subscribe({
        next: (data: any) => {
          console.log(data);
          this.isRunEnable = true;
          this.jobFlowId = data.Task_Plan_id;
          this.toasterService.success(data.message, 'success', { positionClass: 'toast-top-right' });
        },
        error: (error: any) => {
          this.isRunEnable = false;
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          console.log(error);
        }
      });
    } else{
      this.workbechService.saveTaskPlan(formData).subscribe({
        next: (data: any) => {
          console.log(data);
          this.isRunEnable = true;
          this.jobFlowId = data.Task_Plan_id;
          const encodedId = btoa(this.jobFlowId.toString());
          this.router.navigate(['/datamplify/taskplanList/taskplan/'+encodedId]);
          this.toasterService.success('JobFlow Saved Successfully', 'success', { positionClass: 'toast-top-right' });
        },
        error: (error: any) => {
          this.isRunEnable = false;
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          console.log(error);
        }
      });
    }
  }

  runJobFlow() {
    this.workbechService.runEtl(this.taskId, 'taskplan').subscribe({
      next: (data: any) => {
        console.log(data);
        this.isRefrshEnable = true;
        this.isRunEnable = false;
        this.runId = data.run_id;
        // this.startPollingDataFlowStatus(data.run_id);
        Object.entries(this.drawflow.drawflow.drawflow[this.drawflow.module].data).forEach(([id, node]) => {
          const nodeElement = document.querySelector(`#node-${id}`);
          if (nodeElement) {
            const statusDiv = nodeElement.querySelector('.node-status') as HTMLElement;
            if (statusDiv) {
              statusDiv.textContent = '';
              statusDiv.style.display = 'none';
              statusDiv.className = 'node-status'; // remove any previous status class
            }
          }
        });
        this.isLogShow = true;
        this.logs = '';
        this.getJobFlowStatus(data.run_id);
        this.toasterService.success('Run Successfully', 'success', { positionClass: 'toast-top-right' });
      },
      error: (error: any) => {
        this.isRefrshEnable = false;
        this.isRunEnable = true;
        this.isLogShow = false;
        if (error?.error?.message?.detail?.includes('not found')) {
          this.toasterService.info('Please Run After 5 seconds.', 'info', { positionClass: 'toast-top-right' });
        } else {
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        }
        console.log(error);
      }
    });
  }
  getJobFlowStatus(runId: any) {
    if (this.isComponentDestroyed) return;
    let object = {
      dag_id: this.taskId,
      run_id: runId
    }
    this.workbechService.disableLoaderForNextRequest();
    this.workbechService.getDataFlowStatus(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.jobFlowStatus = data.tasks;
        this.jobFlowRunStatus = data.status;

        Object.entries(this.drawflow.drawflow.drawflow[this.drawflow.module].data).forEach(([id, node]) => {
          const node1 = this.drawflow.getNodeFromId(id);
          const nodeName = node1.data.nodeData.general.name;

          // Find matching task status from dataFlowStatus
          const matchedTask = this.jobFlowStatus.find(task => task.task === nodeName);

          if (matchedTask) {
            let status = matchedTask.state;
            if (node1) {
              const nodeElement = document.querySelector(`#node-${id}`);
              if (nodeElement) {
                const statusDiv = nodeElement.querySelector('.node-status') as HTMLElement;
                status = (status === null ? 'waiting' : status);
                if (statusDiv && status) {
                  statusDiv.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                  statusDiv.style.display = 'block';
                  statusDiv.className = `node-status node-status-${status}`;
                }
              }
            }
          }
        });
        // this.tableTypeTabId = 2;
        if (!['success', 'failed'].includes(data.status)) {
          this.pollingTimeout = setTimeout(() => {
            this.getJobFlowStatus(runId);
          }, 3000);
        } else {
          this.isRefrshEnable = false;
          this.isRunEnable = true;
        }
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }
  getJobFlowLogs(taskId: any) {
    let object = {
      dag_id: this.taskId,
      run_id: this.runId,
      task_id: taskId
    }
    this.workbechService.getDataFlowLogs(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.logs = data.content;
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }
  generateTasks(nodeId: any, nodes: any) {
    // Build task for currentNode
    const task: any = {
      type: nodes[nodeId].data.type,
      id: nodes[nodeId].data.nodeData.general.name,
    };

    if (nodes[nodeId].data.type === 'taskCommand') {
      task.command_type = nodes[nodeId].data.nodeData.command.commandType;
      task.commands = nodes[nodeId].data.nodeData.command.commandDesc;
      task.time_out = nodes[nodeId].data.nodeData.command.timeOut;
      task.sleep_interval = nodes[nodeId].data.nodeData.command.sleepInterval;
      task.remote_id = nodes[nodeId].data.nodeData.command.serverFileId;
    } else if(nodes[nodeId].data.type === 'dbCommand'){
      task.queries = nodes[nodeId].data.nodeData.command.dbCommand;
      task.hierarchy_id = nodes[nodeId].data.nodeData.dataPoints.selectedDataPoint.hierarchy_id;
    } else if(nodes[nodeId].data.type === 'loop'){
      task.loop_type = nodes[nodeId].data.nodeData.properties.type;
      task.command = nodes[nodeId].data.nodeData.properties.command;
      task.parameter_name = nodes[nodeId].data.nodeData.general.name;
      task.return_type = nodes[nodeId].data.nodeData.properties.returnType;
      task.delimeter = nodes[nodeId].data.nodeData.properties.delimiter;
      task.fail = nodes[nodeId].data.nodeData.properties.failZeroRowsReturn;
      if(task.loop_type === 'sql'){
        task.hierarchy_id = nodes[nodeId].data.nodeData.properties.dataPoint.hierarchy_id;
      } else if(task.loop_type === 'command'){
        task.remote_id = nodes[nodeId].data.nodeData.properties.serverFileId;
      }
      task.loop_tasks = this.getLoopTasksBetween(nodeId, nodes);
    } else if(nodes[nodeId].data.type === 'email'){
      task.to_email = nodes[nodeId].data.nodeData.properties.to;
      task.cc = nodes[nodeId].data.nodeData.properties.cc;
      task.subject = nodes[nodeId].data.nodeData.properties.subject;
      task.message = nodes[nodeId].data.nodeData.properties.message;
    } else if(nodes[nodeId].data.type === 'dataFlow'){
      task.trigger_dag = nodes[nodeId].data.nodeData.dataFlow.Flow_id;
    }


    const inputConnections = nodes[nodeId].inputs?.input_1?.connections || [];
    if (inputConnections.length > 0) {
      const prevTaskIds = inputConnections.map((conn: any) => nodes[conn.node].data.nodeData.general.name);
      task.previous_task_id = prevTaskIds;
    }

    return task;
  }

  getLoopTasksBetween(startNodeId: number, nodes: any): any[] {
    const visited = new Set<number>();
    const queue: number[] = [];
    const loopTasks: any[] = [];

    const outputs = nodes[startNodeId].outputs;
    for (const outKey in outputs) {
      for (const conn of outputs[outKey]?.connections ?? []) {
        queue.push(Number(conn.node));
      }
    }

    while (queue.length) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodes[currentId];
      const currentType = currentNode.data.type;

      if (currentType === 'loop_end') {
        break; // End node reached
      }

      if (currentId !== startNodeId) {
        const task = this.generateTasks(currentId, nodes);
        loopTasks.push(task);
      }

      const currentOutputs = currentNode.outputs;
      for (const outKey in currentOutputs) {
        for (const conn of currentOutputs[outKey]?.connections ?? []) {
          queue.push(Number(conn.node));
        }
      }
    }

    return loopTasks;
  }

  getLoopNodeIdsBetween(startNodeId: number, nodes: any): number[] {
    const visited = new Set<number>();
    const queue: number[] = [];
    const result: number[] = [];

    const outputs = nodes[startNodeId].outputs;
    for (const outKey in outputs) {
      for (const conn of outputs[outKey]?.connections ?? []) {
        queue.push(Number(conn.node));
      }
    }

    while (queue.length) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodes[currentId];
      const currentType = currentNode.data.type;

      if (currentType === 'loop_end') {
        break; // Stop traversal when loop_end is found
      }

      result.push(currentId);

      const currentOutputs = currentNode.outputs;
      for (const outKey in currentOutputs) {
        for (const conn of currentOutputs[outKey]?.connections ?? []) {
          queue.push(Number(conn.node));
        }
      }
    }

    return result;
  }

  openExpressionEdit(modal: any, attribute: any, index: any) {
    if (index !== null || index !== undefined) {
      this.selectedIndex = index;
    }
    let dataObject: any[] = [];
    if (attribute.paramName) {
      dataObject = [''].map((col: any) => ({
        label: '',
        value: '',
        dataType: '',
        group: 'Project Parameters'
      }));
    } else {
      const nodeData = JSON.parse(JSON.stringify(this.selectedNode.data.nodeData));
      dataObject = nodeData.dataObject || [];
    }

    this.groupedColumns = dataObject.reduce((acc: any, attr: any) => {
      if (!acc[attr.group]) {
        acc[attr.group] = [];
      }
      acc[attr.group].push(attr);
      return acc;
    }, {} as { [groupName: string]: any[] });

    const groupKeys = Object.keys(this.groupedColumns);
    this.selectedGroup = groupKeys.length > 0 ? groupKeys[0] : null;

    if (attribute.hasOwnProperty('paramName')) {
      this.selectedField = attribute;
      this.selectedColumn = '';
      if (attribute.hasOwnProperty('sql')) {
        this.isSQLParameter = true;
        this.expression = attribute.sql;
      } else {
        this.isParameter = true;
        this.expression = attribute.default;
      }
      this.isTaskCommand = false;
      this.isDbCommand = false;
      this.isLoopCommand = false;
      this.isTo = false;
      this.isCC = false;
      this.isSubject = false;
      this.isMessage = false;
    } else {
      this.isParameter = false;
      this.isSQLParameter = false;
      this.selectedField = attribute;
      this.selectedColumn = '';
      if(attribute === 'command') {
        this.isTaskCommand = true;
        this.isDbCommand = false;
        this.isLoopCommand = false;
        this.isTo = false;
        this.isCC = false;
        this.isSubject = false;
        this.isMessage = false;
        this.expression = this.selectedNode.data.nodeData.command.commandDesc;
      } else if(attribute === 'dbCommand') {
        this.isTaskCommand = false;
        this.isDbCommand = true;
        this.isLoopCommand = false;
        this.isTo = false;
        this.isCC = false;
        this.isSubject = false;
        this.isMessage = false;
        this.expression = this.selectedNode.data.nodeData.command.dbCommand;
      } else if(attribute === 'loopCommand') {
        this.isTaskCommand = false;
        this.isDbCommand = false;
        this.isLoopCommand = true;
        this.isTo = false;
        this.isCC = false;
        this.isSubject = false;
        this.isMessage = false;
        this.expression = this.selectedNode.data.nodeData.properties.command;
      } else if(attribute === 'to') {
        this.isTaskCommand = false;
        this.isDbCommand = false;
        this.isLoopCommand = false;
        this.isTo = true;
        this.isCC = false;
        this.isSubject = false;
        this.isMessage = false;
        this.expression = this.selectedNode.data.nodeData.properties.to;
      } else if(attribute === 'cc') {
        this.isTaskCommand = false;
        this.isDbCommand = false;
        this.isLoopCommand = false;
        this.isTo = false;
        this.isCC = true;
        this.isSubject = false;
        this.isMessage = false;
        this.expression = this.selectedNode.data.nodeData.properties.cc;
      } else if(attribute === 'subject') {
        this.isTaskCommand = false;
        this.isDbCommand = false;
        this.isLoopCommand = false;
        this.isTo = false;
        this.isCC = false;
        this.isSubject = true;
        this.isMessage = false;
        this.expression = this.selectedNode.data.nodeData.properties.subject;
      } else if(attribute === 'message') {
        this.isTaskCommand = false;
        this.isDbCommand = false;
        this.isLoopCommand = false;
        this.isTo = false;
        this.isCC = false;
        this.isSubject = false;
        this.isMessage = true;
        this.expression = this.selectedNode.data.nodeData.properties.message;
      } 
    }
    this.modalService.open(modal, {
      centered: true,
      windowClass: 'animate__animated animate__zoomIn',
      modalDialogClass: 'modal-lg modal-dialog-scrollable'
    });
  }

  updateExpressionToNode() {
    if (this.isParameter) {
      this.canvasData.parameters[this.selectedIndex].default = this.expression;
    } else if (this.isSQLParameter) {
      this.canvasData.sqlParameters[this.selectedIndex].sql = this.expression;
    } else if( this.isTaskCommand) {
      this.selectedNode.data.nodeData.command.commandDesc = this.expression;
    } else if(this.isDbCommand) {
      this.selectedNode.data.nodeData.command.dbCommand = this.expression;
    } else if(this.isLoopCommand) { 
      this.selectedNode.data.nodeData.properties.command = this.expression;
    } else if(this.isTo) {
      this.selectedNode.data.nodeData.properties.to = this.expression;
    } else if(this.isCC) {
      this.selectedNode.data.nodeData.properties.cc = this.expression;
    } else if(this.isSubject) {
      this.selectedNode.data.nodeData.properties.subject = this.expression;
    }  else if(this.isMessage) {
      this.selectedNode.data.nodeData.properties.message = this.expression;
    }

    if (!this.isParameter && !this.isSQLParameter) {
      this.updateNode('');
    } else {
      this.updateNode('parameter');
    }
    this.expression = '';
    this.selectedGroup = '';
    this.selectedColumn = {};
    this.selectedIndex = -1;
    this.isTaskCommand = false;
    this.isDbCommand = false;
    this.isLoopCommand = false;
    this.isTo = false;
    this.isCC = false;
    this.isSubject = false;
    this.isMessage = false;
    this.isParameter = false;
    this.isSQLParameter = false;
  }

  insertOrReplace(text: string, textarea: HTMLTextAreaElement): void {
    const { selectionStart: start, selectionEnd: end } = textarea;
    const value = this.expression || '';

    const prefix = (value && start === end && value[start - 1] !== ' ') ? ' ' : '';
    this.expression = value.slice(0, start) + prefix + text + value.slice(end);

    const newPos = start + prefix.length + text.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  getJobFlow() {
    this.workbechService.getTaskPlan(this.jobFlowId, 'jobflow').subscribe({
      next: (data) => {
        console.log(data);
        this.etlName = data?.task_name;
        this.jobFlowId = data.id;
        this.taskId = data.Task_id;
        const drawFlowJson = JSON.parse(data.drawflow);
        this.drawflow.import(drawFlowJson);
        this.validateFlowName(this.etlName);
        console.log(drawFlowJson);
        this.isRunEnable = true;
        this.canvasData = drawFlowJson.drawflow.Home.canvasData ? drawFlowJson.drawflow.Home.canvasData : { parameters: [], sqlParameters: [] };
        console.log(this.canvasData);
        this.isNodeSelected = true;
        this.isCanvasSelected = true;
        this.tableTabId = 8;

        setTimeout(() => {
          const allNodes = this.drawflow.drawflow.drawflow['Home'].data;
          Object.entries(allNodes).forEach(([id, node]: [string, any]) => {
            const type = node.data?.type;
            if (type && type !== 'dataFlow') {
              this.nodeTypeCounts[type] = (this.nodeTypeCounts[type] || 0) + 1;
            }
            let displayName = (node.data?.nodeData?.general?.name || '');
            if (displayName.length > 10) {
              displayName = (node.data?.nodeData?.general?.name || '').substring(0, 10) + '..';
            } 
            const nodeElement = document.querySelector(`#node-${id}`);
            if (nodeElement) {
              const labelElement = nodeElement.querySelector('.node-label') as HTMLElement;
              if (labelElement) {
                labelElement.innerText = displayName;
                labelElement.setAttribute('title', node.data?.nodeData?.general?.name);
              }
            }
          });
          if(this.isFromMonitor){
            this.runJobFlow();
          }
        }, 100);
      },
      error: (error: any) => {
        console.log(error);
        this.isRunEnable = false;
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  addNewParameter() {
    const existingIndexes = this.canvasData?.parameters
      .map((p: any) => {
        const match = p.paramName?.match(/PARAM_NAME_(\d+)/);
        return match ? +match[1] : null;
      })
      .filter((index: any) => index !== null)
      .sort((a: any, b: any) => a! - b!) as number[];

    // Find the smallest unused index
    let newIndex = 1;
    for (let i = 0; i < existingIndexes?.length; i++) {
      if (existingIndexes[i] !== i + 1) {
        newIndex = i + 1;
        break;
      }
      newIndex = existingIndexes.length + 1;
    }

    let parameter = { paramName: `PARAM_NAME_${newIndex}`, dataType: 'varchar', default: '' }
    this.canvasData?.parameters.push(parameter);
    this.updateNode('parameter');
  }
  deleteParameter(index: any) {
    this.canvasData.parameters.splice(index, 1);
    this.updateNode('parameter');
  }

  addNewSQLParameter() {
    const existingIndexes = this.canvasData?.sqlParameters
      .map((p: any) => {
        const match = p.paramName?.match(/SQL_PARAM_NAME_(\d+)/);
        return match ? +match[1] : null;
      })
      .filter((index: any) => index !== null)
      .sort((a: any, b: any) => a! - b!) as number[];

    // Find the smallest unused index
    let newIndex = 1;
    for (let i = 0; i < existingIndexes?.length; i++) {
      if (existingIndexes[i] !== i + 1) {
        newIndex = i + 1;
        break;
      }
      newIndex = existingIndexes.length + 1;
    }
    
    const originalJobs = Object.values(this.drawflow.drawflow.drawflow[this.drawflow.module].data);
    const initializationOption = {
      data: {
        nodeData: {
          general: {
            name: 'Initialization'
          }
        }
      }
    };
    const jobsList = [initializationOption, ...originalJobs];

    let parameter = { paramName: `SQL_PARAM_NAME_${newIndex}`, dataType: 'varchar', dataPoint: null, jobsList: jobsList ?? [], dependentJobName: 'intialization', jobOrder: 'intialization', sql: '', default: 'null' }
    this.canvasData?.sqlParameters.push(parameter);
    this.updateNode('parameter');
  }
  deleteSQLParameter(index: any) {
    this.canvasData.sqlParameters.splice(index, 1);
    this.updateNode('parameter');
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  canvasZoomOut() {
    this.drawflow.zoom_out();
  }
  canvasZoomReset() {
    this.drawflow.zoom_reset()
  }
  canvasZoomIn() {
    this.drawflow.zoom_in();
  }

  dataPointIndexForSqlParameter : number = -1;
  changeDataPointPopup(modal:any, from: any, index?:number) {
    if( from === 'sqlParameters' && index !== undefined && index !== null){
      this.dataPointIndexForSqlParameter = index;
    }
    this.modalService.open(modal, {
      centered: true,
      windowClass: 'animate__animated animate__zoomIn',
    });
    this.dataPointPopUpFrom = from;
    if(from === 'loop'){
      this.selectedDataPoint = this.selectedNode.data.nodeData.properties.dataPoint ?? null;
    } else if(from === 'dbCommand'){
      this.selectedDataPoint = this.selectedNode?.data?.nodeData?.dataPoints?.selectedDataPoint ?? null;
    } 
    // else if(from === 'sqlParameters' && index !== undefined && index !== null){
    //   this.canvasData.sqlParameters[index].dataPoint = this.drawflow.drawflow.drawflow[this.drawflow.module].canvasData.sqlParameters[index].dataPoint ?? null;
    // }
    this.getDataPointList(1);
  }

  updateDataPointToNode(from:any){
    if(from === 'loop'){
      this.selectedNode.data.nodeData.properties.dataPoint = this.selectedDataPoint;
    } else if(from === 'dbCommand'){
      this.selectedNode.data.nodeData.dataPoints.selectedDataPoint = this.selectedDataPoint;
      this.selectedNode.data.nodeData.dataPoints.dataPoint = this.selectedDataPoint?.display_name;
    } 
    if(from === 'sqlParameters'){
      console.log(this.canvasData);
      this.updateNode('parameter');
    } else{
      this.updateNode('');
    }
  }

  getDataFlow(id: any) {
    this.workbechService.getEtlDataFlow(id, 'dataflow').subscribe({
      next: (data) => {
        console.log(data);
        const drawFlowJson = JSON.parse(data.drawflow);
        console.log(drawFlowJson);
        const allNodes = Object.values(drawFlowJson.drawflow.Home.data);
        const params = Object.values(drawFlowJson.drawflow.Home?.canvasData?.parameters);
        const sqlParams = Object.values(drawFlowJson.drawflow.Home?.canvasData?.sqlParameters);
        this.srcConnections = allNodes.filter((node: any) => node.data.type === 'source_data_object' || node.data.type === 'target_data_object');
        this.transformations = allNodes.filter((node: any) => node.data.type !== 'source_data_object' && node.data.type !== 'target_data_object');
        this.flowboardParams = params;
        this.flowboardSqlParams = sqlParams;
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  goBackToJobflowList() {
    this.router.navigate(['/datamplify/taskplanList']);
  }

  onTypeChange() {
    if (this.expEditorAddType === 'functions') {
      this.selectedGroup = this.functionGroupType[0].value;
      this.selectedColumn = this.functions['allFunctions'][0] || null;
    }
  }

  validateFlowName(value: string) {
    const pattern = /^[a-zA-Z0-9_]+$/;
    this.isValidFlowName = pattern.test(value);
  }

  createNewTaskplan(){
    this.router.navigate(['/datamplify/taskplanList/taskplan']);
  }

  clearTaskplan(){
    this.drawflow.clear();
  }

  goToFlowboard(){
    const id = this.selectedNode?.data?.nodeData?.dataFlow?.id;
    const encodedId = btoa(id.toString());
    this.router.navigate(['/datamplify/flowboardList/flowboard/' + encodedId]);
  }

  showInputFocus(){
    setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
  }

  copyTaskplan() {
    const exportedData = this.drawflow.export();

    this.sharedService.setDuplicatedFlow(exportedData);
    this.createNewTaskplan();
  }
  
  duplicateTaskplan() {
    const drawFlowJson = this.sharedService.getDuplicatedFlow();
    this.drawflow.import(drawFlowJson);
    this.canvasData = drawFlowJson.drawflow.Home.canvasData ? drawFlowJson.drawflow.Home.canvasData : { parameters: [], sqlParameters: [] };
    console.log(this.canvasData);
    this.isNodeSelected = true;
    this.isCanvasSelected = true;
    this.tableTabId = 8;

    setTimeout(() => {
      const allNodes = this.drawflow.drawflow.drawflow['Home'].data;
      Object.entries(allNodes).forEach(([id, node]: [string, any]) => {
        const type = node.data?.type;
        if (type && type !== 'dataFlow') {
          this.nodeTypeCounts[type] = (this.nodeTypeCounts[type] || 0) + 1;
        }
        let displayName = (node.data?.nodeData?.general?.name || '');
        if (displayName.length > 10) {
          displayName = (node.data?.nodeData?.general?.name || '').substring(0, 10) + '..';
        }
        const nodeElement = document.querySelector(`#node-${id}`);
        if (nodeElement) {
          const labelElement = nodeElement.querySelector('.node-label') as HTMLElement;
          if (labelElement) {
            labelElement.innerText = displayName;
            labelElement.setAttribute('title', node.data?.nodeData?.general?.name);
          }
        }
      });
      this.sharedService.clearDuplicatedFlow();
      Swal.fire({
        icon: 'info',
        title: 'Taskplan Duplicated',
        text: 'Taskplan duplicated successfully. If you refresh the page without saving, the duplicate data will be lost.',
        confirmButtonText: 'Got it',
        width: '400px'
      });
    }, 100);
  }
}
