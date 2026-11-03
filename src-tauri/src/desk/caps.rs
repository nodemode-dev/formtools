use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Support {
    pub ok: bool,
    pub reason: String,
}

impl Support {
    pub fn yes() -> Self {
        Support { ok: true, reason: String::new() }
    }

    pub fn no(reason: &str) -> Self {
        Support { ok: false, reason: reason.to_string() }
    }
}

#[derive(Serialize)]
pub struct Ocr {
    pub engine: Option<&'static str>,
    pub languages: Vec<String>,
}

#[derive(Serialize)]
pub struct DeskCaps {
    pub os: &'static str,
    pub session: &'static str,
    pub utilities: BTreeMap<&'static str, Support>,
    pub ocr: Ocr,
}

pub fn which(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let suffixes: &[&str] = if cfg!(windows) { &["", ".exe", ".cmd", ".bat"] } else { &[""] };
    std::env::split_paths(&path).find_map(|dir| {
        suffixes.iter().map(|suffix| dir.join(format!("{name}{suffix}"))).find(|candidate| candidate.is_file())
    })
}

pub fn os_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(windows) {
        "windows"
    } else {
        "linux"
    }
}

#[cfg(target_os = "linux")]
pub fn session() -> &'static str {
    let kind = std::env::var("XDG_SESSION_TYPE").unwrap_or_default().to_lowercase();
    let wayland_display = std::env::var_os("WAYLAND_DISPLAY").is_some_and(|value| !value.is_empty());
    if kind == "wayland" || (wayland_display && kind != "x11") {
        "wayland"
    } else if kind == "x11" || std::env::var_os("DISPLAY").is_some_and(|value| !value.is_empty()) {
        "x11"
    } else {
        "unknown"
    }
}

#[cfg(windows)]
pub fn session() -> &'static str {
    "windows"
}

#[cfg(target_os = "macos")]
pub fn session() -> &'static str {
    "macos"
}

#[cfg(target_os = "linux")]
fn screen_support(session: &str) -> Support {
    match session {
        "x11" => {
            if x11rb::connect(None).is_ok() {
                Support::yes()
            } else {
                Support::no("The X11 display cannot be reached.")
            }
        }
        "wayland" => Support::no("Screen capture and overlays are not available under Wayland. Log in with an X11 session to use this."),
        _ => Support::no("No graphical session was found."),
    }
}

#[cfg(not(target_os = "linux"))]
fn screen_support(_session: &str) -> Support {
    Support::yes()
}

fn timer_support(session: &str) -> Support {
    if cfg!(target_os = "linux") && session == "unknown" {
        Support::no("No graphical session was found.")
    } else {
        Support::yes()
    }
}

fn topmost_support(session: &str) -> Support {
    if cfg!(target_os = "macos") {
        Support::no("macOS does not let one app change the level of another app's window.")
    } else if cfg!(target_os = "linux") {
        match session {
            "x11" => screen_support(session),
            "wayland" => Support::no("Wayland does not let one app pin another app's window. Use an X11 session."),
            _ => Support::no("No graphical session was found."),
        }
    } else {
        Support::yes()
    }
}

fn awake_support() -> Support {
    if cfg!(target_os = "linux") && which("systemd-inhibit").is_none() {
        Support::no("systemd-inhibit is not installed.")
    } else {
        Support::yes()
    }
}

pub fn detect() -> DeskCaps {
    let session = session();
    let screen = screen_support(session);
    let ocr = super::ocr::engine();
    let text = if ocr.engine.is_some() {
        screen.clone()
    } else if cfg!(target_os = "linux") {
        Support::no("Install the tesseract package to extract text from the screen.")
    } else {
        Support::no("Text recognition is not available on this system.")
    };
    let mut utilities = BTreeMap::new();
    utilities.insert("picker", screen.clone());
    utilities.insert("ruler", screen.clone());
    utilities.insert("text", if screen.ok { text } else { screen.clone() });
    utilities.insert("zoom", screen.clone());
    utilities.insert("draw", screen);
    utilities.insert("timer", timer_support(session));
    utilities.insert("topmost", topmost_support(session));
    utilities.insert("awake", awake_support());
    utilities.insert("hosts", Support::yes());
    utilities.insert("env", Support::yes());
    DeskCaps { os: os_name(), session, utilities, ocr }
}
