"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const subscription_1 = require("./subscription");
const conditional_injector_1 = require("conditional-injector");
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const logger_1 = require("../loggers/logger");
const store_1 = require("../configurations/store");
let UdsSubscription = class UdsSubscription extends subscription_1.Subscription {
    constructor(subscriptionAttributes) {
        super(subscriptionAttributes);
        this.path = subscriptionAttributes.path;
        if (typeof subscriptionAttributes.response != 'string') {
            this.response = JSON.stringify(subscriptionAttributes.response);
        }
        this.loadStream = subscriptionAttributes.loadStream;
        this.saveStream = subscriptionAttributes.saveStream;
    }
    receiveMessage() {
        return new Promise((resolve) => {
            if (this.stream) {
                this.waitForData(resolve);
            }
            else {
                this.server.on('connection', (stream) => {
                    this.server.close();
                    this.server = null;
                    this.stream = stream;
                    this.waitForData(resolve);
                });
            }
        });
    }
    subscribe() {
        return new Promise((resolve, reject) => {
            if (this.loadStream) {
                logger_1.Logger.debug(`Server is trying to reuse uds stream: ${this.loadStream}`);
                this.stream = store_1.Store.getData()[this.loadStream];
                if (!this.stream) {
                    reject(`No uds stream able for being reused`);
                }
                resolve();
                return;
            }
            fs.unlink(this.path, () => {
                this.server = net.createServer()
                    .listen(this.path, () => {
                    resolve();
                });
            });
        });
    }
    waitForData(resolve) {
        this.stream.once('end', () => {
            logger_1.Logger.debug(`Uds server detected stream's end`);
            this.persistStream();
            resolve();
            return;
        });
        this.stream.on('data', (msg) => {
            logger_1.Logger.debug(`Uds server got data`);
            if (!this.response) {
                this.persistStream();
            }
            resolve(msg);
        });
    }
    sendResponse() {
        return new Promise((resolve, reject) => {
            if (this.stream) {
                logger_1.Logger.debug(`Uds server sending response`);
                this.stream.write(this.response, () => {
                    logger_1.Logger.debug(`Uds server response sent`);
                    this.persistStream();
                    resolve();
                });
            }
            else {
                const message = `No uds response was sent because uds stream is null`;
                logger_1.Logger.warning(message);
                reject(message);
            }
        });
    }
    persistStream() {
        if (this.saveStream) {
            this.stream.removeAllListeners('data');
            this.stream.removeAllListeners('connect');
            this.stream.removeAllListeners('error');
            this.stream.removeAllListeners('end');
            logger_1.Logger.debug(`Uds server saving stream: ${this.saveStream}`);
            store_1.Store.getData()[this.saveStream] = this.stream;
        }
        else {
            if (this.stream) {
                this.stream.end();
                this.stream = null;
            }
        }
    }
};
UdsSubscription = __decorate([
    conditional_injector_1.Injectable({ predicate: (subscriptionAttributes) => subscriptionAttributes.type === 'uds' }),
    __metadata("design:paramtypes", [Object])
], UdsSubscription);
exports.UdsSubscription = UdsSubscription;
