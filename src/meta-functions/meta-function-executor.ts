import {MetaFunctionBodyCreator} from "./meta-function-body-creator";
import {VariablesController} from "../variables/variables-controller";
import {Configuration} from "../configurations/configuration";
import {Logger} from "../loggers/logger";

let persistEnqueuerVariable = (name: string, value: any): void => {
    const configuration = new Configuration();
    configuration.setFileVariable(name, value);
}

let persistSessionVariable = (name: string, value: any): void => {
    VariablesController.sessionVariables()[name] = value;
}

let deleteEnqueuerVariable = (name: string): void => {
    const configuration = new Configuration();
    configuration.deleteFileVariable(name);
}

export class MetaFunctionExecutor {
    private functionBody: string;

    constructor(functionBodyCreator: MetaFunctionBodyCreator) {
        this.functionBody = functionBodyCreator.createBody();
    }

    public execute(): any {
        try {
            let functionToExecute = new Function("persistEnqueuerVariable",
                                                "persistSessionVariable",
                                                "deleteEnqueuerVariable",
                                                this.functionBody);

            Logger.trace(`Function to execute: ${functionToExecute.toString()}`);
            try {
                let functionResponse = functionToExecute((name: string, value: any) => persistEnqueuerVariable(name, value),
                                                         (name: string, value: any) => persistSessionVariable(name, value),
                                                         (name: string) => deleteEnqueuerVariable(name));
                let result = this.fillResponseAttributes(functionResponse);
                return result;
            } catch (exc) {
                Logger.error(`Error running function: ${JSON.stringify(exc, null, 2)}`);
                return { exception: `Function runtime error ${exc}`};
            }
        } catch (exc) {
            Logger.error(`Error creating function: ${JSON.stringify(exc, null, 2)}`);
            return { exception: `Function compile time error ${exc}`};
        }
    }

    private fillResponseAttributes(functionResponse: any) {
        let result: any = Object.assign({}, functionResponse);
        delete result.test;
        delete result.report;

        result.tests = [];
        for (const title in functionResponse.test) {
            result.tests.push({name: title, valid: functionResponse.test[title]});
        }

        result.report = this.fillReportAttribute(functionResponse);
        return result;
    }

    private fillReportAttribute(functionResponse: any): any {
        let reports: any = {};
        for (const report in functionResponse.report) {
            reports[report] = functionResponse.report[report];
        }
        return reports;
    }
}
