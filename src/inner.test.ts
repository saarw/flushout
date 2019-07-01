import { Inner } from "./inner";

import { CommandAction } from ".";

describe('Inner', () => {
    test('add new node without initial values', () => {
      const model = new Inner();
      const result = model.performCommand({
        action: CommandAction.New
      }) as any;
      expect(model.getUpdateCount()).toBe(1);
      expect(model.getDocument()[result.newId]).toEqual({});
    });
  
    test('add new node with initial values', () => {
      const model = new Inner();
      const result = model.performCommand({
        action: CommandAction.New, 
        props: {p1: 'aValue'}
      }) as any;
      expect(model.getUpdateCount()).toBe(1);
      expect(model.getDocument()[result.newId].p1).toBe('aValue');
    });
  
    test('add and update node', () => {
      const model = new Inner();
      const result = model.performCommand({
        action: CommandAction.New
      }) as any;
      const result2 = model.performCommand({
        action: CommandAction.Update,
        path: [result.newId],
        props: {
          p1: 'aValue'
        }
      }) as any;
  
      expect(model.getUpdateCount()).toBe(2);
      expect(model.getDocument()[result.newId].p1).toBe('aValue');
    });
  
    test('add and delete node', () => {
      const model = new Inner();
      const result = model.performCommand({
        action: CommandAction.New
      }) as any;
      const result2 = model.performCommand({
        action: CommandAction.Delete,
        path: result.newId
      }) as any;
      expect(model.getUpdateCount()).toBe(2);
      expect(model.getDocument()[result.newId]).toBe(undefined);
    });
  
    test('add branch and delete middle', () => {
      const model = new Inner();
      const result = model.performCommand({
        action: CommandAction.New
      }) as any;
      const result2 = model.performCommand({
        action: CommandAction.New,
        path: [result.newId]
      }) as any;
      const result3 = model.performCommand({
        action: CommandAction.New,
        path: [result.newId, result2.newId]
      }) as any;
      const result4 = model.performCommand({
        action: CommandAction.Delete,
        path: [result.newId, result2.newId]
      }) as any;
      expect(model.getUpdateCount()).toBe(4);
      expect(model.getDocument()[result.newId][result2.newId]).toBe(undefined);
      expect(model.getDocument()[result.newId]).toEqual({});
    });
  });