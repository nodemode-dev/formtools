use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ExtendedColorType, ImageEncoder};

pub struct Raw {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub path: PathBuf,
}

pub fn write_png(path: &Path, rgb: &[u8], width: u32, height: u32) -> Result<(), String> {
    let file = File::create(path).map_err(|err| format!("The capture file could not be written: {err}"))?;
    PngEncoder::new_with_quality(BufWriter::new(file), CompressionType::Fast, FilterType::Adaptive)
        .write_image(rgb, width, height, ExtendedColorType::Rgb8)
        .map_err(|err| format!("The capture could not be encoded: {err}"))
}

#[cfg(target_os = "linux")]
pub fn all(dir: &Path) -> Result<Vec<Raw>, String> {
    use x11rb::connection::Connection;
    use x11rb::protocol::randr::ConnectionExt as _;
    use x11rb::protocol::xproto::{ConnectionExt as _, ImageFormat, ImageOrder};

    let (conn, screen_num) = x11rb::connect(None).map_err(|_| "The X11 display cannot be reached.".to_string())?;
    let setup = conn.setup();
    let screen = &setup.roots[screen_num];
    let mut regions: Vec<(i16, i16, u16, u16)> = conn
        .randr_get_monitors(screen.root, true)
        .ok()
        .and_then(|cookie| cookie.reply().ok())
        .map(|reply| reply.monitors.iter().map(|m| (m.x, m.y, m.width, m.height)).collect())
        .unwrap_or_default();
    regions.retain(|region| region.2 > 0 && region.3 > 0);
    if regions.is_empty() {
        regions.push((0, 0, screen.width_in_pixels, screen.height_in_pixels));
    }
    let little = setup.image_byte_order == ImageOrder::LSB_FIRST;
    let mut shots = Vec::new();
    for (index, (x, y, w, h)) in regions.into_iter().enumerate() {
        let reply = conn
            .get_image(ImageFormat::Z_PIXMAP, screen.root, x, y, w, h, !0)
            .map_err(|err| format!("The screen could not be read: {err}"))?
            .reply()
            .map_err(|err| format!("The screen could not be read: {err}"))?;
        let format = setup
            .pixmap_formats
            .iter()
            .find(|format| format.depth == reply.depth)
            .ok_or_else(|| "The screen uses a pixel format that is not supported.".to_string())?;
        let bits = format.bits_per_pixel as usize;
        if bits != 32 && bits != 24 {
            return Err("The screen uses a pixel format that is not supported.".to_string());
        }
        let visual_id = if reply.visual != 0 { reply.visual } else { screen.root_visual };
        let visual = screen
            .allowed_depths
            .iter()
            .flat_map(|depth| depth.visuals.iter())
            .find(|visual| visual.visual_id == visual_id)
            .ok_or_else(|| "The screen uses a colour layout that is not supported.".to_string())?;
        let masks = [visual.red_mask, visual.green_mask, visual.blue_mask];
        if masks.iter().any(|mask| *mask == 0) {
            return Err("The screen uses a colour layout that is not supported.".to_string());
        }
        let pad = format.scanline_pad.max(8) as usize;
        let stride = (w as usize * bits).div_ceil(pad) * pad / 8;
        let step = bits / 8;
        let mut rgb = Vec::with_capacity(w as usize * h as usize * 3);
        for row in 0..h as usize {
            let line = reply
                .data
                .get(row * stride..row * stride + w as usize * step)
                .ok_or_else(|| "The screen data was shorter than expected.".to_string())?;
            for pixel in line.chunks_exact(step) {
                let mut value = 0u32;
                if little {
                    for (shift, byte) in pixel.iter().enumerate() {
                        value |= (*byte as u32) << (8 * shift);
                    }
                } else {
                    for byte in pixel {
                        value = (value << 8) | *byte as u32;
                    }
                }
                for mask in masks {
                    let low = mask.trailing_zeros();
                    let top = (mask >> low).max(1);
                    rgb.push((((value & mask) >> low) * 255 / top) as u8);
                }
            }
        }
        let path = dir.join(format!("monitor-{index}.png"));
        write_png(&path, &rgb, w as u32, h as u32)?;
        shots.push(Raw { x: x as i32, y: y as i32, w: w as u32, h: h as u32, path });
    }
    Ok(shots)
}

#[cfg(any(windows, target_os = "macos"))]
pub fn all(dir: &Path) -> Result<Vec<Raw>, String> {
    let monitors = xcap::Monitor::all().map_err(|err| format!("The screens could not be listed: {err}"))?;
    let mut shots = Vec::new();
    for (index, monitor) in monitors.iter().enumerate() {
        let image = monitor.capture_image().map_err(|err| format!("The screen could not be captured: {err}"))?;
        let scale = if cfg!(target_os = "macos") { monitor.scale_factor().unwrap_or(1.0) as f64 } else { 1.0 };
        let x = (monitor.x().unwrap_or(0) as f64 * scale).round() as i32;
        let y = (monitor.y().unwrap_or(0) as f64 * scale).round() as i32;
        let (w, h) = (image.width(), image.height());
        let rgb = image::DynamicImage::ImageRgba8(image).into_rgb8();
        let path = dir.join(format!("monitor-{index}.png"));
        write_png(&path, rgb.as_raw(), w, h)?;
        shots.push(Raw { x, y, w, h, path });
    }
    if shots.is_empty() {
        return Err("No screen was found to capture.".to_string());
    }
    Ok(shots)
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
pub fn permit() -> Result<(), String> {
    unsafe {
        if CGPreflightScreenCaptureAccess() {
            return Ok(());
        }
        CGRequestScreenCaptureAccess();
    }
    Err("Allow Screen Recording for formtools in System Settings, Privacy and Security, then try again.".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn permit() -> Result<(), String> {
    Ok(())
}
