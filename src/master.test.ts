import { Master, CompletionBatch, CommandAction, CommandCompletion, Command } from ".";
import { HistoryProvider } from "./master";

describe("Master", () => {
  test("apply batch with command to create", async () => {
    const master = new Master<any>({ commandCount: 0, document: {} });
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            action: CommandAction.Create
          },
          createdId: "1"
        }
      ],
      from: 0
    };
    const result = await master.apply(batch);

    expect(master.getSnapshot().commandCount).toBe(1);
    expect(result.sync).toBeUndefined();
    expect(result.errors).toBeUndefined();
    expect(master.getSnapshot().document["1"]).toBeDefined();
  });

  test("create in tree", async () => {
    const master = new Master<any>({commandCount:3,document:{"1":{"branchA":{"2":{"childOf":"a"}}},"4":{"branchB":{}}}});
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            path: ["4","branchB"],
            action: CommandAction.Create,
            props: {"childOf":"b"}
          },
          createdId: "2"
        }
      ],
      from: 3
    };
    const result = await master.apply(batch);
    expect(master.getSnapshot().commandCount).toBe(4);
    expect(Object.keys(master.getSnapshot().document['4'].branchB).length).toBe(1);
  });

  test("apply two batches that both perform the same create", () => {
    const master = new Master<any>(
      { commandCount: 0, document: {} },
      { sequentialIds: true }
    );
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            action: CommandAction.Create
          },
          createdId: "1"
        }
      ],
      from: 0
    };
    master.apply(batch);
    master.apply(batch);

    expect(master.getSnapshot().commandCount).toBe(2);
    expect(master.getSnapshot().document["1"]).toBeDefined();
    expect(master.getSnapshot().document["3"]).toBeDefined();
  });

  test("interceptor modifies prop without history produces partial sync", async () => {
    const master = new Master({ commandCount: 0, document: {} }, {
      interceptor: (document: any, command: Command) => {
        return {
          newProps: {
            field: 'b'
          }
        };
      }
    });
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            action: CommandAction.Create,
            props: {
              field: 'a'
            }
          },
          createdId: "1"
        }
      ],
      from: 0
    };
    const result = await master.apply(batch);

    if (result.sync == undefined) {
      fail();
      return;
    }
    expect(result.sync.isPartial).toBe(true);
  });

  test("interceptor modifies prop with history produces partial sync", async () => {
    const historyStore = createHistoryStore();
    const master = new Master({ commandCount: 0, document: {} }, {
      historyProvider: historyStore.createProvider(),
      interceptor: (document: any, command: Command) => {
        return {
          newProps: {
            field: 'b'
          }
        };
      }
    });
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            action: CommandAction.Create,
            props: {
              field: 'a'
            }
          },
          createdId: "1"
        }
      ],
      from: 0
    };
    const result = await master.apply(batch);

    if (result.sync == undefined) {
      fail();
      return;
    }
    expect(result.sync.isPartial).toBe(true);
  });

  test("merge two add commands without history produces full sync", async () => {
    const master = new Master({ commandCount: 0, document: {} });
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            action: CommandAction.Create
          },
          createdId: "1"
        }
      ],
      from: 0
    };
    master.apply(batch);
    const result = await master.apply(batch);

    if (result.sync == undefined) {
      fail();
      return;
    }
    expect(result.sync.isPartial).toBe(false);
  });

  test("merge two add commands with history produces partial sync", async () => {
    const historyStore = createHistoryStore();
    const master = new Master(
      { commandCount: 0, document: {} },
      { historyProvider: historyStore.createProvider() }
    );
    const batch: CompletionBatch = {
      completions: [
        {
          command: {
            action: CommandAction.Create
          },
          createdId: "1"
        }
      ],
      from: 0
    };
    const r1 = await master.apply(batch);
    historyStore.store(r1.applied.from, r1.applied.completions);

    const result = await master.apply(batch);
    historyStore.store(result.applied.from, result.applied.completions);

    if (result.sync == undefined) {
      fail();
      return;
    }
    expect(result.sync.isPartial).toBe(true);
    expect(result.sync.isPartial && result.sync.diff.from).toBe(0);
    expect(result.sync.isPartial && result.sync.diff.completions.length).toBe(
      2
    );
  });
});

export function createHistoryStore(): { 
  history: CommandCompletion[];
  createProvider(): HistoryProvider,
  store(from: number, completions: CommandCompletion[]): Promise<void>;
} {
  return {
    history: [],
    createProvider() { 
      const store = this;
      return (from: number, to: number): Promise<CommandCompletion[]> => {
        return Promise.resolve(store.history.slice(from, to));
      }
    },
    store(from: number, completions: CommandCompletion[]): Promise<void> {
      if (this.history.length === from) {
        this.history = this.history.concat(completions);
      }
      return Promise.resolve();
    }
  };
}
