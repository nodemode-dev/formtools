use std::fs;
use std::path::PathBuf;

use super::spec::{label, plain_path, sh_quote, title, unsupported, xml_escape, Status, IDS};

pub struct Env {
    pub services: PathBuf,
    pub exe: PathBuf,
}

impl Env {
    pub fn detect() -> Result<Env, String> {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|home| home.is_absolute())
            .ok_or_else(|| "The home folder is not known.".to_string())?;
        let exe = std::env::current_exe().map_err(|e| format!("The formtools program path is not known: {e}."))?;
        Ok(Env { services: home.join("Library/Services"), exe })
    }
}

fn folder_name(id: &str) -> String {
    format!("formtools {}.workflow", label(id))
}

fn folder(env: &Env, id: &str) -> PathBuf {
    env.services.join(folder_name(id))
}

fn present(env: &Env) -> Vec<&'static str> {
    IDS.iter().copied().filter(|id| folder(env, id).join("Contents/Info.plist").is_file()).collect()
}

pub fn status_in(env: &Env) -> Status {
    Status {
        supported: true,
        installed: present(env).into_iter().map(String::from).collect(),
        place: "Finder Quick Actions (~/Library/Services/formtools *.workflow)".to_string(),
        reason: String::new(),
    }
}

pub fn info_plist(id: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>\n\t<key>NSServices</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>NSBackgroundColorName</key>\n\t\t\t<string>background</string>\n\t\t\t<key>NSIconName</key>\n\t\t\t<string>NSActionTemplate</string>\n\t\t\t<key>NSMenuItem</key>\n\t\t\t<dict>\n\t\t\t\t<key>default</key>\n\t\t\t\t<string>{}</string>\n\t\t\t</dict>\n\t\t\t<key>NSMessage</key>\n\t\t\t<string>runWorkflowAsService</string>\n\t\t\t<key>NSRequiredContext</key>\n\t\t\t<dict>\n\t\t\t\t<key>NSApplicationIdentifier</key>\n\t\t\t\t<string>com.apple.finder</string>\n\t\t\t</dict>\n\t\t\t<key>NSSendFileTypes</key>\n\t\t\t<array>\n\t\t\t\t<string>public.item</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n",
        xml_escape(title(id))
    )
}

fn uuid(kind: u8, id: &str) -> String {
    let n = IDS.iter().position(|known| *known == id).unwrap_or(0);
    format!("F0A17001-{kind:04X}-4000-8000-00000000000{n}")
}

