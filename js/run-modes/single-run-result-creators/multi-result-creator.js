"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const console_result_creator_1 = require("./console-result-creator");
const logger_1 = require("../../loggers/logger");
const file_result_creator_1 = require("./file-result-creator");
class MultiResultCreator {
    constructor(reportName) {
        this.resultCreators = [];
        if (reportName) {
            this.resultCreators.push(new file_result_creator_1.FileResultCreator(reportName));
        }
        this.resultCreators.push(new console_result_creator_1.ConsoleResultCreator());
    }
    addTestSuite(name, report) {
        logger_1.Logger.trace('Adding test suite');
        this.resultCreators.forEach(result => result.addTestSuite(name, report));
    }
    addError(err) {
        this.resultCreators.forEach(result => result.addError(err));
    }
    isValid() {
        return this.resultCreators.every(result => result.isValid());
    }
    create() {
        this.resultCreators.forEach(result => result.create());
    }
}
exports.MultiResultCreator = MultiResultCreator;