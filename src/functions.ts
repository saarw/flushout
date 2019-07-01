import { Model, CommandCompletion, CompletionBatch, CompletionError } from "./types";
import { PathMapper } from "./path-mapper";

export function applyCompletions(model: Model<any>, completions: CommandCompletion[], pathMapper: PathMapper): 
    undefined | { applied: CompletionBatch, errors?: CompletionError[] } {
    const startUpdate = model.getUpdateCount();
    let modifiedBatch = undefined;
    let errors = undefined;
    completions.forEach((e, idx) => {
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
                modifiedBatch = modifiedBatch || completions.slice(0, idx);
                const appliedExecution = {
                    command: command,
                    newId: result.newId
                };
                modifiedBatch.push(appliedExecution)
            } 
        } else {
            modifiedBatch = modifiedBatch || completions.slice(0, idx);
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
                from: startUpdate, 
                completions: modifiedBatch
            },
            errors: errors
        };
    } else {
        return undefined;
    }
}