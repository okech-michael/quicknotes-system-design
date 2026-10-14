# QuickNotes REST API

Base URL: `https://api.quicknotes.example/v1`

All endpoints require an authenticated user except `POST /auth/register` and `POST /auth/login`. Note resources are scoped to the authenticated user; clients cannot read or modify another user's notes.

## Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Create a user account. | `201 Created` |
| `POST` | `/auth/login` | Authenticate a user and issue an access token. | `200 OK` |
| `GET` | `/notes` | List the authenticated user's notes, newest first; supports `limit` and `cursor` query parameters. | `200 OK` |
| `POST` | `/notes` | Create a note owned by the authenticated user. | `201 Created` |
| `GET` | `/notes/{noteId}` | Retrieve one of the authenticated user's notes. | `200 OK` |
| `PUT` | `/notes/{noteId}` | Replace a note's title and body. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Delete a note owned by the authenticated user. | `204 No Content` |
| `GET` | `/tags` | List the authenticated user's tags. | `200 OK` |
| `PUT` | `/notes/{noteId}/tags/{tagId}` | Add an existing tag to a note. | `200 OK` |
| `DELETE` | `/notes/{noteId}/tags/{tagId}` | Remove a tag from a note. | `204 No Content` |

## List notes

Example request:

```http
GET /v1/notes?limit=2 HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer <access-token>
Accept: application/json
```

Example response (`200 OK`):

```json
{
  "items": [
    {
      "id": "note_01J8Y4KX",
      "title": "Plan the week",
      "body": "Prepare the project milestones.",
      "createdAt": "2026-10-14T12:30:00Z",
      "updatedAt": "2026-10-14T12:30:00Z",
      "tags": ["work"]
    },
    {
      "id": "note_01J8Y4M2",
      "title": "Read chapter three",
      "body": "",
      "createdAt": "2026-10-13T17:05:00Z",
      "updatedAt": "2026-10-13T17:05:00Z",
      "tags": ["study"]
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTEwLTEzVDE3OjA1OjAwWiJ9"
}
```

## Create a note

Example request:

```http
POST /v1/notes HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer <access-token>
Content-Type: application/json
Accept: application/json
```

```json
{
  "title": "Plan the week",
  "body": "Prepare the project milestones."
}
```

Example response (`201 Created`):

```json
{
  "id": "note_01J8Y4KX",
  "title": "Plan the week",
  "body": "Prepare the project milestones.",
  "createdAt": "2026-10-14T12:30:00Z",
  "updatedAt": "2026-10-14T12:30:00Z",
  "tags": []
}
```

## Error responses

Errors return a consistent JSON body; the message is safe for clients to display, and the code is stable for programmatic handling.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required."
  }
}
```

- **`400 Bad Request`** — The request body is malformed or invalid, such as a missing title or a title longer than 100 characters.
- **`401 Unauthorized`** — The request has no valid access token, such as an expired or missing bearer token.
- **`403 Forbidden`** — The user is authenticated but is not allowed to perform the operation, such as trying to access an administrator-only endpoint.
- **`404 Not Found`** — The requested note does not exist or is not visible to the authenticated user.
- **`500 Internal Server Error`** — An unexpected server failure occurred; the response must not expose internal stack traces.
