import {TestModel} from '../../models/outputs/test-model';

export type Time = { timeout?: number; totalTime: number };
export type Summary = { subscribed: boolean, avoidable: boolean, hasMessage: boolean, time?: Time, ignore?: boolean, subscribeError?: string};

export class SubscriptionFinalReporter {
    private messageReceivedTestName: string = `Message received`;
    private subscriptionAvoidedTestName: string = `Subscription avoided`;
    private noTimeOutTestName: string = `No time out`;
    private subscribedTestName: string = `Subscribed`;

    private readonly subscribed: boolean;
    private readonly avoidable: boolean;
    private readonly hasMessage: boolean = false;
    private readonly ignore: boolean;
    private readonly time?: Time;
    private readonly subscribeError?: string;

    constructor(summary: Summary) {
        this.subscribed = summary.subscribed;
        this.avoidable = summary.avoidable;
        this.hasMessage = summary.hasMessage;
        this.time = summary.time;
        this.subscribeError = summary.subscribeError;
        this.ignore = !!summary.ignore;
    }

    public getReport(): TestModel[] {
        if (this.ignore) {
            return [];
        }
        if (!this.subscribed) {
            return this.createNotSubscribedTests();
        }
        let tests: TestModel[] = [];
        if (this.avoidable) {
            tests = tests.concat(this.createAvoidableTests());
        } else {
            tests = tests.concat(this.createMessageTests());
        }
        return tests.concat(this.addTimeoutTests());
    }

    private addTimeoutTests(): TestModel[] {
        if (this.time) {
            if (!!this.time.timeout && this.time.totalTime > this.time.timeout) {
                return this.createTimeoutTests();
            }
        }
        return [];
    }

    private createNotSubscribedTests(): TestModel[] {
        return [{
            valid: false,
            name: this.subscribedTestName,
            description: `Subscription is not able to subscribe: ${this.subscribeError}`
        }];
    }

    private createMessageTests(): TestModel[] {
        if (this.hasMessage) {
            return [{
                valid: true,
                name: this.messageReceivedTestName,
                description: `Subscription has received its message`
            }];
        } else {
            return [{
                valid: false,
                name: this.messageReceivedTestName,
                description: `Subscription has not received its message`
            }];
        }
    }
    private createTimeoutTests(): TestModel[] {
        if (!this.avoidable && this.time) {
            return [{
                valid: false,
                name: this.noTimeOutTestName,
                description: `Not avoidable subscription has timed out: ${this.time.totalTime} > ${this.time.timeout}`
            }];
        }
        return [];
    }

    private createAvoidableTests(): TestModel[] {
        if (this.hasMessage) {
            return [{
                valid: false,
                name: this.subscriptionAvoidedTestName,
                description: `Avoidable subscription should not receive messages`
            }];
        } else {
            return [{
                valid: true,
                name: this.subscriptionAvoidedTestName,
                description: `Avoidable subscription has not received any message`
            }];
        }
    }
}
