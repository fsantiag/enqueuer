import {RequisitionModel} from '../models/inputs/requisition-model';
import {Logger} from '../loggers/logger';
import {JsonPlaceholderReplacer} from 'json-placeholder-replacer';
import {Store} from '../configurations/store';
import {IterationsEvaluator} from './iterations-evaluator';

export class RequisitionMultiplier {
    private readonly requisition: RequisitionModel;
    private readonly iterations?: number;

    public constructor (requisition: RequisitionModel) {
        this.requisition = requisition;
        this.iterations = this.evaluateIterations();
    }

    public multiply(): RequisitionModel[] {

        if (this.iterations === undefined || this.iterations === 1) {
            return [this.requisition];
        }

        if (!this.iterations) {
            Logger.debug(`No iteration was found`);
            return [];
        }

        let requisitions: RequisitionModel[] = [];
        for (let x = 0; x < this.iterations; ++x) {
            const clone: RequisitionModel = {...this.requisition} as RequisitionModel;
            clone.name = clone.name + ` [${x}]`;
            requisitions = requisitions.concat(clone);
        }
        return requisitions;
    }

    private evaluateIterations(): number | undefined {
        const placeHolderReplacer = new JsonPlaceholderReplacer();
        let iterations: any = {
            iterations: this.requisition.iterations
        };

        try {
            const replaced = (placeHolderReplacer.addVariableMap(Store.getData())
                .replace(iterations) as any);
            return new IterationsEvaluator().evaluate(replaced);
        } catch (err) {
            return undefined;
        }
    }
}
