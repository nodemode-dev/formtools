#[cfg(target_os = "macos")]
const ENGINE: &str = "formtools-engine";

#[cfg(target_os = "macos")]
pub fn engine_folder() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    [dir.join("../Resources/engine"), dir.join("engine")]
        .into_iter()
        .map(|folder| folder.join(ENGINE))
        .find(|program| program.is_file())
}

#[cfg(not(target_os = "macos"))]
pub fn engine_folder() -> Option<std::path::PathBuf> {
    None
}
