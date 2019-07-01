import { Model, Snapshot, Command, Result, CommandAction } from "./types";
export class Inner<T extends object> implements Model<T> {
    private snapshot: Snapshot<T>;
    constructor(snapshotOrDocument: Snapshot<T> | T) {
        if ((snapshotOrDocument as Snapshot<T>).updateCount != undefined &&
            (snapshotOrDocument as Snapshot<T>).document != undefined) {
            this.snapshot = snapshotOrDocument as Snapshot<T>;
        } else {
            this.snapshot = { updateCount: 0, document: snapshotOrDocument as T};
        }
    }
    getUpdateCount(): number {
        return this.snapshot.updateCount;
    }
    getDocument(): T {
        return this.snapshot.document;
    }
    performCommand(command: Command): Result {
        const path = command.path || [];
        switch (command.action) {
            case CommandAction.New: {
                const result = this.navigateToNode(path);
                if (result.found == true) {
                    const node = result.node;
                    const newId = (this.snapshot.updateCount + 1).toString();
                    node[newId] = command.props != undefined ? command.props : {};
                    this.snapshot.updateCount += 1;
                    return {
                        isSuccess: true,
                        newId: newId
                    };
                }
                return {
                    isSuccess: false,
                    error: 'No object at path  ' + result.errorPath.toString()
                };
            }
            case CommandAction.Update: {
                const result = this.navigateToNode(path);
                if (result.found == true) {
                    Object.keys(command.props).forEach(key => {
                        result.node[key] = command.props[key];
                    });
                    this.snapshot.updateCount += 1;
                    return {
                        isSuccess: true
                    };
                }
                return {
                    isSuccess: false,
                    error: 'No object at path ' + result.errorPath.toString()
                };
            }
            case CommandAction.Delete: {
                const result = this.navigateToNode(path.slice(0, path.length - 1));
                if (result.found == true) {
                    delete result.node[path[path.length - 1]];
                    this.snapshot.updateCount += 1;
                    return {
                        isSuccess: true
                    };
                }
                return {
                    isSuccess: false,
                    error: 'No object at path ' + result.errorPath.toString()
                };
            }
            default: {
                throw new Error('Unknown action ' + command.action);
            }
        }
    }
    private navigateToNode(path: string[]): {
        found: false;
        errorPath: string[];
    } | {
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
}
