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
  selector: 'app-flowboard',
  standalone: true,
  imports: [NgbModule, CommonModule, NgSelectModule, FormsModule, EtlLoggerViewComponent, DataFlowSearchFilterPipe, ResizableTopDirective],
  templateUrl: './flowboard.component.html',
  styleUrl: './flowboard.component.scss'
})
export class FlowboardComponent {
  drawflow: any;
  nodeToAdd: string = '';
  isOpen: boolean = true;
  active = 1;
  isNodeSelected: boolean = false;
  selectedNode: any;
  modal: any;
  connectionOptions: any[] = [];
  selectedConnection: any = null;
  dataObjectOptions: [] = [];
  selectedDataObject: any = null;
  posX: any;
  posY: any;
  tableTabId: number = 1;
  tableTypeTabId: number = 1;
  nodeTypeCounts: { [key: string]: number } = {};
  etlName: string = '';
  dataFlowId!: string;
  nodeName: string = '';
  isRunEnable : boolean = false;
  objectType : string = 'select';
  dataFlowStatus : any[] = [];
  runId: string = '';
  nodeLogs: any[] = [];
  pollingInterval: any;
  currentNodeColumns : any[] = [];
  logs : any = '';
  isLogShow : boolean = false;
  selectedGroupAttrs: any[] = [];
  groupAttributesList: any[] = [];
  allChecked: boolean = false;
  isSourceClicked : boolean = false;
  isRefrshEnable: boolean = false;
  dataFlowRunStatus: string = '';
  expression: string = '';
  selectedField: any = {};
  groupedColumns: any = {};
  selectedGroup: any = '';
  selectedColumn: any = {};
  selectedIndex: number = -1;
  isJoinerCondition: boolean = false;
  isCanvasSelected: boolean = false;
  canvasData: any = {parameters: [], sqlParameters: []};
  isParameter: boolean = false;
  isSQLParameter: boolean = false;
  isHaving : boolean = false;
  isWhere : boolean = false;
  isFilter : boolean = false;
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
  type: any = 1;
  fileSelectType: string = 'dataSource';
  sourcePath: string = '';
  selectedFile: any = '';
  Folders: any[] = [];
  expEditorAddType: string = 'transforms';
  flowId: string = '';
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
  }
  dataTypes: string[] = [
    // Numeric types
    'smallint', 'number', 'integer', 'bigint', 'decimal', 'numeric', 'real', 'double precision', 'serial', 'bigserial', 'money', 'double', 'float', 'int',

    // Character types
    'char', 'character', 'varchar', 'character varying', 'text', 'string', 'any',
  
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
  activeTab: string = 'sources';
  isEditing: boolean = false;
  isValidFlowName: boolean = false;
  viewMode: string = 'list';
  componentsContent: any = {
    sources: [
      { id: 1, name: 'PostgreSQL', icon: 'fa-database', type: 'source_data_object' },
      { id: 6, name: 'MySQL', icon: 'fa-database', type: 'source_data_object' },
      { id: 7, name: 'MongoDB', icon: 'fa-leaf', type: 'source_data_object' },
      { id: 8, name: 'Oracle', icon: 'fa-database', type: 'source_data_object' },
      { id: 2, name: 'CSV', icon: 'fa-file', type: 'source_data_object' },
      { id: 3, name: 'Remote', icon: 'fa-server', type: 'source_data_object' },
    ],
    targets: [
      { id: 1, name: 'PostgreSQL', icon: 'fa-database', type: 'target_data_object' },
      { id: 6, name: 'MySQL', icon: 'fa-database', type: 'target_data_object' },
      { id: 7, name: 'MongoDB', icon: 'fa-leaf', type: 'target_data_object' },
      { id: 8, name: 'Oracle', icon: 'fa-database', type: 'target_data_object' }
    ],
    transforms: [
      { name: 'Expression', icon: 'fa-calculator', type: 'Expression' },
      { name: 'Joiner', icon: 'fa-link', type: 'Joiner' },
      { name: 'Rollup', icon: 'fa-layer-group', type: 'Rollup' },
      { name: 'Filter', icon: 'fa-filter', type: 'Filter' },
      { name: 'Rank', icon: 'fa-sort-numeric-up', type: 'Rank' },
      { name: 'Pivot', icon: 'fa-table', type: 'Pivot' },
      { name: 'Union', icon: 'fa-object-group', type: 'Union' },
      { name: 'Router', icon: 'fa-route', type: 'Router' },
      { name: 'Update Strategy', icon: 'fa-sync-alt', type: 'UpdateStrategy' }
    ]
  }
  isFromMonitor: boolean = false;
  remoteFileType: string = 'csv';
  remoteFilePath: string = '';
  remoteServerFiles: string = '';
  selectedRemoteServerFile: string= '';
  maximumConditionsReached: boolean = false;
  @ViewChild('nameInput') nameInput!: ElementRef;
  private isComponentDestroyed = false;
  private pollingTimeout: any;
  filteredDropdownItems: any[] = [];

  constructor(private modalService: NgbModal, private toasterService: ToastrService, private workbechService: WorkbenchService, 
    private loaderService: LoaderService, private router: Router,private route: ActivatedRoute, private sharedService: SharedService) {
      
      if (this.router.url.startsWith('/datamplify/flowboardList/flowboard')) {
        if (route.snapshot.params['id1']) {
          const id = atob(route.snapshot.params['id1']);
          this.dataFlowId = id.toString();
        }
      } else if (this.router.url.startsWith('/datamplify/monitor/flowboard')) {
        if (route.snapshot.params['id1']) {
          const id = atob(route.snapshot.params['id1']);
          this.dataFlowId = id.toString();
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

      if(this.dataFlowId){
        this.getDataFlow();
      }

      if(this.sharedService.isFlowboardCopied){
        this.duplicateFlowboard();
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
          this.tableTabId = 7;
        }
      });

      this.drawflow.on('connectionCreated', (connection: any) => {

        const module = this.drawflow.module;
        const data = this.drawflow.drawflow.drawflow[module].data;

        const { input_id, input_class, output_id, output_class } = connection;
        const inputNode = data[input_id];
        const outputNode = data[output_id];
        const inputPort = inputNode.inputs[input_class];
        const nodeType = inputNode.data.type;
        if(outputNode.data.type === 'Router'){
          this.selectedNode = outputNode;
          this.selectedNode.data.nodeData.properties.router.conditions[output_class.charAt(output_class.length - 1)-1].targetNodes.push(inputNode);
          this.selectedNode.data.nodeData.properties.router.conditions[output_class.charAt(output_class.length - 1)-1].isVisible = true;
          this.updateNode('');
        }
        if (!['Joiner', 'Union'].includes(nodeType) && inputPort.connections.length > 1) {
          const lastConnection = inputPort.connections[inputPort.connections.length - 1];
          this.drawflow.removeSingleConnection(lastConnection.node, input_id, lastConnection.input, input_class);
          this.toasterService.info('Connection limit exceeded!', 'info', { positionClass: 'toast-top-right' });
        }
        if (nodeType === 'Union' && inputPort.connections.length > 4) {
          const lastConnection = inputPort.connections[inputPort.connections.length - 1];
          this.drawflow.removeSingleConnection(lastConnection.node, input_id, lastConnection.input, input_class);
          this.toasterService.info('Connection limit exceeded!', 'info', { positionClass: 'toast-top-right' });
        }
        if(nodeType === 'Joiner') {
          this.getConnectionData(connection);
        }
        this.getDropdownColumnsData(this.drawflow.getNodeFromId(input_id));
      });
      this.drawflow.on('connectionSelected', (connection: any) => {
        // this.getConnectionData(connection);
      });

      this.drawflow.on('connectionRemoved', (connection: any) => {
        const { input_id, input_class, output_id, output_class } = connection;

        const sourceNode = this.drawflow.getNodeFromId(output_id);
        const targetNode = this.drawflow.getNodeFromId(input_id);

        if (targetNode.data.type === 'Joiner') {
          const nodeNamesDropdown = targetNode.data.nodeData.properties.nodeNamesDropdown;
          const sourceNodeName = sourceNode.data.nodeData.general.name;
      
          const index = nodeNamesDropdown.findIndex((item:any) => item.label === sourceNodeName);
          if (index !== -1) {
            const sourceNodeValue = nodeNamesDropdown[index].value;
            nodeNamesDropdown.splice(index, 1);

            const joinList = targetNode.data.nodeData.properties.joinList;
            const joinIndex = joinList.findIndex((join:any) => join.sourceNodeId === sourceNodeValue);
            if (joinIndex !== -1) {
              joinList.splice(joinIndex, 1);
            }

            if (targetNode.data.nodeData.properties.primaryObject?.value === sourceNodeValue) {
              targetNode.data.nodeData.properties.primaryObject = null;
            }

            if(nodeNamesDropdown.length <= 1){
              targetNode.data.nodeData.properties.joinList = [];
            }
            this.drawflow.updateNodeDataFromId(targetNode.id, targetNode.data);
            this.updateDropdownList(targetNode);
          }
        }
        this.selectedNode = this.drawflow.getNodeFromId(input_id);
        if (this.selectedNode.data.type === 'target_data_object' && !this.selectedNode.data.nodeData.properties.create) {
          const mapper = this.selectedNode.data.nodeData.attributeMapper
          if (mapper.length > 0) {
            mapper.forEach((attr: any) => {
              attr.selectedColumn = null;
              attr.selectedDataType = '';
            });
          }
          this.selectedNode.data.nodeData.properties.truncate = false;
        } else if(this.selectedNode.data.type === 'Expression'){
          this.selectedNode.data.nodeData.attributes = [];
        } else if(this.selectedNode.data.type === 'Rollup'){
          this.selectedNode.data.nodeData.attributes = [];
          this.selectedNode.data.nodeData.properties.havingClause = '';
          this.selectedNode.data.nodeData.groupAttributes = [];
        } else if(this.selectedNode.data.type === 'Joiner'){
          this.selectedNode.data.nodeData.attributes = [];
          this.selectedNode.data.nodeData.properties.whereClause = '';
        } else if(this.selectedNode.data.type === 'filter'){
          this.selectedNode.data.nodeData.properties.filterCondition = '';
        } else if(this.selectedNode.data.type === 'Rank'){
          this.selectedNode.data.nodeData.properties.rank = { rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' };
        } else if(this.selectedNode.data.type === 'Pivot'){
          this.selectedNode.data.nodeData.properties.pivot = { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' };
        } else if(this.selectedNode.data.type === 'Union'){
          this.selectedNode.data.nodeData.properties.union = { sourceNodes: [], columnMappings: [], type: 'UNION' };
        } else if(this.selectedNode.data.type === 'Router'){
          this.selectedNode.data.nodeData.properties.router.conditions = [
            { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
            { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
            { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
            { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
          ];
        }
        this.getDropdownColumnsData(this.selectedNode);
        if(this.selectedNode.hasOwnProperty('data')){
          const node = this.drawflow.getNodeFromId(this.selectedNode.id);
          this.getSelectedNodeData(node);
        }
        const outputNode = this.drawflow.getNodeFromId(output_id);
        if(outputNode.data.type === 'Router'){
          this.selectedNode = outputNode;
          this.selectedNode.data.nodeData.properties.router.conditions[output_class.charAt(output_class.length - 1)-1] = { conditionName: `condition_${output_class.charAt(output_class.length - 1)}`, condition: '', isVisible: false, targetNodes: [] };
          this.updateNode('');
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
            if(this.selectedNode.data.type === 'Union'){
              this.selectedNode.data.nodeData.properties.union.sourceNodes = this.getConnectedInputNodes(node);
            }
            if(this.selectedNode.data.type === 'Joiner'){
              this.updateDropdownList(this.selectedNode);
            }
          });
        }
      });

      // this.drawflow.on('nodeUnselected', () => {
      //   this.selectedNode = {data: {type: '', nodeData: {general: {name: this.etlName}}}};
      //   this.isNodeSelected = true;
      // });

      const allNodes = this.drawflow.drawflow.drawflow[this.drawflow.module].data;
      Object.entries(allNodes).forEach(([id, node]) => {
        console.log('Node ID:', id, 'Node Data:', node);
      });
    }, 100);
  }

  // getConnectionData(connection: any) {
  //   const { output_id, input_id } = connection;

  //   const sourceNode = this.drawflow.getNodeFromId(output_id);
  //   const targetNode = this.drawflow.getNodeFromId(input_id);

  //   if(targetNode.data.type === 'Joiner'){
  //     targetNode.data.nodeData.properties.nodeNamesDropdown.push({label: sourceNode.data.nodeData.general.name, value: sourceNode.id});
  //     if(targetNode.data.nodeData.properties.nodeNamesDropdown.length > 1){
  //       targetNode.data.nodeData.properties.joinList.push({joinType: '', secondaryObject: null, joinCondition: '', sourceNodeId: sourceNode.id, joinObject: null});
  //     }
  //     this.drawflow.updateNodeDataFromId(targetNode.id, targetNode.data);
  //   }

  //   console.log('Output Node ID:', output_id);
  //   console.log('Input Node ID:', input_id);
  //   console.log('Source Node:', sourceNode);
  //   console.log('Target Node:', targetNode);
  // }

  getConnectionData(connection: any) {
    const { output_id, input_id } = connection;

    const sourceNode = this.drawflow.getNodeFromId(output_id);
    const targetNode = this.drawflow.getNodeFromId(input_id);

    if (targetNode.data.type === 'Joiner') {
      const dropdown = targetNode.data.nodeData.properties.nodeNamesDropdown;
      const joinList = targetNode.data.nodeData.properties.joinList;
      const primaryObject = targetNode.data.nodeData.properties.primaryObject;
      const sourceName = sourceNode.data.nodeData.general.name;

      // <-- push the new source into dropdown (you flagged this)
      dropdown.push({ label: sourceName, value: sourceNode.id });

      // expected joinList length should always be dropdown.length - 1
      const expectedJoinListLength = dropdown.length - 1;

      // checks
      const hasMultipleDropdowns = dropdown.length > 1;
      const isNotInSecondaryObjects = !joinList.some((j:any) => j.secondaryObject === sourceName);
      const isNotPrimaryObject = sourceName !== primaryObject?.label;
      const isLengthMismatch = joinList.length !== expectedJoinListLength;

      // Only push a new join entry when all conditions are true
      if (hasMultipleDropdowns && isNotInSecondaryObjects && isNotPrimaryObject && isLengthMismatch) {
        joinList.push({
          joinType: '',
          secondaryObject: null,
          joinCondition: '',
          sourceNodeId: sourceNode.id,
          joinObject: null
        });
      }

      // update node data
      this.drawflow.updateNodeDataFromId(targetNode.id, targetNode.data);
      this.updateDropdownList(targetNode);
    }

    console.log('Output Node ID:', output_id);
    console.log('Input Node ID:', input_id);
    console.log('Source Node:', sourceNode);
    console.log('Target Node:', targetNode);
  }

  getFilteredDropdownItems(selectedNode:any) {
    const dropdown = selectedNode.data.nodeData.properties.nodeNamesDropdown || [];
    const primaryObject = selectedNode.data.nodeData.properties.primaryObject;
    const joinList = selectedNode.data.nodeData.properties.joinList || [];

    // Collect all secondaryObjects from joinList
    const secondaryObjects = joinList
      .map((j: any) => j.secondaryObject)
      .filter((s: any) => !!s);

    // Return dropdown items with "disabled" flag
    return dropdown.map((item: any) => ({
      ...item,
      disabled: item?.label === primaryObject?.label || secondaryObjects?.includes(item?.label)
    }));
  }

  updateDropdownList(node:any) {
    this.filteredDropdownItems = this.getFilteredDropdownItems(node);
  }

  joinListUpdate(event:any, index:any){
    this.selectedNode.data.nodeData.properties.joinList[index].secondaryObject = event.label;
    this.selectedNode.data.nodeData.properties.joinList[index].sourceNodeId = event.value;
    this.updateNode('properties');
  }

  onDragStart(event: DragEvent, nodeType: string, modal: any, sourceOrTargetType:any) {
    this.nodeToAdd = nodeType;
    this.modal = modal;
    this.type = sourceOrTargetType;
    console.log(`🎯 FlowBoard: Dragging ${nodeType}, type set to: ${sourceOrTargetType}`);
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

    if (['source_data_object', 'target_data_object'].includes(this.nodeToAdd)) {
      this.modalService.open(this.modal, {
        centered: true,
        windowClass: 'animate__animated animate__zoomIn',
        modalDialogClass: 'modal-md'
      });
      // Always get all connections regardless of which source/target was dragged
      this.getConnections();
    } else {
      this.addNode(this.nodeToAdd, this.posX, this.posY);
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
    let data = { 
      type: '', 
      source: { type: '',  fileSelectFrom: '', path: '', file: '' },
      nodeData: { 
        general: { name: '' }, 
        connection: {}, dataObject: {}, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes: [], 
        groupAttributes: [],
        sourceAttributes: [],
        attributeMapper: [] as any[]
      } 
    };
    let iconPath = '';
    let altText = '';
    let baseName = name;
    let inputNodeCount = 1;
    let outputNodeCount = 1;

    if (baseName === 'source_data_object') {
      // Use the database type from the selected connection instead of this.type
      const connectionDbType = this.selectedConnection?.dbType || this.type;
      
      if (connectionDbType === 1) {
        iconPath = './assets/images/etl/PostgreSQL-etl.svg';
        altText = 'PostgreSQL';
        data.source = {type: connectionDbType, fileSelectFrom: this.fileSelectType, path: this.sourcePath, file: this.selectedFile};
      } else if(connectionDbType === 2){
        iconPath = './assets/images/etl/File-etl.svg';
        altText = 'file';
        data.source = {type: connectionDbType, fileSelectFrom: this.fileSelectType, path: this.sourcePath, file: this.selectedFile};
      } else if(connectionDbType === 3){
        iconPath = './assets/images/icons_new/SFTP.png';
        altText = 'sftp';
        data.source = {type: connectionDbType, fileSelectFrom: '', path: this.remoteFilePath, file: this.selectedRemoteServerFile};
      } else if(connectionDbType === 6){
        iconPath = './assets/images/icons_new/MYSQL.svg';
        altText = 'MySQL';
        data.source = {type: connectionDbType, fileSelectFrom: this.fileSelectType, path: this.sourcePath, file: this.selectedFile};
      } else if(connectionDbType === 7){
        iconPath = './assets/images/etl/MongoDB-etl.svg'; // You may need to create this icon
        altText = 'MongoDB';
        data.source = {type: connectionDbType, fileSelectFrom: this.fileSelectType, path: this.sourcePath, file: this.selectedFile};
      } else if(connectionDbType === 8){
        iconPath = './assets/images/icons_new/ORACLE.svg';
        altText = 'Oracle';
        data.source = {type: connectionDbType, fileSelectFrom: this.fileSelectType, path: this.sourcePath, file: this.selectedFile};
      }
      data.type = name;
      // data.source = {type: this.type, fileSelectFrom: this.fileSelectType, path: this.sourcePath, file: this.selectedFile};
      data.nodeData = { 
        connection: this.selectedConnection, 
        dataObject: this.selectedDataObject, 
        general: { name: 'SRC_' + this.selectedDataObject?.tables }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      };
      inputNodeCount = 0;
      outputNodeCount = 1;
    }
    else if (baseName === 'target_data_object') {
      // Use the database type from the selected connection instead of this.type
      const connectionDbType = this.selectedConnection?.dbType || this.type;
      
      if (connectionDbType === 1) {
        iconPath = './assets/images/etl/PostgreSQL-etl.svg';
        altText = 'PostgreSQL';
      } else if(connectionDbType === 2){
        iconPath = './assets/images/etl/File-etl.svg';
        altText = 'file';
      } else if(connectionDbType === 6){
        iconPath = './assets/images/icons_new/MYSQL.svg';
        altText = 'MySQL';
      } else if(connectionDbType === 7){
        iconPath = './assets/images/etl/MongoDB-etl.svg'; // You may need to create this icon
        altText = 'MongoDB';
      } else if(connectionDbType === 8){
        iconPath = './assets/images/icons_new/ORACLE.svg';
        altText = 'Oracle';
      }
      data.type = name;
      data.nodeData = { 
        connection: this.selectedConnection, 
        dataObject: this.selectedDataObject, 
        general: { name: 'TGT_' + (this.objectType === 'select' ? this.selectedDataObject?.tables : this.selectedDataObject) }, 
        properties: { truncate: false, create: this.objectType === 'select' ? false : true, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      };
      inputNodeCount = 1;
      outputNodeCount = 0;
      if(!data.nodeData.properties.create){
        let cols : any[] = [];
        for (const col of this.selectedDataObject.columns) {
          cols.push({
            column: col.col,
            dataType: col.dtype,
            selectedColumn: null,
            selectedDataType: ''
          });
        }
        data.nodeData.attributeMapper = cols;
      }
    }
    else if (baseName === 'Expression') {
      iconPath = './assets/images/etl/expression-etl.svg';
      altText = 'Expression';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `expression_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
    }
    else if (baseName === 'Joiner') {
      iconPath = './assets/images/etl/mjoiner-etl.svg';
      altText = 'Joiner';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `joiner_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: [] 
      }
    }
    else if (baseName === 'Rollup') {
      iconPath = './assets/images/etl/rollup-etl.svg';
      altText = 'Rollup';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `rollup_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
    }
    else if (baseName === 'Filter') {
      iconPath = './assets/images/etl/filter-etl.svg';
      altText = 'Filter';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `filter_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
    }
    else if (baseName === 'Rank') {
      iconPath = './assets/images/etl/filter-etl.svg';
      altText = 'Rank';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `rank_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
    }
    else if (baseName === 'Pivot') {
      iconPath = './assets/images/etl/filter-etl.svg';
      altText = 'Pivot';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `pivot${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
    }
    else if (baseName === 'Union') {
      iconPath = './assets/images/etl/filter-etl.svg';
      altText = 'Union';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `union_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
    }
    else if (baseName === 'Router') {
      iconPath = './assets/images/etl/filter-etl.svg';
      altText = 'Router';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `router_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes:[], 
        groupAttributes:[],
        sourceAttributes: [],
        attributeMapper: []
      }
      outputNodeCount = 4;
    }
    else if (baseName === 'UpdateStrategy') {
      iconPath = './assets/images/etl/filter-etl.svg';
      altText = 'Update Strategy';
      data.type = baseName;
      this.nodeTypeCounts[baseName] = (this.nodeTypeCounts[baseName] || 0) + 1;
      data.nodeData = { 
        connection: {}, 
        dataObject: {}, 
        general: { name: `update_strategy_${this.nodeTypeCounts[baseName]}` }, 
        properties: { truncate: false, create: false, havingClause: '', filterCondition: '', whereClause: '', nodeNamesDropdown: [], primaryObject: null, joinList: [], updateStrategy: 'append', keyColumns: [],
          rank:{ rankType: '', orderByCols: [], partitionByCols: [], rankColumnName: '', sortType: 'top', records: '' },
          pivot: { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: '' },
          union: { sourceNodes: [], columnMappings: [], type: 'UNION' },
          router: {
            conditions: [
              { conditionName: `condition_1`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_2`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_3`, condition: '', isVisible: false, targetNodes: [] },
              { conditionName: `condition_4`, condition: '', isVisible: false, targetNodes: [] }
            ]
          }
         }, 
        attributes: [], 
        groupAttributes: [],
        sourceAttributes: [],
        attributeMapper: [] as any[]
      };
      inputNodeCount = 1;
      outputNodeCount = 1;
    }
    data.nodeData.general.name = data.nodeData.general.name.replace(/ /g, '_');
    let displayName = data.nodeData.general.name;
    if (displayName.length > 10) {
      displayName = displayName.substring(0, 10) + '..';
    }
    var html = document.createElement('div');
    html.innerHTML = `<div class="d-flex flex-column align-items-center">
      <img src="${iconPath}" class="node-icon" alt="${altText}" />
      <div class="node-label" title="${data.nodeData.general.name}">${displayName}</div>
      <div class="node-status" style="display: none;"></div>
      </div>`;

    // this.drawflow.registerNode(name, html);
    const nodeId = this.drawflow.addNode(name, inputNodeCount, outputNodeCount, posX, posY, name, data, html.innerHTML);

    this.selectedConnection = null;
    this.selectedDataObject = null;
    this.objectType = 'select';
    this.fileSelectType = 'dataSource'; 
    this.sourcePath = ''; 
    this.selectedFile = '';
    const allNodes = this.drawflow.drawflow.drawflow[this.drawflow.module].data;
    Object.entries(allNodes).forEach(([id, node]) => {
      console.log('Node ID:', id, 'Node Data:', node);
    });

    setTimeout(() => {
      const node = this.drawflow.getNodeFromId(nodeId);
      this.selectedNode = node;

      if (this.selectedNode.data.type === 'source_data_object') {
        this.openAttributesSelection(null);
        this.groupAttributesList.forEach((group: any) => {
          group.isChecked = true;
          this.toggleGroup(group);
        });
        this.isSourceClicked = true;
        this.applySelectedAttributes();
      }
      if (this.selectedNode.data.type === 'Router'){
        this.hideAllOutputPort(node);
      }
    }, 0);
  }

  updateNode(type: any, nameInput?: any, index?: any, conditionName?: any) {
    let data = {};
    let nodeId = '';
    let previousName = '';
    if(type !== 'parameter'){
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
      if(['target_data_object'].includes(this.selectedNode.data.type) && this.selectedNode.data.nodeData.properties.create){
        let currentDataObject;
        currentDataObject = general.name;
        data = {
          ...this.selectedNode.data,
          nodeData: {
            ...this.selectedNode.data.nodeData,
            general: general,
            dataObject: currentDataObject
          }
        };
      } else{
        data = {
          ...this.selectedNode.data,
          nodeData: {
            ...this.selectedNode.data.nodeData,
            general: general
          }
        };
      }

      let displayName = general.name;
      if (displayName.length > 5) {
        displayName = displayName.substring(0, 5) + '..';
      }
      this.selectedNode.data.nodeData.general.name = general.name;
      const nodeElement = document.querySelector(`#node-${nodeId}`);
      if (nodeElement) {
        const labelElement = nodeElement.querySelector('.node-label') as HTMLElement;
        if (labelElement) {
          labelElement.innerText = displayName;
          labelElement.setAttribute('title', general.name);
        }
      }
      this.updateNextConnectedNodes(nodeId, previousName, general.name);
    } else if (type === 'properties') {
      nodeId = this.selectedNode.id;

      data = {
        ...this.selectedNode.data
      };
    } else if (type === 'attribute') {
      nodeId = this.selectedNode.id;

      data = {
        ...this.selectedNode.data
      };
    } else if (type === 'groupAttribute'){
      nodeId = this.selectedNode.id;

      data = {
        ...this.selectedNode.data
      };
    } else if(type === 'parameter'){
      const module = this.drawflow.module || 'Home';
      this.drawflow.drawflow.drawflow[module].canvasData = this.canvasData;
    } else{
      nodeId = this.selectedNode.id;

      data = {
        ...this.selectedNode.data
      };
      if (this.selectedNode.data.type === 'Router' && index) {
        const nodeElement = document.querySelector(`#node-${this.selectedNode.id}`);

        if (nodeElement) {
          const portEl = nodeElement.querySelector(`.output_${index}`) as HTMLElement;
          if (portEl) {
            portEl.setAttribute('title', conditionName);
          }
        }
      }
    }
    if(type !== 'parameter'){
      this.drawflow.updateNodeDataFromId(nodeId, data);
      const allNodes = this.drawflow.drawflow.drawflow[this.drawflow.module].data;
      Object.entries(allNodes).forEach(([id, node]) => {
        this.getDropdownColumnsData(node);
      });
    }
    if (this.selectedNode.data.type === 'Joiner') {
      this.updateDropdownList(this.selectedNode);
    }
    console.log(this.drawflow.drawflow.drawflow[this.drawflow.module]);
  }

  updateNextConnectedNodes(parentNodeId: number | string, oldName: string, newName: string) {
    const parentNode = this.drawflow.getNodeFromId(parentNodeId);
    const outputs = parentNode.outputs;

    for (const key in outputs) {
      const connections = outputs[key]?.connections ?? [];
      for (const conn of connections) {
        const childId = conn.node;
        const childNode = this.drawflow.getNodeFromId(childId);

        if (!childNode?.data?.nodeData) continue;

        const nodeData = childNode.data.nodeData;
        const props = nodeData.properties;

        if (childNode.data.type === 'Joiner') {
          const index = props.nodeNamesDropdown.findIndex((item: any) => item.label === oldName);
          if (index !== -1) {
            props.nodeNamesDropdown[index].label = newName;
          }

          if (props.primaryObject.label === oldName) {
            props.primaryObject.label = newName;
          }

          if (props.joinList?.length) {
            props.joinList.forEach((join: any) => {
              if (join.secondaryObject === oldName) {
                join.secondaryObject = newName;
              }
              if (join.joinObject.label === oldName) {
                join.joinObject.label = newName;
              }
              if (join.joinCondition && typeof join.joinCondition === 'string') {
                const regex = new RegExp(`\\b${oldName}\\b`, 'g'); // match exact word
                join.joinCondition = join.joinCondition.replace(regex, newName);
              }
              if (nodeData.whereClause) {
                nodeData.whereClause = nodeData.whereClause.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
              }
            });
          }

          this.drawflow.updateNodeDataFromId(childNode.id, childNode.data);
        }
        if (nodeData.filterCondition && typeof nodeData.filterCondition === 'string') {
          nodeData.filterCondition = nodeData.filterCondition.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
          this.drawflow.updateNodeDataFromId(childNode.id, childNode.data);
        }
        if (nodeData.havingClause && typeof nodeData.havingClause === 'string') {
          nodeData.havingClause = nodeData.havingClause.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
          this.drawflow.updateNodeDataFromId(childNode.id, childNode.data);
        }
        if (Array.isArray(nodeData.attributes) && nodeData.attributes.length > 0) {
          nodeData.attributes = nodeData.attributes.map((attr: any) => {
            if (attr.expression && typeof attr.expression === 'string') {
              attr.expression = attr.expression.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
            }
            return attr;
          });
          this.drawflow.updateNodeDataFromId(childNode.id, childNode.data);
        }
        if (Array.isArray(nodeData.groupAttributes) && nodeData.groupAttributes.length > 0) {
          nodeData.groupAttributes.forEach((attr: any) => {
            if (Array.isArray(attr.selectColumnDropdown)) {
              attr.selectColumnDropdown.forEach((col: any) => {
                if (typeof col.group === 'string') {
                  col.group = col.group.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
                }
              });
            }

            if (attr.selectedColumn) {
              if (typeof attr.selectedColumn.group === 'string') {
                attr.selectedColumn.group = attr.selectedColumn.group.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
              }
            }
          });
          this.drawflow.updateNodeDataFromId(childNode.id, childNode.data);
        }
        if (Array.isArray(nodeData.dataObject) && nodeData.dataObject.length > 0) {
          nodeData.dataObject.forEach((obj: any) => {
            if (typeof obj.group === 'string') {
              obj.group = obj.group.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
            }
          });
          this.drawflow.updateNodeDataFromId(childNode.id, childNode.data);
        }
        if (Array.isArray(parentNode.data.nodeData.sourceAttributes)) {
          parentNode.data.nodeData.sourceAttributes.forEach((attr: any) => {
            if (Array.isArray(attr.selectColumnDropdown)) {
              attr.selectColumnDropdown.forEach((col: any) => {
                if (typeof col.group === 'string') {
                  col.group = col.group.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
                }
              });
            }
            if (attr.selectedColumn) {
              if (typeof attr.selectedColumn.group === 'string') {
                attr.selectedColumn.group = attr.selectedColumn.group.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
              }
            }
          });
          this.drawflow.updateNodeDataFromId(parentNodeId, parentNode.data);
        }
        if (Array.isArray(props.router.conditions) && props.router.conditions.length > 0) {
          props.router.conditions.forEach((cond: any) => {
            if (typeof cond.condition === 'string' && cond.condition.trim() !== '') {
              cond.condition = cond.condition.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
            }
          });
        }
      }
    }
  }

  getSelectedNodeData(node: any) {
    this.isNodeSelected = true;
    this.selectedNode = node;
    this.nodeName = this.selectedNode.data.nodeData.general.name;
    console.log(this.selectedNode);
    this.selectedAttributeIndex = null;
    this.selectedGroupAttributeIndex = null;
    this.selectedSourceAttributeIndex = null;
    if(this.isRefrshEnable && !['success', 'failed'].includes(this.dataFlowRunStatus)){
      this.tableTypeTabId = 2;
      this.getDataFlowLogs(this.nodeName);
    } else {
      this.tableTypeTabId = 1;
    }
  }

  getConnections() {
    // Get all connections without specifying a type (this will get all types)
    console.log('🔍 FlowBoard: Getting all connections...');
    
    this.workbechService.getConnectionsForEtl(null).subscribe({
      next: (data) => {
        console.log('📊 FlowBoard connections response:', data);
        console.log(`🎯 Total connections found: ${data.data?.length || 0}`);
        
        if (data.data) {
          data.data.forEach((conn: any, index: number) => {
            console.log(`   ${index + 1}. ${conn.display_name} (${conn.server_type})`);
          });
        }
        
        this.connectionOptions = data.data || [];
      },
      error: (error: any) => {
        console.error('❌ Error getting connections:', error);
        this.toasterService.error(error.error?.message || 'Failed to load connections', 'error', { positionClass: 'toast-top-right' });
        this.connectionOptions = [];
      }
    });
  }
  getDataObjects() {
    if (this.selectedConnection?.hierarchy_id) {
      console.log('🔍 Getting data objects for connection:', this.selectedConnection);
      console.log('🔗 API call: Server_tables/' + this.selectedConnection.hierarchy_id);
      this.workbechService.getTablesForDataTransformation(this.selectedConnection.hierarchy_id).subscribe({
        next: (data) => {
          console.log('📊 Data objects response:', data);
          this.dataObjectOptions = data?.tables;
          console.log('📋 Available data objects:', this.dataObjectOptions);
          
          if (!this.dataObjectOptions || this.dataObjectOptions.length === 0) {
            console.log('⚠️ No data objects found - check if MongoDB collections are being returned');
          }
        },
        error: (error) => {
          console.error('❌ Error getting data objects:', error);
          console.error('❌ Error details:', error.error);
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        }
      });
    }
  }
  getDataObjectsforFile(){
    if (this.selectedConnection?.hierarchy_id) {
      this.workbechService.getDataObjectsForFile(this.selectedConnection.hierarchy_id).subscribe({
        next: (data) => {
          console.log(data);
          this.selectedDataObject = data?.tables[0];
        },
        error: (error) => {
          console.log(error);
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        }
      });
    }
  }
  getFilesforServer() {
    this.workbechService.getFilesForServer(this.sourcePath).subscribe({
      next: (data) => {
        console.log(data);
        this.Folders = data?.files || [];
      },
      error: (error) => {
        console.log(error);
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }
  getDataObjectsFromServer() {
    let object = {
      source_type: this.sourcePath,
      file_name: this.selectedFile,
    }
    this.workbechService.getDataObjectsFromServer(object).subscribe({
      next: (data) => {
        console.log(data);
        this.selectedDataObject = data?.tables[0];
      },
      error: (error) => {
        console.log(error);
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  saveOrUpdateEtlDataFlow() {
    const exportedData = this.drawflow.export();
    const nodes = exportedData.drawflow.Home.data;

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

        const taskA = this.generateTasks(current, nodes);
        if (!tasks.some(t => t.id === taskA.id)) {
          tasks.push(taskA);
        }
        const taskB = this.generateTasks(target, nodes);
        if (!tasks.some(t => t.id === taskB.id)) {
          tasks.push(taskB);
        }

        queue.push(target);
      }
    }

    for (const nodeIdStr in nodes) {
      const nodeId = Number(nodeIdStr);
      const node = nodes[nodeId];
      const existing = tasks.some(t => t.id === node.data.nodeData.general.name);
      if (!existing) {
        const task = this.generateTasks(nodeId, nodes);
        tasks.push(task);
      }
    }

    console.log(tasks);
    console.log(flows);

    if(tasks.length > 0){
      this.isRunEnable = tasks.some((task: any) => task.type === 'target_data_object');
    }

    const params = exportedData?.drawflow?.Home?.canvasData?.parameters?.map((param: any) => ({
      param_name: param?.paramName,
      data_type: param?.dataType,
      value: param?.default || ''
    })) || [];

    const sqlParams = exportedData?.drawflow?.Home?.canvasData?.sqlParameters?.map((param: any) => ({
      param_name: param?.paramName,
      data_type: param?.dataType,
      query: param?.sql,
      value: param?.default || '',
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
    // const flow_type = 'dataflow';

    const formData = new FormData();
    formData.append('drawflow', file);
    formData.append('flow_plan', JSON.stringify(etlFlow));
    formData.append('flow_name', this.etlName);

    // formData.append('transformation_flow', file);
    // formData.append('ETL_flow', JSON.stringify(etlFlow));
    // formData.append('flow_type', flow_type);

    if(this.dataFlowId){
      formData.append('id', this.dataFlowId);
      this.workbechService.updateEtl(formData).subscribe({
        next: (data: any) => {
          console.log(data);
          this.isRunEnable = true;
          this.dataFlowId = data.Flow_Board_id;
          this.toasterService.success(data.message, 'success', { positionClass: 'toast-top-right' });
        },
        error: (error: any) => {
          this.isRunEnable = false;
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          console.log(error);
        }
      });
    } else{
      this.workbechService.saveEtl(formData).subscribe({
        next: (data: any) => {
          console.log(data);
          this.isRunEnable = true;
          this.dataFlowId = data.Flow_Board_id;
          const encodedId = btoa(this.dataFlowId.toString());
          this.router.navigate(['/datamplify/flowboardList/flowboard/'+encodedId]);
          this.toasterService.success('Flowboard Saved Successfully', 'success', { positionClass: 'toast-top-right' });
        },
        error: (error: any) => {
          this.isRunEnable = false;
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
          console.log(error);
        }
      });
    }
  }
  runDataFlow() {
    this.workbechService.runEtl(this.flowId, 'flowboard').subscribe({
      next: (data: any) => {
        console.log(data);
        this.isRefrshEnable = true;
        this.runId = data.run_id;
        this.isRunEnable = false;
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
        this.getDataFlowStatus(data.run_id);
        this.toasterService.success('Run Successfully', 'success', { positionClass: 'toast-top-right' });
      },
      error: (error: any) => {
        this.isRefrshEnable = false;
        this.isLogShow = false;
        this.isRunEnable = true;
        if (error?.error?.message?.detail?.includes('not found')) {
          this.toasterService.info('Please Run After 5 seconds.', 'info', { positionClass: 'toast-top-right' });
        } else {
          this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        }
        console.log(error);
      }
    });
  }
  getDataFlowStatus(runId : any){
    if (this.isComponentDestroyed) return;
    let object = {
      dag_id: this.flowId,
      run_id: runId
    }
    this.workbechService.disableLoaderForNextRequest();
    this.workbechService.getDataFlowStatus(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.dataFlowStatus = data.tasks;
        this.dataFlowRunStatus = data.status;
        // if (this.dataFlowRunStatus !== '') {
        //   this.isLogShow = true;
        // }
        // if (data.status === 'success' || data.status === 'failed') {
        //   clearInterval(this.pollingInterval);
        // }

        Object.entries(this.drawflow.drawflow.drawflow[this.drawflow.module].data).forEach(([id, node]) => {
          const node1 = this.drawflow.getNodeFromId(id);
          const nodeName = node1.data.nodeData.general.name;

          // Find matching task status from dataFlowStatus
          const matchedTask = this.dataFlowStatus.find(task => task.task === nodeName);

          if (matchedTask) {
            let status = matchedTask.state;
            if (node1) {
              const nodeElement = document.querySelector(`#node-${id}`);
              if (nodeElement) {
                const statusDiv = nodeElement.querySelector('.node-status')  as HTMLElement;
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
        if(!['success', 'failed'].includes(data.status)){
          this.pollingTimeout = setTimeout(() => {
            this.getDataFlowStatus(runId);
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
  getDataFlowLogs(taskId:any){
    let object = {
      dag_id: this.flowId,
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

    if (nodes[nodeId].data.type === 'source_data_object') {
      let sourceAttr: any[] = [];
      nodes[nodeId].data.nodeData.sourceAttributes.forEach((atrr: any) => {
        const array = [atrr.attributeName, atrr.dataType, atrr.selectedColumn.label, atrr.selectedColumn.dataType];
        sourceAttr.push(array);
      });
      let attr: any[] = [];
      nodes[nodeId].data.nodeData.attributes.forEach((atrr: any) => {
        const array = [atrr.attributeName, atrr.dataType, atrr.expression];
        attr.push(array);
      });
      if (nodes[nodeId].data?.source?.type === 1) {
        task.format = 'database',
        task.hierarchy_id = nodes[nodeId].data.nodeData.connection.hierarchy_id;
        task.path = '';
      } else if(nodes[nodeId].data?.source?.type === 2) {
        task.format = 'file';
        if(nodes[nodeId].data.source.fileSelectFrom === 'server'){
          task.path = `${nodes[nodeId].data.source.path}/${nodes[nodeId].data.source.file}`;
          task.hierarchy_id = '';
        } else if(nodes[nodeId].data.source.fileSelectFrom === 'dataSource'){
          task.hierarchy_id = nodes[nodeId].data.nodeData.connection.hierarchy_id;
          task.path = '';
        }
      } else if(nodes[nodeId].data?.source?.type === 3){
        task.format = 'remote_server';
        task.hierarchy_id = nodes[nodeId].data.nodeData.connection.hierarchy_id;
        task.path = `${nodes[nodeId].data.source.path}/${nodes[nodeId].data.source.file}`;
      } else{
        task.format = 'database';
        task.hierarchy_id = nodes[nodeId].data.nodeData.connection.hierarchy_id;
        task.path = '';
      }
      task.source_table_name = nodes[nodeId].data.nodeData.dataObject.tables;
      task.attributes = attr;
      task.source_attributes = sourceAttr;
    } else {
      if (nodes[nodeId].data.type === 'target_data_object') {
        if(!nodes[nodeId].data.nodeData.properties.create){
          let attrMapper: any[] = [];
          nodes[nodeId].data.nodeData.attributeMapper.forEach((atrr: any) => {
            const array = [atrr.column, atrr.dataType, atrr.selectedColumn.label, atrr.selectedDataType];
            attrMapper.push(array);
          });
          task.attribute_mapper = attrMapper;
        }
        task.format = 'database',
        task.hierarchy_id = nodes[nodeId].data.nodeData.connection.hierarchy_id,
        task.path = '',
        task.target_table_name = nodes[nodeId].data.nodeData.properties.create ? nodes[nodeId].data.nodeData.dataObject : nodes[nodeId].data.nodeData.dataObject.tables;
        task.truncate = nodes[nodeId].data.nodeData.properties.truncate;
        task.create = nodes[nodeId].data.nodeData.properties.create;
        task.update_strategy = nodes[nodeId].data.nodeData.properties.updateStrategy || 'append';
        task.key_columns = (nodes[nodeId].data.nodeData.properties.keyColumns || []).map((c: any) => c.label || c);
      } else if(nodes[nodeId].data.type === 'UpdateStrategy'){
        task.update_strategy = nodes[nodeId].data.nodeData.properties.updateStrategy || 'append';
        task.key_columns = (nodes[nodeId].data.nodeData.properties.keyColumns || []).map((c: any) => c.label || c);
      } else if(nodes[nodeId].data.type === 'Rollup'){
        let grp : any[] = [];
        nodes[nodeId].data.nodeData.groupAttributes.forEach((atrr:any)=>{
          const array = [atrr.aliasName, '', atrr.selectedColumn.group+'.'+atrr.selectedColumn.label];
          grp.push(array);
        });
        let attr : any[] = [];
        nodes[nodeId].data.nodeData.attributes.forEach((atrr:any)=>{
          const array = [atrr.attributeName, atrr.dataType, atrr.expression];
          attr.push(array);
        });
        task.group_attributes = grp;
        task.having_clause = nodes[nodeId].data.nodeData.properties.havingClause;
        task.attributes = attr;
      } else if(nodes[nodeId].data.type === 'Filter'){
        task.filter_conditions = nodes[nodeId].data.nodeData.properties.filterCondition;
      } else if(nodes[nodeId].data.type === 'Joiner'){
        task.primary_table = nodes[nodeId].data.nodeData.properties.primaryObject.label;
        let joins : any[] = [];
        nodes[nodeId].data.nodeData.properties.joinList.forEach((join:any)=>{
          const array = [join.joinType, join.secondaryObject, join.joinCondition];
          joins.push(array);
        });
        let attr : any[] = [];
        nodes[nodeId].data.nodeData.attributes.forEach((atrr:any)=>{
          const array = [atrr.attributeName, atrr.dataType, atrr.expression];
          attr.push(array);
        });
        task.joining_list = joins;
        task.where_clause = nodes[nodeId].data.nodeData.properties.whereClause;
        task.attributes = attr;
      } else if(nodes[nodeId].data.type === 'Expression'){
        let exps : any[] = [];
        nodes[nodeId].data.nodeData.attributes.forEach((atrr:any)=>{
          const array = [atrr.attributeName, atrr.dataType, atrr.expression];
          exps.push(array);
        });
        task.expressions_list = exps;
      } else if(nodes[nodeId].data.type === 'Rank'){
        task.order_by_cols = nodes[nodeId].data.nodeData.properties.rank.orderByCols.map((obj:any)=> obj.label) || [];
        task.rank_type = nodes[nodeId].data.nodeData.properties.rank.rankType || '';
        task.partition_by_cols = nodes[nodeId].data.nodeData.properties.rank.partitionByCols.map((obj:any)=> obj.label) || [];
        task.rank_column_name = nodes[nodeId].data.nodeData.properties.rank.rankColumnName || '';
        task.sort = nodes[nodeId].data.nodeData.properties.rank.sortType || 'top';
        task.Records = nodes[nodeId].data.nodeData.properties.rank.records || 0;
        task.source_attributes = nodes[nodeId].data.nodeData.dataObject.map((obj:any)=> [obj.label, obj.dataType, obj.label, obj.dataType]) || [];
      } else if(nodes[nodeId].data.type === 'Pivot'){
        task.group_by_cols = nodes[nodeId].data.nodeData.properties.pivot.groupByCols.map((col:any)=> col.label)  || [];
        task.pivot_col = nodes[nodeId].data.nodeData.properties.pivot.pivotCol.label || '';
        task.value_cols = nodes[nodeId].data.nodeData.properties.pivot.valueCols.map((col:any)=>{ return {column: col.label, dtype: col.dataType} }) || [];
        task.pivot_values = nodes[nodeId].data.nodeData.properties.pivot.pivotValues.split(",").map((item:any) => item.trim()).filter((item:any) => item.length > 0) ?? [];
        task.aggregation = nodes[nodeId].data.nodeData.properties.pivot.aggregation || '';
      } else if(nodes[nodeId].data.type === 'Union'){
        task.column_mappings = nodes[nodeId].data.nodeData.properties.union.columnMappings || [];
        task.union_type = nodes[nodeId].data.nodeData.properties.union.type || 'UNION';
      } else if(nodes[nodeId].data.type === 'Router'){
        task.conditions = nodes[nodeId].data.nodeData.properties.router.conditions.filter((conn:any)=>conn.isVisible).map((condition:any)=> [condition.condition, condition.conditionName]) || [];
      }

      const inputConnections = nodes[nodeId].inputs?.input_1?.connections || [];
      if (inputConnections.length > 0) {
        const prevTaskIds = inputConnections.map((conn: any) => nodes[conn.node]);
        if (prevTaskIds[0].data.type === 'Router') {
          task.previous_instance_id = prevTaskIds[0].data.nodeData.general.name;
          const conditions = prevTaskIds[0].data.nodeData.properties.router.conditions.filter((cond:any)=>cond.isVisible);
          outer: for (let i = 0; i < conditions.length; i++) {
            const targetNodes = conditions[i].targetNodes;
            for(let j = 0; j < targetNodes.length; j++){
              if(targetNodes[j].data.nodeData.general.name === nodes[nodeId].data.nodeData.general.name){
                task.previous_task_id = conditions[i].conditionName;
                break outer;
              }
            }
          }
        } else{
          if (['Joiner', 'Union'].includes(nodes[nodeId].data.type)) {
            task.previous_task_id = prevTaskIds.map((node: any) => node.data.nodeData.general.name);
            task.previous_instance_id = prevTaskIds.map((node: any) => node.data.nodeData.general.name);
          } else {
            task.previous_task_id = prevTaskIds[0].data.nodeData.general.name;
            task.previous_instance_id = prevTaskIds[0].data.nodeData.general.name;
          }
        }
      }
    }

    return task;
  }
  addNewAttribute(){
    let count = this.selectedNode.data.nodeData.attributes.length+1;
    let attribute = {attributeName: 'ATTR_NAME_'+count, dataType: 'varchar', expression: ''}
    this.selectedNode.data.nodeData.attributes.push(attribute);
  }
  deleteAttribute(index:number){
    this.selectedNode.data.nodeData.attributes.splice(index, 1);
    this.updateNode('attribute');
  }
  addNewGroupAttribute(){
    let attribute = {aliasName: '', selectColumnDropdown: this.selectedNode.data.nodeData.dataObject, selectedColumn: null, dataType: '',}
    this.selectedNode.data.nodeData.groupAttributes.push(attribute);
  }
  deleteGroupAttribute(index:number){
    this.selectedNode.data.nodeData.groupAttributes.splice(index, 1);
    this.updateNode('groupattribute');
  }
  deleteSourceAttribute(index:number){
    this.selectedNode.data.nodeData.sourceAttributes.splice(index, 1);
    this.updateNode('');
  }
  startPollingDataFlowStatus(runId: any) {
    // Clear any existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  
    this.pollingInterval = setInterval(() => {
      this.getDataFlowStatus(runId);
    }, 2000); // Poll every 3 seconds
  }

  getDropdownColumnsData(node:any){
    let childrenList = [];

    const inputIds: number[] = [];

    Object.values(node.inputs).forEach((input:any) => {
      input.connections.forEach((connection:any) => {
        inputIds.push(connection.node);
      });
    });

    childrenList = inputIds;

    const childDataObjects: any[] = [];
    const childAttributes: any[] = [];
    let childGrpAttributes: any = {};
    let childSourceAttributes: any = {};
    let childColumnMappings: any = {};
    const nodeNames: any[] = [];
    const nodeTypes: any[] = [];


    childrenList.forEach(childId => {
      const childNode = this.drawflow.getNodeFromId(childId);
      if (childNode?.data?.nodeData) {
        childDataObjects.push(childNode.data.nodeData.dataObject);
        childAttributes.push(childNode.data.nodeData.attributes);
        const nodeName = childNode.data.nodeData.general.name;
        if(childNode.data.type === 'source_data_object'){
          childSourceAttributes[nodeName] = childNode.data.nodeData.sourceAttributes;
        }
        if(childNode.data.type === 'Rollup'){
          childGrpAttributes[nodeName] = childNode.data.nodeData.groupAttributes;
        }
        if(childNode.data.type === 'Union'){
          childColumnMappings[nodeName] = childNode.data.nodeData.properties.union.columnMappings;
        }
        nodeNames.push(nodeName);
        nodeTypes.push(childNode.data.type);
      }
    });

    console.log('Children DataObjects:', childDataObjects);
    console.log('Children Attributes:', childAttributes);

    this.currentNodeColumns = [];

    for (let i = 0; i < childDataObjects.length; i++) {
      const nodeName = nodeNames[i];
      const nodeType = nodeTypes[i];
      const columns = childDataObjects[i]?.columns || [];
      const attributes = childAttributes[i] || [];
      const sourceAttributes = childSourceAttributes[i] || [];

      let items = [];

      if(nodeType === 'source_data_object'){
        const attr = childSourceAttributes[nodeName] || [];
        if(attr.length > 0){
          for (const atr of attr) {
            attr
            items.push({...atr.selectedColumn, group: nodeName, label: atr.attributeName, value: atr.attributeName, dataType: atr.dataType});
          }
        }
      } 
      else if(!['Rollup', 'Expression', 'Joiner', 'Union'].includes(nodeType)){
        let dataObjects = JSON.parse(JSON.stringify(childDataObjects[i]));
        dataObjects.forEach((object:any)=>{
          object.group = nodeName;
        });
        items = dataObjects;
      }
       if(nodeType === 'Rollup'){
        const attr = childGrpAttributes[nodeName] || [];
        if(attr.length > 0){
          for (const atr of attr) {
            items.push({
              label: atr.aliasName,
              value: atr.aliasName,
              column: atr.selectedColumn,
              group: nodeName
            });
          }
        }
      }

      if (nodeType === 'Union') {
        items = (childColumnMappings[nodeName] || []).map((object: any) => ({
          label: object.aliasName,
          value: object.aliasName,
          dataType: object.columns?.[0]?.dtype,
          group: nodeName
        }));
      }

      for (const attr of attributes) {
        items.push({
          label: attr.attributeName,
          value: attr.attributeName,
          dataType: attr.dataType,
          group: nodeName
        });
      }

      this.currentNodeColumns.push(...items);
    }

    this.currentNodeColumns = this.currentNodeColumns.filter((item, index, self) => {
      return index === self.findIndex(t => t.label === item.label && t.group === item.group);
    });
    console.log('Children columns:', this.currentNodeColumns);
    if(!['source_data_object', 'target_data_object'].includes(node.data.type)){
      node.data.nodeData.dataObject = this.currentNodeColumns;
      if(node.data.type === 'Rollup'){
        node.data.nodeData.groupAttributes.forEach((grp:any)=>{
          grp.selectColumnDropdown = this.currentNodeColumns;
          const match = this.currentNodeColumns.find((col: any) => 
            col.group === grp.selectedColumn?.group && 
            col.label === grp.selectedColumn?.label
          );
      
          if (!match) {
            grp.selectedColumn = '';
          }
        });
      }
      this.drawflow.updateNodeDataFromId(node.id, node.data);
    } else if(node.data.type === 'target_data_object'){
      node.data.nodeData.columnsDropdown = this.currentNodeColumns;
      this.drawflow.updateNodeDataFromId(node.id, node.data);
    }

    const allNodes = this.drawflow.drawflow.drawflow[this.drawflow.module].data;
      Object.entries(allNodes).forEach(([id, node]) => {
        console.log('Node ID:', id, 'Node Data:', node);
    });
  }

  openAttributesSelection(modal: any) {
    const dataObject = this.selectedNode.data.nodeData.dataObject || [];
  
    let flatList = [];
  
    if (this.selectedNode.data.type === 'Rollup') {
      const selectedGroups = this.selectedNode.data.nodeData.groupAttributes || [];
      flatList = dataObject.map((attr: any) => {
        const matched = selectedGroups.find((grp: any) => grp.selectedColumn?.value === attr.value);
        return {
          ...attr,
          isChecked: !!matched
        };
      });
    } else if (['Expression', 'Joiner'].includes(this.selectedNode.data.type)) {
      flatList = dataObject.map((attr: any) => ({
        ...attr,
        isChecked: false
      }));
    } else if (this.selectedNode.data.type === 'source_data_object') {
      const columns = dataObject.columns || [];
      flatList = columns.map((col: any) => {
        const attr = {
          label: col.col,
          value: col.col,
          dataType: col.dtype,
          group: this.selectedNode.data.nodeData.general.name,
        };

        if (this.isSourceClicked) {
          const selectedSources = this.selectedNode.data.nodeData.sourceAttributes || [];
          const matched = selectedSources.find((grp: any) => grp.selectedColumn?.value === attr.value);
          return {
            ...attr,
            isChecked: !!matched
          };
        } else {
          return {
            ...attr,
            isChecked: false
          };
        }
      });
    }
  
    // Group the flat list by `group`
    const grouped = flatList.reduce((acc: any[], attr: any) => {
      let groupObj = acc.find(g => g.group === attr.group);
      if (!groupObj) {
        groupObj = { group: attr.group, isChecked: false, attributes: [] };
        acc.push(groupObj);
      }
      groupObj.attributes.push({ ...attr });
      return acc;
    }, []);
  
    // Set group-level isChecked
    grouped.forEach((group:any) => {
      group.isChecked = group.attributes.every((attr: any) => attr.isChecked);
    });
  
    this.groupAttributesList = grouped;
  
    if(modal !== null){
      this.modalService.open(modal, {
        centered: true,
        windowClass: 'animate__animated animate__zoomIn',
        modalDialogClass: 'modal-md modal-dialog-scrollable'
      });
    }
  }
  
  toggleGroup(group: any) {
    group.attributes.forEach((attr: any) => attr.isChecked = group.isChecked);
  }

  toggleAllAttributes() {
    this.groupAttributesList.forEach(attr => {
      attr.isChecked = this.allChecked;
    });
  }

  applySelectedAttributes() {
    const flatSelected = this.groupAttributesList
      .flatMap(g => g.attributes)
      .filter(attr => attr.isChecked);
  
    const dataObject = this.selectedNode.data.nodeData.dataObject;
  
    if (this.selectedNode.data.type === 'Rollup') {
      this.selectedNode.data.nodeData.groupAttributes = flatSelected.map(attr => ({
        aliasName: attr.label,
        selectColumnDropdown: dataObject,
        selectedColumn: attr,
        dataType: attr.dataType || attr.column.dataType
      }));
      this.updateNode('groupAttribute');
  
    } else if (['Expression', 'Joiner'].includes(this.selectedNode.data.type)) {
      const existingAttributes = this.selectedNode.data.nodeData.attributes || [];

      const usedNames: { [key: string]: number } = {};
      // Pre-fill usedNames with existing attribute names
      existingAttributes.forEach((attr:any) => {
        const baseName = attr.attributeName.split('_')[0];
        usedNames[baseName] = Math.max(usedNames[baseName] || 0,
          parseInt(attr.attributeName.split('_')[1] || '0'));
      });

      const newAttributes = flatSelected.map(attr => {
        let name = attr.label;
        if (usedNames[name] !== undefined) {
          usedNames[name]++;
          name = `${name}_${usedNames[name]}`;
        } else {
          usedNames[name] = 0;
        }

        return {
          attributeName: name,
          dataType: attr.dataType || attr.column?.dataType,
          expression: `${attr.group}.${attr.label}`
        };
      });

      this.selectedNode.data.nodeData.attributes = [...existingAttributes, ...newAttributes];
      this.updateNode('');
    } else if(this.selectedNode.data.type === 'source_data_object'){
      if(this.isSourceClicked){
        let items : any[] = [];
        for (const col of dataObject.columns) {
          items.push({
            label: col.col,
            value: col.col,
            dataType: col.dtype,
            group: this.selectedNode.data.nodeData.general.name
          });
        }
        this.selectedNode.data.nodeData.sourceAttributes = flatSelected.map(attr => ({
          attributeName: attr.label,
          selectColumnDropdown: items,
          selectedColumn: attr,
          dataType: attr.dataType || attr.column.dataType
        }));
      } else{
        const usedNames: { [key: string]: number } = {};
        const existingNames = new Set<string>();

        // Include existing attribute names from both lists
        const existingAttributes = this.selectedNode.data.nodeData.attributes || [];
        const existingSourceAttributes = this.selectedNode.data.nodeData.sourceAttributes || [];

        [...existingAttributes, ...existingSourceAttributes].forEach(attr => {
          existingNames.add(attr.attributeName);

          const match = attr.attributeName.match(/^(.+?)(?:_(\d+))?$/);
          if (match) {
            const base = match[1];
            const suffix = match[2] ? parseInt(match[2]) : 0;
            usedNames[base] = Math.max(usedNames[base] || 0, suffix);
          }
        });

        flatSelected.forEach(attr => {
          let baseName = attr.label;
          let name = baseName;

          if (existingNames.has(name)) {
            let count = (usedNames[baseName] || 0) + 1;
            do {
              name = `${baseName}_${count}`;
              count++;
            } while (existingNames.has(name));
            usedNames[baseName] = count - 1;
          }

          existingNames.add(name);

          this.selectedNode.data.nodeData.attributes.push({
            attributeName: name,
            dataType: attr.dataType || attr.column?.dataType,
            expression: `${attr.group}.${attr.label}`
          });
        });


      }
      this.updateNode('');
    }
  }

  openExpressionEdit(modal:any, attribute:any, index:any){
    if(index !== null || index !== undefined){
      this.selectedIndex = index;
    }
    let dataObject: any[] = [];
    if(attribute.paramName){
      dataObject = [''].map((col: any) => ({
        label: '',
        value: '',
        dataType: '',
        group: 'Project Parameters'
      }));
    } else {
      const nodeData = JSON.parse(JSON.stringify(this.selectedNode.data.nodeData));

      if (this.selectedNode.data.type === 'source_data_object') {
        const columns = nodeData.dataObject.columns || [];
        const group = this.selectedNode.data.nodeData.general.name;

        dataObject = columns.map((col: any) => ({
          label: col.col,
          value: col.col,
          dataType: col.dtype,
          group: group
        }));
      } else {
        dataObject = nodeData.dataObject || [];
      }
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

    if(attribute.hasOwnProperty('secondaryObject')){
      this.isJoinerCondition = true;
      this.isParameter = false;
      this.isSQLParameter = false;
      this.isHaving = false;
      this.isWhere = false;
      this.isFilter = false;
      this.selectedField = attribute.secondaryObject;
      this.selectedColumn = this.groupedColumns[this.selectedGroup][0];
      this.expression = attribute.joinCondition;
    } else if(attribute.hasOwnProperty('paramName')){
      this.isJoinerCondition = false;
      this.isHaving = false;
      this.isWhere = false;
      this.isFilter = false;
      this.selectedField = attribute;
      this.selectedColumn = '';
      if(attribute.hasOwnProperty('sql')){
        this.isSQLParameter = true;
        this.expression = attribute.sql;
      } else{
        this.isParameter = true;
        this.expression = attribute.default;
      }
    } else if(attribute === 'having'){
      this.isJoinerCondition = false;
      this.isParameter = false;
      this.isSQLParameter = false;
      this.isWhere = false;
      this.isFilter = false;
      this.isHaving = true;
      this.selectedField = 'Having Clause';
      this.selectedColumn = this.groupedColumns[this.selectedGroup][0];;
      this.expression = this.selectedNode.data.nodeData.properties.havingClause;
    }  else if(attribute === 'where'){
      this.isJoinerCondition = false;
      this.isParameter = false;
      this.isSQLParameter = false;
      this.isHaving = false;
      this.isFilter = false;
      this.isWhere = true;
      this.selectedField = 'Where Clause';
      this.selectedColumn = this.groupedColumns[this.selectedGroup][0];;
      this.expression = this.selectedNode.data.nodeData.properties.whereClause;
    }  else if(attribute === 'filter'){
      this.isJoinerCondition = false;
      this.isParameter = false;
      this.isSQLParameter = false;
      this.isHaving = false;
      this.isWhere = false;
      this.isFilter = true;
      this.selectedField = 'Filter Condition';
      this.selectedColumn = this.groupedColumns[this.selectedGroup][0];;
      this.expression = this.selectedNode.data.nodeData.properties.filterCondition;
    } else if(this.selectedNode?.data?.type === 'Router'){
      this.isJoinerCondition = false;
      this.isParameter = false;
      this.isSQLParameter = false;
      this.isHaving = false;
      this.isWhere = false;
      this.isFilter = false;
      this.selectedField = attribute;
      this.selectedColumn = attribute;
      this.expression = attribute.condition;
    } else{
      this.isJoinerCondition = false;
      this.isParameter = false;
      this.isSQLParameter = false;
      this.isHaving = false;
      this.isWhere = false;
      this.isFilter = false;
      this.selectedField = attribute;
      this.selectedColumn = attribute;
      this.expression = attribute.expression;
    }
    this.modalService.open(modal, {
      centered: true,
      windowClass: 'animate__animated animate__zoomIn',
      modalDialogClass: 'modal-lg modal-dialog-scrollable'
    });
  }

  updateExpressionToNode(){
    if(this.isJoinerCondition){
      this.selectedNode.data.nodeData.properties.joinList[this.selectedIndex].joinCondition = this.expression;
    } else if(this.isParameter){
      this.canvasData.parameters[this.selectedIndex].default = this.expression;
    } else if(this.isSQLParameter){
      this.canvasData.sqlParameters[this.selectedIndex].sql = this.expression;
    } else if(this.isHaving){
      this.selectedNode.data.nodeData.properties.havingClause = this.expression;
    }  else if(this.isWhere){
      this.selectedNode.data.nodeData.properties.whereClause = this.expression;
    }  else if(this.isFilter){
      this.selectedNode.data.nodeData.properties.filterCondition = this.expression;
    } else if(this.selectedNode.data.type === 'Router'){
      this.selectedNode.data.nodeData.properties.router.conditions[this.selectedIndex].condition = this.expression;
    } else{
      this.selectedNode.data.nodeData.attributes[this.selectedIndex].expression = this.expression;
    }

    if(!this.isParameter && !this.isSQLParameter){
      this.updateNode('');
    } else{
      this.updateNode('parameter');
    }
    this.expression = '';
    this.selectedGroup = '';
    this.selectedColumn = {};
    this.selectedIndex = -1;
    this.isJoinerCondition = false;
    this.isHaving = false;
    this.isWhere = false;
    this.isFilter = false;
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
  
  getDataFlow(){
    this.workbechService.getEtlDataFlow(this.dataFlowId, 'dataflow').subscribe({
      next: (data) => {
        console.log(data);
        this.etlName = data?.flow_name;
        this.dataFlowId = data.id;
        this.flowId = data.Flow_id;
        const drawFlowJson = JSON.parse(data.drawflow);
        this.drawflow.import(drawFlowJson);
        console.log(drawFlowJson);
        this.validateFlowName(this.etlName);
        if (data?.flow_plan?.tasks.length > 0) {
          this.isRunEnable = data?.flow_plan?.tasks.some((task: any) => task.type === 'target_data_object');
        }
        // this.isRunEnable = true;
        this.canvasData = drawFlowJson.drawflow.Home.canvasData ? drawFlowJson.drawflow.Home.canvasData : {parameters: [], sqlParameters: []};
        console.log(this.canvasData);
        this.isNodeSelected = true;
        this.isCanvasSelected = true;
        this.tableTabId = 7;

        setTimeout(() => {
          const allNodes = this.drawflow.drawflow.drawflow['Home'].data;
          Object.entries(allNodes).forEach(([id, node]: [string, any]) => {
            const type = node.data?.type;
            if (type && !['source_data_object', 'target_data_object'].includes(type)) {
              this.nodeTypeCounts[type] = (this.nodeTypeCounts[type] || 0) + 1;
            }
            let displayName = (node.data?.nodeData?.general?.name || '');
            if(displayName.length > 10){
              displayName = (node.data?.nodeData?.general?.name || '').substring(0, 10) + '..';
            }
            const nodeElement = document.querySelector(`#node-${id}`);
            if (nodeElement) {
              const labelElement = nodeElement.querySelector('.node-label') as HTMLElement;
              if (labelElement) {
                labelElement.innerText = displayName;
                labelElement.setAttribute('title', node.data?.nodeData?.general?.name);
              }
              if(node.data.type === 'Router'){
                // this.setOutputPortTooltip(node, nodeElement);
                this.hideAllOutputPort(node);
                node.data.nodeData.properties.router.conditions.forEach((cond:any, index:any)=>{
                  if(cond.isVisible){
                    this.showOutputPort(index+1, node);
                  }
                });
                this.checkNoOfConditions(node.data.nodeData.properties.router.conditions);
              }
            }
          });
          if(this.isFromMonitor){
            this.runDataFlow();
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
  
  setAttributeAutoMapper(){
    const mapper = this.selectedNode.data.nodeData.attributeMapper
    if(mapper.length > 0){
      // mapper.forEach((attr:any)=>{
      //   this.selectedNode.data.nodeData.columnsDropdown
      //   if(attr.column === attr.selectedColumn){
      //     attr.selectedDataType = attr.dataType;
      //   }
      // });

      mapper.forEach((attr: any) => {
        const match = this.selectedNode.data.nodeData.columnsDropdown.find((col: any) =>
          col.label === attr.column // exact case-sensitive match
        );

        if (match) {
          attr.selectedColumn = match; // assign the matched column
          attr.selectedDataType = attr.dataType;
        }
      });
      this.drawflow.updateNodeDataFromId(this.selectedNode.id, this.selectedNode.data);
    }
  }

  addNewParameter(){
    const existingIndexes = this.canvasData?.parameters
      .map((p:any) => {
        const match = p.paramName?.match(/PARAM_NAME_(\d+)/);
        return match ? +match[1] : null;
      })
      .filter((index:any) => index !== null)
      .sort((a:any, b:any) => a! - b!) as number[];

    // Find the smallest unused index
    let newIndex = 1;
    for (let i = 0; i < existingIndexes?.length; i++) {
      if (existingIndexes[i] !== i + 1) {
        newIndex = i + 1;
        break;
      }
      newIndex = existingIndexes.length + 1;
    }

    let parameter = {paramName: `PARAM_NAME_${newIndex}`, dataType: 'varchar', default: ''}
    this.canvasData?.parameters.push(parameter);
    this.updateNode('parameter');
  }
  deleteParameter(index:any){
    this.canvasData.parameters.splice(index, 1);
    this.updateNode('parameter');
  }

  addNewSQLParameter(){
    const existingIndexes = this.canvasData?.sqlParameters
      .map((p:any) => {
        const match = p.paramName?.match(/SQL_PARAM_NAME_(\d+)/);
        return match ? +match[1] : null;
      })
      .filter((index:any) => index !== null)
      .sort((a:any, b:any) => a! - b!) as number[];

    // Find the smallest unused index
    let newIndex = 1;
    for (let i = 0; i < existingIndexes?.length; i++) {
      if (existingIndexes[i] !== i + 1) {
        newIndex = i + 1;
        break;
      }
      newIndex = existingIndexes.length + 1;
    }

    const originaltransformations = Object.values(this.drawflow.drawflow.drawflow[this.drawflow.module].data);
    const initializationOption = {
      data: {
        nodeData: {
          general: {
            name: 'Initialization'
          }
        }
      }
    };
    const transformationsList = [initializationOption, ...originaltransformations];

    let parameter = {paramName: `SQL_PARAM_NAME_${newIndex}`, dataType: 'varchar', dataPoint: null, transformationsList: transformationsList ?? [], dependentJobName: 'intialization', jobOrder: 'intialization', sql: '', default: 'null'}
    this.canvasData?.sqlParameters.push(parameter);
    this.updateNode('parameter');
  }
  deleteSQLParameter(index:any){
    this.canvasData.sqlParameters.splice(index, 1);
    this.updateNode('parameter');
  }

  moveUp(type:string) {
    let isChanged: boolean = false;
    if(type === 'sourceAttributes'){
      if (this.selectedSourceAttributeIndex !== null && this.selectedSourceAttributeIndex > 0) {
        const index = this.selectedSourceAttributeIndex;
        const attrs = this.selectedNode.data.nodeData.sourceAttributes;
        [attrs[index - 1], attrs[index]] = [attrs[index], attrs[index - 1]];
        this.selectedSourceAttributeIndex--;
        isChanged = true;
      }
    } else if(type === 'groupAttributes'){
      if (this.selectedGroupAttributeIndex !== null && this.selectedGroupAttributeIndex > 0) {
        const index = this.selectedGroupAttributeIndex;
        const attrs = this.selectedNode.data.nodeData.groupAttributes;
        [attrs[index - 1], attrs[index]] = [attrs[index], attrs[index - 1]];
        this.selectedGroupAttributeIndex--;
        isChanged = true;
      }
    } else if(type === 'attributes'){
      if (this.selectedAttributeIndex !== null && this.selectedAttributeIndex > 0) {
        const index = this.selectedAttributeIndex;
        const attrs = this.selectedNode.data.nodeData.attributes;
        [attrs[index - 1], attrs[index]] = [attrs[index], attrs[index - 1]];
        this.selectedAttributeIndex--;
        isChanged = true;
      }
    }

    if(isChanged){
      this.updateNode('');
    }
  }
  
  moveDown(type:string) {
    let isChanged: boolean = false;
    if(type === 'sourceAttributes'){
      if (this.selectedSourceAttributeIndex !== null && this.selectedSourceAttributeIndex < this.selectedNode.data.nodeData.sourceAttributes.length - 1) {
        const index = this.selectedSourceAttributeIndex;
        const attrs = this.selectedNode.data.nodeData.sourceAttributes;
        [attrs[index + 1], attrs[index]] = [attrs[index], attrs[index + 1]];
        this.selectedSourceAttributeIndex++;
        isChanged = true;
      }
    } else if(type === 'groupAttributes'){
      if (this.selectedGroupAttributeIndex !== null && this.selectedGroupAttributeIndex < this.selectedNode.data.nodeData.groupAttributes.length - 1) {
        const index = this.selectedGroupAttributeIndex;
        const attrs = this.selectedNode.data.nodeData.groupAttributes;
        [attrs[index + 1], attrs[index]] = [attrs[index], attrs[index + 1]];
        this.selectedGroupAttributeIndex++;
        isChanged = true;
      }
    } else if(type === 'attributes'){
      if (this.selectedAttributeIndex !== null && this.selectedAttributeIndex < this.selectedNode.data.nodeData.attributes.length - 1) {
        const index = this.selectedAttributeIndex;
        const attrs = this.selectedNode.data.nodeData.attributes;
        [attrs[index + 1], attrs[index]] = [attrs[index], attrs[index + 1]];
        this.selectedAttributeIndex++;
        isChanged = true;
      }
    }

    if(isChanged){
      this.updateNode('');
    }
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  canvasZoomOut(){
    this.drawflow.zoom_out();
  }
  canvasZoomReset(){
    this.drawflow.zoom_reset()
  }
  canvasZoomIn(){
    this.drawflow.zoom_in();
  }

  goBackToDataflowList() {
    this.router.navigate(['/datamplify/flowboardList']);
  }

  onTypeChange() {
    if (this.expEditorAddType === 'functions') {
      this.selectedGroup = this.functionGroupType[0].value;
      this.selectedColumn = this.functions['allFunctions'][0] || null;
    }
  }

  dataPointIndexForSqlParameter : number = -1;
  changeDataPointPopup(modal:any, index?:number) {
    if(index !== undefined && index !== null){
      this.dataPointIndexForSqlParameter = index;
    }
    this.modalService.open(modal, {
      centered: true,
      windowClass: 'animate__animated animate__zoomIn',
    });
    this.type = 1;
    this.getConnections();
  }

  updateDataPointToNode() {
    console.log(this.canvasData);
    this.updateNode('parameter');
  }


  getChildNodeIds(nodeId: number): number[] {
    const node = this.drawflow.getNodeFromId(nodeId);
    const childIds: number[] = [];

    Object.values(node.inputs).forEach((input: any) => {
      input.connections.forEach((conn: any) => {
        childIds.push(conn.node);
      });
    });

    return childIds;
  }

  getColumnsFromNode(nodeId: number): string[] {
    const node = this.drawflow.getNodeFromId(nodeId);
    const dataObject = node.data.nodeData?.dataObject || {};
    return dataObject.columns?.map((col: any) => ({
      label: col.col,
      value: col.col,
      dataType: col.dtype,
      group: node.data.nodeData.general.name
    })) || [];
  }

  validateFlowName(value: string) {
    const pattern = /^[a-zA-Z0-9_]+$/;
    this.isValidFlowName = pattern.test(value);
  }

  createNewFlowboard(){
    this.router.navigate(['/datamplify/flowboardList/flowboard']);
  }

  clearFlowboard(){
    this.drawflow.clear();
  }

  getConnectedInputNodes(node: any) {
    const connectedNodes: any[] = [];

    // Loop through all input ports of the node
    Object.values(node.inputs).forEach((input: any) => {
      // Each input can have multiple connections
      input.connections.forEach((conn: any) => {
        const sourceNodeId = conn.node; // the node ID connected to this input
        const sourceNode = this.drawflow.getNodeFromId(sourceNodeId);
        if (sourceNode) {
          connectedNodes.push(sourceNode);
        }
      });
    });

    return connectedNodes;
  }

  addNewColumnMappings() {
    const mappings = this.selectedNode?.data?.nodeData?.properties?.union?.columnMappings || [];

    // Extract existing alias indexes like "aliasName_1", "aliasName_2", etc.
    const existingIndexes = mappings
      .map((m: any) => {
        const match = m.aliasName?.match(/aliasName_(\d+)/i);
        return match ? +match[1] : null;
      })
      .filter((index: any) => index !== null)
      .sort((a: number, b: number) => a - b) as number[];

    // Find the smallest unused index
    let newIndex = 1;
    for (let i = 0; i < existingIndexes.length; i++) {
      if (existingIndexes[i] !== i + 1) {
        newIndex = i + 1;
        break;
      }
      newIndex = existingIndexes.length + 1;
    }

    // Create new mapping with default aliasName
    const newMapping = {
      aliasName: `aliasName_${newIndex}`,
      columns: []
    };

    mappings.push(newMapping);

    // Reassign back (in case it's reactive)
    this.selectedNode.data.nodeData.properties.union.columnMappings = mappings;

    // Update drawflow node
    this.updateNode('');
  }
  deleteColumnMapping(index: any) {
    this.selectedNode.data.nodeData.properties.union.columnMappings.splice(index, 1);
    this.updateNode('');
  }

  addNewCondition() {
    const conditions = this.selectedNode?.data?.nodeData?.properties?.router?.conditions || [];

    // conditions.push(newCondition);
    const emptyIndex = conditions.findIndex((con:any)=>!con.isVisible);
    const newCondition = { conditionName: `condition_${emptyIndex+1}`, condition: '', isVisible: true, targetNodes: []};
    this.showOutputPort(emptyIndex+1, this.selectedNode);
    conditions[emptyIndex] = newCondition;

    // Reassign back (reactivity safe)
    this.selectedNode.data.nodeData.properties.router.conditions = conditions;
    this.checkNoOfConditions(this.selectedNode.data.nodeData.properties.router.conditions);
    this.updateNode('');
  }

  deleteCondition(index: number) {
    const portName = `output_${index + 1}`;
    const outputPort = this.selectedNode.outputs?.[portName];
    const routerNode = JSON.parse(JSON.stringify(this.selectedNode));

    if (outputPort && outputPort.connections.length > 0) {
      outputPort.connections.forEach((conn: any) => {
        // const node = `node-${conn.node}`
        // this.drawflow.getNodeFromId(node);
        this.drawflow.removeSingleConnection(this.selectedNode.id, conn.node, portName, conn.output);
      });
    }

    this.selectedNode = routerNode;
    this.hideOutputPort(index+1);
    this.selectedNode.data.nodeData.properties.router.conditions[index] = { conditionName: `condition_${index+1}`, condition: '', isVisible: false, targetNodes: []};
    this.checkNoOfConditions(this.selectedNode.data.nodeData.properties.router.conditions);
    this.updateNode('');
  }

  checkNoOfConditions(conditions: any[]){
    this.maximumConditionsReached = conditions.every((condition: any) => condition.isVisible === true);
  }

  hideAllOutputPort(node:any) {
    const nodeElement = document.querySelector(`#node-${node.id}`);

    if (nodeElement) {
      // Assume max 4 ports
      for (let i = 1; i <= 4; i++) {
        const portEl = nodeElement.querySelector(`.output_${i}`) as HTMLElement;
        if (portEl) {
            portEl.style.visibility = 'hidden';
            portEl.removeAttribute('title');
        }
      }
    }
  }

  setOutputPortTooltip(node: any, nodeElement: any) {
    const conditions = node.data.nodeData.properties.router.conditions || [];
    for (let i = 1; i <= 4; i++) {
      const portEl = nodeElement.querySelector(`.output_${i}`) as HTMLElement;
      if (portEl) {
        portEl.setAttribute('title', conditions[i-1].conditionName);
      }
    }
  }

  showOutputPort(index:any, node:any){
    const conditions = node.data.nodeData.properties.router.conditions || [];
    const nodeElement = document.querySelector(`#node-${node.id}`);

    if (nodeElement) {
      const portEl = nodeElement.querySelector(`.output_${index}`) as HTMLElement;
      if (portEl) {
        portEl.style.visibility = 'visible';
        portEl.setAttribute('title', conditions[index-1].conditionName);
      }
    }
  }

  hideOutputPort(index:any){
    const nodeElement = document.querySelector(`#node-${this.selectedNode.id}`);

    if (nodeElement) {
      const portEl = nodeElement.querySelector(`.output_${index}`) as HTMLElement;
      if (portEl) {
        portEl.style.visibility = 'hidden';
        portEl.removeAttribute('title');
      }
    }
  }

  getRemoteServerFiles() {
    let object = {
      type: this.remoteFileType,
      path: this.remoteFilePath,
      conn_id: this.selectedConnection.hierarchy_id
    };
    this.workbechService.getRemoteServerFiles(object).subscribe({
      next: (data) => {
        console.log(data);
        this.remoteServerFiles = data.files;
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  getRemoteServerFileData() {
    let object = {
      conn_id: this.selectedConnection.hierarchy_id,
      path: this.remoteFilePath+'/'+this.selectedRemoteServerFile 
    };
    this.workbechService.getRemoteServerFileData(object).subscribe({
      next: (data) => {
        console.log(data);
        this.selectedDataObject =  data?.tables[0];
      },
      error: (error: any) => {
        console.log(error);
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
      }
    });
  }

  showInputFocus(){
    setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
  }

  copyFlowboard(){
    const exportedData = this.drawflow.export();

    this.sharedService.setDuplicatedFlow(exportedData);
    this.createNewFlowboard();
  }

  duplicateFlowboard() {
    const drawFlowJson = this.sharedService.getDuplicatedFlow();
    this.drawflow.import(drawFlowJson);
    console.log(drawFlowJson);
    this.canvasData = drawFlowJson.drawflow.Home.canvasData ? drawFlowJson.drawflow.Home.canvasData : { parameters: [], sqlParameters: [] };
    console.log(this.canvasData);
    this.isNodeSelected = true;
    this.isCanvasSelected = true;
    this.tableTabId = 7;

    setTimeout(() => {
      const allNodes = this.drawflow.drawflow.drawflow['Home'].data;
      Object.entries(allNodes).forEach(([id, node]: [string, any]) => {
        const type = node.data?.type;
        if (type && !['source_data_object', 'target_data_object'].includes(type)) {
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
          if (node.data.type === 'Router') {
            // this.setOutputPortTooltip(node, nodeElement);
            this.hideAllOutputPort(node);
            node.data.nodeData.properties.router.conditions.forEach((cond: any, index: any) => {
              if (cond.isVisible) {
                this.showOutputPort(index + 1, node);
              }
            });
            this.checkNoOfConditions(node.data.nodeData.properties.router.conditions);
          }
        }
      });
      this.sharedService.clearDuplicatedFlow();
      Swal.fire({
        icon: 'info',
        title: 'Flowboard Duplicated',
        text: 'Flowboard duplicated successfully. If you refresh the page without saving, the duplicate data will be lost.',
        confirmButtonText: 'Got it',
        width: '400px'
      });
    }, 100);
  }
}
