import {Publisher} from "./publisher";

const mqtt = require("mqtt")

export class MqttPublisher extends Publisher {
    brokerAddress: string = "";
    topic: string = "";

    constructor(publish: any) {
        super(publish);
        if (publish) {
            this.brokerAddress = publish.brokerAddress;
            this.topic = publish.topic;
        }
    }

    public execute(): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = mqtt.connect(this.brokerAddress,
                {clientId: 'mqtt_' + (1+Math.random()*4294967295).toString(16)});
            if (client.connected) {
                client.publish(this.topic, this.payload);
                client.end();
                resolve();

            }
            else {
                client.on("connect", () =>  {
                    client.publish(this.topic, this.payload);
                    client.end();
                    resolve();
                });
            }
            client.on("error", (err: any) =>  reject(err));
        });
    }

}