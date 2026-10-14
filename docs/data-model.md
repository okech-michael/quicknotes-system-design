# QuickNotes Data Model

## Entities and relationships

- **Users** stores one account per person, including a unique email address and a password hash rather than a plain-text password.
- **Notes** stores a user's title, body, and creation/update timestamps. Each note belongs to one user, so users-to-notes is a one-to-many relationship.
- **Tags** stores a user's named labels. Each tag belongs to one user, and a user can create many tags.
- **Note tags** joins notes to tags. A note can have many tags and a tag can be applied to many notes, making notes-to-tags a many-to-many relationship. The join table stores each note/tag pairing and uses a composite primary key to prevent duplicate assignments.

Foreign keys use cascading deletes so removing a user removes their notes and tags, and removing a note or tag clears its join rows.

## SQLite schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE tags (
    tag_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE note_tags (
    note_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes (note_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (tag_id) ON DELETE CASCADE
);
```

## Example queries

List a user's notes, newest first:

```sql
SELECT note_id, title, body, created_at, updated_at
FROM notes
WHERE user_id = :user_id
ORDER BY created_at DESC
LIMIT :page_size;
```

List notes with their tags (join across notes, the join table, and tags):

```sql
SELECT n.note_id, n.title, t.name AS tag
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.note_id
JOIN tags AS t ON t.tag_id = nt.tag_id
WHERE n.user_id = :user_id
ORDER BY n.created_at DESC, t.name;
```

Count a user's notes by tag, including untagged notes:

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags AS t
LEFT JOIN note_tags AS nt ON nt.tag_id = t.tag_id
LEFT JOIN notes AS n ON n.note_id = nt.note_id AND n.user_id = t.user_id
WHERE t.user_id = :user_id
GROUP BY t.tag_id, t.name
ORDER BY t.name;
```

Find notes whose title contains a search term:

```sql
SELECT note_id, title, body
FROM notes
WHERE user_id = :user_id
  AND title LIKE '%' || :search_term || '%'
ORDER BY created_at DESC;
```

## Index

Add `CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);`. The API commonly lists a user's notes ordered by creation time, so this index supports filtering to one owner and returning the newest notes without sorting the entire table.

The `note_tags` composite primary key supports lookups beginning with `note_id`; add `CREATE INDEX idx_note_tags_tag_note ON note_tags (tag_id, note_id);` for the reverse lookup of notes by tag.

## SQL or NoSQL?

I would use a relational SQL database such as PostgreSQL. Users, notes, tags, and their ownership rules have stable relationships that benefit from foreign keys, unique constraints, and transactions. SQL joins directly support retrieving notes and their tags, while indexes support user-scoped, newest-first feeds. A document store could embed tags in each note, but shared tags and consistency during edits would make updates and cross-note queries more complicated.
