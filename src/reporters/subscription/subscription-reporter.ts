import {Logger} from '../../loggers/logger';
import {DateController} from '../../timers/date-controller';
import {Subscription} from '../../subscriptions/subscription';
import {Timeout} from '../../timers/timeout';
import * as input from '../../models/inputs/subscription-model';
import {SubscriptionModel} from '../../models/inputs/subscription-model';
import * as output from '../../models/outputs/subscription-model';
import {checkValidation} from '../../models/outputs/report-model';
import {OnInitEventExecutor} from '../../events/on-init-event-executor';
import {OnMessageReceivedEventExecutor} from '../../events/on-message-received-event-executor';
import {SubscriptionFinalReporter} from './subscription-final-reporter';
import {OnFinishEventExecutor} from '../../events/on-finish-event-executor';
import {Json} from '../../object-notations/json';
import '../../injectable-files-list';
import {PluginManager} from '../../plugins/plugin-manager';
import Signals = NodeJS.Signals;
import SignalsListener = NodeJS.SignalsListener;

export class SubscriptionReporter {

    private static readonly DEFAULT_TIMEOUT: number = 5 * 1000;
    private readonly killListener: SignalsListener;
    private readonly report: output.SubscriptionModel;
    private readonly startTime: DateController;
    private readonly subscription: Subscription;
    private subscribeError?: string;
    private timeOut?: Timeout;
    private hasTimedOut: boolean = false;
    private subscribed: boolean = false;
    private totalTime?: DateController;

    constructor(subscriptionAttributes: input.SubscriptionModel) {
        this.startTime = new DateController();
        this.report = {
            id: subscriptionAttributes.id,
            name: subscriptionAttributes.name,
            type: subscriptionAttributes.type,
            tests: [],
            valid: true
        };

        this.executeOnInitFunction(subscriptionAttributes);
        if (subscriptionAttributes.timeout === undefined) {
            subscriptionAttributes.timeout = SubscriptionReporter.DEFAULT_TIMEOUT;
        } else if (subscriptionAttributes.timeout <= 0) {
            delete subscriptionAttributes.timeout;
        }

        Logger.debug(`Instantiating subscription ${subscriptionAttributes.type}`);
        this.subscription = PluginManager.getProtocolManager().createSubscription(subscriptionAttributes);
        this.killListener = (signal: Signals) => this.handleKillSignal(signal, this.subscription.type || 'undefined');
    }

    public startTimeout(onTimeOutCallback: Function) {
        this.subscription.messageReceived = undefined;
        if (this.timeOut) {
            this.timeOut.clear();
        }
        this.timeOut = new Timeout(() => {
            if (!this.subscription.messageReceived) {
                this.totalTime = new DateController();
                const message = `${this.subscription.name} stopped waiting because it has timed out`;
                Logger.info(message);
                this.hasTimedOut = true;
                onTimeOutCallback();
            }
        });
    }

