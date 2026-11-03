const APP_COMMANDS: &[&str] = &[
    "app_ready",
    "text_edit",
    "pick_folder",
    "pick_files",
    "reveal_in_folder",
    "open_with_default",
    "desk_capabilities",
    "desk_start",
    "desk_close",
    "desk_ocr",
    "desk_awake_get",
    "desk_awake_set",
    "desk_topmost_toggle",
    "desk_shortcuts_set",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS)),
    )
    .expect("failed to run the Tauri build step");
}
