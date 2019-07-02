import { Model, CommandCompletion, CompletionBatch, CompletionError } from "./types";
import { PathMapper } from "./path-mapper";

export function applyCompletions(model: Model<any>, completions: CommandCompletion[], pathMapper: PathMapper): 
    undefined | { applied: CompletionBatch, errors?: CompletionError[] } {
    const startUpdate = model.getUpdateCount();
    let modifiedBatch = undefined;
    let errors = undefined;
    completions.forEach((c, idx) => {
        let path = c.command.path || [];
        const mapped = pathMapper.get(path);
        const command = mapped ? {
                path: mapped,
                action: c.command.action,
                props: c.command.props
            } : c.command;
        path = mapped || path;
        let isModified = mapped != undefined;
        const result = model.performCommand(command, c.createdId);
        if (result.isSuccess == true) {
            if (result.createdId != undefined && result.createdId != c.createdId) {
                isModified = true;
                pathMapper.put(path.concat(c.createdId), path.concat(result.createdId));
            }
            if (modifiedBatch != undefined || isModified) {
                modifiedBatch = modifiedBatch || completions.slice(0, idx);
                const appliedExecution = {
                    command: command,
                    newId: result.createdId
                };
                modifiedBatch.push(appliedExecution)
            } 
        } else {
            modifiedBatch = modifiedBatch || completions.slice(0, idx);
            if (errors == undefined) {
                errors = [];
            }
            errors.push({
                action: c.command.action,
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