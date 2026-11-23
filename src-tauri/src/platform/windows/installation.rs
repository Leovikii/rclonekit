use std::io;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};

use windows_sys::Win32::System::Threading::{CREATE_NEW_CONSOLE, CREATE_NO_WINDOW};

use crate::platform::{Detection, Installation};

const NO_APPLICATIONS_FOUND: u32 = 0x8A15_0014;
const REBOOT_REQUIRED: u32 = 0x8A15_0109;
const REBOOT_BEFORE_INSTALL: u32 = 0x8A15_010A;
const REBOOT_INITIATED: u32 = 0x8A15_010B;
const INSTALL_CANCELLED: u32 = 0x8A15_010C;

#[derive(Clone, Copy)]
pub(super) enum Package {
    Rclone,
    WinFsp,
}

pub(super) const PACKAGES: [Package; 2] = [Package::Rclone, Package::WinFsp];

impl Package {
    pub(super) fn component(self) -> &'static str {
        match self {
            Self::Rclone => "rclone",
            Self::WinFsp => "winfsp",
        }
    }

    fn id(self) -> &'static str {
        match self {
            Self::Rclone => "Rclone.Rclone",
            Self::WinFsp => "WinFsp.WinFsp",
        }
    }

    fn install_error(self) -> &'static str {
        match self {
            Self::Rclone => "rclone_install_failed",
            Self::WinFsp => "winfsp_install_failed",
        }
    }

    fn arguments(self, verb: &'static str) -> [&'static str; 6] {
        [verb, "--id", self.id(), "--exact", "--source", "winget"]
    }

    pub(super) fn installed(self, winget: &Path) -> Detection {
        let status = quiet_winget(winget)
            .args(self.arguments("list"))
            .arg("--disable-interactivity")
            .status();
        list_result(status.ok().and_then(exit_code))
    }

    fn install(self, winget: &Path) -> Result<bool, &'static str> {
        let status = Command::new(winget)
            .args(self.arguments("install"))
            .arg("--no-upgrade")
            .creation_flags(CREATE_NEW_CONSOLE)
            .status()
            .map_err(|_| self.install_error())?;
        match exit_code(status) {
            Some(0) if self.installed(winget) == Detection::Detected => Ok(false),
            Some(REBOOT_REQUIRED | REBOOT_BEFORE_INSTALL | REBOOT_INITIATED) => Ok(true),
            Some(INSTALL_CANCELLED) => Err("install_cancelled"),
            _ => Err(self.install_error()),
        }
    }
}

fn quiet_winget(path: &Path) -> Command {
    let mut command = Command::new(path);
    command
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
}

pub(super) fn winget() -> Result<PathBuf, Detection> {
    let path = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or(Detection::Unknown)?;
    if !path.is_absolute() {
        return Err(Detection::Unknown);
    }
    let winget = path.join(r"Microsoft\WindowsApps\winget.exe");
    match quiet_winget(&winget).arg("--version").status() {
        Ok(status) if status.success() => Ok(winget),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Err(Detection::NotDetected),
        _ => Err(Detection::Unknown),
    }
}

fn exit_code(status: ExitStatus) -> Option<u32> {
    status.code().map(|code| code as u32)
}

fn list_result(code: Option<u32>) -> Detection {
    match code {
        Some(0) => Detection::Detected,
        Some(NO_APPLICATIONS_FOUND) => Detection::NotDetected,
        _ => Detection::Unknown,
    }
}

pub(crate) fn install_components() -> Result<Installation, &'static str> {
    let winget = winget().map_err(|_| "winget_unavailable")?;
    let statuses = PACKAGES.map(|package| package.installed(&winget));
    if statuses.contains(&Detection::Unknown) {
        return Err("component_detection_failed");
    }
    for (package, status) in PACKAGES.into_iter().zip(statuses) {
        if status == Detection::NotDetected && package.install(&winget)? {
            return Ok(Installation {
                restart_required: true,
            });
        }
    }
    Ok(Installation {
        restart_required: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queries_and_installs_exact_packages_with_default_winget_settings() {
        assert_eq!(
            Package::Rclone.arguments("list"),
            [
                "list",
                "--id",
                "Rclone.Rclone",
                "--exact",
                "--source",
                "winget"
            ]
        );
        assert_eq!(
            Package::WinFsp.arguments("install"),
            [
                "install",
                "--id",
                "WinFsp.WinFsp",
                "--exact",
                "--source",
                "winget"
            ]
        );
    }

    #[test]
    fn distinguishes_an_absent_package_from_a_failed_query() {
        assert_eq!(list_result(Some(0)), Detection::Detected);
        assert_eq!(
            list_result(Some(NO_APPLICATIONS_FOUND)),
            Detection::NotDetected
        );
        assert_eq!(list_result(Some(1)), Detection::Unknown);
        assert_eq!(list_result(None), Detection::Unknown);
    }
}
