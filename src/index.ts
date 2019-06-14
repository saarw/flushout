type Path = string;

class Paths {
    static getParent(path: Path): Path | undefined {
        const n = path.lastIndexOf('/');
        if (n > 0) {
            return path.substring(0, n - 1);
        }
        return undefined;
    }

    static isRoot(path: Path): boolean {
        return path == undefined || path === '' || path === '/';
    }

    static remainder(base: Path, path: Path): Path {
        return path.substring(base.length);
    }

    static concat(path1: Path, path2: Path): Path {
        return path1.concat(path2);
    }

    static fromString(path: Path): string {
        return path;
    }

    static toString(s: string): Path {
        return s;
    }
}

export enum CommandAction {
    New = 'new',
    Update = 'update',
    Delete = 'detete'
}
export interface Command {
    action: CommandAction;
    props?: Record<string, any>;
}

export interface CommandExecution {
    path: Path;
    command: Command;
    newId?: string;
}

export interface CommandBatch {
    fromUpdateCount: number;
    commands: CommandExecution[];
}

type Sync = { isPartial: true, diff: CommandBatch } | { isPartial: false };
interface ExecutionError {
    action: CommandAction,
    path: Path,
    errorMessage: string
}
interface ApplyResult {
    sync?: Sync;
    errors?: ExecutionError[]
}

class PathMapper {
    mappedPaths: Record<string, Path> = {};
    get(path: Path): Path | undefined {
        let p = path;
        while (!Paths.isRoot(p)) {
            const mappedSection = this.mappedPaths[Paths.toString(p)];
            if (mappedSection != undefined) {
                const remappedPath = Paths.concat(mappedSection, Paths.remainder(path, p));
                this.mappedPaths[Paths.toString(path)] = remappedPath;
                return remappedPath;
            }
            p = Paths.getParent(p); 
        }
        return undefined;
    }
    put(path: Path, remappedPath: Path) {
        this.mappedPaths[Paths.toString(path)] = remappedPath;
    }
}

type Result = {isSuccess: true, newId?: string} | {isSuccess: false, error: string};


export interface Model {
    getDocument(): any;
    getUpdateCount(): number;
    performCommand(path: Path, command: Command): Result;
}

export interface ModelData {
    updateCount: number;
    root: {}
}

export class ModelImpl implements Model {
    private data: ModelData;

    constructor(data: ModelData) {
        this.data = data;
    }
    getUpdateCount(): number {
        return this.data.updateCount;
    }

    getDocument(): any {
        return this.data.root;
    }

