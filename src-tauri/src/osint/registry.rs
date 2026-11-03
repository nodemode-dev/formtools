use std::path::PathBuf;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS, WIN32_ERROR};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteTreeW, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    KEY_WRITE, REG_OPTION_NON_VOLATILE, REG_SZ,
};

use super::spec::{plain_path, title, Status, IDS};

const ROOTS: [&str; 2] = [r"Software\Classes\*\shell", r"Software\Classes\Directory\shell"];

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn key_path(root: &str, id: &str) -> String {
    format!(r"{root}\formtools.{id}")
}

fn failed(what: &str, code: WIN32_ERROR) -> String {
    format!("Could not {what} (Windows error {}).", code.0)
}

fn set_text(key: HKEY, name: Option<&str>, value: &str) -> Result<(), String> {
    let name = name.map(wide);
    let name = name.as_ref().map_or(PCWSTR::null(), |text| PCWSTR(text.as_ptr()));
    let data = wide(value);
    let bytes = unsafe { std::slice::from_raw_parts(data.as_ptr() as *const u8, data.len() * 2) };
    let code = unsafe { RegSetValueExW(key, name, None, REG_SZ, Some(bytes)) };
    if code == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(failed("write a registry value", code))
    }
}

fn create(path: &str) -> Result<HKEY, String> {
    let path = wide(path);
    let mut key = HKEY::default();
    let code = unsafe {
        RegCreateKeyExW(HKEY_CURRENT_USER, PCWSTR(path.as_ptr()), None, PCWSTR::null(), REG_OPTION_NON_VOLATILE, KEY_WRITE, None, &mut key, None)
    };
    if code == ERROR_SUCCESS {
        Ok(key)
    } else {
        Err(failed("create a registry key", code))
    }
}

fn exists(path: &str) -> bool {
    let path = wide(path);
    let mut key = HKEY::default();
    let code = unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(path.as_ptr()), None, KEY_READ, &mut key) };
    if code == ERROR_SUCCESS {
        unsafe {
            let _ = RegCloseKey(key);
        }
        true
    } else {
        false
    }
}

fn write_entry(root: &str, id: &str, exe: &str) -> Result<(), String> {
    let base = key_path(root, id);
    let key = create(&base)?;
    let first = set_text(key, Some("MUIVerb"), title(id)).and_then(|_| set_text(key, Some("Icon"), &format!("\"{exe}\",0")));
    unsafe {
        let _ = RegCloseKey(key);
    }
    first?;
    let command = create(&format!(r"{base}\command"))?;
    let done = set_text(command, None, &format!("\"{exe}\" --tool {id} \"%1\""));
    unsafe {
        let _ = RegCloseKey(command);
    }
    done
}

fn delete_entry(root: &str, id: &str) -> Result<(), String> {
    let path = wide(&key_path(root, id));
    let code = unsafe { RegDeleteTreeW(HKEY_CURRENT_USER, PCWSTR(path.as_ptr())) };
    if code == ERROR_SUCCESS || code == ERROR_FILE_NOT_FOUND {
        Ok(())
    } else {
        Err(failed("remove a registry key", code))
    }
}

pub fn status() -> Status {
    Status {
        supported: true,
        installed: IDS
            .iter()
            .filter(|id| ROOTS.iter().any(|root| exists(&key_path(root, id))))
            .map(|id| id.to_string())
            .collect(),
        place: r"HKEY_CURRENT_USER\Software\Classes\*\shell and Directory\shell (keys named formtools.<id>)".to_string(),
        reason: String::new(),
    }
}

pub fn install(ids: &[&str]) -> Result<Status, String> {
    if ids.is_empty() {
        return Err("Choose at least one menu entry.".to_string());
    }
    let exe: PathBuf = std::env::current_exe().map_err(|e| format!("The formtools program path is not known: {e}."))?;
    let exe = plain_path(&exe)?;
    for id in ids {
        for root in ROOTS {
            write_entry(root, id, &exe)?;
        }
    }
    Ok(status())
}

pub fn remove(ids: &[&str]) -> Result<Status, String> {
    for id in ids {
        for root in ROOTS {
            delete_entry(root, id)?;
        }
    }
    Ok(status())
}
