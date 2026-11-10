from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


class NoteInput(BaseModel):
    content: str


MODE = os.environ.get("NOTES_MODE", "volatile")
DATA_FILE = Path(os.environ["NOTES_DATA_FILE"])
notes: list[str] = []


def load_notes() -> None:
    global notes
    if MODE == "persistent" and DATA_FILE.exists():
        notes = json.loads(DATA_FILE.read_text())
    else:
        notes = []


def save_notes() -> None:
    if MODE == "persistent":
        DATA_FILE.write_text(json.dumps(notes, ensure_ascii=False))


load_notes()
app = FastAPI()


PAGE = """<!doctype html>
<html lang="en">
  <body>
    <main id="app">
      <h1>Notes</h1>
      <input id="note" aria-label="Note" />
      <button id="save">Save</button>
      <p id="status"></p>
      <ul id="notes"></ul>
    </main>
    <script>
      async function refresh() {
        const response = await fetch('/api/notes');
        const values = await response.json();
        document.querySelector('#notes').innerHTML = values.map(
          value => `<li>${value}</li>`
        ).join('');
      }
      document.querySelector('#save').addEventListener('click', async () => {
        const content = document.querySelector('#note').value;
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({content})
        });
        const result = await response.json();
        document.querySelector('#status').textContent = result.message;
        await refresh();
      });
      refresh();
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def home() -> str:
    return PAGE


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/notes")
def list_notes() -> list[str]:
    return notes


@app.post("/api/notes")
def create_note(body: NoteInput) -> dict[str, str]:
    if MODE != "placeholder":
        notes.append(body.content)
        save_notes()
    return {"message": "Saved"}


@app.post("/__test__/restart", status_code=204)
def restart() -> Response:
    load_notes()
    return Response(status_code=204)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True, type=int)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