    performCommand(path: Path, command: Command): Result {
        switch (command.action) {
            case CommandAction.New: {
                const result = this.navigateToNode(path);
                if (result.found == true) {
                    const node = result.node;
                    const newId = (this.data.updateCount + 1).toString();
                    node[newId] = command.props != undefined ? command.props : {};
                    this.data.updateCount += 1;
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
                    this.data.updateCount += 1;
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
                const result = this.navigateToNode(path.slice(0, path.length -1));
                if (result.found == true) {
                    delete result.node[path[path.length - 1]];
                    this.data.updateCount += 1;
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

    private navigateToNode(path: Path): {found: false, errorPath: Path} | {found: true, node: any} {
        let n = this.data.root;
        for (let i = 0; i < path.length; i++) {
            n = n[path[i]];
            if (typeof n !== 'object') {
                return {found: false, errorPath: path.slice(0, i)};
            }
        }
        return {found: true, node: n};
    }
}

export class FlushableModel implements Model {
    private lastCommittedRoot: string;
    private lastCommittedUpdateCount: number;
    private model: ModelImpl;
    private uncommitedExecutions: CommandExecution[];
    private nextCommittedRoot?: string;
    private nextCommittedUpdateCount?: number;

    constructor(data: ModelData) {
        this.model = new ModelImpl(data);
        this.lastCommittedRoot = JSON.stringify(data.root);
        this.lastCommittedUpdateCount = data.updateCount;
    }

    getDocument(): any {
        return this.model.getDocument();
    }

    getUpdateCount(): number {
        return this.model.getUpdateCount();
    }

    performCommand(path: Path, command: Command): Result {
        const result = this.model.performCommand(path, command);
        if (result.isSuccess == true) {
            // Only store successfully applied commands in delegates
            this.uncommitedExecutions.push({path: path, command: command, newId: result.newId});
        }
        return result;
    }

    beginFlush(): CommandBatch {
        if (this.nextCommittedRoot != undefined) {
            throw Error('Flush already in progress');
        }
        this.nextCommittedRoot = JSON.stringify(this.model.getDocument())
        this.nextCommittedUpdateCount = this.model.getUpdateCount();
        const batch = {
            fromUpdateCount: this.lastCommittedUpdateCount,
            commands: this.uncommitedExecutions
        };
        this.uncommitedExecutions = [];
        return batch;
    }

    endFlush(diff?: CommandBatch): string | undefined {
        if (this.nextCommittedRoot == undefined) {
            return 'No flush in progress';
        }
        if (diff != undefined) {
            return this.applyDiff(diff);
        } 
        this.lastCommittedRoot = this.nextCommittedRoot;
        this.lastCommittedUpdateCount = this.nextCommittedUpdateCount;
        this.nextCommittedRoot = undefined;
        this.nextCommittedUpdateCount = undefined;
        return undefined;
    }

    private applyDiff(diff: CommandBatch): undefined | string {
        if (this.lastCommittedUpdateCount === diff.fromUpdateCount) {
            this.model = JSON.parse(this.lastCommittedRoot);
            const errorApplication = diff.commands.find(exec => {
                let result = this.model.performCommand(exec.path, exec.command);
                if (!result.isSuccess || (result.newId != exec.newId)) {
                    return true;
                }
                return false;
            });
            if (errorApplication) {
                return 'Failed to apply command from diff ' + JSON.stringify(errorApplication);
            }
            this.lastCommittedRoot = JSON.stringify(this.model.getDocument());
            this.lastCommittedUpdateCount = this.model.getUpdateCount();
            this.nextCommittedRoot = undefined;
            this.nextCommittedUpdateCount = undefined;
            return undefined;
        }
        return 'Failed to apply diff because its from-update-count did not match last committed';
    }
}



interface HistoryStore {
    // Returns the history from the specified update number, if available, otherwise undefined
    getFrom(updateNum: number): CommandExecution[] | undefined;

    // Stores the execution with its model udate number
    store(updateNum: number, command: CommandExecution);
}

class ModelUpdater {
    
    historyStore: HistoryStore;
    model: Model;

    apply(batch: CommandBatch): ApplyResult {
        const self = this;
        let errors: ExecutionError[] = [];
        if (batch.fromUpdateCount == this.model.getUpdateCount()) {
            batch.commands.forEach(e => {
                const result = this.model.performCommand(e.path, e.command);
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
            const history = self.historyStore.getFrom(batch.fromUpdateCount);
            const sync: Sync = (!history || history.length < this.model.getUpdateCount() - batch.fromUpdateCount) ?
                    { isPartial: false } :
                    { isPartial: true, diff: {fromUpdateCount: batch.fromUpdateCount, commands: [...history]}};            
            const pathMapper = new PathMapper();
            batch.commands.forEach(e => {
                const remappedPath = pathMapper.get(e.path);
                const path = remappedPath ? remappedPath : e.path;
                const result = this.model.performCommand(path, e.command);
                if (result.isSuccess == true) {
                    if (result.newId != undefined && result.newId != e.newId) {
                        pathMapper.put(Paths.concat(e.path, e.newId), Paths.concat(e.path, result.newId));
                    }
                    const appliedExecution = {
                        path: path,
                        command: e.command,
                        newId: result.newId
                    };
                    self.historyStore.store(this.model.getUpdateCount(), appliedExecution);
                    if (sync.isPartial) {
                        sync.diff.commands.push(appliedExecution);
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

