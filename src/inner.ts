import { Model, Snapshot, Command, Result, CommandAction } from "./types";
export class Inner<T extends object> implements Model<T> {
  private snapshot: Snapshot<T>;
  constructor(
    snapshotOrDocument: Snapshot<T> | T,
    private sequentialIds: boolean
  ) {
    if (
      (snapshotOrDocument as Snapshot<T>).commandCount != undefined &&
      (snapshotOrDocument as Snapshot<T>).document != undefined
    ) {
      this.snapshot = snapshotOrDocument as Snapshot<T>;
    } else {
      this.snapshot = { commandCount: 0, document: snapshotOrDocument as T };
    }
  }
  public getCommandCount(): number {
    return this.snapshot.commandCount;
  }
  public getDocument(): T {
    return this.snapshot.document;
  }
  public apply(command: Command, proposeCreateId?: string): Result {
    const path = command.path || [];
    switch (command.action) {
      case CommandAction.Create: {
        const result = this.navigateToNode(path);
        let node: undefined | any;
        let errorPath: undefined | string[];
        if (result.found) {
          node = result.node;
        } else if (command.parentDefault && path.length > 0) {
          const parentsParent = this.navigateToNode(path.slice(0, path.length - 1));
          if (parentsParent.found) {
            parentsParent.node[path[path.length - 1]] = JSON.parse(JSON.stringify(command.parentDefault));
            node = parentsParent.node[path[path.length - 1]];
          } else {
            errorPath = parentsParent.errorPath;
          }
        } else {
          errorPath = result.errorPath;
        }
        if (node) {
          let attempt = 0;
          let newId;
          do {
            newId =
              proposeCreateId !== undefined && attempt === 0
                ? proposeCreateId
                : this.generateNewId(attempt);
            attempt += 1;
          } while (newId in node);
          node[newId] =
            command.props != undefined
              ? JSON.parse(JSON.stringify(command.props))
              : {};
          this.snapshot.commandCount += 1;
          return {
            isSuccess: true,
            createdId: newId
          };
        }
        return {
          isSuccess: false,
          error: 'No object at document path ' + (errorPath || []).toString()
        };
      }
      case CommandAction.Update: {
        const result = this.navigateToNode(path);
        if (result.found) {
          const propKeys =
            command.props !== undefined ? Object.keys(command.props) : [];
          if (propKeys.length > 0) {
            const copy = JSON.parse(JSON.stringify(command.props));
            propKeys.forEach(key => {
              result.node[key] = copy[key];
            });
          }
          this.snapshot.commandCount += 1;
          return {
            isSuccess: true
          };
        }
        return {
          isSuccess: false,
          error: 'No object at document path ' + result.errorPath.toString()
        };
      }
      case CommandAction.Delete: {
        const result = this.navigateToNode(path.slice(0, path.length - 1));
        if (result.found) {
          delete result.node[path[path.length - 1]];
          this.snapshot.commandCount += 1;
          return {
            isSuccess: true
          };
        }
        return {
          isSuccess: false,
          error: 'No object at document path ' + result.errorPath.toString()
        };
      }
      default: {
        // never supposed to end up here
        console.log('Unknown action in command ' + JSON.stringify(command));
        return {
            isSuccess: false,
            error: 'Unknown command'
        };
      }
    }
  }
  private navigateToNode(
    path: string[]
  ):
    | {
        found: false;
        errorPath: string[];
      }
    | {
        found: true;
        node: any;
      } {
    let n: any = this.snapshot.document;
    for (let i = 0; i < path.length; i++) {
      n = n[path[i]];
      if (typeof n !== 'object') {
        return { found: false, errorPath: path.slice(0, i + 1) };
      }
    }
    return { found: true, node: n };
  }

  private generateNewId(attempt: number): string {
    if (this.sequentialIds) {
      return (this.snapshot.commandCount + 1 + attempt).toString();
    } else {
      return Math.round(Math.random() * Number.MAX_SAFE_INTEGER).toString();
    }
  }
}
