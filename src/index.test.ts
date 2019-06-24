import { ModelImpl, CommandAction } from ".";

describe('ModelImpl', () => {
  test('add new node without initial values', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
    const result = model.performCommand({
      action: CommandAction.New
    }) as any;
    expect(model.getUpdateCount()).toBe(1);
    expect(model.getDocument()[result.newId]).toEqual({});
  });

  test('add new node with initial values', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
    const result = model.performCommand({
      action: CommandAction.New, 
      props: {p1: 'aValue'}
    }) as any;
    expect(model.getUpdateCount()).toBe(1);
    expect(model.getDocument()[result.newId].p1).toBe('aValue');
  });

  test('add and update node', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
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
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
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
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
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
})