const whyIsNodeRunning = require('why-is-node-running') // should be your first require
import {RequisitionReader} from "./requisitions/requisition-reader";
import {RequisitionParser} from "./requisitions/requisition-parser";
import {ReportersFactory} from "./reporters/reporters-factory";
import {RequisitionRunner} from "./requisitions/requisition-runner";
import {Logger} from "./loggers/logger";

export class Enqueuer {

    private requisitionParser: RequisitionParser = new RequisitionParser();

    public execute(configReaders: any): void {

        configReaders
            .forEach((configReader: any) => {
                let reader = new RequisitionReader(configReader)

                Logger.info(`Starting reader ${configReader.protocol}`);
                reader.connect()
                        .then(() => this.startReader(reader))
                        .catch( (err: string) => {
                            Logger.error(err);
                            reader.unsubscribe();
                        })
            });
    }

    private startReader(reader: RequisitionReader) {
        reader.receiveMessage()
            .then((messageReceived: string) => {
                Logger.info(`${reader.getSubscriptionProtocol()} got a message`);
                this.processRequisition(messageReceived);
                return this.startReader(reader); //runs again
            })
            .catch( (err: string) => {
                Logger.error(err);
                reader.unsubscribe();
            })
    }

    private processRequisition(messageReceived: string): void {
        try {
            const parsedRequisition: any = this.requisitionParser.parse(messageReceived);
            const requisitionRunner: RequisitionRunner = new RequisitionRunner(parsedRequisition);

            requisitionRunner.start((report: string) => {
                new ReportersFactory(report)
                    .createReporters(parsedRequisition.reports)
                    .forEach( publisher => publisher.publish()
                        .catch( (err: any) => {
                            Logger.error(err);
                        }));

        });
            Logger.info("Requisition is over");

            // return this.processRequisition(requisition); //Do it again
            // whyIsNodeRunning();
        } catch (err) {
            Logger.error(err);
        }
    }
}