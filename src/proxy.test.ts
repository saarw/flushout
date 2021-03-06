import { CommandAction } from "./types";
import { Proxy } from "./proxy";

describe("Proxy", () => {
  test("performCommand updates document", async () => {
    const snapshot = {
      commandCount: 0,
      document: {}
    };
    const proxy = new Proxy<any>(snapshot, { sequentialIds: true });
    proxy.apply({
      action: CommandAction.Create
    });

    expect(proxy.getCommandCount()).toBe(1);
    expect(proxy.getDocument()["1"]).toBeDefined();
  });

  test("performCommand adds to flush completions", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy(snapshot);
    proxy.apply({
      action: CommandAction.Create
    });

    const batch = proxy.beginFlush();
    expect(batch.from).toBe(23);
    expect(batch.completions.length).toBe(1);
    expect(batch.completions[0].command.action).toBe(CommandAction.Create);
    expect(typeof batch.completions[0].createdId).toBe("string");
  });

  test("performCommand adds multiple flush completions in correct order", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy(snapshot);
    const result = proxy.apply({
      action: CommandAction.Create
    });
    if (!result.isSuccess) {
      fail();
      return;
    }
    proxy.apply({
      path: [result.createdId!],
      action: CommandAction.Update
    });

    const batch = proxy.beginFlush();
    expect(proxy.getCommandCount()).toBe(25);
    expect(batch.from).toBe(23);
    expect(batch.completions.length).toBe(2);
    expect(batch.completions[0].command.action).toBe(CommandAction.Create);
    expect(batch.completions[1].command.action).toBe(CommandAction.Update);
  });

  test("performCommand does not include failing commands in batch", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy(snapshot);
    const result = proxy.apply({
      action: CommandAction.Update,
      path: ["does_not_exist"],
      props: {
        value: 3
      }
    });

    expect(result.isSuccess).toBe(false);

    const batch = proxy.beginFlush();
    expect(proxy.getCommandCount()).toBe(23);
    expect(batch.from).toBe(23);
    expect(batch.completions.length).toBe(0);
  });

  test("beginFlush returns empty batch when empty", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy(snapshot);

    const batch = proxy.beginFlush();
    expect(batch.from).toBe(23);
    expect(batch.completions.length).toBe(0);
  });

  test("second flush flushes only new commands", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy(snapshot);
    const result = proxy.apply({
      action: CommandAction.Create
    });

    proxy.beginFlush();
    if (!result.isSuccess) {
      fail();
      return;
    }
    proxy.apply({
      path: [result.createdId!],
      action: CommandAction.Update
    });

    proxy.endFlush();
    const batch = proxy.beginFlush();

    expect(batch.from).toBe(24);
    expect(batch.completions.length).toBe(1);
    expect(batch.completions[0].command.action).toBe(CommandAction.Update);
  });

  test("endFlush with full sync discards old model", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy(snapshot);
    const result = proxy.apply({
      action: CommandAction.Create
    });

    proxy.beginFlush();
    proxy.endFlush({
      isPartial: false,
      latest: {
        commandCount: 55,
        document: {}
      }
    });

    expect(proxy.getCommandCount()).toBe(55);
    expect(proxy.getDocument()).toEqual({});
  });

  test("endFlush with full sync applies uncommitted commands", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy<any>(snapshot);
    proxy.apply({
      action: CommandAction.Create
    });

    proxy.beginFlush();

    const result = proxy.apply({
      action: CommandAction.Create
    });
    proxy.endFlush({
      isPartial: false,
      latest: {
        commandCount: 55,
        document: {}
      }
    });
    expect(proxy.getCommandCount()).toBe(56);
    if (!result.isSuccess) {
      fail();
      return;
    }
    expect(proxy.getDocument()[result.createdId!]).toEqual({});
  });

  test("endFlush with partial sync updates model", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy<any>(snapshot);
    proxy.beginFlush();

    proxy.endFlush({
      isPartial: true,
      diff: {
        from: 23,
        completions: [
          {
            command: {
              action: CommandAction.Create
            },
            createdId: "5345"
          }
        ]
      }
    });
    expect(proxy.getCommandCount()).toBe(24);
    expect(proxy.getDocument()["5345"]).toEqual({});
  });

  test("endFlush with partial sync applies uncommitted commands", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy<any>(snapshot);
    proxy.beginFlush();

    const result = proxy.apply({
      action: CommandAction.Create
    });

    const flushResult = proxy.endFlush({
      isPartial: true,
      diff: {
        from: 23,
        completions: [
          {
            command: {
              action: CommandAction.Create
            },
            createdId: "5345"
          }
        ]
      }
    });
    expect(flushResult.idsChanged).toBe(false);
    expect(proxy.getCommandCount()).toBe(25);
    if (!result.isSuccess) {
      fail();
      return;
    }
    expect(proxy.getDocument()[result.createdId!]).toEqual({});
  });

  test("endFlush with partial sync remaps existing uncommitted paths", async () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy<any>(snapshot);
    proxy.beginFlush();

    const result = proxy.apply({
      action: CommandAction.Create
    });

    if (!result.isSuccess) {
      fail();
      return;
    }
    const flushResult = proxy.endFlush({
      isPartial: true,
      diff: {
        from: 23,
        completions: [
          {
            command: {
              action: CommandAction.Create,
              props: {
                syncCreated: true
              }
            },
            createdId: result.createdId
          }
        ]
      }
    });
    expect(flushResult.idsChanged).toBe(true);
    expect(proxy.getCommandCount()).toBe(25);
    expect(proxy.getDocument()[result.createdId!]).toEqual({
      syncCreated: true
    });
  });

  test("cancelFlush allows new beginFlush", () => {
    const snapshot = {
      commandCount: 23,
      document: {}
    };
    const proxy = new Proxy<any>(snapshot);

    proxy.apply({
      action: CommandAction.Create
    });
    const flush1 = proxy.beginFlush();
    proxy.apply({
      action: CommandAction.Create
    });
    proxy.cancelFlush(flush1);
    const flush2 = proxy.beginFlush();
    expect(flush1.completions.length).toBe(1);
    expect(flush2.from).toBe(23);
    expect(flush2.completions.length).toBe(2);
  });
});
