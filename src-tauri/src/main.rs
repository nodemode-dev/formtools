#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_dialog::DialogExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

mod desk;
mod files;
mod packaged;
mod reveal;
mod text_edit;
mod traffic_lights;
mod window_state;

const FALLBACK_SIZE: (f64, f64) = (1280.0, 820.0);
const MIN_SIZE: (f64, f64) = (980.0, 640.0);
const SCREEN_FRACTION: f64 = 0.9;
const DEV_ENGINE: &str = "http://127.0.0.1:8240";
const OPEN_EVENT: &str = "open-paths";

struct Backend(Mutex<Option<Child>>);

#[derive(Default)]
struct Opens {
    ready: bool,
    paths: Vec<String>,
}

struct OpenQueue(Mutex<Opens>);

fn dev_engine_url() -> Option<String> {
    if !cfg!(debug_assertions) {
        return None;
    }
    let value = std::env::var("FORMTOOLS_DEV_URL").ok()?;
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    if value.starts_with("http://127.0.0.1:") || value.starts_with("http://localhost:") {
        Some(value.trim_end_matches('/').to_string())
    } else {
        Some(DEV_ENGINE.to_string())
    }
}

fn kill_backend(handle: &tauri::AppHandle) {
    let state = handle.state::<Backend>();
    let child = state.0.lock().ok().and_then(|mut slot| slot.take());
    if let Some(mut child) = child {
        #[cfg(unix)]
        {
            let pid = child.id().to_string();
            let signal = |sig: &str| {
                std::process::Command::new("kill")
                    .args([sig, pid.as_str()])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status()
                    .is_ok_and(|s| s.success())
            };
            if signal("-TERM") {
                for _ in 0..30 {
                    std::thread::sleep(Duration::from_millis(50));
                    if matches!(child.try_wait(), Ok(Some(_))) {
                        return;
                    }
                }
            }
        }
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn close_splash(handle: &tauri::AppHandle) {
    if let Some(splash) = handle.get_webview_window("splash") {
        let _ = splash.close();
    }
}

fn show_main_window(handle: &tauri::AppHandle) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_paths(handle: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let send = match handle.state::<OpenQueue>().0.lock() {
        Ok(mut opens) => {
            if opens.ready {
                Some(paths)
            } else {
                opens.paths.extend(paths);
                None
            }
        }
        Err(_) => None,
    };
    if let Some(paths) = send {
        let _ = handle.emit(OPEN_EVENT, paths);
        show_main_window(handle);
    }
}

fn page_loaded(handle: &tauri::AppHandle) {
    let handle = handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(800));
        let paths = match handle.state::<OpenQueue>().0.lock() {
            Ok(mut opens) => {
                opens.ready = true;
                std::mem::take(&mut opens.paths)
            }
            Err(_) => return,
        };
        if !paths.is_empty() {
            let _ = handle.emit(OPEN_EVENT, paths);
        }
    });
}

fn paths_from_args(args: &[String], cwd: Option<&str>) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| {
            let path = std::path::PathBuf::from(arg);
            let full = match cwd {
                Some(dir) if path.is_relative() => std::path::Path::new(dir).join(path),
                _ => path,
            };
            full.exists().then(|| full.to_string_lossy().into_owned())
        })
        .collect()
}

fn forward_lines<R: std::io::Read + Send + 'static>(stream: R, tx: tauri::async_runtime::Sender<String>) {
    std::thread::spawn(move || {
        for line in BufReader::new(stream).split(b'\n') {
            let Ok(bytes) = line else { break };
            let _ = tx.blocking_send(String::from_utf8_lossy(&bytes).into_owned());
        }
    });
}

