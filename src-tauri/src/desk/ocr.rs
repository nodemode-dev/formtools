use std::io::Cursor;
use std::path::Path;

use image::{DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};

use super::caps::Ocr;

#[derive(Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize)]
pub struct Text {
    pub text: String,
    pub engine: &'static str,
}

#[cfg(target_os = "linux")]
pub fn engine() -> Ocr {
    let Some(program) = super::caps::which("tesseract") else {
        return Ocr { engine: None, languages: Vec::new() };
    };
    let output = std::process::Command::new(program).arg("--list-langs").output();
    let languages = output
        .ok()
        .map(|out| {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .skip(1)
                .map(|line| line.trim().to_string())
                .filter(|line| !line.is_empty() && line != "osd")
                .collect()
        })
        .unwrap_or_default();
    Ocr { engine: Some("tesseract"), languages }
}

#[cfg(target_os = "macos")]
pub fn engine() -> Ocr {
    Ocr { engine: Some("vision"), languages: vision::languages() }
}

#[cfg(windows)]
pub fn engine() -> Ocr {
    Ocr { engine: Some("windows"), languages: winocr::languages() }
}

fn crop(path: &Path, rect: &Rect) -> Result<DynamicImage, String> {
    let allowed = super::base().canonicalize().map_err(|_| "No capture is open.".to_string())?;
    let real = path.canonicalize().map_err(|_| "The capture file is gone.".to_string())?;
    if !real.starts_with(&allowed) {
        return Err("That file is not a capture.".to_string());
    }
    let image = image::open(&real).map_err(|err| format!("The capture could not be read: {err}"))?;
    let left = rect.x.round().max(0.0) as u32;
    let top = rect.y.round().max(0.0) as u32;
    if left >= image.width() || top >= image.height() {
        return Err("Select a region on the screen.".to_string());
    }
    let width = (rect.w.round().max(0.0) as u32).min(image.width() - left);
    let height = (rect.h.round().max(0.0) as u32).min(image.height() - top);
    if width < 4 || height < 4 {
        return Err("Select a larger region.".to_string());
    }
    Ok(image.crop_imm(left, top, width, height))
}

fn png_bytes(image: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut bytes = Cursor::new(Vec::new());
    image.write_to(&mut bytes, ImageFormat::Png).map_err(|err| format!("The region could not be encoded: {err}"))?;
    Ok(bytes.into_inner())
}

fn tidy(text: &str) -> String {
    let lines: Vec<&str> = text.lines().map(|line| line.trim_end()).collect();
    lines.join("\n").trim().to_string()
}

pub fn run(path: &Path, rect: &Rect, lang: Option<&str>) -> Result<Text, String> {
    let region = crop(path, rect)?;
    let lang = lang.map(str::trim).filter(|value| !value.is_empty());
    recognise(&region, lang)
}

#[cfg(target_os = "linux")]
fn recognise(region: &DynamicImage, lang: Option<&str>) -> Result<Text, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let program = super::caps::which("tesseract").ok_or_else(|| "Install the tesseract package to extract text.".to_string())?;
    let factor = if region.height() < 40 {
        3
    } else if region.height() < 100 {
        2
    } else {
        1
    };
    let prepared = if factor > 1 {
        region.resize(region.width() * factor, region.height() * factor, image::imageops::FilterType::Lanczos3)
    } else {
        region.clone()
    };
    let bytes = png_bytes(&prepared)?;
    let mut command = Command::new(program);
    command.args(["stdin", "stdout", "--psm", "6"]);
    if let Some(lang) = lang {
        if lang.is_empty() || !lang.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '+') {
            return Err("That language code is not valid.".to_string());
        }
        command.args(["-l", lang]);
    }
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("tesseract could not be started: {err}"))?;
    let mut stdin = child.stdin.take().ok_or_else(|| "tesseract did not accept the image.".to_string())?;
    let writer = std::thread::spawn(move || stdin.write_all(&bytes));
    let output = child.wait_with_output().map_err(|err| format!("tesseract stopped: {err}"))?;
    let _ = writer.join();
    if !output.status.success() {
        let note = String::from_utf8_lossy(&output.stderr);
        let first = note.lines().find(|line| !line.trim().is_empty()).unwrap_or("it failed");
        return Err(format!("tesseract could not read the region: {}", first.trim()));
    }
    Ok(Text { text: tidy(&String::from_utf8_lossy(&output.stdout)), engine: "tesseract" })
}

