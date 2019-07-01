import { CommandAction } from "./types";
import { Proxy } from './proxy';

describe('Proxy', () => {
    test('adding node returns ok', async () => {
      const snapshot = {
        updateCount: 0,
        document: {}
      };
      const proxy = new Proxy(snapshot);
      proxy.performCommand({
        action: CommandAction.New
      });
      
      expect(proxy.getUpdateCount()).toBe(1);
      expect(proxy.getDocument()['1']).toBeDefined();
    });
});