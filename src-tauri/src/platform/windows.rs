use windows_sys::Win32::Storage::FileSystem::GetLogicalDrives;

use super::{Component, Detection, Environment};

mod installation;
mod services;
pub(crate) use installation::install_components;
pub(crate) use services::{mount_states, require_unregistered};

pub(crate) fn read_environment() -> Result<Environment, &'static str> {
    let winget = installation::winget();
    let [rclone, winfsp] = installation::PACKAGES.map(|package| Component {
        id: package.component(),
        status: winget
            .as_deref()
            .map_or(Detection::Unknown, |path| package.installed(path)),
    });
    let install_candidates = if [rclone.status, winfsp.status].contains(&Detection::Unknown) {
        Vec::new()
    } else {
        [&rclone, &winfsp]
            .into_iter()
            .filter(|component| component.status == Detection::NotDetected)
            .map(|component| component.id)
            .collect()
    };
    Ok(Environment {
        available_drives: available_drives()?,
        components: [
            rclone,
            winfsp,
            Component {
                id: "winget",
                status: winget.map_or_else(|status| status, |_| Detection::Detected),
            },
        ],
        install_candidates,
    })
}

pub(crate) fn available_drives() -> Result<Vec<String>, &'static str> {
    // SAFETY: GetLogicalDrives has no inputs and reports failure with a zero mask.
    free_drives(unsafe { GetLogicalDrives() })
}

fn free_drives(occupied: u32) -> Result<Vec<String>, &'static str> {
    if occupied == 0 {
        return Err("drive_query_failed");
    }
    Ok((b'D'..=b'Z')
        .rev()
        .filter(|letter| occupied & (1 << (letter - b'A')) == 0)
        .map(|letter| format!("{}:", char::from(letter)))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drive_candidates_exclude_occupied_and_reserved_letters() {
        let drives = free_drives((1 << 2) | (1 << 25)).unwrap();
        assert_eq!(drives.len(), 22);
        assert_eq!(drives.first().unwrap(), "Y:");
        assert_eq!(drives.last().unwrap(), "D:");
        assert!(free_drives((1 << 26) - 1).unwrap().is_empty());
        assert_eq!(free_drives(0), Err("drive_query_failed"));
    }
}