    public subscribe(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.subscription.ignore) {
                Logger.trace(`Subscription ${this.subscription.name} is ignored`);
                resolve();
            } else {
                Logger.trace(`Starting ${this.subscription.name} time out`);
                this.initializeTimeout();
                Logger.trace(`Subscription ${this.subscription.name} is subscribing`);
                this.subscription.subscribe()
                    .then(() => {
                        this.handleSubscription(reject, resolve);
                    })
                    .catch((err: any) => {
                        Logger.error(`${this.subscription.name} is unable to subscribe: ${err}`);
                        this.subscribeError = new Json().stringify(err);
                        reject(err);
                    });
            }
        });
    }

    public receiveMessage(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.subscription.ignore) {
                resolve();
            } else {
                this.subscription.receiveMessage()
                    .then((message: any) => {
                        Logger.debug(`${this.subscription.name} received its message`);
                        if (message !== null || message !== undefined) {
                            this.handleMessageArrival(message);
                            this.sendSyncResponse(resolve, message, reject);
                        } else {
                            Logger.warning(`${this.subscription.name} message is null or undefined`);
                        }
                    })
                    .catch((err: any) => {
                        this.subscription.unsubscribe().catch(console.log.bind(console));
                        Logger.error(`${this.subscription.name} is unable to receive message: ${err}`);
                        reject(err);
                    });
            }
        });
    }

    private handleSubscription(reject: any, resolve: any) {
        if (this.hasTimedOut) {
            const message = `Subscription '${this.subscription.name}' subscription because it has timed out`;
            Logger.error(message);
            reject(message);
        } else {
            this.report.connectionTime = new DateController().toString();
            this.subscribed = true;
            resolve();
        }
        process.once('SIGINT', this.killListener)
            .once('SIGTERM', this.killListener);
    }

    private sendSyncResponse(resolve: any, message: any, reject: any) {
        if (this.subscription.response) {
            Logger.debug(`Subscription ${this.subscription.type} sending synchronous response`);
            this.subscription.sendResponse()
                .then(() => resolve(message))
                .catch(err => {
                    Logger.warning(`Error ${this.subscription.type} synchronous response sending: ${err}`);
                    reject(err);
                });
        } else {
            resolve();
        }
    }

    public getReport(): output.SubscriptionModel {
        const time: any = {
            timeout: this.subscription.timeout
        };
        if (!this.totalTime) {
            this.totalTime = new DateController();
        }
        time.totalTime = this.totalTime.getTime() - this.startTime.getTime();
        const finalReporter = new SubscriptionFinalReporter({
            subscribed: this.subscribed,
            avoidable: this.subscription.avoid,
            hasMessage: !!this.subscription.messageReceived,
            time: time,
            subscribeError: this.subscribeError,
            ignore: this.subscription.ignore
        });
        this.report.tests = this.report.tests.concat(finalReporter.getReport());

        this.report.messageReceived = this.subscription.messageReceived;
        this.report.valid = this.report.valid && checkValidation(this.report);
        return this.report;
    }

    public async unsubscribe(): Promise<void> {
        process.removeListener('SIGINT', this.killListener)
            .removeListener('SIGTERM', this.killListener);

        Logger.debug(`Unsubscribing subscription ${this.subscription.type}`);
        if (this.subscribed) {
            return this.subscription.unsubscribe();
        }
    }

    public onFinish() {
        Logger.trace(`Executing subscription onFinish`);
        if (!this.subscription.ignore) {
            this.report.tests = this.report.tests.concat(new OnFinishEventExecutor('subscription', this.subscription).trigger());
        }
    }

    private handleMessageArrival(message: any) {
        Logger.debug(`${this.subscription.name} message: ${new Json().stringify(message)}`.substr(0, 150) + '...');
        if (!this.hasTimedOut) {
            Logger.debug(`${this.subscription.name} stop waiting because it has received its message`);
            this.totalTime = new DateController();
            this.subscription.messageReceived = message;
            this.executeOnMessageReceivedFunction();
        } else {
            Logger.info(`${this.subscription.name} has received message in a unable time`);
        }
        Logger.debug(`${this.subscription.name} handled message arrival`);
    }

    private initializeTimeout() {
        if (this.timeOut && this.subscription.timeout) {
            Logger.debug(`${this.subscription.name} setting timeout to ${this.subscription.timeout}ms`);
            this.timeOut.start(this.subscription.timeout);
        }
    }

    private executeOnInitFunction(subscriptionAttributes: SubscriptionModel) {
        if (!subscriptionAttributes.ignore) {
            Logger.debug(`Executing subscription::onInit hook function`);
            this.report.tests = this.report.tests.concat(new OnInitEventExecutor('subscription', subscriptionAttributes).trigger());
        }
    }

    private executeOnMessageReceivedFunction() {
        Logger.trace(`Executing subscription onMessageReceivedResponse`);
        Logger.trace(`${this.subscription.name} executing hook ${this.subscription.type} specific`);
        this.report.tests = this.subscription.onMessageReceivedTests().concat(this.report.tests);
        this.report.tests = this.report.tests.concat(new OnMessageReceivedEventExecutor('subscription', this.subscription).trigger());
    }

    private async handleKillSignal(signal: Signals, type: string): Promise<void> {
        Logger.fatal(`Subscription reporter '${type}' handling kill signal ${signal}`);
        await this.unsubscribe();
        Logger.fatal(`Subscription reporter '${type}' unsubscribed`);
    }

}
