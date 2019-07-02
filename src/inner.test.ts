import { Inner } from "./inner";

import { CommandAction } from ".";

describe('Inner', () => {
    test('add new node without initial values', () => {
      const model = new Inner({});
      const result = model.performCommand({
        action: CommandAction.Create
      });
      expect(model.getUpdateCount()).toBe(1);
      expect(model.getDocument()[result.isSuccess && result.createdId]).toEqual({});
    });
  
    test('add new node with initial values', () => {
      const model = new Inner({});
      const result = model.performCommand({
        action: CommandAction.Create, 
        props: {p1: 'aValue'}
      });
      expect(model.getUpdateCount()).toBe(1);
      expect(model.getDocument()[result.isSuccess && result.createdId].p1).toBe('aValue');
    });
  
    test('add and update node', () => {
      const model = new Inner({});
      const result = model.performCommand({
        action: CommandAction.Create
      });
      const result2 = model.performCommand({
        action: CommandAction.Update,
        path: [result.isSuccess && result.createdId],
        props: {
          p1: 'aValue'
        }
      });
  
      expect(model.getUpdateCount()).toBe(2);
      expect(model.getDocument()[result.isSuccess && result.createdId].p1).toBe('aValue');
    });
  
    test('add and delete node', () => {
      const model = new Inner({});
      const result = model.performCommand({
        action: CommandAction.Create
      });
      const result2 = model.performCommand({
        action: CommandAction.Delete,
        path: [result.isSuccess && result.createdId]
      });
      expect(model.getUpdateCount()).toBe(2);
      expect(model.getDocument()[result.isSuccess && result.createdId]).toBe(undefined);
    });
  
    test('add branch and delete middle', () => {
      const model = new Inner({});
      const result = model.performCommand({
        action: CommandAction.Create
      });
      const result2 = model.performCommand({
        action: CommandAction.Create,
        path: [result.isSuccess && result.createdId]
      });
      const result3 = model.performCommand({
        action: CommandAction.Create,
        path: [result.isSuccess && result.createdId, result2.isSuccess && result2.createdId]
      });
      const result4 = model.performCommand({
        action: CommandAction.Delete,
        path: [result.isSuccess && result.createdId, result2.isSuccess && result2.createdId]
      });
      expect(model.getUpdateCount()).toBe(4);
      expect(model.getDocument()[result.isSuccess && result.createdId][result2.isSuccess && result2.createdId]).toBe(undefined);
      expect(model.getDocument()[result.isSuccess && result.createdId]).toEqual({});
    });
  });