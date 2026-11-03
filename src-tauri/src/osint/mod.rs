#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod other;
#[cfg(windows)]
mod registry;
mod spec;

#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
use other as platform;
#[cfg(windows)]
use registry as platform;

pub use spec::Status;

pub const TOOLS: [&str; 7] = ["view", "convert", "resize", "rename", "hash", "dupes", "disk"];

fn failed(reason: String) -> Status {
    let mut status = platform::status();
    status.reason = reason;
    status
}

#[tauri::command(async)]
pub fn osint_menu_status() -> Status {
    platform::status()
}

#[tauri::command(async)]
pub fn osint_menu_install(ids: Vec<String>) -> Status {
    match spec::pick(&ids).and_then(|ids| platform::install(&ids)) {
        Ok(status) => status,
        Err(reason) => failed(reason),
    }
}

#[tauri::command(async)]
pub fn osint_menu_remove(ids: Option<Vec<String>>) -> Status {
    let ids = ids.unwrap_or_else(|| spec::IDS.iter().map(|id| id.to_string()).collect());
    match spec::pick(&ids).and_then(|ids| platform::remove(&ids)) {
        Ok(status) => status,
        Err(reason) => failed(reason),
    }
}
