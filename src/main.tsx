import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { NoteWindowView } from "./views/note/NoteWindowView";
import "./styles/index.css";

const noteMatch = /^#\/note\/(.+)$/.exec(window.location.hash);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {noteMatch ? <NoteWindowView noteId={noteMatch[1]} /> : <App />}
  </React.StrictMode>,
);
