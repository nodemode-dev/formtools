use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

const MAX_MINUTES: u64 = 24 * 60;

#[derive(Deserialize)]
pub struct Request {
    pub mode: String,
    pub minutes: Option<f64>,
    #[serde(default)]
    pub display: bool,
}

#[derive(Serialize, Clone)]
pub struct State {
    pub mode: &'static str,
    pub display: bool,
    pub until: Option<u64>,
}

struct Hold {
    mode: &'static str,
    display: bool,
    until: Option<u64>,
    generation: u64,
    keeper: Option<Keeper>,
}

#[derive(Clone)]
pub struct Awake {
    hold: Arc<Mutex<Hold>>,
}

impl Default for Awake {
    fn default() -> Self {
        Awake { hold: Arc::new(Mutex::new(Hold { mode: "off", display: false, until: None, generation: 0, keeper: None })) }
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

impl Awake {
    pub fn get(&self) -> State {
        let mut hold = self.hold.lock().unwrap_or_else(|e| e.into_inner());
        if hold.until.is_some_and(|until| until <= now_ms()) {
            clear(&mut hold);
        }
        State { mode: hold.mode, display: hold.display, until: hold.until }
    }

    pub fn release(&self) {
        let mut hold = self.hold.lock().unwrap_or_else(|e| e.into_inner());
        clear(&mut hold);
    }

    pub fn set(&self, req: Request) -> Result<State, String> {
        let mode = req.mode.as_str();
        if !matches!(mode, "off" | "on" | "timed") {
            return Err("The awake mode must be off, on or timed.".to_string());
        }
        let minutes = match mode {
            "timed" => {
                let value = req.minutes.filter(|m| m.is_finite() && *m >= 1.0).ok_or_else(|| "Give a number of minutes for the timed mode.".to_string())?;
                Some((value.round() as u64).min(MAX_MINUTES))
            }
            _ => None,
        };
        let mut hold = self.hold.lock().unwrap_or_else(|e| e.into_inner());
        clear(&mut hold);
        if mode == "off" {
            return Ok(State { mode: "off", display: false, until: None });
        }
        let keeper = Keeper::start(req.display)?;
        hold.generation += 1;
        hold.keeper = Some(keeper);
        hold.display = req.display;
        hold.mode = if minutes.is_some() { "timed" } else { "on" };
        hold.until = minutes.map(|m| now_ms() + m * 60_000);
        let generation = hold.generation;
        let until = hold.until;
        let state = State { mode: hold.mode, display: hold.display, until };
        drop(hold);
        if let Some(until) = until {
            let shared = self.hold.clone();
            std::thread::spawn(move || {
                loop {
                    let now = now_ms();
                    if now >= until {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis((until - now).min(1000)));
                    let live = shared.lock().unwrap_or_else(|e| e.into_inner()).generation == generation;
                    if !live {
                        return;
                    }
                }
                let mut hold = shared.lock().unwrap_or_else(|e| e.into_inner());
                if hold.generation == generation {
                    clear(&mut hold);
                }
            });
        }
        Ok(state)
    }
}

fn clear(hold: &mut Hold) {
    hold.generation += 1;
    hold.keeper = None;
    hold.mode = "off";
    hold.display = false;
    hold.until = None;
}

#[cfg(windows)]
pub struct Keeper {
    stop: std::sync::mpsc::Sender<()>,
}

#[cfg(windows)]
impl Keeper {
    fn start(display: bool) -> Result<Keeper, String> {
        use windows::Win32::System::Power::{SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED};

        let (stop, wait) = std::sync::mpsc::channel::<()>();
        let (ready, started) = std::sync::mpsc::channel::<bool>();
        std::thread::spawn(move || {
            let mut flags = ES_CONTINUOUS | ES_SYSTEM_REQUIRED;
            if display {
                flags |= ES_DISPLAY_REQUIRED;
            }
            let ok = unsafe { SetThreadExecutionState(flags) }.0 != 0;
            let _ = ready.send(ok);
            if ok {
                let _ = wait.recv();
                unsafe { SetThreadExecutionState(ES_CONTINUOUS) };
            }
        });
        match started.recv() {
            Ok(true) => Ok(Keeper { stop }),
            _ => Err("Windows refused the request to stay awake.".to_string()),
        }
    }
}

#[cfg(windows)]
impl Drop for Keeper {
    fn drop(&mut self) {
        let _ = self.stop.send(());
    }
}

#[cfg(target_os = "macos")]
pub struct Keeper {
    ids: Vec<u32>,
}

#[cfg(target_os = "macos")]
mod iokit {
    use std::ffi::{c_char, c_void, CStr};

    #[link(name = "IOKit", kind = "framework")]
    extern "C" {
        pub fn IOPMAssertionCreateWithName(kind: *const c_void, level: u32, name: *const c_void, id: *mut u32) -> i32;
        pub fn IOPMAssertionRelease(id: u32) -> i32;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFStringCreateWithCString(alloc: *const c_void, text: *const c_char, encoding: u32) -> *const c_void;
        fn CFRelease(value: *const c_void);
    }

    pub fn create(kind: &CStr, name: &CStr) -> Option<u32> {
        const UTF8: u32 = 0x0800_0100;
        const LEVEL_ON: u32 = 255;
        unsafe {
            let kind = CFStringCreateWithCString(std::ptr::null(), kind.as_ptr(), UTF8);
            let name = CFStringCreateWithCString(std::ptr::null(), name.as_ptr(), UTF8);
            let mut id = 0u32;
            let status = IOPMAssertionCreateWithName(kind, LEVEL_ON, name, &mut id);
            CFRelease(kind);
            CFRelease(name);
            (status == 0).then_some(id)
        }
    }
}

#[cfg(target_os = "macos")]
impl Keeper {
    fn start(display: bool) -> Result<Keeper, String> {
        let reason = c"formtools is keeping the Mac awake";
        let mut ids = Vec::new();
        let system = iokit::create(c"PreventUserIdleSystemSleep", reason);
        ids.extend(system);
        if display {
            ids.extend(iokit::create(c"PreventUserIdleDisplaySleep", reason));
        }
        if ids.is_empty() || (display && ids.len() < 2) {
            for id in ids {
                unsafe { iokit::IOPMAssertionRelease(id) };
            }
            return Err("macOS refused the request to stay awake.".to_string());
        }
        Ok(Keeper { ids })
    }
}

#[cfg(target_os = "macos")]
impl Drop for Keeper {
    fn drop(&mut self) {
        for id in self.ids.drain(..) {
            unsafe { iokit::IOPMAssertionRelease(id) };
        }
    }
}

#[cfg(target_os = "linux")]
pub struct Keeper {
    child: std::process::Child,
}

#[cfg(target_os = "linux")]
impl Keeper {
    fn start(display: bool) -> Result<Keeper, String> {
        use std::process::{Command, Stdio};

        let program = super::caps::which("systemd-inhibit").ok_or_else(|| "systemd-inhibit is not installed.".to_string())?;
        let what = if display { "idle:sleep" } else { "sleep" };
        let child = Command::new(program)
            .args(["--what", what, "--who", "formtools", "--why", "Keeping the system awake", "--mode", "block"])
            .args(["sh", "-c", "p=$PPID; while kill -0 \"$1\" 2>/dev/null && kill -0 \"$p\" 2>/dev/null; do sleep 2; done"])
            .arg("sh")
            .arg(std::process::id().to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| format!("The inhibitor could not be started: {err}"))?;
        let mut keeper = Keeper { child };
        std::thread::sleep(Duration::from_millis(250));
        if let Ok(Some(_)) = keeper.child.try_wait() {
            let mut note = String::new();
            if let Some(mut stderr) = keeper.child.stderr.take() {
                let _ = std::io::Read::read_to_string(&mut stderr, &mut note);
            }
            let first = note.lines().find(|line| !line.trim().is_empty()).unwrap_or("it exited at once").trim().to_string();
            return Err(format!("The system refused the request to stay awake: {first}"));
        }
        keeper.child.stderr.take();
        Ok(keeper)
    }
}

#[cfg(target_os = "linux")]
impl Drop for Keeper {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
