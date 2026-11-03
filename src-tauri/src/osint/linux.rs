use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use super::spec::{desktop_quote, pick, plain_path, sh_quote, title, Status, IDS};

const INSTALLED_BINARY: &str = "/usr/bin/formtools";

pub struct Env {
    pub data: PathBuf,
    pub exe: PathBuf,
}

impl Env {
    pub fn detect() -> Result<Env, String> {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|home| home.is_absolute())
            .ok_or_else(|| "The home folder is not known.".to_string())?;
        let data = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .filter(|dir| dir.is_absolute())
            .unwrap_or_else(|| home.join(".local/share"));
        Ok(Env { data, exe: launcher() })
    }
}

fn launcher() -> PathBuf {
    if let Some(image) = std::env::var_os("APPIMAGE").map(PathBuf::from).filter(|image| image.is_file()) {
        return image;
    }
    let current = std::env::current_exe().unwrap_or_else(|_| PathBuf::from(INSTALLED_BINARY));
    let installed = Path::new(INSTALLED_BINARY);
    let same = match (fs::canonicalize(&current), fs::canonicalize(installed)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    if same {
        installed.to_path_buf()
    } else {
        current
    }
}

fn script_dir(env: &Env) -> PathBuf {
    env.data.join("nautilus/scripts/formtools")
}

fn script_path(env: &Env, id: &str) -> PathBuf {
    script_dir(env).join(title(id))
}

fn dolphin_path(env: &Env) -> PathBuf {
    env.data.join("kio/servicemenus/formtools.desktop")
}

fn nemo_path(env: &Env, id: &str) -> PathBuf {
    env.data.join(format!("nemo/actions/formtools-{id}.nemo_action"))
}

fn dolphin_ids(env: &Env) -> Vec<&'static str> {
    let Ok(text) = fs::read_to_string(dolphin_path(env)) else { return Vec::new() };
    let Some(line) = text.lines().find(|line| line.starts_with("Actions=")) else { return Vec::new() };
    IDS.iter()
        .copied()
        .filter(|id| line["Actions=".len()..].split(';').any(|name| name == format!("formtools-{id}")))
        .collect()
}

fn present(env: &Env) -> Vec<&'static str> {
    let dolphin = dolphin_ids(env);
    IDS.iter()
        .copied()
        .filter(|id| script_path(env, id).is_file() || nemo_path(env, id).is_file() || dolphin.contains(id))
        .collect()
}

fn place() -> String {
    "Nautilus scripts (~/.local/share/nautilus/scripts/formtools), Dolphin service menu (~/.local/share/kio/servicemenus/formtools.desktop), Nemo actions (~/.local/share/nemo/actions/formtools-*.nemo_action)".to_string()
}

pub fn status_in(env: &Env) -> Status {
    Status {
        supported: true,
        installed: present(env).into_iter().map(String::from).collect(),
        place: place(),
        reason: String::new(),
    }
}

fn write_file(path: &Path, text: &str, mode: u32) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Could not create {}: {e}.", parent.display()))?;
    }
    fs::write(path, text).map_err(|e| format!("Could not write {}: {e}.", path.display()))?;
    fs::set_permissions(path, fs::Permissions::from_mode(mode)).map_err(|e| format!("Could not set the mode of {}: {e}.", path.display()))
}

fn script_text(exe: &str, id: &str) -> String {
    let program = sh_quote(exe);
    format!(
        "#!/bin/sh\nprintf '%s\\n' \"$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS\" | {{\n    set --\n    while IFS= read -r line; do\n        [ -n \"$line\" ] && set -- \"$@\" \"$line\"\n    done\n    exec {program} --tool {id} \"$@\"\n}}\n"
    )
}

fn nemo_text(exe: &str, id: &str) -> String {
    let program = desktop_quote(exe);
    format!(
        "[Nemo Action]\nName={}\nComment={}\nExec={program} --tool {id} %F\nIcon-Name=formtools\nSelection=notnone\nExtensions=any;dir;none;\nQuote=double\n",
        title(id),
        title(id)
    )
}

fn dolphin_text(exe: &str, ids: &[&str]) -> String {
    let program = desktop_quote(exe);
    let names: Vec<String> = ids.iter().map(|id| format!("formtools-{id}")).collect();
    let mut text = format!(
        "[Desktop Entry]\nType=Service\nMimeType=all/allfiles;inode/directory;\nX-KDE-ServiceTypes=KonqPopupMenu/Plugin\nX-KDE-Priority=TopLevel\nX-KDE-Submenu=formtools\nIcon=formtools\nActions={};\n",
        names.join(";")
    );
    for id in ids {
        text.push_str(&format!(
            "\n[Desktop Action formtools-{id}]\nName={}\nIcon=formtools\nExec={program} --tool {id} %F\n",
            title(id)
        ));
    }
    text
}

fn write_dolphin(env: &Env, exe: &str, ids: &[&str]) -> Result<(), String> {
    if ids.is_empty() {
        let path = dolphin_path(env);
        if path.is_file() {
            fs::remove_file(&path).map_err(|e| format!("Could not remove {}: {e}.", path.display()))?;
        }
        return Ok(());
    }
    write_file(&dolphin_path(env), &dolphin_text(exe, ids), 0o755)
}

pub fn install_in(env: &Env, ids: &[&str]) -> Result<Status, String> {
    if ids.is_empty() {
        return Err("Choose at least one menu entry.".to_string());
    }
    let exe = plain_path(&env.exe)?;
    let mut all: Vec<&str> = present(env);
    all.extend(ids.iter().copied());
    let all = pick(&all.iter().map(|id| id.to_string()).collect::<Vec<_>>())?;
    for id in ids {
        write_file(&script_path(env, id), &script_text(&exe, id), 0o755)?;
        write_file(&nemo_path(env, id), &nemo_text(&exe, id), 0o644)?;
    }
    write_dolphin(env, &exe, &all)?;
    Ok(status_in(env))
}

fn delete(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not remove {}: {e}.", path.display())),
    }
}

pub fn remove_in(env: &Env, ids: &[&str]) -> Result<Status, String> {
    let exe = plain_path(&env.exe).unwrap_or_default();
    let keep: Vec<&str> = present(env).into_iter().filter(|id| !ids.contains(id)).collect();
    for id in ids {
        delete(&script_path(env, id))?;
        delete(&nemo_path(env, id))?;
    }
    let _ = fs::remove_dir(script_dir(env));
    if keep.is_empty() || !exe.is_empty() {
        write_dolphin(env, &exe, &keep)?;
    }
    Ok(status_in(env))
}

pub fn status() -> Status {
    match Env::detect() {
        Ok(env) => status_in(&env),
        Err(reason) => super::spec::unsupported(&reason),
    }
}

pub fn install(ids: &[&str]) -> Result<Status, String> {
    install_in(&Env::detect()?, ids)
}

pub fn remove(ids: &[&str]) -> Result<Status, String> {
    remove_in(&Env::detect()?, ids)
}
