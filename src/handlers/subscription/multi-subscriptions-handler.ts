import {SubscriptionHandler} from "./subscription-handler";

export class MultiSubscriptionsHandler {
    private subscriptionHandlers: SubscriptionHandler[] = [];
    private subscriptionsConnectionCompletedCounter: number = 0;
    private subscriptionsStoppedWaitingCounter: number = 0;

    constructor(subscriptionsAttributes: any[]) {
        for (let id: number = 0; id < subscriptionsAttributes.length; ++id) {
            this.subscriptionHandlers.push(new SubscriptionHandler(subscriptionsAttributes[id]));
        }
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.subscriptionHandlers.forEach(subscriptionHandler => {
                subscriptionHandler.connect()
                    .then(() => {
                        if (this.areAllSubscriptionsConnected())
                            resolve();
                    })
                    .catch(err => reject(err));
                }
            );
        });
    }

    public receiveMessage(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.subscriptionHandlers.forEach(subscriptionHandler => {
                subscriptionHandler.onTimeout(() => {
                    if (this.haveAllSubscriptionsStoppedWaiting())
                        resolve();
                });
                subscriptionHandler.receiveMessage()
                    .then(() => {
                        if (this.haveAllSubscriptionsStoppedWaiting())
                            resolve();
                    })
                    .catch(err => reject(err))
            }
            );
        });
    }

    public getReport(): any {
        var subscriptionReports: any = [];
        var valid = true;
        this.subscriptionHandlers.forEach(subscriptionHandler => {
            const subscriptionReport = subscriptionHandler.getReport();
            subscriptionReports.push(subscriptionReport);
            valid = valid && subscriptionReport.valid;
        });
        return {
            subscriptionReports: subscriptionReports,
            valid: valid
        };
    }

    private areAllSubscriptionsConnected(): boolean {
        ++this.subscriptionsConnectionCompletedCounter;
        return (this.subscriptionsConnectionCompletedCounter >= this.subscriptionHandlers.length)
    }

    private haveAllSubscriptionsStoppedWaiting() {
        ++this.subscriptionsStoppedWaitingCounter;
        return (this.subscriptionsStoppedWaitingCounter >= this.subscriptionHandlers.length);
    }

}