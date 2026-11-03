use std::path::{Path, PathBuf};

use tauri::Runtime;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

fn text(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

#[tauri::command(async)]
pub fn pick_folder<R: Runtime>(app: tauri::AppHandle<R>, title: Option<String>) -> Option<String> {
    let mut dialog = app.dialog().file();
    if let Some(title) = title {
        dialog = dialog.set_title(title);
    }
    dialog.blocking_pick_folder().and_then(|picked| picked.into_path().ok()).map(text)
}

#[tauri::command(async)]
pub fn pick_files<R: Runtime>(app: tauri::AppHandle<R>, title: Option<String>, extensions: Option<Vec<String>>) -> Vec<String> {
    let mut dialog = app.dialog().file();
    if let Some(title) = title {
        dialog = dialog.set_title(title);
    }
    let extensions = extensions.unwrap_or_default();
    if !extensions.is_empty() {
        let names: Vec<&str> = extensions.iter().map(|ext| ext.trim_start_matches('.')).collect();
        dialog = dialog.add_filter("Files", &names);
    }
    dialog
        .blocking_pick_files()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|picked| picked.into_path().ok())
        .map(text)
        .collect()
}

#[tauri::command(async)]
pub fn reveal_in_folder<R: Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err(format!("{path} does not exist"));
    }
    app.opener().reveal_item_in_dir(&path).map_err(|err| err.to_string())
}

#[tauri::command(async)]
pub fn open_with_default<R: Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err(format!("{path} does not exist"));
    }
    app.opener().open_path(&path, None::<&str>).map_err(|err| err.to_string())
}