fn start_engine(program: &std::path::Path) -> std::io::Result<(Child, tauri::async_runtime::Receiver<String>)> {
    let mut command = Command::new(program);
    command
        .env("FORMTOOLS_PORT", "0")
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(folder) = program.parent() {
        command.current_dir(folder);
    }
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = command.spawn()?;
    let (tx, rx) = tauri::async_runtime::channel::<String>(64);
    if let Some(stdout) = child.stdout.take() {
        forward_lines(stdout, tx.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        forward_lines(stderr, tx);
    }
    Ok((child, rx))
}

async fn read_port(mut rx: tauri::async_runtime::Receiver<String>) -> Option<u16> {
    let pattern = regex::Regex::new(r"http://127\.0\.0\.1:(\d+)").unwrap();
    while let Some(text) = rx.recv().await {
        if let Some(port) = pattern.captures(&text).and_then(|found| found[1].parse::<u16>().ok()) {
            tauri::async_runtime::spawn(async move { while rx.recv().await.is_some() {} });
            return Some(port);
        }
    }
    None
}

fn open_main(handle: &tauri::AppHandle, url: &str) -> bool {
    let Ok(parsed) = url.parse() else { return false };
    let place = window_state::load(handle);
    let (width, height) = if place.width > 0.0 {
        (place.width, place.height)
    } else {
        handle
            .primary_monitor()
            .ok()
            .flatten()
            .map(|monitor| {
                let logical = monitor.size().to_logical::<f64>(monitor.scale_factor());
                (logical.width * SCREEN_FRACTION, logical.height * SCREEN_FRACTION)
            })
            .unwrap_or(FALLBACK_SIZE)
    };
    let builder = WebviewWindowBuilder::new(handle, "main", WebviewUrl::External(parsed))
        .title("formtools")
        .visible(reveal::BUILD_VISIBLE)
        .background_color(reveal::BACKGROUND)
        .inner_size(width, height)
        .min_inner_size(MIN_SIZE.0, MIN_SIZE.1);
    let builder = if place.width > 0.0 {
        builder.position(place.x, place.y)
    } else {
        builder.center()
    };
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true);
    let builder = builder.on_page_load(|window, payload| {
        if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
            traffic_lights::place(&window.as_ref().window());
            page_loaded(window.app_handle());
        }
    });
    match builder.build() {
        Ok(window) => {
            reveal::conceal(&window);
            traffic_lights::place(&window.as_ref().window());
            window_state::restore(&window, &place);
            true
        }
        Err(_) => false,
    }
}

fn engine_failed(handle: &tauri::AppHandle) {
    close_splash(handle);
    let _ = handle
        .dialog()
        .message("The formtools engine failed to start. Please relaunch the app.")
        .blocking_show();
    kill_backend(handle);
    handle.exit(1);
}

fn single_instance() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_single_instance::Builder::<tauri::Wry>::new()
        .callback(|app, args, cwd| {
            open_paths(app, paths_from_args(&args, Some(&cwd)));
            show_main_window(app);
        })
        .build()
}

fn main() {
    reveal::mark_launch();
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder.on_web_content_process_terminate(window_state::on_renderer_stopped);
    let app = builder
        .plugin(single_instance())
        .manage(OpenQueue(Mutex::new(Opens::default())))
        .manage(window_state::Memory::default())
        .manage(Backend(Mutex::new(None)))
        .manage(desk::Desk::default())
        .on_window_event(|window, event| {
            window_state::track(window, event);
            if window.label() == "main"
                && matches!(
                    event,
                    WindowEvent::Resized(_) | WindowEvent::Focused(_) | WindowEvent::ThemeChanged(_) | WindowEvent::ScaleFactorChanged { .. }
                )
            {
                traffic_lights::place(window);
            }
        })
        .invoke_handler(tauri::generate_handler![
            reveal::app_ready,
            text_edit::text_edit,
            files::pick_folder,
            files::pick_files,
            files::reveal_in_folder,
            files::open_with_default,
            desk::desk_capabilities,
            desk::desk_start,
            desk::desk_close,
            desk::desk_ocr,
            desk::desk_awake_get,
            desk::desk_awake_set,
            desk::desk_topmost_toggle,
            desk::desk_shortcuts_set
        ])
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            reveal::round_splash(&handle);
            let launch_args: Vec<String> = std::env::args().collect();
            open_paths(&handle, paths_from_args(&launch_args, None));

            if let Some(url) = dev_engine_url() {
                tauri::async_runtime::spawn(async move {
                    if !open_main(&handle, &url) {
                        engine_failed(&handle);
                    }
                });
                return Ok(());
            }

            let spawned = packaged::engine_program(&handle)
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "engine not found"))
                .and_then(|program| start_engine(&program));
            tauri::async_runtime::spawn(async move {
                let port = match spawned {
                    Ok((child, rx)) => {
                        if let Ok(mut slot) = handle.state::<Backend>().0.lock() {
                            *slot = Some(child);
                        }
                        read_port(rx).await
                    }
                    Err(_) => None,
                };
                let opened = match port {
                    Some(port) => open_main(&handle, &format!("http://127.0.0.1:{port}")),
                    None => false,
                };
                if !opened {
                    engine_failed(&handle);
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the formtools app");

    app.run(|handle, event| match event {
        RunEvent::Exit => {
            window_state::flush(handle);
            desk::shutdown(handle);
            kill_backend(handle);
        }
        #[cfg(target_os = "macos")]
        RunEvent::Opened { urls } => {
            let paths = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            open_paths(handle, paths);
            show_main_window(handle);
        }
        _ => {}
    });
}
