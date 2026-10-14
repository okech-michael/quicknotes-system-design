const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");

let notes = [];

function setStatus(message, state = "") {
  statusText.textContent = message;
  statusText.className = state;
}

function renderNotes(noteList) {
  notesList.replaceChildren();

  if (noteList.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.classList.add("empty-state");
    emptyMessage.textContent = "No notes to show.";
    notesList.append(emptyMessage);
    return;
  }

  noteList.forEach((note) => {
    const item = document.createElement("li");
    item.classList.add("note");

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body || "";

    item.append(title, body);
    notesList.append(item);
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return {
    data: response.status === 204 ? null : await response.json(),
    status: response.status,
  };
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus("Loading notes...");
  notesList.replaceChildren();

  try {
    const result = await request(`${API_URL}?_limit=10`);
    notes = result.data;
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus("No notes were returned by the server.");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus("Could not load notes. Please try again.", "error");
    console.error("Unable to load notes:", error);
  } finally {
    loadButton.disabled = false;
  }
}

async function createNote(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title.", "error");
    titleInput.focus();
    return;
  }

  if (title.length > 100) {
    setStatus("Titles must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus("Creating note...");

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, userId: 1 }),
    });
    notes = [result.data, ...notes];
    renderNotes(notes);
    setStatus(`Note created (status ${result.status}, id ${result.data.id}).`, "success");
    noteForm.reset();
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
    console.error("Unable to create note:", error);
  } finally {
    submitButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
