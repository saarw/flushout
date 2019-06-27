import { ModelImpl, CommandAction, CompletionBatch, ModelUpdater, HistoryStore, CommandCompletion } from ".";

describe('ModelImpl', () => {
  test('add new node without initial values', () => {
    const model = new ModelImpl();
    const result = model.performCommand({
      action: CommandAction.New
    }) as any;
    expect(model.getUpdateCount()).toBe(1);
    expect(model.getDocument()[result.newId]).toEqual({});
  });

  test('add new node with initial values', () => {
    const model = new ModelImpl();
    const result = model.performCommand({
      action: CommandAction.New, 
      props: {p1: 'aValue'}
    }) as any;
    expect(model.getUpdateCount()).toBe(1);
    expect(model.getDocument()[result.newId].p1).toBe('aValue');
  });

  test('add and update node', () => {
    const model = new ModelImpl();
    const result = model.performCommand({
      action: CommandAction.New
    }) as any;
    const result2 = model.performCommand({
      path: [result.newId],
      action: CommandAction.Update,
      props: {
        p1: 'aValue'
      }
    }) as any;

    expect(model.getUpdateCount()).toBe(2);
    expect(model.getDocument()[result.newId].p1).toBe('aValue');
  });

  test('add and delete node', () => {
    const model = new ModelImpl();
    const result = model.performCommand({
      action: CommandAction.New
    }) as any;
    const result2 = model.performCommand({
      path: result.newId,
      action: CommandAction.Delete
    }) as any;
    expect(model.getUpdateCount()).toBe(2);
    expect(model.getDocument()[result.newId]).toBe(undefined);
  });

  test('add branch and delete middle', () => {
    const model = new ModelImpl();
    const result = model.performCommand({
      action: CommandAction.New
    }) as any;
    const result2 = model.performCommand({
      path: [result.newId],
      action: CommandAction.New
    }) as any;
    const result3 = model.performCommand({
      path: [result.newId, result2.newId],
      action: CommandAction.New
    }) as any;
    const result4 = model.performCommand({
      path: [result.newId, result2.newId],
      action: CommandAction.Delete
    }) as any;
    expect(model.getUpdateCount()).toBe(4);
    expect(model.getDocument()[result.newId][result2.newId]).toBe(undefined);
    expect(model.getDocument()[result.newId]).toEqual({});
  });
});

describe('ModelUpdater', () => {
  test('adding node returns ok', () => {
    const model =new ModelImpl();
    const updater = new ModelUpdater(model);
    const batch: CompletionBatch = {
      from: 0,
      completions: [{
          command: {
            action: CommandAction.New
          },
          newId: '1'
      }]
    };
    let result = updater.apply(batch);
    
    expect(model.getUpdateCount()).toBe(1);
    expect(result.sync).toBeUndefined();
    expect(result.errors).toBeUndefined();
    expect(model.getDocument()['1']).toBeDefined();
  });

  test('merge two add commands', () => {
    const model = new ModelImpl();
    const updater = new ModelUpdater(model);
    const batch: CompletionBatch = {
      from: 0,
      completions: [{
          command: {
            action: CommandAction.New
          },
          newId: '1'
      }]
    };
    updater.apply(batch);
    updater.apply(batch);
    
    expect(model.getUpdateCount()).toBe(2);
    expect(model.getDocument()['1']).toBeDefined();
    expect(model.getDocument()['2']).toBeDefined();
  });

  test('merge two add commands without history produces full sync', () => {
    const model = new ModelImpl();
    const updater = new ModelUpdater(model);
    const batch: CompletionBatch = {
      from: 0,
      completions: [{
          command: {
            action: CommandAction.New
          },
          newId: '1'
      }]
    };
    updater.apply(batch);
    let result = updater.apply(batch);
    
    
    expect(result.sync).toBeDefined();
    expect(result.sync.isPartial).toBe(false);
  });

  test('merge two add commands with history produces partial sync', () => {
    const model = new ModelImpl();
    const historyStore: HistoryStore = createHistoryStore();
    const updater = new ModelUpdater(model, historyStore);
    const batch: CompletionBatch = {
      from: 0,
      completions: [{
          command: {
            action: CommandAction.New
          },
          newId: '1'
      }]
    };
    updater.apply(batch);
    let result = updater.apply(batch);
    
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
      if (this.history.length == updateNum) {
        this.history.push(command);
      }
    }
  } as HistoryStore;
}