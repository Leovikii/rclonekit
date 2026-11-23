use serde::Serialize;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub(super) use windows::{
    available_drives, install_components, mount_states, read_environment, require_unregistered,
};

#[derive(Serialize)]
pub(super) struct MountState {
    #[serde(flatten)]
    config: crate::mounts::MountConfig,
    mounted: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Environment {
    components: [Component; 3],
    available_drives: Vec<String>,
    install_candidates: Vec<&'static str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Installation {
    restart_required: bool,
}

#[derive(Serialize)]
struct Component {
    id: &'static str,
    status: Detection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum Detection {
    Detected,
    NotDetected,
    Unknown,
}

#[cfg(not(windows))]
pub(super) fn read_environment() -> Result<Environment, &'static str> {
    Err("unsupported_platform")
}

#[cfg(not(windows))]
pub(super) fn install_components() -> Result<Installation, &'static str> {
    Err("unsupported_platform")
}

#[cfg(not(windows))]
pub(super) fn available_drives() -> Result<Vec<String>, &'static str> {
    Err("unsupported_platform")
}

#[cfg(not(windows))]
pub(super) fn require_unregistered(_: uuid::Uuid) -> Result<(), &'static str> {
    Err("unsupported_platform")
}

#[cfg(not(windows))]
pub(super) fn mount_states(configs: Vec<crate::mounts::MountConfig>) -> Vec<MountState> {
    configs
        .into_iter()
        .map(|config| MountState {
            config,
            mounted: None,
        })
        .collect()
}
