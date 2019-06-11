
export enum CommandAction {
    New = 'new',
    Update = 'update',
    Delete = 'detete'
}
export interface Command {
    action: CommandAction;
    props?: Record<string, any>;
}

type Sync = { isPartial: true, fromUpdateCount: number, diff: CommandExecution[] } | { isPartial: false };
interface ExecutionError {
    action: CommandAction,
    path: string[],
    errorMessage: string
}
interface ApplyResult {
    sync?: Sync;
    errors?: ExecutionError[]
}

class PathMapper {
    remappedPaths = {}
    get(path: string[]): string[] | undefined {
        let p = path;
        while (p && p.length > 0) {
            const pStr = p.toString();
            const remappedSection = this.remappedPaths[pStr];
            if (remappedSection) {
                const remappedPath = remappedSection.concat(path.slice(p.length, path.length));
                this.remappedPaths[path.toString()] = remappedPath;
                return remappedPath;
            }
            p = path.slice(0, p.length - 1);
        }
        return undefined;
    }
    put(path: string[], remappedPath: string[]) {
        this.remappedPaths[path.toString()] = remappedPath.toString();
    }
}

type Result = {isSuccess: true, newId?: string} | {isSuccess: false, error: string};


export interface Model {
    getUpdateCount(): number;
    performCommand(path: string[], command: Command): Result;
}

interface Node {
    props: {};
    children?: Record<string, Node>;
    nextId: number;
}

export interface ModelData {
    updateCount: number;
    root: {}
}

export class Model {
    private data: ModelData;

    constructor(data: ModelData) {
        this.data = data;
    }
    getUpdateCount(): number {
        return this.data.updateCount;
    }

    performCommand(path: string[], command: Command): Result {
        switch (command.action) {
            case CommandAction.New: {
                const result = this.navigateToChild(path);
                if (result.found == true) {
                    const node = result.node;
                    if (node.nextId == undefined) {
                        node.nextId = 1; // Start IDs at 1 to avoid JS's 0-equality issues
                    }
                    const newId = node.nextId.toString();
                    node[newId] = command.props;
                    node.nextId += 1;
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
                const result = this.navigateToChild(path);
                if (result.found == true) {
                    Object.keys(command.props).forEach(key => {
                        result[key] = command.props[key];
                    });
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
                return undefined;
            }
            default: {
                throw new Error('Unknown action ' + command.action);
            }
        }
        return {isSuccess: true};
    }

    navigateToChild(path: string[]): {found: false, errorPath: string[]} | {found: true, node: any} {
        let n: {} = this.data.root;
        for (let i = 0; i < path.length; i++) {
            n = n[path[i]];
            if (typeof n !== 'object') {
                return {found: false, errorPath: path.slice(0, i)};
            }
        }
        return {found: true, node: n};
    }
}

class ModelUpdater {
    
    historyProvider: (fromUpdate: number) => CommandExecution[];

    apply(fromCommittedUpdateCount: number, execs: CommandExecution[], model: Model): ApplyResult {
        const self = this;
        let errors: ExecutionError[] = [];
        if (fromCommittedUpdateCount == model.getUpdateCount()) {
            execs.forEach(e => {
                const result = model.performCommand(e.path, e.command);
                if (result.isSuccess == false) {
                    errors.push({
                        action: e.command.action,
                        path: e.path,
                        errorMessage: result.error
                    });
                }
            });
            return {};
        } else {
            const history = self.historyProvider(fromCommittedUpdateCount);
            const sync: Sync = (!history || history.length < model.getUpdateCount() - fromCommittedUpdateCount) ?
                    { isPartial: false } :
                    { isPartial: true, fromUpdateCount: fromCommittedUpdateCount, diff: [].concat(history)};            
            const pathMapper = new PathMapper();
            execs.forEach(e => {
                const remappedPath = pathMapper.get(e.path);
                const path = remappedPath ? remappedPath : e.path;
                const result = model.performCommand(path, e.command);
                if (result.isSuccess == true) {
                    if (result.newId != undefined && result.newId != e.newId) {
                        pathMapper.put(e.path.concat([e.newId]), e.path.concat([result.newId]));
                    }
                    if (sync.isPartial) {
                        sync.diff.push({
                            path: path,
                            command: e.command,
                            newId: result.newId
                        });
                    }
                } else {
                    errors.push({
                        action: e.command.action,
                        path: e.path,
                        errorMessage: result.error
                    });
                }
            });
            return {
                sync: sync
            };
        }
    }
}

export class NewCommand implements Command {
    action = CommandAction.New;
    props: Record<string, any>;
    constructor(initialProps?: Record<string, any>) {
        this.props = initialProps;
    }
}

export class UpdateCommand implements Command {
    action = CommandAction.Update;
    constructor(public props: Record<string, any>) {}
}

export class DeleteCommand implements Command {
    action = CommandAction.Delete;
}

export class CommandExecution {
    path: string[];
    command: Command;
    newId?: string;
}