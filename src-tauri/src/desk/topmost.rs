use serde::Serialize;

#[derive(Serialize)]
pub struct Outcome {
    pub ok: bool,
    pub on: bool,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn refused(error: &str) -> Outcome {
    Outcome { ok: false, on: false, title: String::new(), error: Some(error.to_string()) }
}

#[cfg(target_os = "macos")]
pub fn toggle() -> Outcome {
    refused("macOS does not let one app change the level of another app's window.")
}

#[cfg(windows)]
pub fn toggle() -> Outcome {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowLongW, GetWindowTextW, GetWindowThreadProcessId, SetWindowPos, GWL_EXSTYLE, HWND_NOTOPMOST,
        HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WS_EX_TOPMOST,
    };

    let window: HWND = unsafe { GetForegroundWindow() };
    if window.0.is_null() {
        return refused("No window is in front. Click the window you want to pin, then try again.");
    }
    let mut owner = 0u32;
    unsafe { GetWindowThreadProcessId(window, Some(&mut owner)) };
    if owner == std::process::id() {
        return refused("The window in front belongs to formtools. Switch to the window you want to pin, then try again.");
    }
    let mut buffer = [0u16; 512];
    let length = unsafe { GetWindowTextW(window, &mut buffer) }.max(0) as usize;
    let title = String::from_utf16_lossy(&buffer[..length.min(buffer.len())]);
    let pinned = unsafe { GetWindowLongW(window, GWL_EXSTYLE) } as u32 & WS_EX_TOPMOST.0 != 0;
    let target = if pinned { HWND_NOTOPMOST } else { HWND_TOPMOST };
    match unsafe { SetWindowPos(window, Some(target), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE) } {
        Ok(()) => Outcome { ok: true, on: !pinned, title, error: None },
        Err(_) => Outcome {
            ok: false,
            on: pinned,
            title,
            error: Some("Windows would not change that window. It may belong to a program running as administrator.".to_string()),
        },
    }
}

#[cfg(target_os = "linux")]
pub fn toggle() -> Outcome {
    if super::caps::session() == "wayland" {
        return refused("Wayland does not let one app pin another app's window. Use an X11 session.");
    }
    match x11() {
        Ok(outcome) => outcome,
        Err(err) => refused(&format!("The window could not be changed: {err}")),
    }
}

#[cfg(target_os = "linux")]
fn x11() -> Result<Outcome, Box<dyn std::error::Error>> {
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::{AtomEnum, ClientMessageEvent, ConnectionExt, EventMask};

    let (conn, screen) = x11rb::connect(None)?;
    let root = conn.setup().roots[screen].root;
    let atom = |name: &str| -> Result<u32, Box<dyn std::error::Error>> { Ok(conn.intern_atom(false, name.as_bytes())?.reply()?.atom) };
    let active = atom("_NET_ACTIVE_WINDOW")?;
    let state = atom("_NET_WM_STATE")?;
    let above = atom("_NET_WM_STATE_ABOVE")?;
    let pid_atom = atom("_NET_WM_PID")?;
    let name_atom = atom("_NET_WM_NAME")?;
    let utf8 = atom("UTF8_STRING")?;

    let found = conn.get_property(false, root, active, AtomEnum::WINDOW, 0, 1)?.reply()?;
    let window = found.value32().and_then(|mut items| items.next()).unwrap_or(0);
    if window == 0 {
        return Ok(refused("No window is in front. Click the window you want to pin, then try again."));
    }
    let owner = conn.get_property(false, window, pid_atom, AtomEnum::CARDINAL, 0, 1)?.reply()?;
    if owner.value32().and_then(|mut items| items.next()) == Some(std::process::id()) {
        return Ok(refused("The window in front belongs to formtools. Switch to the window you want to pin, then try again."));
    }
    let named = conn.get_property(false, window, name_atom, utf8, 0, 256)?.reply()?;
    let title = if named.value.is_empty() {
        let plain = conn.get_property(false, window, AtomEnum::WM_NAME, AtomEnum::STRING, 0, 256)?.reply()?;
        String::from_utf8_lossy(&plain.value).into_owned()
    } else {
        String::from_utf8_lossy(&named.value).into_owned()
    };
    let current = conn.get_property(false, window, state, AtomEnum::ATOM, 0, 64)?.reply()?;
    let pinned = current.value32().is_some_and(|mut items| items.any(|item| item == above));
    let action: u32 = if pinned { 0 } else { 1 };
    let event = ClientMessageEvent::new(32, window, state, [action, above, 0, 1, 0]);
    conn.send_event(false, root, EventMask::SUBSTRUCTURE_REDIRECT | EventMask::SUBSTRUCTURE_NOTIFY, event)?;
    conn.flush()?;
    Ok(Outcome { ok: true, on: !pinned, title, error: None })
}
