use std::path::Path;

use serde::Serialize;

pub const IDS: [&str; 5] = ["view", "convert", "resize", "rename", "hash"];

#[derive(Serialize, Default, Clone, Debug)]
pub struct Status {
    pub supported: bool,
    pub installed: Vec<String>,
    #[serde(rename = "where")]
    pub place: String,
    pub reason: String,
}

pub fn title(id: &str) -> &'static str {
    match id {
        "view" => "Open in formtools",
        "convert" => "Convert with formtools",
        "resize" => "Resize with formtools",
        "rename" => "Rename with formtools",
        "hash" => "Hash with formtools",
        _ => "",
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn label(id: &str) -> &'static str {
    match id {
        "view" => "View",
        "convert" => "Convert",
        "resize" => "Resize",
        "rename" => "Rename",
        "hash" => "Hash",
        _ => "",
    }
}

pub fn pick(ids: &[String]) -> Result<Vec<&'static str>, String> {
    let mut found = Vec::new();
    for id in ids {
        match IDS.iter().find(|known| **known == id.as_str()) {
            Some(known) => found.push(*known),
            None => return Err(format!("{id} is not a menu entry.")),
        }
    }
    found.sort_by_key(|id| IDS.iter().position(|known| known == id));
    found.dedup();
    Ok(found)
}

#[cfg_attr(windows, allow(dead_code))]
pub fn unsupported(reason: &str) -> Status {
    Status { supported: false, installed: Vec::new(), place: String::new(), reason: reason.to_string() }
}

pub fn plain_path(path: &Path) -> Result<String, String> {
    let text = path.to_str().ok_or_else(|| "The formtools program path is not plain text.".to_string())?;
    if text.chars().any(|c| c.is_control() || matches!(c, '"' | '`' | '$' | '\\' | '%' | '\'' | '&' | '<' | '>')) && !cfg!(windows) {
        return Err("The formtools program path has characters a menu entry cannot hold safely.".to_string());
    }
    Ok(text.to_string())
}

#[cfg(unix)]
pub fn sh_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "'\\''"))
}

#[cfg(unix)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn desktop_quote(text: &str) -> String {
    format!("\"{text}\"")
}

#[cfg(unix)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}
