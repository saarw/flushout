# flushout
Flushout is an event-sourcing based data model where clients interact with a local proxy of a remote master
model and flush changes to the master in the background. Flushout is written in TypeScript to support single-page applications, progressive web applications, and mobile clients that need to interact with data models without network delay and to support periods of offline data model manipulation. 

Flushout design properties
* Minimizes network traffic by only initializing clients with the latest model snapshot and then only send updates
* Makes storing update history optional and history is stored separately from the latest model state
* Is flexible about deployment and agnostic about network transport to fit many sorts of backends and protocols
* Defines communication between client and server as simple interfaces to support inspection and validation
* Optimizes for reducing network traffic and load on the server in favor of performing more work on the client

# How it works
## Document and snapshot
A document in Flushout is a simple JavaScript object that may contain primitive fields or additional object fields to form a tree graph. Applications modify the model by applying commands. All commands include an action and allow specifying a path to where in the document graph the command should operate (omitting the path uses the root of the document). A **snapshot** is simply a document and a count of how many commands have been applied to the document.

## Client proxies
Clients initialize a Proxy model with the latest snapshot from the backend. They then apply commands to modify the model any may periodically perform flushes to synchronize their state with the remote master.

## Remote master
The server initialize a Master model with the latest snapshot and apply flushes it receives from the clients to update the model and produce sync messages that let the proxies update their state to that of the master.

### Commands   
**Create** - Creates a new object field inside an object in the document graph, optionally initializing the object with the values in the command's props object. The field will receive a random ID and the ID is returned to the application.   

**Update** - Updates an object field in the document graph by setting the values specified in the command's props object.   

**Delete** - Deletes the object in the document graph.   

#### History and undo
The update history of the master and the changes flushed by the proxies are represented by batches of **command completions**. Each batch has a number indicating the command count of the document it was applied to and each command completion includes a command that was successfully applied and optionally its resulting ID (if it created a new node). This means each document can rebuilt from an earlier version by re-applying all command completions that occurred after the document's command count. Applications can implement full or limited undo functionality by preserving the necessary earlier document snapshots and command completions.

#### Collisions
* Updates to the same node will simply overwrite each other, but applications that preserve command history may be able to implement more advanced merge operations.
* Updates on deleted nodes will fail silently.
* If two proxies perform create commands that create a node with the same ID before flushing to the master, the flush will remap any queued up commands in the second proxy to the new node's ID and notify the application that IDs may have changed.

## Background
Flushout was built to support https://plotdash.com to offer a Google Docs-like experience where data model is always immediately responsive to the user while backend communication happens in the background. Flushout was also inspired by TypeScript's rise as a full-stack language and the powerful benefit it provides to share code between server and many sorts of clients.

## Differences to CRDT-based libraries
CRDT-based libraries, such as Automerge, is another attractive option for this kind of applications, but Flushout may be more practical if you application do not need all the features provided by CRDTs.    

They tend to embed their whole update history in the document which may cause slower initial load times for clients, higher memory usage and more serialization work and traffic to the database. Flushout's simpler operations defined as easily interceptable interfaces may make it easier to support validation, security, and model-based limitations on operations. It may also be possible to implement CRDT types on top of Flushout's primitives, or directly embed a CRDT-based document as part of Flushout model.
