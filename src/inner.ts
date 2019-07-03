import { Model, Snapshot, Command, Result, CommandAction } from "./types";
export class Inner<T extends object> implements Model<T> {
    private snapshot: Snapshot<T>;
    constructor(snapshotOrDocument: Snapshot<T> | T, private sequentialIds: boolean) {
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
    apply(command: Command, proposeCreateId?: string): Result {
        const path = command.path || [];
        switch (command.action) {
            case CommandAction.Create: {
                const result = this.navigateToNode(path);
                if (result.found == true) {
                    const node = result.node;
                    let attempt = 0;
                    let newId;
                    do {
                        newId = proposeCreateId != undefined && attempt == 0 ? 
                            proposeCreateId : 
                            this.generateNewId(attempt);
                        attempt += 1;
                    } while(newId in node);
                    node[newId] = command.props != undefined ? JSON.parse(JSON.stringify(command.props)) : {};
                    this.snapshot.updateCount += 1;
                    return {
                        isSuccess: true,
                        createdId: newId
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
                    const propKeys = command.props != undefined ? Object.keys(command.props) : [];
                    if (propKeys.length > 0) {
                        const copy = JSON.parse(JSON.stringify(command.props));
                        propKeys.forEach(key => {
                            result.node[key] = copy[key];
                        });
                    }
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

    generateNewId(attempt: number): string {
        if (this.sequentialIds) {
            return (this.snapshot.updateCount + 1 + attempt).toString();
        } else {
            return Math.round(Math.random() * Number.MAX_SAFE_INTEGER).toString();
        }
    }
}
