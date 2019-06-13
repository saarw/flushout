# flusho
Flusho is an event-sourcing based alternative to REST/GraphQL for part or the whole of an application's model. Client keeps complete copies of the model that track changes the clients perform and allow periodically flushing the changes to a remote source model. Flusho was built to support single-page applications, with progressive web-application offline capabilities and should be a good fit for queue-based serverless backends.   
Some design properties of Flusho
* Minimize network traffic by only requiring transmitting current model state and future updates
* Store command history separately from current model state
* Make command history optional
* Make commands and model update inspectable and interceptable to support validation
* Be agnostic about network transport (Flushes can be performed over regular fetch calls or websockets etc.)
