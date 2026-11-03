const APP_COMMANDS: &[&str] = &[
    "app_ready",
    "text_edit",
    "pick_folder",
    "pick_files",
    "reveal_in_folder",
    "open_with_default",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS)),
    )
    .expect("failed to run the Tauri build step");
}
