"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../loggers/logger");
const requisition_reporter_1 = require("../reporters/requisition-reporter");
const json_placeholder_replacer_1 = require("json-placeholder-replacer");
const store_1 = require("../configurations/store");
const timeout_1 = require("../timers/timeout");
const requisition_multiplier_1 = require("./requisition-multiplier");
const date_controller_1 = require("../timers/date-controller");
class RequisitionRunner {
    constructor(requisition) {
        this.requisitions = [];
        this.name = requisition.name;
        logger_1.Logger.debug(`Initializing requisition '${requisition.name}'`);
        const items = new requisition_multiplier_1.RequisitionMultiplier(requisition).multiply();
        if (items.length <= 0) {
            logger_1.Logger.debug(`No result requisition after iterations evaluation: ${requisition.iterations}`);
        }
        else {
            this.requisitions = items;
        }
    }
    run() {
        logger_1.Logger.info(`Running requisition '${this.name}'`);
        if (this.requisitions.length <= 1) {
            return this.startRequisition(this.requisitions[0]);
        }
        else {
            return new Promise((resolve) => this.startIterator(this.createIteratorReport(this.name), resolve));
        }
    }
    startIterator(iteratorReport, resolve) {
        const requisition = this.requisitions.shift();
        if (requisition) {
            try {
                this.startRequisition(requisition).then(report => {
                    if (iteratorReport.requisitions) {
                        iteratorReport.requisitions.push(report);
                    }
                    this.startIterator(iteratorReport, resolve);
                });
            }
            catch (err) {
                logger_1.Logger.error(`Error running requisition '${requisition.name}'`);
                const report = this.createRunningError(requisition.name, err);
                if (iteratorReport.requisitions) {
                    iteratorReport.requisitions.push(report);
                }
                this.startIterator(iteratorReport, resolve);
            }
        }
        else {
            this.adjustIteratorReportTimeValues(iteratorReport);
            resolve(iteratorReport);
        }
    }
    adjustIteratorReportTimeValues(iteratorReport) {
        if (iteratorReport.requisitions) {
            const first = iteratorReport.requisitions[0];
            const last = iteratorReport.requisitions[iteratorReport.requisitions.length - 1];
            if (first && first.time && last && last.time) {
                const startTime = new date_controller_1.DateController(new Date(first.time.startTime));
                const endTime = new date_controller_1.DateController(new Date(last.time.endTime));
                const totalTime = endTime.getTime() - startTime.getTime();
                iteratorReport.time = {
                    startTime: startTime.toString(),
                    endTime: endTime.toString(),
                    totalTime: totalTime
                };
            }
        }
    }
    startRequisition(requisition) {
        const placeHolderReplacer = new json_placeholder_replacer_1.JsonPlaceholderReplacer();
        const requisitionModel = placeHolderReplacer.addVariableMap(store_1.Store.getData())
            .replace(requisition);
        if (this.shouldSkipRequisition(requisition, requisitionModel)) {
            logger_1.Logger.info(`Requisition will be skipped`);
            return Promise.resolve(this.createSkippedReport(this.name));
        }
        return new Promise((resolve) => {
            new timeout_1.Timeout(() => {
                const requisitionReporter = new requisition_reporter_1.RequisitionReporter(requisitionModel);
                requisitionReporter.start(() => {
                    const report = requisitionReporter.getReport();
                    logger_1.Logger.info(`Requisition '${report.name}' is over (${report.valid})`);
                    logger_1.Logger.trace(`Store keys: ${Object.keys(store_1.Store.getData())}`);
                    resolve(report);
                });
            }).start(requisitionModel.delay || 0);
        });
    }
    shouldSkipRequisition(requisition, requisitionModel) {
        if (!requisitionModel || !requisition) {
            return true;
        }
        const definedIterationsButLessThanZero = typeof (requisitionModel.iterations) != 'number' ||
            (requisitionModel.iterations && requisitionModel.iterations <= 0);
        return requisitionModel.iterations && (definedIterationsButLessThanZero);
    }
    //TODO remove all of default reports to their own files
    createRunningError(name, err) {
        return {
            valid: false,
            tests: [{
                    valid: false,
                    name: 'Requisition ran',
                    description: err
                }],
            name: name,
            time: {
                startTime: '',
                endTime: '',
                totalTime: 0
            },
            subscriptions: [],
            startEvent: {}
        };
    }
    createSkippedReport(name) {
        return {
            valid: true,
            tests: [{
                    valid: true,
                    name: 'Requisition skipped',
                    description: 'There is no iterations set to this requisition'
                }],
            name: name,
            time: {
                startTime: new date_controller_1.DateController().toString(),
                endTime: new date_controller_1.DateController().toString(),
                totalTime: 0
            },
            subscriptions: [],
            startEvent: {}
        };
    }
    createIteratorReport(name) {
        return {
            valid: true,
            tests: [],
            name: name + ' iterator collection',
            time: {
                startTime: '',
                endTime: '',
                totalTime: 0
            },
            subscriptions: [],
            startEvent: {},
            requisitions: []
        };
    }
}
exports.RequisitionRunner = RequisitionRunner;