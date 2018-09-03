"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TestsCounter {
    constructor() {
        this.totalTests = 0;
        this.failingTests = 0;
    }
    addTests(report) {
        this.findRequisitions([report]);
    }
    getTestsNumber() {
        return this.totalTests;
    }
    getFailingTestsNumber() {
        return this.failingTests;
    }
    getPercentage() {
        let percentage = Math.trunc(10000 * (this.totalTests - this.failingTests) / this.totalTests) / 100;
        if (isNaN(percentage)) {
            percentage = 0;
        }
        return percentage;
    }
    findRequisitions(reports = []) {
        reports.forEach((requisition) => {
            this.findRequisitions(requisition.requisitions);
            this.findTests(requisition);
        });
    }
    findTests(requisition) {
        this.sumTests(requisition.tests);
        if (requisition.subscriptions) {
            requisition.subscriptions
                .forEach(subscription => this.sumTests(subscription.tests));
        }
        const startEvent = this.detectStartEvent(requisition);
        if (startEvent) {
            this.sumTests(startEvent.tests);
        }
    }
    sumTests(tests) {
        this.failingTests += tests.filter(test => !test.valid).length;
        this.totalTests += tests.length;
    }
    detectStartEvent(requisition) {
        if (requisition.startEvent) {
            if (requisition.startEvent.subscription) {
                return requisition.startEvent.subscription;
            }
            else if (requisition.startEvent.publisher) {
                return requisition.startEvent.publisher;
            }
        }
    }
}
exports.TestsCounter = TestsCounter;