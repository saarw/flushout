import { ModelImpl, CommandAction } from ".";

test('add new node without initial values', () => {
  const data = {
    updateCount: 0,
    root: {}
  };
  const model = new ModelImpl(data);
  const result = model.performCommand([], {
    action: CommandAction.New
  }) as any;
  expect(model.getUpdateCount()).toBe(1);
  expect(model.getRoot()[result.newId]).toEqual({});
});

test('add new node with initial values', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
    const result = model.performCommand([], {
      action: CommandAction.New, 
      props: {p1: 'aValue'}
    }) as any;
    expect(model.getUpdateCount()).toBe(1);
    expect(model.getRoot()[result.newId].p1).toBe('aValue');
  });

  test('add and update node', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
    const result = model.performCommand([], {
      action: CommandAction.New
    }) as any;
    const result2 = model.performCommand([result.newId], {
      action: CommandAction.Update,
      props: {
        p1: 'aValue'
      }
    }) as any;
    expect(model.getUpdateCount()).toBe(2);
    expect(model.getRoot()[result.newId].p1).toBe('aValue');
  });

  test('add and delete node', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new ModelImpl(data);
    const result = model.performCommand([], {
      action: CommandAction.New
    }) as any;
    const result2 = model.performCommand([result.newId], {
      action: CommandAction.Delete
    }) as any;
    expect(model.getUpdateCount()).toBe(2);
    expect(model.getRoot()[result.newId]).toBe(undefined);
  });