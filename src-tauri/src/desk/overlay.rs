use tauri::webview::PageLoadEvent;
use tauri::window::Color;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::capture::Raw;

const PREFIX: &str = "overlay-";
const REVEAL_FALLBACK_MS: u64 = 2500;

#[derive(Clone, Copy)]
pub struct Place {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub scale: f64,
}

pub struct Spec<'a> {
    pub tool: &'a str,
    pub shot: Option<&'a str>,
    pub index: usize,
    pub place: Place,
    pub focus: bool,
    pub options: &'a str,
}

pub fn places<R: Runtime>(app: &AppHandle<R>) -> Vec<Place> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| Place {
            x: monitor.position().x,
            y: monitor.position().y,
            w: monitor.size().width,
            h: monitor.size().height,
            scale: monitor.scale_factor(),
        })
        .collect()
}

pub fn assign(raws: &[Raw], places: &[Place]) -> Vec<Place> {
    let mut used = vec![false; places.len()];
    let pick = |raw: &Raw, used: &mut Vec<bool>| -> Option<usize> {
        let found = (0..places.len())
            .find(|i| !used[*i] && places[*i].x == raw.x && places[*i].y == raw.y)
            .or_else(|| (0..places.len()).find(|i| !used[*i] && places[*i].w == raw.w && places[*i].h == raw.h))
            .or_else(|| (0..places.len()).find(|i| !used[*i]));
        if let Some(i) = found {
            used[i] = true;
        }
        found
    };
    raws.iter()
        .map(|raw| match pick(raw, &mut used) {
            Some(i) => places[i],
            None => Place { x: raw.x, y: raw.y, w: raw.w, h: raw.h, scale: 1.0 },
        })
        .collect()
}

pub fn pointer_index<R: Runtime>(app: &AppHandle<R>, places: &[Place]) -> usize {
    let Ok(pointer) = app.cursor_position() else { return 0 };
    places
        .iter()
        .position(|place| {
            pointer.x >= place.x as f64
                && pointer.x < place.x as f64 + place.w as f64
                && pointer.y >= place.y as f64
                && pointer.y < place.y as f64 + place.h as f64
        })
        .unwrap_or(0)
}

fn engine_url<R: Runtime>(app: &AppHandle<R>) -> Result<Url, String> {
    let main = app.get_webview_window("main").ok_or_else(|| "The main window is not open.".to_string())?;
    let mut url = main.url().map_err(|err| format!("The engine address is not known: {err}"))?;
    url.set_path("/overlay.html");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

fn reveal<R: Runtime>(app: &AppHandle<R>, label: &str, focus: bool) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        if focus {
            let _ = window.set_focus();
        }
    }
}

#[cfg(target_os = "macos")]
fn raise<R: Runtime>(window: &WebviewWindow<R>) {
    let Ok(ns_window) = window.ns_window() else { return };
    let address = ns_window as usize;
    let _ = window.run_on_main_thread(move || unsafe {
        if let Some(window) = (address as *const objc2_app_kit::NSWindow).as_ref() {
            window.setLevel(25);
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn raise<R: Runtime>(_window: &WebviewWindow<R>) {}

pub fn open<R: Runtime>(app: &AppHandle<R>, spec: &Spec) -> Result<(), String> {
    let label = format!("{PREFIX}{}", spec.index);
    let mut url = engine_url(app)?;
    url.query_pairs_mut()
        .append_pair("tool", spec.tool)
        .append_pair("shot", spec.shot.unwrap_or(""))
        .append_pair("monitor", &spec.index.to_string())
        .append_pair("scale", &spec.place.scale.to_string())
        .append_pair("options", spec.options);
    let wayland = cfg!(target_os = "linux") && super::caps::session() == "wayland";
    let hook_label = label.clone();
    let focus = spec.focus;
    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title("formtools overlay")
        .visible(false)
        .focused(false)
        .decorations(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible_on_all_workspaces(true)
        .fullscreen(wayland)
        .on_page_load(move |webview, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                reveal(webview.app_handle(), &hook_label, focus);
            }
        });
    #[cfg(target_os = "macos")]
    let builder = builder.accept_first_mouse(true);
    let window = builder.build().map_err(|err| format!("The overlay window could not be opened: {err}"))?;
    let place = spec.place;
    let _ = window.set_position(PhysicalPosition::new(place.x, place.y));
    let _ = window.set_size(PhysicalSize::new(place.w, place.h));
    let _ = window.set_position(PhysicalPosition::new(place.x, place.y));
    raise(&window);
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(REVEAL_FALLBACK_MS));
        reveal(&handle, &label, focus);
    });
    Ok(())
}

pub fn close_all<R: Runtime>(app: &AppHandle<R>) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(PREFIX) {
            let _ = window.destroy();
        }
    }
    for _ in 0..50 {
        if !app.webview_windows().keys().any(|label| label.starts_with(PREFIX)) {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
}
