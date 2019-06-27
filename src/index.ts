

export enum CommandAction {
    New = 'new',
    Update = 'update',
    Delete = 'detete'
}
export interface Command {
    path?:  string[];
    action: CommandAction;
    props?: Record<string, any>;
}

export interface CommandCompletion {
    command: Command;
    newId?: string;
}

export interface CompletionBatch {
    from: number;
    completions: CommandCompletion[];
}

type Sync = { isPartial: true, diff: CompletionBatch } | { isPartial: false };
interface CompletionError {
    action: CommandAction,
    path: string[],
    errorMessage: string
}
interface ApplyResult {
    sync?: Sync;
    errors?: CompletionError[]
}

class PathMapper {
    mappedPaths: Record<string, string[]> = {};
    get(path: string[]): string[] | undefined {
        if (Object.keys(this.mappedPaths).length == 0) {
            return undefined;
        }
        let p = path;
        while (p.length > 0) {
            const mappedSection = this.mappedPaths[p.toString()];
            if (mappedSection != undefined) {
                const remappedPath = mappedSection.concat(path.slice(p.length, path.length));
                this.mappedPaths[path.toString()] = remappedPath;
                return remappedPath;
            }
            p = p.slice(0, p.length - 1); 
        }
        return undefined;
    }
    put(path: string[], remappedPath: string[]) {
        this.mappedPaths[path.toString()] = remappedPath;
    }
}

type Result = {isSuccess: true, newId?: string} | {isSuccess: false, error: string};


export interface Model {
    getDocument(): any;
    getUpdateCount(): number;
    performCommand(command: Command): Result;
}

export interface ModelData {
    updateCount: number;
    root: {}
}

export class ModelImpl implements Model {
    private data: ModelData;

    constructor(data?: ModelData) {
        this.data = data ? data : { updateCount: 0, root: {} };
    }
    getUpdateCount(): number {
        return this.data.updateCount;
    }

    getDocument(): any {
        return this.data.root;
    }

    performCommand(command: Command): Result {
        const path = command.path || [];
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
                const result = this.navigateToNode(path.slice(0, path.length - 1));
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

    private navigateToNode(path: string[]): {found: false, errorPath: string[]} | {found: true, node: any} {
        let n: any = this.data.root;
        for (let i = 0; i < path.length; i++) {
            n = n[path[i]];
            if (typeof n !== 'object') {
                return {found: false, errorPath: path.slice(0, i + 1)};
            }
        }
        return {found: true, node: n};
    }
}

export class FlushableModel implements Model {
    private lastCommittedRoot: string;
    private lastCommittedUpdateCount: number;
    private model: ModelImpl;
    private uncommittedCompletions: CommandCompletion[];
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

    performCommand(command: Command): Result {
        const result = this.model.performCommand(command);
        if (result.isSuccess == true) {
            // Only store successfully applied commands in delegates
            this.uncommittedCompletions.push({command: command, newId: result.newId});
        }
        return result;
    }

    beginFlush(): CompletionBatch {
        if (this.nextCommittedRoot != undefined) {
            throw Error('Flush already in progress');
        }
        this.nextCommittedRoot = JSON.stringify(this.model.getDocument())
        this.nextCommittedUpdateCount = this.model.getUpdateCount();
        const batch: CompletionBatch = {
            from: this.lastCommittedUpdateCount,
            completions: this.uncommittedCompletions
        };
        this.uncommittedCompletions = [];
        return batch;
    }

    endFlush(diff?: CompletionBatch): string | undefined {
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

    private applyDiff(diff: CompletionBatch): undefined | string {
        if (this.lastCommittedUpdateCount === diff.from) {
            this.model = JSON.parse(this.lastCommittedRoot);
            const errorApplication = diff.completions.find(exec => {
                let result = this.model.performCommand(exec.command);
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



export interface HistoryStore {
    // Returns the history from the specified update number, if available, otherwise undefined
    get(from: number, to: number): CommandCompletion[] | undefined;

    // Stores the execution with its model udate number
    store(update: number, command: CommandCompletion);
}

function applyBatch(model: Model, batch: CompletionBatch, pathMapper: PathMapper): 
    undefined | { applied: CompletionBatch, errors?: CompletionError[] } {
    let modifiedBatch = undefined;
    let errors = undefined;
    batch.completions.forEach((e, idx) => {
        let path = e.command.path || [];
        const mapped = pathMapper.get(path);
        const command = mapped ? {
                path: mapped,
                action: e.command.action,
                props: e.command.props
            } : e.command;
        path = mapped || path;
        let isModified = mapped != undefined;
        const result = model.performCommand(command);
        if (result.isSuccess == true) {
            if (result.newId != undefined && result.newId != e.newId) {
                isModified = true;
                pathMapper.put(path.concat(e.newId), path.concat(result.newId));
            }
            if (modifiedBatch != undefined || isModified) {
                modifiedBatch = modifiedBatch || batch.completions.slice(0, idx);
                const appliedExecution = {
                    command: command,
                    newId: result.newId
                };
                modifiedBatch.push(appliedExecution)
            } 
        } else {
            modifiedBatch = modifiedBatch || batch.completions.slice(0, idx);
            if (errors == undefined) {
                errors = [];
            }
            errors.push({
                action: e.command.action,
                path: path,
                errorMessage: result.error
            });
        }
    });
    if (modifiedBatch) {
        return {
            applied: {
                from: batch.from, 
                completions: modifiedBatch
            },
            errors: errors
        };
    } else {
        return undefined;
    }
}

export class ModelUpdater {
    
    historyStore?: HistoryStore;
    model: Model;

    constructor(model: Model, historyStore?: HistoryStore) {
        this.model = model;
        this.historyStore = historyStore;
    }

    apply(batch: CompletionBatch): ApplyResult {
        const startUpdate = this.model.getUpdateCount();

        const pathMapper = new PathMapper();
        const result = applyBatch(this.model, batch, pathMapper);
        const applied = result == undefined ? batch : result.applied;

        let sync = undefined;
        if (batch.from != startUpdate) {
            const historyDiff = this.historyStore ? this.historyStore.get(batch.from, startUpdate) : undefined;
            if (historyDiff == undefined || (historyDiff.length != startUpdate - batch.from)) {
                sync = {
                    isPartial: false
                };
            } else {
                const diff: CompletionBatch = {
                    from: batch.from,
                    completions: historyDiff.concat(applied.completions)
                };
                sync = {
                    isPartial: true,
                    diff: diff
                };
            }
        }
        if (this.historyStore) {
            applied.completions.forEach((e, i: number) => {
                this.historyStore.store(startUpdate + i, e);
            });
        }
        return {
            sync: sync,
            errors: result == undefined ? undefined : result.errors
        };
    }
}

