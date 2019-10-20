import { CommandAction, Snapshot } from "./types";
import { createHistoryStore } from "./master.test";
import { Master } from "./master";
import { Proxy } from "./proxy";

describe("Integration", () => {
  test("proxy gets same data as master", async () => {
    interface Todo {
      title: string,
      details: string
    }
    interface TodoList {
      title: string,
      todos: Record<string, Todo>
    };
    const latest: Snapshot<TodoList> = {
      commandCount: 0,
      document: {
        title: '',
        todos: {}
      }
    };
    const historyStore = createHistoryStore();
    const master = new Master(latest, { historyProvider: historyStore.createProvider() });
    const clientSnapshot: Snapshot<TodoList> = JSON.parse(JSON.stringify(master.getSnapshot()));
    const proxy = new Proxy(clientSnapshot);
    proxy.apply({
      action: CommandAction.Update,
      props: {
        title: 'My todo list'
      }
    });
    const result = proxy.apply({
      action: CommandAction.Create,
      path: ['todos'],
      props: {
        title: 'shopping',
        details: 'coffee'
      }
    });
    if (!result.isSuccess || result.createdId == undefined) {
      fail();
      return;
    }
    proxy.apply({
      action: CommandAction.Update,
      path: ['todos', result.createdId],
      props: {
        details: 'coffee and cookies'
      }
    });
    const flush = proxy.beginFlush();
    const flushResponse = await master.apply(flush);
    historyStore.store(flushResponse.applied.from, flushResponse.applied.completions);
    proxy.endFlush(flushResponse.sync);

    expect(proxy.getDocument()).toEqual(master.getSnapshot().document);
    expect(proxy.getCommandCount()).toBe(master.getSnapshot().commandCount);
    expect(proxy.getDocument().todos[Object.keys(proxy.getDocument().todos)[0]].details).toBe('coffee and cookies');
  });

  test("multiple proxies create tree with same root ID, without history store", async () => {
    const proxyA = new Proxy(
      {
        commandCount: 0,
        document: {}
      },
      { sequentialIds: true }
    );
    const proxyB = new Proxy(
      {
        commandCount: 0,
        document: {}
      },
      { sequentialIds: true }
    );
    const master = new Master(
      {
        commandCount: 0,
        document: {}
      },
      { sequentialIds: true }
    );

    const resultA = proxyA.apply({
      action: CommandAction.Create,
      props: {
        branchA: {}
      }
    });
    if (resultA.isSuccess === false) {
      fail();
      return;
    }
    proxyA.apply({
      path: [resultA.createdId!, "branchA"],
      action: CommandAction.Create,
      props: {
        childOf: "a"
      }
    });
    const batchA1 = proxyA.beginFlush();

    const resultB = proxyB.apply({
      action: CommandAction.Create,
      props: {
        branchB: {}
      }
    });
    if (resultB.isSuccess === false) {
      fail();
      return;
    }
    const batchB1 = proxyB.beginFlush();
    proxyB.apply({
      path: [resultB.createdId!, "branchB"],
      action: CommandAction.Create,
      props: {
        childOf: "b"
      }
    });

    expect(resultA.isSuccess && resultA.createdId).toBe(
      resultB.isSuccess && resultB.createdId
    );

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

    expect(proxyA.getCommandCount()).toBe(4);
    expect(proxyA.getCommandCount()).toBe(proxyB.getCommandCount());
    expect(proxyA.getDocument()).toStrictEqual(proxyB.getDocument());
  });

  test("multiple proxies create tree with same root ID, with history store", async () => {
    const historyStore = createHistoryStore();
    const proxyA = new Proxy(
      {
        commandCount: 0,
        document: {}
      },
      { sequentialIds: true }
    );
    const proxyB = new Proxy(
      {
        commandCount: 0,
        document: {}
      },
      { sequentialIds: true }
    );
    const master = new Master(
      {
        commandCount: 0,
        document: {}
      },
      { historyProvider: historyStore.createProvider(), sequentialIds: true }
    );

    const resultA = proxyA.apply({
      action: CommandAction.Create,
      props: {
        branchA: {}
      }
    });
    if (resultA.isSuccess === false) {
      fail();
      return;
    }
    proxyA.apply({
      path: [resultA.createdId!, "branchA"],
      action: CommandAction.Create,
      props: {
        childOf: "a"
      }
    });
    const batchA1 = proxyA.beginFlush();

    const resultB = proxyB.apply({
      action: CommandAction.Create,
      props: {
        branchB: {}
      }
    });
    if (resultB.isSuccess === false) {
      fail();
      return;
    }
    const batchB1 = proxyB.beginFlush();
    proxyB.apply({
      path: [resultB.createdId!, "branchB"],
      action: CommandAction.Create,
      props: {
        childOf: "b"
      }
    });

    expect(resultA.isSuccess && resultA.createdId).toBe(
      resultB.isSuccess && resultB.createdId
    );

    const applyResA1 = await master.apply(batchA1);
    historyStore.store(applyResA1.applied.from, applyResA1.applied.completions);
    const applyResB1 = await master.apply(batchB1);
    historyStore.store(applyResB1.applied.from, applyResB1.applied.completions);

    const flushResA1 = proxyA.endFlush(applyResA1.sync);
    expect(flushResA1.idsChanged).toBe(false);
    const flushResB1 = proxyB.endFlush(applyResB1.sync);

    expect(flushResB1.idsChanged).toBe(true);

    const batchA2 = proxyA.beginFlush();

    const batchB2 = proxyB.beginFlush();
    const applyResB2 = await master.apply(batchB2);
    historyStore.store(applyResB2.applied.from, applyResB2.applied.completions);

    const applyResA2 = await master.apply(batchA2);
    historyStore.store(applyResA2.applied.from, applyResA2.applied.completions);

    proxyA.endFlush(applyResA2.sync);
    proxyB.endFlush(applyResB2.sync);

    expect(proxyA.getCommandCount()).toBe(4);
    expect(proxyA.getCommandCount()).toBe(proxyB.getCommandCount());
    expect(proxyA.getDocument()).toStrictEqual(proxyB.getDocument());
  });

  test("creation with parentDefault transfers correctly", async () => {
    interface Todo {
      title: string,
      details: string
    }
    interface TodoList {
      title: string,
      todos?: Record<string, Todo>
    };
    const latest: Snapshot<TodoList> = {
      commandCount: 0,
      document: {
        title: '',
      }
    };
    const historyStore = createHistoryStore();
    const master = new Master(latest, { historyProvider: historyStore.createProvider() });
    const clientSnapshot: Snapshot<TodoList> = JSON.parse(JSON.stringify(master.getSnapshot()));
    const proxy = new Proxy(clientSnapshot);
    const result = proxy.apply({
      action: CommandAction.Create,
      path: ['todos'],
      props: {
        title: 'shopping',
        details: 'coffee'
      },
      parentDefault: {}
    });
    if (!result.isSuccess || result.createdId == undefined) {
      fail();
      return;
    }
    const flush = proxy.beginFlush();
    const flushResponse = await master.apply(flush);
    historyStore.store(flushResponse.applied.from, flushResponse.applied.completions);
    proxy.endFlush(flushResponse.sync);

    expect(proxy.getDocument()).toEqual(master.getSnapshot().document);
    expect(proxy.getCommandCount()).toBe(master.getSnapshot().commandCount);
    expect(proxy.getDocument().todos).not.toBeUndefined();
    expect(Object.keys(proxy.getDocument().todos!).length).toBe(1);
    expect(proxy.getDocument().todos![Object.keys(proxy.getDocument().todos!)[0]].details).toBe('coffee');

  });
});
