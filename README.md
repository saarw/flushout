# flusho
Flusho is an event-sourcing based alternative to REST/GraphQL for exposing and updating a data model on the server from one or more clients. The clients interact with a local copy of the data model that periodically synchronizes local changes with the remote model.

## Background
Flusho was built to support single-page applications that can maintain a copy of its data model state to support low-latency model interactions, offline capabilities of progressive web applications, and to be a good fit for queue-based serverless backends.   
   
Some design properties of Flusho
* Minimize network traffic by only initializing clients with current model state and sending future updates
* Support limiting update history and store update history separately from current model state
* Be agnostic about network transport (Flushes can be performed over regular fetch calls or websockets etc.)
* Make commands and model update inspectable and interceptable to support validation
* Reduce performance load on the server in favour of performing more work on the client
