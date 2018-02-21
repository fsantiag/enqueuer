import {classToClass} from "class-transformer";
import { MqttRequisition, Subscription } from "../mqtt/model/mqtt-requisition";
import { ReportGenerator } from "../report/report-generator";
import { Report } from "../report/report";
import { MessengerService, MessengerServiceCallback } from "../service/messenger-service";
import { SubscriptionOnMessageReceivedExecutor } from "../function-executor/subscription-on-message-received-executor";
import { PublishPrePublishingExecutor } from "../function-executor/publish-pre-publishing-executor";

const mqtt = require('mqtt')

export class MqttService implements MessengerService {
    private client: any;
    private mqttRequisition: MqttRequisition;
    private onFinishCallback: MessengerServiceCallback | null = null;
    private startTime: number = 0;
    private timer: NodeJS.Timer | null = null;
    private reportGenerator: ReportGenerator = new ReportGenerator();

    constructor(mqttRequisition: MqttRequisition) {
        this.mqttRequisition = classToClass(mqttRequisition); //clone
        this.client = mqtt.connect(mqttRequisition.brokerAddress);
        this.client.on('message', 
                    (topic: string, message: string) => this.onMessageReceived(topic, message));
        this.subscribeToTopics();
    }
    
    public start(onFinishCallback: MessengerServiceCallback): void {
        this.onFinishCallback = onFinishCallback;
        this.client.on('connect', () => this.onConnect());
    }

    private onConnect(): void {
        this.startTime = Date.now();
        this.setTimeout();
        this.publish();
    }

    private publish(): void {
        if (this.mqttRequisition.publish) {
            this.client.publish(this.mqttRequisition.publish.topic,
                                this.mqttRequisition.publish.payload);

            const ellapsedTime = Date.now() - this.startTime;
            let warning = {};
            try {
                new PublishPrePublishingExecutor(this.mqttRequisition.publish, {payload: this.mqttRequisition.publish.payload,
                    topic: this.mqttRequisition.publish.topic});
            }
            catch (exception) {
                this.reportGenerator.addError(exception);
                warning = exception;
            }

            this.reportGenerator.addPublishReport({
                                                    payload: this.mqttRequisition.publish.payload,
                                                    topic: this.mqttRequisition.publish.topic,
                                                    ellapsedTime: ellapsedTime,
                                                    warning: warning
                                                });                        
        }
    }
    
    private setTimeout(): void {
        let totalTimeout = -1;
        this.mqttRequisition.subscriptions.forEach(
            (subscription: Subscription) => {
                const subscriptionTimeout = subscription.timeout;
                if (subscriptionTimeout && subscriptionTimeout > totalTimeout)
                    totalTimeout = subscriptionTimeout;
            });

        if (totalTimeout != -1) {
            this.reportGenerator.addInfo(`Max timeout: ${totalTimeout}ms`);
            this.timer = setTimeout(() => this.onTimeout(), totalTimeout);
        } else {
            this.reportGenerator.addInfo(`The service will wait untill all topics are hit`);            
        }
    }
    
    private onTimeout(): void {
        this.client.end();
        this.onFinish();
    }
    
    private onMessageReceived(topic: string, payloadBuffer: string): void {
        const payload: string = payloadBuffer.toString();
        const ellapsedTime = Date.now() - this.startTime;

        var index = this.mqttRequisition.subscriptions.findIndex((subscription: Subscription) => {
            return subscription.topic == topic;
        });

        if (index > -1) {
            let subscription: Subscription = this.mqttRequisition.subscriptions[index];
            this.mqttRequisition.subscriptions.splice(index, 1);
            this.generateSubscriptionReport(subscription, {payload: payload, topic: topic});

            if (this.mqttRequisition.subscriptions.length === 0) {
                this.reportGenerator.addInfo("All subscriptions received messages");
                this.onFinish();
            }
        }
    }

    private generateSubscriptionReport(subscription: Subscription, message: any) {
        const ellapsedTime = Date.now() - this.startTime;

        let tests = {};
        if (message) {
            let subscriptionTestExecutor: SubscriptionOnMessageReceivedExecutor
                        = new SubscriptionOnMessageReceivedExecutor(subscription, message);
            
            subscriptionTestExecutor.execute();

            tests = {
                failing: subscriptionTestExecutor.getFailingTests(),
                passing: subscriptionTestExecutor.getPassingTests(),
                warning: subscriptionTestExecutor.getWarning()
            }
        }

        var subscriptionReport = {
            subscription: subscription.topic,
            timeout: subscription.timeout,
            ellapsedTime: ellapsedTime,
            tests: tests,
            message: message
        };
        this.reportGenerator.addSubscriptionReport(subscriptionReport);
    }
    
    private subscribeToTopics(): void {
        this.mqttRequisition.subscriptions
                .forEach((subscription: Subscription) => {
                    this.client.subscribe(subscription.topic)
                });
    }

    private onFinish(): void {
        const totalTime = Date.now() - this.startTime;
        if (this.timer)
            clearTimeout(this.timer);
            this.mqttRequisition.subscriptions
                .forEach((subscription: Subscription) => {
                    this.generateSubscriptionReport(subscription, null);
                });

        this.reportGenerator.addInfo(`Total time: ${totalTime}ms`);
        this.client.end();
        if (this.onFinishCallback)
            this.onFinishCallback(this.reportGenerator.generate());
    }
}