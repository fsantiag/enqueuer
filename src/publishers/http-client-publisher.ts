import {Publisher} from "./publisher";
import {Injectable} from "../injector/injector";
import {PublisherModel} from "../requisitions/model/publisher-model";
const request = require("request");

@Injectable((publishRequisition: any) => publishRequisition.type === "http-client")
export class HttpClientPublisher extends Publisher {
    private url: string;
    private method: string;
    private headers: any;

    constructor(publish: PublisherModel) {
        super(publish);
        this.url = publish.url;
        this.method = publish.method;
        this.headers = publish.headers;
    }

    public publish(): Promise<void> {
        return new Promise((resolve, reject) => {
            request({
                    url: this.url,
                    method: this.method,
                    headers: this.headers,
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