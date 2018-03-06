import {Publisher} from "./publisher";

const request = require("request");

export class HttpPublisher extends Publisher {
    private endpoint: string;
    private method: string;
    private header: any;

    constructor(publish: any) {
        super(publish);
        this.endpoint = publish.endpoint;
        this.method = publish.method;
        this.header = publish.header;
    }

    public publish(): Promise<void> {
        return new Promise((resolve, reject) => {
            request.post({
                    url: this.endpoint,
                    body: this.payload
                },
                (error: any, response: any, body: any) =>
                {
                    if (error) {
                        reject("Error to publish http: "  + error);
                    }
                    else {
                        resolve();
                    }
                });
        })

    }

}
