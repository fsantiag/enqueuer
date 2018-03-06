import {Subscription} from "./subscription";
const amqp = require('amqp');

export class AmqpSubscription extends Subscription {

    private connection: any;
    private brokerUrl: string;
    private exchangeName: string;
    private routingKey: string;
    private queueName: string;

    constructor(subscriptionAttributes: any) {
        super(subscriptionAttributes);
        this.brokerUrl = subscriptionAttributes.brokerUrl;
        this.exchangeName = subscriptionAttributes.exchangeName;
        this.routingKey = subscriptionAttributes.routingKey;
        this.queueName = subscriptionAttributes.queueName;
    }

    public receiveMessage(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.connection.queue(this.queueName, (queue:any) => {
                queue.bind(this.exchangeName, this.routingKey);
                queue.subscribe((message: any) => {
                    resolve(message.data.toString());
                    queue.destroy();
                });
            });
        });
    }

    public connect(): Promise<void> {
        this.connection = amqp.createConnection({ url: this.brokerUrl});
        return new Promise((resolve, reject) => {
            this.connection.on('ready', () => resolve());
            this.connection.on('error', (err: any) => reject(err));

        });
    }

    public unsubscribe(): void {
        if (this.connection) {
            this.connection.disconnect();
        }
        delete this.connection;
    }

}