import { Inner } from "./inner";

import { Master, CompletionBatch, CommandAction, HistoryStore, CommandCompletion } from ".";

describe('Master', () => {
    test('apply batch with command to create', async () => {
      const master = new Master({ updateCount: 0, document: {} });
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.Create
            },
            createdId: '1'
        }],
        from: 0
      };
      const result = await master.apply(batch);
      
      expect(master.getSnapshot().updateCount).toBe(1);
      expect(result.sync).toBeUndefined();
      expect(result.errors).toBeUndefined();
      expect(master.getSnapshot().document['1']).toBeDefined();
    });
  
    test('apply two batches that both perform the same create', () => {
      const master = new Master({ updateCount: 0, document: {} }, { sequentialIds: true });
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.Create
            },
            createdId: '1'
        }],
        from: 0
      };
      master.apply(batch);
      master.apply(batch);
      
      expect(master.getSnapshot().updateCount).toBe(2);
      expect(master.getSnapshot().document['1']).toBeDefined();
      expect(master.getSnapshot().document['3']).toBeDefined();
    });
  
    test('merge two add commands without history produces full sync', async () => {
      const master = new Master({ updateCount: 0, document: {} });
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.Create
            },
            createdId: '1'
        }],
        from: 0
      };
      master.apply(batch);
      const result = await master.apply(batch);
      
      expect(result.sync).toBeDefined();
      expect(result.sync.isPartial).toBe(false);
    });
  
    test('merge two add commands with history produces partial sync', async () => {
      const historyStore: HistoryStore = createHistoryStore();
      const master = new Master({ updateCount: 0, document: {} }, { historyStore: historyStore });
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.Create
            },
            createdId: '1'
        }],
        from: 0
      };
      master.apply(batch);
      const result = await  master.apply(batch);
      
      expect(result.sync).toBeDefined();
      expect(result.sync.isPartial).toBe(true);
      expect(result.sync.isPartial && result.sync.diff.from).toBe(0);
      expect(result.sync.isPartial && result.sync.diff.completions.length).toBe(2);
    });
  });
  
  function createHistoryStore(): HistoryStore {
    return {
      history: [],
      get(from: number, to: number): Promise<CommandCompletion[]> {
        return Promise.resolve(this.history.slice(from, to));
      },
      store(from: number, completions: CommandCompletion[]): Promise<void> {
        if (this.history.length === from) {
            this.history = this.history.concat(completions);
        }
        return Promise.resolve();
      }
    } as HistoryStore;
  }