# flushout
Flushout is an event-sourcing based data model where clients interact with a local proxy of a remote master
model and flush changes to the master in the background. Flushout is written in TypeScript to support single-page applications, progressive web applications, and mobile clients that need to interact with data models without network delay and to support periods of offline data model manipulation. 

Flushout design properties
* Minimizes network traffic by only initializing clients with the latest model snapshot and then only sends updates
* Makes storing update history optional and history is stored separately from the latest model state
* Is flexible about deployment and agnostic about network transport to fit many sorts of backends and protocols
* Defines communication between client and server as simple interfaces to support inspection and validation
* Optimizes for reducing network traffic and load on the server in favor of performing more work on the client

# How it works
## Clients
Clients initialize a Proxy model with the latest snapshot from the backend. They then apply commands to modify the model any may periodically perform flushes to synchronize their state with the remote master.

### Flushout document
A document in Flushout is a simple JavaScript object that may contain primitive fields or additional objects that form a tree graph. Applications modify the model by applying commands with changes they want to make. All commands include an action and allow specifying a path to where in the document graph the command should operate (omitting the path uses the root of the document). A snapshot is simply a document and a count of how many commands have been applied to the document.

### Commands   
#### Create
Creates a new node in the document graph, optionally initializing it with the values in the commands props object. The node will receive a random ID.

#### Update
Updates a node in the document graph by setting the document keys specified in the command's props object.

#### Delete
Deletes the node in the document graph.

### Collisions
* Updates simply overwrite any old values, but applications that preserve command history may be able to implement more advanced merge operations.
* Updates commands on deleted nodes will fail silently.
* If two proxies perform a create command and create a node with the same ID before flushing to the master, the flush will remap any queued up commands in the second proxy to the new node's ID and notify the application that IDs may have changed.

### Server
The server initialize a Master model with the latest snapshot and apply flushes it receives from the clients to update the model and produce sync messages that let the proxies update their state to that of the master.



## Background
Flushout was built to support https://plotdash.com to offer a Google Docs-like experience where data model is always immediately responsive to the user while backend communication happens in the background. Flushout was also inspired by TypeScript's rise as a full-stack language and the powerful benefit it provides to share code between server and many sorts of clients.

## Differences to CRDT-based libraries
CRDT-based libraries, such as Automerge, is another attractive option for this kind of applications, but Flushout may be more practical if you application do not need all the features provided by CRDTs.    

They tend to embed their whole update history in the document which may cause slower initial load times for clients, higher memory usage and more serialization work and traffic to the database. Flushout's simpler operations defined as easily interceptable interfaces may make it easier to support validation, security, and model-based limitations on operations. It may also be possible to implement CRDT types on top of Flushout's primitives, or directly embed a CRDT-based document as part of Flushout model.
