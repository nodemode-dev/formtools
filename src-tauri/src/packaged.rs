use tauri::path::BaseDirectory;
use tauri::Manager;

#[cfg(windows)]
const PROGRAM: &str = "engine/formtools-engine.exe";

#[cfg(not(windows))]
const PROGRAM: &str = "engine/formtools-engine";

pub fn engine_program(handle: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let mut places = Vec::new();
    if let Ok(found) = handle.path().resolve(PROGRAM, BaseDirectory::Resource) {
        places.push(found);
    }
    if let Some(dir) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(|p| p.to_path_buf())) {
        places.push(dir.join(PROGRAM));
    }
    places.push(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(PROGRAM));
    places.into_iter().find(|program| program.is_file())
}
