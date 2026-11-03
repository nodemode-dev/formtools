use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use super::SHORTCUT_EVENT;

#[derive(Deserialize)]
pub struct Binding {
    pub id: String,
    pub accel: String,
}

#[derive(Serialize)]
pub struct Outcome {
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn done(id: String) -> Outcome {
    Outcome { id, ok: true, error: None }
}

fn failed(id: String, error: String) -> Outcome {
    Outcome { id, ok: false, error: Some(error) }
}

pub fn replace<R: Runtime>(app: &AppHandle<R>, list: Vec<Binding>) -> Vec<Outcome> {
    let keys = app.global_shortcut();
    let _ = keys.unregister_all();
    let mut seen: HashSet<u32> = HashSet::new();
    let mut outcomes = Vec::with_capacity(list.len());
    for binding in list {
        let accel = binding.accel.trim();
        if accel.is_empty() {
            outcomes.push(done(binding.id));
            continue;
        }
        let shortcut: Shortcut = match accel.parse() {
            Ok(parsed) => parsed,
            Err(_) => {
                outcomes.push(failed(binding.id, format!("{accel} is not a shortcut formtools can read.")));
                continue;
            }
        };
        if !seen.insert(shortcut.id()) {
            outcomes.push(failed(binding.id, format!("{accel} is already used by another formtools shortcut.")));
            continue;
        }
        let id = binding.id.clone();
        let result = keys.on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app.emit_to("main", SHORTCUT_EVENT, id.clone());
            }
        });
        match result {
            Ok(()) => outcomes.push(done(binding.id)),
            Err(_) => outcomes.push(failed(binding.id, format!("{accel} is taken by another app or reserved by the system."))),
        }
    }
    outcomes
}
