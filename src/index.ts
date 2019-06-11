
enum CommandAction {
    New,
    Update,
    Delete
}
interface Command {
    action: CommandAction;
    props?: Record<string, any>;
}

type Sync = { isPartial: true, fromUpdateCount: number, diff: CommandExecution[] } | { isPartial: false };

interface ApplyResult {
    sync?: Sync;
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

class Node {
    updateCount: number;
    props: object;
    children: object;
    historyProvider: (fromUpdate: number) => CommandExecution[];

    apply(fromCommittedUpdateCount: number, execs: CommandExecution[]): ApplyResult {
        const self = this;
        if (fromCommittedUpdateCount == this.updateCount) {
            execs.forEach(e => {
                e.command.apply(self);
                self.updateCount += 1;
            });
            return {};
        } else {
            const history = self.historyProvider(fromCommittedUpdateCount);
            const sync: Sync = (!history || history.length < self.updateCount - fromCommittedUpdateCount) ?
                    { isPartial: false } :
                    { isPartial: true, fromUpdateCount: fromCommittedUpdateCount, diff: [].concat(history)};            
            const pathMapper = new PathMapper();
            execs.forEach(e => {
                const remappedPath = pathMapper.get(e.path);
                const path = remappedPath ? remappedPath : e.path;
                const newId = self.performCommand(path, e.command);
                self.updateCount += 1;
                if (newId != undefined && newId != e.newId) {
                    pathMapper.put(e.path.concat([e.newId]), e.path.concat([newId]));
                }
                if (sync.isPartial) {
                    sync.diff.push({
                        path: path,
                        command: e.command,
                        newId: newId
                    })
                }
            });
            return {
                sync: sync
            };
        }
    }

    performCommand(path: string[], command: Command): string | undefined | { error: string } {
        switch (command.action) {
            case CommandAction.New: {
                return 'new';
            }
            case CommandAction.Update: {
                return undefined;
            }
            case CommandAction.Delete: {
                return undefined;
            }
            default: {
                throw new Error('Unknown action ' + command.action);
            }
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