import { Inner } from "./inner";

import { Master, CompletionBatch, CommandAction, HistoryStore, CommandCompletion } from ".";

describe('Master', () => {
    test('adding node returns ok', () => {
      const model =new Inner();
      const updater = new Master(model);
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.New
            },
            newId: '1'
        }],
        from: 0
      };
      const result = updater.apply(batch);
      
      expect(model.getUpdateCount()).toBe(1);
      expect(result.sync).toBeUndefined();
      expect(result.errors).toBeUndefined();
      expect(model.getDocument()['1']).toBeDefined();
    });
  
    test('merge two add commands', () => {
      const model = new Inner();
      const updater = new Master(model);
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.New
            },
            newId: '1'
        }],
        from: 0
      };
      updater.apply(batch);
      updater.apply(batch);
      
      expect(model.getUpdateCount()).toBe(2);
      expect(model.getDocument()['1']).toBeDefined();
      expect(model.getDocument()['2']).toBeDefined();
    });
  
    test('merge two add commands without history produces full sync', () => {
      const model = new Inner();
      const updater = new Master(model);
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.New
            },
            newId: '1'
        }],
        from: 0
      };
      updater.apply(batch);
      const result = updater.apply(batch);
      
      expect(result.sync).toBeDefined();
      expect(result.sync.isPartial).toBe(false);
    });
  
    test('merge two add commands with history produces partial sync', () => {
      const model = new Inner();
      const historyStore: HistoryStore = createHistoryStore();
      const updater = new Master(model, historyStore);
      const batch: CompletionBatch = {
        completions: [{
            command: {
              action: CommandAction.New
            },
            newId: '1'
        }],
        from: 0
      };
      updater.apply(batch);
      const result = updater.apply(batch);
      
      expect(result.sync).toBeDefined();
      expect(result.sync.isPartial).toBe(true);
      expect(result.sync.isPartial && result.sync.diff.from).toBe(0);
      expect(result.sync.isPartial && result.sync.diff.completions.length).toBe(2);
    });
  });
  
  function createHistoryStore(): HistoryStore {
    return {
      history: [],
      get(from: number, to: number): CommandCompletion[] {
        return this.history.slice(from, to);
      },
      store(updateNum: number, command: CommandCompletion) {
        if (this.history.length === updateNum) {
          this.history.push(command);
        }
      }
    } as HistoryStore;
  }