# QuickNotes System Design

QuickNotes is a browser-based API client and a set of design documents for evolving a simple notes app into an online service for one million users. The client demonstrates loading, creating, and deleting notes with JSONPlaceholder; the documents describe the REST API, relational data model, and scalable production architecture.

## Run the API client

Open `index.html` in a modern browser, or serve the project directory with a local static web server and open its local URL. Select **Load notes** to fetch sample posts, or enter a title and optional body to create a sample note. JSONPlaceholder is a practice API: it simulates POST and DELETE responses but does not persist those changes on the server.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- How a reusable `fetch` helper, HTTP status checks, and request-specific loading/error states make an API client easier to maintain.
- How REST endpoint contracts, status codes, validation, and ownership rules shape a backend API.
- How primary/foreign keys and a join table model note ownership and many-to-many tags.
- How caches, read replicas, queues, workers, and multiple app instances address different scaling and availability problems.
