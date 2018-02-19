import {IpcFactory} from './ipc-factory';
import { expect } from 'chai';
import 'mocha';
import { IpcUds } from './ipc-uds';

describe('IpcFactory test', function() {
    describe('IpcFactory test', function() {
        it('uds protocol', function() {
            const ipcFactory: IpcFactory = new IpcFactory();
            const configurationFile = {
                protocol: "uds"
            }

            const created = ipcFactory.create(configurationFile);
            expect(created).to.be.instanceOf(IpcUds);
        });

        it('undefined protocol', function() {
            const ipcFactory: IpcFactory = new IpcFactory();
            const configurationFile = {
                protocol: "unknown"
            }

            expect(() => ipcFactory.create(configurationFile)).to.throw;
        });
    });
});
