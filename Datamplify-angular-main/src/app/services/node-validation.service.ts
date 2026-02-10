import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NodeValidationService {

  constructor() {
  }

  nodeValidation(node: any, type: any): any {
    let validateData: any = { msg: '', isValid: true }

    if (node?.data && type) {
      validateData = this.nodeNameValidation(node);
      if (validateData.isValid) {
        //DagBoard
        if (type === 'source_data_object') {
          validateData = this.sourceDataObjectValidation(node);
        } else if (type === 'Expression') {
          validateData = this.expressionValidation(node);
        } else if (type === 'Joiner') {
          validateData = this.joinerValidation(node);
        } else if (type === 'Rollup') {
          validateData = this.rollupValidation(node);
        } else if (type === 'Filter') {
          validateData = this.filterValidation(node);
        } else if (type === 'Rank') {
          validateData = this.rankValidation(node);
        } else if (type === 'Pivot') {
          validateData = this.pivotValidation(node);
        } else if (type === 'Union') {
          validateData = this.unionValidation(node);
        } else if (type === 'Router') {
          validateData = this.routerValidation(node);
        } else if (type === 'UpdateStrategy') {
          validateData = this.updateStrategyValidation(node);
        } else if (type === 'target_data_object') {
          validateData = this.targetDataObjectValidation(node);
        }

        //TaskRunPlan
        else if (type === 'dataFlow') {
          validateData = this.dagboardInstanceValidation(node);
        } else if (type === 'taskCommand') {
          validateData = this.taskCommandValidation(node);
        } else if (type === 'dbCommand') {
          validateData = this.dbCommandValidation(node);
        } else if (type === 'loop') {
          validateData = this.loopValidation(node);
        } else if (type === 'loop_end') {
          validateData = this.loopEndValidation(node);
        } else if (type === 'email') {
          validateData = this.emailValidation(node);
        }
      }
    }
    
    return validateData;
  }

  //DagBoard
  sourceDataObjectValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const sourceAttributes = node?.data?.nodeData?.sourceAttributes || [];
    const attributes = node?.data?.nodeData?.attributes || [];
    if (!sourceAttributes.length) {
      return { msg: 'At least one Source Attribute is required', isValid: false };
    }
    const invalidSourceAttribute = sourceAttributes.find((attr: any) =>
      !attr.attributeName ||
      !attr.dataType ||
      attr.selectedColumn === null ||
      attr.selectedColumn === undefined
    );
    if (invalidSourceAttribute) {
      return { msg: 'Each Source Attribute must have Attribute, Data Type, and Source Column', isValid: false };
    }

    if (attributes.length) {
      const invalidAttribute = attributes.find((attr: any) =>
        !attr.attributeName ||
        !attr.dataType ||
        !attr.expression
      );
      if (invalidAttribute) {
        return { msg: 'Each Attribute must have Attribute, Data Type, and Expression', isValid: false };
      }
    }

    return validateData;
  }
  expressionValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const attributes = node?.data?.nodeData?.attributes || [];
    if (!attributes.length) {
      return { msg: 'At least one Attribute is required', isValid: false };
    }
    const invalidAttribute = attributes.find((attr: any) =>
      !attr.attributeName ||
      !attr.dataType ||
      !attr.expression
    );
    if (invalidAttribute) {
      return { msg: 'Each Attribute must have Attribute, Data Type, and Expression', isValid: false };
    }

    return validateData;
  }
  joinerValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const joinList = node?.data?.nodeData?.properties?.joinList || [];
    if (!joinList.length) {
      return { msg: 'At least Two Nodes need to be connect for Joiner', isValid: false };
    }
    if (node?.data?.nodeData?.properties?.primaryObject === null || node?.data?.nodeData?.properties?.primaryObject === undefined) {
      return { msg: 'Primary Object selection is required', isValid: false };
    }
    const invalidSecondaryObject = joinList.find((attr: any) =>
      !attr.joinType ||
      !attr.joinCondition ||
      !attr.secondaryObject ||
      attr.secondaryObject === null ||
      attr.secondaryObject === undefined
    );
    if (invalidSecondaryObject) {
      return { msg: 'Each Join condition must have Joiner Type, Secondary Object, and Joiner Condition', isValid: false };
    }

    const attributes = node?.data?.nodeData?.attributes || [];
    if (!attributes.length) {
      return { msg: 'At least one Attribute is required', isValid: false };
    }
    const invalidAttribute = attributes.find((attr: any) =>
      !attr.attributeName ||
      !attr.dataType ||
      !attr.expression
    );
    if (invalidAttribute) {
      return { msg: 'Each Attribute must have Attribute, Data Type, and Expression', isValid: false };
    }

    return validateData;
  }
  rollupValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const groupAttributes = node?.data?.nodeData?.groupAttributes || [];
    const attributes = node?.data?.nodeData?.attributes || [];
    if (!groupAttributes.length) {
      return { msg: 'At least one Group Attribute is required', isValid: false };
    }
    const invalidGroupAttribute = groupAttributes.find((attr: any) =>
      !attr.aliasName ||
      !attr.selectedColumn ||
      attr.selectedColumn === null ||
      attr.selectedColumn === undefined
    );
    if (invalidGroupAttribute) {
      return { msg: 'Each Group Attribute must have Alias Name and Select Column', isValid: false };
    }

    if (attributes.length) {
      const invalidAttribute = attributes.find((attr: any) =>
        !attr.attributeName ||
        !attr.dataType ||
        !attr.expression
      );
      if (invalidAttribute) {
        return { msg: 'Each Attribute must have Attribute, Data Type, and Expression', isValid: false };
      }
    }

    return validateData;
  }
  filterValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const filterCondition = node?.data?.nodeData?.properties?.filterCondition || '';

    if (!filterCondition) {
      return { msg: 'Filter condition must be provided', isValid: false };
    }

    return validateData;
  }
  rankValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const rank = node?.data?.nodeData?.properties?.rank || { rankType: "", orderByCols: [], partitionByCols: [], rankColumnName: "", sortType: "top", records: "" };
    if (!rank?.rankType) {
      return { msg: 'Rank Type must be provided', isValid: false };
    }
    if (!rank?.rankColumnName) {
      return { msg: 'Rank Column Name must be provided', isValid: false };
    }
    if (rank?.records === null || rank?.records === undefined || rank?.records === '' || Number.isNaN(Number(rank?.records))) {
      return { msg: 'Records must be provided', isValid: false };
    }
    if (!rank?.orderByCols?.length) {
      return { msg: 'At least one Order By Columns must be provided', isValid: false };
    }
    if (!rank?.partitionByCols?.length) {
      return { msg: 'At least one Partition By Columns must be provided', isValid: false };
    }
    if (!rank?.sortType) {
      return { msg: 'Sort Type must be provided', isValid: false };
    }

    return validateData;
  }
  pivotValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const pivot = node?.data?.nodeData?.properties?.pivot || { groupByCols: [], pivotCol: null, valueCols: [], pivotValues: [], aggregation: "" };
    if (!pivot?.groupByCols?.length) {
      return { msg: 'At least one Group By Columns must be provided', isValid: false };
    }
    if (!pivot?.valueCols?.length) {
      return { msg: 'At least one Value Columns Name must be provided', isValid: false };
    }
    if ((Array.isArray(pivot.pivotValues) && !pivot.pivotValues.length) || (typeof pivot.pivotValues === 'string' && !pivot.pivotValues)) {
      return { msg: 'Pivot Values must be provided', isValid: false };
    }
    if (pivot?.pivotCol === null || !pivot?.pivotCol === undefined) {
      return { msg: 'Pivot Column must be provided', isValid: false };
    }
    if (!pivot?.aggregation) {
      return { msg: 'Aggregation must be provided', isValid: false };
    }

    return validateData;
  }
  unionValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const union = node?.data?.nodeData?.properties?.union || { columnMappings: [], sourceNodes: [], type: "" };
    if (union?.sourceNodes?.length < 2) {
      return { msg: 'At least Two Nodes need to be connect for Unoin', isValid: false };
    }
    if (!union?.type) {
      return { msg: 'Union type must be provided', isValid: false };
    }
    // if (union?.columnMappings?.length <= (union?.sourceNodes?.length - 1)) {
    //   return { msg: 'Column mapping must be provided for all Union source nodes', isValid: false };
    // }
    if (!union?.columnMappings?.length) {
      return { msg: 'At least one Column Mapping must be provided', isValid: false };
    }

    const columnMappings = union?.columnMappings || [];
    if (columnMappings.length) {
      const invalidMapping = columnMappings.find((mapping: any) =>
        !mapping.aliasName ||
        !Array.isArray(mapping.columns) ||
        !mapping.columns.length ||
        mapping.columns.some((col: any) => !col || !col.label || !col.value)
      );

      if (invalidMapping) {
        return { msg: 'Each Column Mapping must have Alias Name and valid mapped Columns', isValid: false };
      }
    }

    return validateData;
  }
  routerValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const conditions = node?.data?.nodeData?.properties?.router?.conditions || [];
    const visibleConditions = conditions.filter((c: any) => c.isVisible);
    if (!visibleConditions.length) {
      return { msg: 'At least one Router condition must be added', isValid: false };
    }

    const invalidCondition = visibleConditions.find((c: any) =>
      !c.conditionName ||
      !c.condition
    );
    if (invalidCondition) {
      return { msg: 'Each Router condition must have Condition Name and Condition', isValid: false };
    }

    return validateData;
  }
  updateStrategyValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const updateStrategy = node?.data?.nodeData?.properties?.strategy || { joiningConditions: [], selectedTable: {}, selectedTableColumns: {}, updateStrategy: "append" };
    if (!updateStrategy?.updateStrategy) {
      return { msg: 'Update Strategy type must be provided', isValid: false };
    }
    if (!updateStrategy?.selectedTable?.hierarchy_id || !updateStrategy?.selectedTableColumns?.tables) {
      return { msg: 'Target Table must be provided', isValid: false };
    }

    if (!['append', 'truncate_and_insert', 'replace_table'].includes(updateStrategy?.updateStrategy)) {
      if (!Array.isArray(updateStrategy?.joiningConditions) || !updateStrategy?.joiningConditions.length) {
        return { msg: 'At least one joining condition must be added', isValid: false };
      }

      const invalidJoin = updateStrategy?.joiningConditions.find((join: any) =>
        !Array.isArray(join) ||
        join.length !== 2 ||
        join.some((col: any) => !col || !col.label || !col.value || !col.dataType)
      );
      if (invalidJoin) {
        return { msg: 'Each joining condition must map two valid columns', isValid: false };
      }
    }

    const sourceAttributes = node?.data?.nodeData?.sourceAttributes || [];
    if (!sourceAttributes.length) {
      return { msg: 'At least one Source Attribute is required', isValid: false };
    }
    const invalidSourceAttribute = sourceAttributes.find((attr: any) =>
      !attr.attributeName ||
      !attr.dataType ||
      attr.selectedColumn === null ||
      attr.selectedColumn === undefined
    );
    if (invalidSourceAttribute) {
      return { msg: 'Each Source Attribute must have Attribute, Data Type, and Source Column', isValid: false };
    }

    return validateData;
  }
  targetDataObjectValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    if (!node?.data?.nodeData?.properties?.create) {
      const target = node?.data?.nodeData?.properties?.target || { joiningConditions: [], updateStrategy: "append" };
      if (!target?.updateStrategy) {
        return { msg: 'Update Strategy type must be provided', isValid: false };
      }
      if (!['append', 'truncate_and_insert', 'replace_table'].includes(target?.updateStrategy)) {
        if (!Array.isArray(target?.joiningConditions) || !target?.joiningConditions.length) {
          return { msg: 'At least one joining condition must be added', isValid: false };
        }

        const invalidJoin = target?.joiningConditions.find((join: any) =>
          !Array.isArray(join) ||
          join.length !== 2 ||
          join.some((col: any) => !col || !col.label || !col.value || !col.dataType)
        );
        if (invalidJoin) {
          return { msg: 'Each joining condition must map two valid columns', isValid: false };
        }
      }

      const attributeMapper = node?.data?.nodeData?.attributeMapper || [];
      if (attributeMapper.length) {
        const invalidAttributeMapper = attributeMapper.find((attr: any) =>
          attr.selectedColumn === null || attr.selectedColumn === undefined
        );
        if (invalidAttributeMapper) {
          return { msg: 'Each Attribute must have Source Attribute', isValid: false };
        }
      }
    }

    return validateData;
  }

  //TaskRunPlan
  dagboardInstanceValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };

    return validateData;
  }
  taskCommandValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const command = node?.data?.nodeData?.command;
    if (!command.commandType) {
      return { msg: 'Command Type must be provided', isValid: false };
    }
    if (!command.serverFileId) {
      return { msg: 'Server must be provided', isValid: false };
    }
    if (!command.commandDesc) {
      return { msg: 'Command must be provided', isValid: false };
    }
    if (command.commandType === 'file_watcher') {
      if (command.timeOut === null || command.timeOut === undefined || command.timeOut === '' || typeof command.timeOut !== 'number' || command.timeOut < 0) {
        return { msg: 'Time Out must be a number greater than or equal to 0', isValid: false };
      }

      if (command.sleepInterval === null || command.sleepInterval === undefined || command.sleepInterval === '' || typeof command.sleepInterval !== 'number' || command.sleepInterval < 0) {
        return { msg: 'Sleep Interval must be a number greater than or equal to 0', isValid: false };
      }
    }

    return validateData;
  }
  dbCommandValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const command = node?.data?.nodeData?.command;
    const dataPoints = node?.data?.nodeData?.dataPoints;
    if (!command.dbCommand) {
      return { msg: 'DB Command must be provided', isValid: false };
    }
    if (!dataPoints.dataPoint) {
      return { msg: 'Data Point must be provided', isValid: false };
    }

    return validateData;
  }
  loopValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const properties = node?.data?.nodeData?.properties;
    if (!properties.type) {
      return { msg: 'Type must be provided', isValid: false };
    }
    if (properties.type === 'sql') {
      if (!properties.dataPoint || properties.dataPoint === null || properties.dataPoint === undefined) {
        return { msg: 'Data Point must be provided', isValid: false };
      }
    } else {
      if (!properties.serverFileId) {
        return { msg: 'Server must be provided', isValid: false };
      }
    }
    if (!properties.command) {
      return { msg: 'Command must be provided', isValid: false };
    }
    if (!properties.returnType) {
      return { msg: 'Return Type must be provided', isValid: false };
    }
    if (!properties.delimiter) {
      return { msg: 'Delimiter must be provided', isValid: false };
    }

    return validateData;
  }
  loopEndValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };

    return validateData;
  }
  emailValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const properties = node?.data?.nodeData?.properties;
    if (!properties.to) {
      return { msg: 'To must be provided', isValid: false };
    }
    if (!properties.cc) {
      return { msg: 'CC must be provided', isValid: false };
    }
    if (!properties.subject) {
      return { msg: 'Subject must be provided', isValid: false };
    }
    if (!properties.message) {
      return { msg: 'Message must be provided', isValid: false };
    }

    return validateData;
  }

  nodeNameValidation(node: any): any {
    let validateData = {
      msg: '',
      isValid: true
    };
    const general = node?.data?.nodeData?.general;
    if (!general.name) {
      return { msg: 'Node name must be provided', isValid: false };
    }

    return validateData;
  }

  parametersValidation(canvasData: any): any{
    let validateData = {
      msg: '',
      isValid: true
    };
    const parameters = canvasData?.parameters ?? [];
    const sqlParameters = canvasData?.sqlParameters ?? [];
    if(parameters.length > 0){
      const invalidParameter = parameters.find((parameter: any) =>
        !parameter.paramName ||
        !parameter.dataType ||
        !parameter.default
      );
      if (invalidParameter) {
        return { msg: 'Each Paremeter must have Param Name, Data Type, and Default', isValid: false };
      }
    }
    if (sqlParameters.length > 0) {
      const invalidParameter = sqlParameters.find((parameter: any) =>
        !parameter.paramName ||
        !parameter.dataType ||
        !parameter.dataPoint || parameter.dataPoint === null || parameter.dataPoint === undefined ||
        !parameter.dependentJobName ||
        !parameter.jobOrder ||
        !parameter.sql ||
        !parameter.default
      );
      if (invalidParameter) {
        return { msg: 'Each SQL Paremeter must have Param Name, Data Type, Database, DependentJobName, Job Order, SQL and Default', isValid: false };
      }
    }

    return validateData;
  }
}
