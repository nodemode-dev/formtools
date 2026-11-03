use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};

mod awake;
mod caps;
mod capture;
mod ocr;
mod overlay;
mod shortcuts;
mod topmost;

pub const SHORTCUT_EVENT: &str = "desk://shortcut";

const TOOLS: [&str; 6] = ["picker", "ruler", "text", "zoom", "draw", "timer"];

#[derive(Default)]
pub struct Desk {
    folder: Mutex<Option<PathBuf>>,
    awake: awake::Awake,
}

#[derive(Serialize)]
pub struct Monitor {
    index: usize,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale: f64,
    path: String,
}

#[derive(Serialize)]
pub struct Capture {
    id: String,
    monitors: Vec<Monitor>,
}

pub fn base() -> PathBuf {
    std::env::temp_dir().join("formtools-desk")
}

fn reset<R: Runtime>(app: &AppHandle<R>) {
    overlay::close_all(app);
    let folder = app.state::<Desk>().folder.lock().ok().and_then(|mut slot| slot.take());
    if let Some(folder) = folder {
        let _ = std::fs::remove_dir_all(folder);
    }
}

pub fn shutdown<R: Runtime>(app: &AppHandle<R>) {
    app.state::<Desk>().awake.release();
    let _ = std::fs::remove_dir_all(base());
}

#[tauri::command(async)]
pub fn desk_capabilities() -> caps::DeskCaps {
    caps::detect()
}

#[tauri::command(async)]
pub fn desk_start<R: Runtime>(app: AppHandle<R>, tool: String, options: Option<serde_json::Value>) -> Result<Option<Capture>, String> {
    if !TOOLS.contains(&tool.as_str()) {
        return Err(format!("{tool} is not a desk tool."));
    }
    reset(&app);
    let options = serde_json::to_string(&options.unwrap_or(serde_json::Value::Null)).unwrap_or_else(|_| "null".to_string());
    let options = if options == "null" { "{}".to_string() } else { options };

    if tool == "timer" {
        let places = overlay::places(&app);
        if places.is_empty() {
            return Err("No screen was found.".to_string());
        }
        let index = overlay::pointer_index(&app, &places);
        let spec = overlay::Spec { tool: &tool, shot: None, index, place: places[index], focus: true, options: &options };
        overlay::open(&app, &spec)?;
        return Ok(None);
    }

    capture::permit()?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let id = format!("{stamp}-{}", std::process::id());
    let _ = std::fs::remove_dir_all(base());
    let dir = base().join(&id);
    std::fs::create_dir_all(&dir).map_err(|err| format!("The capture folder could not be made: {err}"))?;
    if let Ok(mut slot) = app.state::<Desk>().folder.lock() {
        *slot = Some(dir.clone());
    }
    let raws = match capture::all(&dir) {
        Ok(raws) => raws,
        Err(err) => {
            reset(&app);
            return Err(err);
        }
    };
    let placed = overlay::assign(&raws, &overlay::places(&app));
    let focus = overlay::pointer_index(&app, &placed);
    let mut monitors = Vec::with_capacity(raws.len());
    for (index, (raw, place)) in raws.iter().zip(placed.iter()).enumerate() {
        let path = raw.path.to_string_lossy().into_owned();
        let spec = overlay::Spec { tool: &tool, shot: Some(&path), index, place: *place, focus: index == focus, options: &options };
        if let Err(err) = overlay::open(&app, &spec) {
            reset(&app);
            return Err(err);
        }
        monitors.push(Monitor { index, x: place.x, y: place.y, width: raw.w, height: raw.h, scale: place.scale, path });
    }
    Ok(Some(Capture { id, monitors }))
}

#[tauri::command(async)]
pub fn desk_close<R: Runtime>(app: AppHandle<R>) {
    reset(&app);
}

#[tauri::command(async)]
pub fn desk_ocr(path: String, rect: ocr::Rect, lang: Option<String>) -> Result<ocr::Text, String> {
    ocr::run(std::path::Path::new(&path), &rect, lang.as_deref())
}

#[tauri::command(async)]
pub fn desk_awake_get(state: State<'_, Desk>) -> awake::State {
    state.awake.get()
}

#[tauri::command(async)]
pub fn desk_awake_set(state: State<'_, Desk>, req: awake::Request) -> Result<awake::State, String> {
    state.awake.set(req)
}

#[tauri::command(async)]
pub fn desk_topmost_toggle() -> topmost::Outcome {
    topmost::toggle()
}

#[tauri::command(async)]
pub fn desk_shortcuts_set<R: Runtime>(app: AppHandle<R>, list: Vec<shortcuts::Binding>) -> Vec<shortcuts::Outcome> {
    shortcuts::replace(&app, list)
}
