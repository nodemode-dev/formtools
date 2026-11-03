use super::spec::{unsupported, Status};

const REASON: &str = "Context menu entries are not available on this operating system.";

pub fn status() -> Status {
    unsupported(REASON)
}

pub fn install(_ids: &[&str]) -> Result<Status, String> {
    Err(REASON.to_string())
}

pub fn remove(_ids: &[&str]) -> Result<Status, String> {
    Err(REASON.to_string())
}