#[cfg(windows)]
fn recognise(region: &DynamicImage, lang: Option<&str>) -> Result<Text, String> {
    let bytes = png_bytes(region)?;
    let lang = lang.map(str::to_string);
    let worker = std::thread::spawn(move || winocr::recognise(&bytes, lang.as_deref()));
    let text = worker.join().map_err(|_| "Text recognition stopped unexpectedly.".to_string())??;
    Ok(Text { text: tidy(&text), engine: "windows" })
}

#[cfg(target_os = "macos")]
fn recognise(region: &DynamicImage, lang: Option<&str>) -> Result<Text, String> {
    let bytes = png_bytes(region)?;
    let text = vision::recognise(&bytes, lang)?;
    Ok(Text { text: tidy(&text), engine: "vision" })
}

#[cfg(windows)]
mod winocr {
    use windows::Globalization::Language;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
    use windows::core::HSTRING;

    fn fail(err: windows::core::Error) -> String {
        format!("Windows text recognition failed: {}", err.message())
    }

    pub fn languages() -> Vec<String> {
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let Ok(list) = OcrEngine::AvailableRecognizerLanguages() else { return Vec::new() };
        list.into_iter()
            .filter_map(|language| language.LanguageTag().ok())
            .map(|tag| tag.to_string())
            .collect()
    }

    pub fn recognise(bytes: &[u8], lang: Option<&str>) -> Result<String, String> {
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let stream = InMemoryRandomAccessStream::new().map_err(fail)?;
        let writer = DataWriter::CreateDataWriter(&stream).map_err(fail)?;
        writer.WriteBytes(bytes).map_err(fail)?;
        writer.StoreAsync().map_err(fail)?.join().map_err(fail)?;
        writer.DetachStream().map_err(fail)?;
        stream.Seek(0).map_err(fail)?;
        let decoder = BitmapDecoder::CreateAsync(&stream).map_err(fail)?.join().map_err(fail)?;
        let bitmap = decoder.GetSoftwareBitmapAsync().map_err(fail)?.join().map_err(fail)?;
        let engine = match lang {
            Some(tag) => {
                let language = Language::CreateLanguage(&HSTRING::from(tag)).map_err(fail)?;
                OcrEngine::TryCreateFromLanguage(&language).map_err(fail)?
            }
            None => OcrEngine::TryCreateFromUserProfileLanguages().map_err(fail)?,
        };
        let result = engine.RecognizeAsync(&bitmap).map_err(fail)?.join().map_err(fail)?;
        let lines = result.Lines().map_err(fail)?;
        let mut out = Vec::new();
        for line in lines {
            out.push(line.Text().map_err(fail)?.to_string());
        }
        Ok(out.join("\n"))
    }
}

#[cfg(target_os = "macos")]
mod vision {
    use objc2::rc::Retained;
    use objc2::AnyThread;
    use objc2_foundation::{NSArray, NSData, NSDictionary, NSString};
    use objc2_vision::{VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel};

    pub fn languages() -> Vec<String> {
        let request = VNRecognizeTextRequest::new();
        unsafe { request.supportedRecognitionLanguagesAndReturnError() }
            .map(|list| list.iter().map(|item| item.to_string()).collect())
            .unwrap_or_default()
    }

    pub fn recognise(bytes: &[u8], lang: Option<&str>) -> Result<String, String> {
        let data = NSData::with_bytes(bytes);
        let options = NSDictionary::new();
        let handler = VNImageRequestHandler::initWithData_options(VNImageRequestHandler::alloc(), &data, &options);
        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        request.setUsesLanguageCorrection(true);
        if let Some(lang) = lang {
            let tag = NSString::from_str(lang);
            request.setRecognitionLanguages(&NSArray::from_slice(&[&*tag]));
        }
        let base: Retained<VNRequest> = Retained::into_super(Retained::into_super(request.clone()));
        handler
            .performRequests_error(&NSArray::from_slice(&[&*base]))
            .map_err(|err| format!("Vision could not read the region: {}", err.localizedDescription()))?;
        let mut rows: Vec<(f64, String)> = Vec::new();
        if let Some(found) = request.results() {
            for observation in found.iter() {
                let candidates = observation.topCandidates(1);
                if let Some(best) = candidates.iter().next() {
                    let top = unsafe { observation.boundingBox() }.origin.y + unsafe { observation.boundingBox() }.size.height;
                    rows.push((top, best.string().to_string()));
                }
            }
        }
        rows.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        Ok(rows.into_iter().map(|row| row.1).collect::<Vec<_>>().join("\n"))
    }
}
