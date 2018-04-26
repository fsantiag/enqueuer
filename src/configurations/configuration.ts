import {PublisherModel} from "../models/publisher-model";
import {Logger} from "../loggers/logger";
const version = require('../../package.json').version;
const yaml = require('yamljs');
let configFileName = "conf/enqueuer.yml";
const fs = require("fs");



let commandLineVariables: any = {};
let commander: any = {};
if (!process.argv[1].toString().match("jest")) {
    commander = require('commander')
    .version(process.env.npm_package_version || version, '-V, --version')
    .option('-v, --verbose', 'Activates verbose mode', false)
    .option('-l, --log-level <level>', 'Set log level')
    .option('-c, --config-file <path>', 'Set configurationFile. Defaults to conf/enqueuer.yml')
    .option('-s, --session-variables [sessionVariable]', 'Add variables values to this session',
        (val: string, memo: string[]) =>{
                const split = val.split("=");
                if (split.length == 2) {
                    commandLineVariables[split[0]] = split[1];
                }

                memo.push(val);
                return memo;
            },
            [])
    .parse(process.argv);

    configFileName = commander.configFile || configFileName;
}


let ymlFile = {};
try {
    ymlFile = yaml.load(configFileName);
} catch (err) {
    Logger.error(`Impossible to read ${configFileName} file: ${err}`);
    ymlFile = {};
}

export class Configuration {

    private configurationFile: any;
    private commandLine: any;

    public constructor(commandLine: any = commander, configurationFile: any = ymlFile) {
        this.commandLine = commandLine;
        this.configurationFile = configurationFile;
        this.configurationFile.variables = this.configurationFile.variables || {};
    }

    public getLogLevel(): string | undefined {
        if (this.commandLine.verbose)
            return 'trace';
        return (this.commandLine.logLevel) ||
            (this.configurationFile["log-level"]);
    }

    public getRequisitionRunMode(): any {
        if (this.configurationFile.requisitions)
            return this.configurationFile.requisitions["run-mode"];
        else return undefined;
    }

    public getOutputs(): PublisherModel[] {
        if (!this.configurationFile.outputs)
            return [];
        return this.configurationFile.outputs;
    }

    public getFileVariables(): any {
        return this.configurationFile.variables || {};
    }

    public setFileVariable(name: string, value: any) {
        this.configurationFile.variables[name] = value;
        fs.writeFileSync(configFileName, yaml.stringify(this.configurationFile, 10, 2));
    }

    public deleteFileVariable(name: string) {
        delete this.configurationFile.variables[name];
        fs.writeFileSync(configFileName, yaml.stringify(this.configurationFile, 10, 2));
    }

    public getSessionVariables(): any {
        return commandLineVariables;
    }

    public getFile(): any {
        return this.configurationFile;
    }
}
