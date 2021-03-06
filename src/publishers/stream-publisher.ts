import {Publisher} from './publisher';
import {PublisherModel} from '../models/inputs/publisher-model';
import * as net from 'net';
import {Logger} from '../loggers/logger';
import {Store} from '../configurations/store';
import {Json} from '../object-notations/json';
import * as tls from 'tls';
import {Timeout} from '../timers/timeout';
import {MainInstance} from '../plugins/main-instance';
import {PublisherProtocol} from '../protocols/publisher-protocol';

class StreamPublisher extends Publisher {

    private readonly loadedStream: any;

    constructor(publisherAttributes: PublisherModel) {
        super(publisherAttributes);
        this.timeout = this.streamTimeout;
        this.timeout = this.timeout || 1000;
        if (this.loadStream) {
            Logger.debug(`Loading ${this.type} client: ${this.loadStream}`);
            this.loadedStream = Store.getData()[this.loadStream];
        }
    }

    public publish(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.loadStream) {
                this.sendReusingStream(resolve, reject);
            } else {
                this.sendCreatingStream(resolve, reject);
            }

        });
    }

    private sendReusingStream(resolve: any, reject: any) {
        Logger.info(`${this.type} client is trying to reuse stream ${this.loadStream}`);
        if (!this.loadedStream) {
            Logger.error(`There is no ${this.type} stream able to be loaded named ${this.loadStream}`);
            this.sendCreatingStream(resolve, reject);
        } else {
            Logger.debug(`Client is reusing ${this.type} stream`);
            this.publishData(this.loadedStream, resolve, reject);
        }
    }

    private sendCreatingStream(resolve: any, reject: any) {
        Logger.info(`${this.type} client trying to connect`);
        this.createStream()
            .then((stream: any) => {
                Logger.debug(`${this.type} client connected to: ${this.serverAddress}:${this.port || this.path}`);
                this.publishData(stream, resolve, reject);
            }).catch(err => {
            reject(err);
        });
    }

    private createStream(): Promise<any> {
        return new Promise((resolve, reject) => {
            if ('tcp' === (this.type || '').toLowerCase()) {
                this.createTcpStream(resolve, reject);
            } else if ('ssl' === (this.type || '').toLowerCase()) {
                this.createSslStream(resolve, reject);
            } else {
                resolve(net.createConnection(this.path));
            }
        });
    }

    private createSslStream(resolve: any, reject: any): void {
        const stream: any = tls.connect(this.port, this.serverAddress, this.options, () => resolve(stream));
        stream.on('error', (error: any) => {
            Logger.error(`${this.type} client error: ${error}`);
            reject(error);
        });
    }

    private createTcpStream(resolve: any, reject: any): void {
        const stream = new net.Socket();
        stream.connect(this.port, this.serverAddress, () => resolve(stream));
        stream.on('error', (error: any) => {
            Logger.error(`${this.type} client error: ${error}`);
            reject(error);
        });
    }

    private publishData(stream: any, resolve: any, reject: any) {
        Logger.debug(`${this.type} client publishing`);
        stream.once('error', (data: any) => {
            this.finalize(stream);
            reject(data);
        });
        const stringifyPayload = this.stringifyPayload();
        stream.write(stringifyPayload, () => {
            Logger.debug(`${this.type} client published`);
            this.registerEvents(stream, resolve);
            if (this.saveStream) {
                Logger.debug(`Persisting publisher stream ${this.saveStream}`);
                Store.getData()[this.saveStream] = stream;
            }
        });
    }

    private registerEvents(stream: any, resolve: any) {
        new Timeout(() => {
            this.finalize(stream);
            Logger.debug(`${this.type} client timed out`);
            stream.removeAllListeners('data');
            resolve();
        }).start(this.timeout);

        stream.once('end', () => {
            Logger.debug(`${this.type} client ended`);
            this.finalize(stream);
            resolve();
        })
            .on('data', (msg: Buffer) => {
                Logger.debug(`${this.type} client got data '${msg.toString()}'`);
                if (!this.messageReceived) {
                    this.messageReceived = {
                        payload: '',
                        stream: stream.address()
                    };
                }
                this.messageReceived.payload += msg;
            });
    }

    private finalize(stream: any) {
        if (!this.saveStream) {
            Logger.trace(`Ending writable stream`);
            stream.end();
        }
        if (stream.close) {
            Logger.trace(`Closing writable stream`);
            stream.close();
        }
    }

    private stringifyPayload() {
        if (typeof(this.payload) != 'string' && !Buffer.isBuffer(this.payload)) {
            return new Json().stringify(this.payload);
        }
        return this.payload;
    }
}

export function entryPoint(mainInstance: MainInstance): void {
    const createFunction = (publisherModel: PublisherModel) => new StreamPublisher(publisherModel);
    const tcp = new PublisherProtocol('tcp',
        createFunction);
    const uds = new PublisherProtocol('uds',
        createFunction)
        .addAlternativeName('uds-client');
    const ssl = new PublisherProtocol('ssl',
        createFunction);

    mainInstance.protocolManager.addProtocol(tcp);
    mainInstance.protocolManager.addProtocol(uds);
    mainInstance.protocolManager.addProtocol(ssl);
}
