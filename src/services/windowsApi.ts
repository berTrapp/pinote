import { invoke } from "@tauri-apps/api/core";

export const windowsApi = {
  openNote: (noteId: string) => invoke<void>("open_note_window", { noteId }),
  createAndOpenNote: () => invoke<void>("create_and_open_note_window"),
};
