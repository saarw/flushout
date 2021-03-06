import { Inner } from "./inner";

import { CommandAction } from ".";

describe("Inner", () => {
  test("create without initial values", () => {
    const model = new Inner<any>({}, false);
    const result = model.apply({
      action: CommandAction.Create
    });
    expect(model.getCommandCount()).toBe(1);
    if (result.isSuccess === false) {
      fail();
      return;
    }
    expect(model.getDocument()[result.createdId!]).toEqual({});
  });

  test("create with initial values", () => {
    const model = new Inner<any>({}, false);
    const result = model.apply({
      action: CommandAction.Create,
      props: { p1: "aValue" }
    });
    expect(model.getCommandCount()).toBe(1);
    if (result.isSuccess === false) {
      fail();
      return;
    }
    expect(model.getDocument()[result.createdId!].p1).toBe("aValue");
  });

  test("create with proposed ID", () => {
    const model = new Inner<any>({}, false);
    model.apply(
      {
        action: CommandAction.Create
      },
      "myId"
    );
    expect(model.getCommandCount()).toBe(1);
    const field = "myId";
    expect(model.getDocument()[field]).toEqual({});
  });

  test("create changes proposed ID when already exists", () => {
    const model = new Inner(
      {
        myId: {}
      },
      false
    );
    const result = model.apply(
      {
        action: CommandAction.Create
      },
      "myId"
    );
    expect(model.getCommandCount()).toBe(1);
    expect(result.isSuccess && result.createdId).toBeTruthy();
    expect(result.isSuccess && result.createdId).not.toBe("myId");
  });

  test("create and update", () => {
    const model = new Inner<any>({}, false);
    const result = model.apply({
      action: CommandAction.Create
    });
    if (result.isSuccess === false) {
      fail();
      return;
    }
    const result2 = model.apply({
      action: CommandAction.Update,
      path: [result.createdId!],
      props: {
        p1: "aValue"
      }
    });

    expect(model.getCommandCount()).toBe(2);
    expect(model.getDocument()[result.createdId!].p1).toBe("aValue");
  });

  test("create and delete", () => {
    const model = new Inner<any>({}, false);
    const result = model.apply({
      action: CommandAction.Create
    });
    if (result.isSuccess === false) {
      fail();
      return;
    }
    const result2 = model.apply({
      action: CommandAction.Delete,
      path: [result.createdId!]
    });
    expect(model.getCommandCount()).toBe(2);
    expect(model.getDocument()[result.createdId!]).toBe(undefined);
  });

  test("create branch and delete middle", () => {
    const model = new Inner<any>({}, false);
    const result = model.apply({
      action: CommandAction.Create
    });
    if (result.isSuccess === false) {
      fail();
      return;
    }
    const result2 = model.apply({
      action: CommandAction.Create,
      path: [result.createdId!]
    });
    if (result2.isSuccess === false) {
      fail();
      return;
    }
    const result3 = model.apply({
      action: CommandAction.Create,
      path: [result.createdId!, result2.createdId!]
    });
    const result4 = model.apply({
      action: CommandAction.Delete,
      path: [result.createdId!, result2.createdId!]
    });
    expect(model.getCommandCount()).toBe(4);
    expect(model.getDocument()[result.createdId!][result2.createdId!]).toBe(
      undefined
    );
    expect(model.getDocument()[result.createdId!]).toEqual({});
  });

  test("create with default parent", () => {
    const model = new Inner<any>({}, false);
    const branch = 'parentBranch';
    const result = model.apply({
      action: CommandAction.Create,
      path: [branch],
      props: {},
      parentDefault: {}
    });
    expect(model.getCommandCount()).toBe(1);
    if (result.isSuccess === false) {
      fail();
      return;
    }
    expect(model.getDocument()[branch][result.createdId!]).toEqual({});
  });

  test("create two children with default parent", () => {
    const model = new Inner<any>({}, false);
    const branch = 'parentBranch';
    const result = model.apply({
      action: CommandAction.Create,
      path: [branch],
      props: {},
      parentDefault: {}
    });
    const result2 = model.apply({
      action: CommandAction.Create,
      path: [branch],
      props: {},
      parentDefault: {}
    });
    expect(model.getCommandCount()).toBe(2);
    if (result.isSuccess === false || result2.isSuccess === false) {
      fail();
      return;
    }
    expect(model.getDocument()[branch][result.createdId!]).toEqual({});
    expect(model.getDocument()[branch][result2.createdId!]).toEqual({});
  });
});