pub fn document_wflow(exe: &str, id: &str) -> String {
    let command = format!("nohup {} --tool {id} \"$@\" >/dev/null 2>&1 &", sh_quote(exe));
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>\n\t<key>AMApplicationBuild</key>\n\t<string>523</string>\n\t<key>AMApplicationVersion</key>\n\t<string>2.10</string>\n\t<key>AMDocumentVersion</key>\n\t<string>2</string>\n\t<key>actions</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>action</key>\n\t\t\t<dict>\n\t\t\t\t<key>AMAccepts</key>\n\t\t\t\t<dict>\n\t\t\t\t\t<key>Container</key>\n\t\t\t\t\t<string>List</string>\n\t\t\t\t\t<key>Optional</key>\n\t\t\t\t\t<true/>\n\t\t\t\t\t<key>Types</key>\n\t\t\t\t\t<array>\n\t\t\t\t\t\t<string>com.apple.cocoa.string</string>\n\t\t\t\t\t</array>\n\t\t\t\t</dict>\n\t\t\t\t<key>AMActionVersion</key>\n\t\t\t\t<string>2.0.3</string>\n\t\t\t\t<key>AMApplication</key>\n\t\t\t\t<array>\n\t\t\t\t\t<string>Automator</string>\n\t\t\t\t</array>\n\t\t\t\t<key>AMParameterProperties</key>\n\t\t\t\t<dict>\n\t\t\t\t\t<key>COMMAND_STRING</key>\n\t\t\t\t\t<dict/>\n\t\t\t\t\t<key>CheckedForUserDefaultShell</key>\n\t\t\t\t\t<dict/>\n\t\t\t\t\t<key>inputMethod</key>\n\t\t\t\t\t<dict/>\n\t\t\t\t\t<key>shell</key>\n\t\t\t\t\t<dict/>\n\t\t\t\t\t<key>source</key>\n\t\t\t\t\t<dict/>\n\t\t\t\t</dict>\n\t\t\t\t<key>AMProvides</key>\n\t\t\t\t<dict>\n\t\t\t\t\t<key>Container</key>\n\t\t\t\t\t<string>List</string>\n\t\t\t\t\t<key>Types</key>\n\t\t\t\t\t<array>\n\t\t\t\t\t\t<string>com.apple.cocoa.string</string>\n\t\t\t\t\t</array>\n\t\t\t\t</dict>\n\t\t\t\t<key>ActionBundlePath</key>\n\t\t\t\t<string>/System/Library/Automator/Run Shell Script.action</string>\n\t\t\t\t<key>ActionName</key>\n\t\t\t\t<string>Run Shell Script</string>\n\t\t\t\t<key>ActionParameters</key>\n\t\t\t\t<dict>\n\t\t\t\t\t<key>COMMAND_STRING</key>\n\t\t\t\t\t<string>{}</string>\n\t\t\t\t\t<key>CheckedForUserDefaultShell</key>\n\t\t\t\t\t<true/>\n\t\t\t\t\t<key>inputMethod</key>\n\t\t\t\t\t<integer>1</integer>\n\t\t\t\t\t<key>shell</key>\n\t\t\t\t\t<string>/bin/zsh</string>\n\t\t\t\t\t<key>source</key>\n\t\t\t\t\t<string></string>\n\t\t\t\t</dict>\n\t\t\t\t<key>BundleIdentifier</key>\n\t\t\t\t<string>com.apple.RunShellScript</string>\n\t\t\t\t<key>CFBundleVersion</key>\n\t\t\t\t<string>2.0.3</string>\n\t\t\t\t<key>CanShowSelectedItemsWhenRun</key>\n\t\t\t\t<false/>\n\t\t\t\t<key>CanShowWhenRun</key>\n\t\t\t\t<true/>\n\t\t\t\t<key>Category</key>\n\t\t\t\t<array>\n\t\t\t\t\t<string>AMCategoryUtilities</string>\n\t\t\t\t</array>\n\t\t\t\t<key>Class Name</key>\n\t\t\t\t<string>RunShellScriptAction</string>\n\t\t\t\t<key>InputUUID</key>\n\t\t\t\t<string>{}</string>\n\t\t\t\t<key>Keywords</key>\n\t\t\t\t<array>\n\t\t\t\t\t<string>Shell</string>\n\t\t\t\t\t<string>Script</string>\n\t\t\t\t\t<string>Command</string>\n\t\t\t\t\t<string>Run</string>\n\t\t\t\t\t<string>Unix</string>\n\t\t\t\t</array>\n\t\t\t\t<key>OutputUUID</key>\n\t\t\t\t<string>{}</string>\n\t\t\t\t<key>UUID</key>\n\t\t\t\t<string>{}</string>\n\t\t\t\t<key>UnlocalizedApplications</key>\n\t\t\t\t<array>\n\t\t\t\t\t<string>Automator</string>\n\t\t\t\t</array>\n\t\t\t\t<key>arguments</key>\n\t\t\t\t<dict/>\n\t\t\t\t<key>isViewVisible</key>\n\t\t\t\t<true/>\n\t\t\t\t<key>location</key>\n\t\t\t\t<string>309.000000:253.000000</string>\n\t\t\t\t<key>nibPath</key>\n\t\t\t\t<string>/System/Library/Automator/Run Shell Script.action/Contents/Resources/Base.lproj/main.nib</string>\n\t\t\t</dict>\n\t\t\t<key>isViewVisible</key>\n\t\t\t<true/>\n\t\t</dict>\n\t</array>\n\t<key>connectors</key>\n\t<dict/>\n\t<key>workflowMetaData</key>\n\t<dict>\n\t\t<key>applicationBundleIDsByPath</key>\n\t\t<dict/>\n\t\t<key>applicationPaths</key>\n\t\t<array/>\n\t\t<key>inputTypeIdentifier</key>\n\t\t<string>com.apple.Automator.fileSystemObject</string>\n\t\t<key>outputTypeIdentifier</key>\n\t\t<string>com.apple.Automator.nothing</string>\n\t\t<key>presentationMode</key>\n\t\t<integer>15</integer>\n\t\t<key>processesInput</key>\n\t\t<integer>0</integer>\n\t\t<key>serviceApplicationBundleID</key>\n\t\t<string>com.apple.finder</string>\n\t\t<key>serviceApplicationPath</key>\n\t\t<string>/System/Library/CoreServices/Finder.app</string>\n\t\t<key>serviceInputTypeIdentifier</key>\n\t\t<string>com.apple.Automator.fileSystemObject</string>\n\t\t<key>serviceOutputTypeIdentifier</key>\n\t\t<string>com.apple.Automator.nothing</string>\n\t\t<key>serviceProcessesInput</key>\n\t\t<integer>0</integer>\n\t\t<key>systemImageName</key>\n\t\t<string>NSActionTemplate</string>\n\t\t<key>useAutomaticInputType</key>\n\t\t<integer>0</integer>\n\t\t<key>workflowTypeIdentifier</key>\n\t\t<string>com.apple.Automator.servicesMenu</string>\n\t</dict>\n</dict>\n</plist>\n",
        xml_escape(&command),
        uuid(1, id),
        uuid(2, id),
        uuid(3, id)
    )
}

fn write(path: &std::path::Path, text: &str) -> Result<(), String> {
    fs::write(path, text).map_err(|e| format!("Could not write {}: {e}.", path.display()))
}

pub fn install_in(env: &Env, ids: &[&str]) -> Result<Status, String> {
    if ids.is_empty() {
        return Err("Choose at least one menu entry.".to_string());
    }
    let exe = plain_path(&env.exe)?;
    for id in ids {
        let contents = folder(env, id).join("Contents");
        fs::create_dir_all(&contents).map_err(|e| format!("Could not create {}: {e}.", contents.display()))?;
        write(&contents.join("Info.plist"), &info_plist(id))?;
        write(&contents.join("document.wflow"), &document_wflow(&exe, id))?;
    }
    Ok(status_in(env))
}

pub fn remove_in(env: &Env, ids: &[&str]) -> Result<Status, String> {
    for id in ids {
        let path = folder(env, id);
        let Ok(meta) = fs::symlink_metadata(&path) else { continue };
        if meta.is_dir() && path.join("Contents/Info.plist").is_file() {
            fs::remove_dir_all(&path).map_err(|e| format!("Could not remove {}: {e}.", path.display()))?;
        }
    }
    Ok(status_in(env))
}

fn refresh() {
    let _ = std::process::Command::new("/System/Library/CoreServices/pbs")
        .arg("-flush")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

pub fn status() -> Status {
    match Env::detect() {
        Ok(env) => status_in(&env),
        Err(reason) => unsupported(&reason),
    }
}

pub fn install(ids: &[&str]) -> Result<Status, String> {
    let done = install_in(&Env::detect()?, ids);
    refresh();
    done
}

pub fn remove(ids: &[&str]) -> Result<Status, String> {
    let done = remove_in(&Env::detect()?, ids);
    refresh();
    done
}
