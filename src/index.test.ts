import { Proxy } from './proxy';
import { CommandAction } from './types';
import { Master } from './master';

describe('Integration', () => {
  test('multiple proxies create same node', async () => {
    const proxyA = new Proxy({
      updateCount: 0,
      document: {}
    }, {sequentialIds: true});
    const proxyB = new Proxy({
      updateCount: 0,
      document: {}
    }, {sequentialIds: true});
    const master = new Master({
      updateCount: 0,
      document: {}
    }, {sequentialIds: true});

    const resultA = proxyA.performCommand({
      action: CommandAction.Create,
      props: {
        branchA: {}
      }
    });
    proxyA.performCommand({
      path: [resultA.isSuccess && resultA.createdId, 'branchA'],
      action: CommandAction.Create,
      props: {
        childOf: 'a'
      }
    });
    const batchA1 = proxyA.beginFlush();

    const resultB = proxyB.performCommand({
      action: CommandAction.Create,
      props: {
        branchB: {}
      }
    });
    const batchB1 = proxyB.beginFlush();
    proxyB.performCommand({
      path: [resultB.isSuccess && resultB.createdId, 'branchB'],
      action: CommandAction.Create,
      props: {
        childOf: 'b'
      }
    });

    expect(resultA.isSuccess && resultA.createdId).toBe(resultB.isSuccess && resultB.createdId);

    const applyResA1 = await master.apply(batchA1);
    const applyResB1 = await master.apply(batchB1);

    const flushResA1 = proxyA.endFlush(applyResA1.sync);
    expect(flushResA1.idsChanged).toBe(false);
    const flushResB1 = proxyB.endFlush(applyResB1.sync);

    expect(flushResB1.idsChanged).toBe(true);

    const batchA2 = proxyA.beginFlush();

    const batchB2 = proxyB.beginFlush();
    const applyResB2 = await master.apply(batchB2);

    const applyResA2 = await master.apply(batchA2);
    
    proxyA.endFlush(applyResA2.sync);
    proxyB.endFlush(applyResB2.sync);

    expect(proxyA.getUpdateCount()).toBe(4);
    expect(proxyA.getUpdateCount()).toBe(proxyB.getUpdateCount());
    expect(proxyA.getDocument()).toStrictEqual(proxyB.getDocument());
  });
});



