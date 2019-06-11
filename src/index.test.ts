import { Model } from ".";

test('initial update count', () => {
    const data = {
      updateCount: 0,
      root: {}
    };
    const model = new Model(data);
    expect(model.getUpdateCount()).toBe(0);
  });