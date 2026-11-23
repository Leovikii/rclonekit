use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::ErrorKind;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;
use uuid::Uuid;

use crate::platform;
use crate::webdav::{CheckedConnection, ConnectionInput, parse_address};

const CONFIGURATION_UNAVAILABLE: &str = "configuration_unavailable";
const CONFIGURATION_FILE: &str = "mounts.json";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MountInput {
    pub(crate) connection: ConnectionInput,
    pub(crate) drive: DriveLetter,
    pub(crate) read_only: bool,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub(crate) struct DriveLetter(String);

impl DriveLetter {
    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for DriveLetter {
    type Error = &'static str;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_bytes() {
            [b'D'..=b'Z', b':'] => Ok(Self(value)),
            _ => Err("invalid_drive"),
        }
    }
}

impl From<DriveLetter> for String {
    fn from(letter: DriveLetter) -> Self {
        letter.0
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MountConfig {
    pub(crate) id: Uuid,
    connection: Connection,
    target: MountTarget,
    read_only: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum Connection {
    Webdav {
        id: Uuid,
        url: String,
        username: String,
    },
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum MountTarget {
    DriveLetter { value: DriveLetter },
}

pub(crate) fn list(root: &Path) -> Result<Vec<MountConfig>, &'static str> {
    let file = match File::open(root.join(CONFIGURATION_FILE)) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(_) => return Err(CONFIGURATION_UNAVAILABLE),
    };
    let records: Vec<MountConfig> =
        serde_json::from_reader(file).map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    let mut drives = HashSet::new();
    let mut ids = HashSet::new();
    for record in &records {
        let MountTarget::DriveLetter { value } = &record.target;
        let Connection::Webdav { id, url, .. } = &record.connection;
        if !drives.insert(value.as_str())
            || !ids.insert(record.id)
            || !ids.insert(*id)
            || parse_address(url).is_err()
        {
            return Err(CONFIGURATION_UNAVAILABLE);
        }
    }
    Ok(records)
}

pub(crate) fn save_new(
    root: &Path,
    connection: CheckedConnection,
    drive: DriveLetter,
    read_only: bool,
) -> Result<MountConfig, &'static str> {
    let _lock = lock_catalog(root)?;
    let mut configurations = list(root)?;
    if configurations.iter().any(|configuration| {
        let MountTarget::DriveLetter { value } = &configuration.target;
        value == &drive
    }) {
        return Err("drive_in_use");
    }
    configurations.push(MountConfig {
        id: Uuid::new_v4(),
        connection: Connection::Webdav {
            id: Uuid::new_v4(),
            url: connection.url,
            username: connection.username,
        },
        target: MountTarget::DriveLetter { value: drive },
        read_only,
    });

    write_catalog(root, &configurations)?;
    Ok(configurations
        .pop()
        .expect("new configuration was appended"))
}

pub(crate) fn update_unregistered(
    root: &Path,
    id: Uuid,
    connection: CheckedConnection,
    drive: DriveLetter,
    read_only: bool,
) -> Result<MountConfig, &'static str> {
    let _lock = lock_catalog(root)?;
    let mut configurations = list(root)?;
    let index = find(&configurations, id)?;
    let MountTarget::DriveLetter { value: current } = &configurations[index].target;
    if current != &drive
        && (!platform::available_drives()?
            .iter()
            .any(|letter| letter == drive.as_str())
            || configurations.iter().any(|config| {
                let MountTarget::DriveLetter { value } = &config.target;
                value == &drive
            }))
    {
        return Err("drive_in_use");
    }
    platform::require_unregistered(id)?;
    let config = &mut configurations[index];
    let Connection::Webdav { url, username, .. } = &mut config.connection;
    *url = connection.url;
    *username = connection.username;
    config.target = MountTarget::DriveLetter { value: drive };
    config.read_only = read_only;
    write_catalog(root, &configurations)?;
    Ok(configurations.swap_remove(index))
}

pub(crate) fn remove_unregistered(root: &Path, id: Uuid) -> Result<(), &'static str> {
    let _lock = lock_catalog(root)?;
    let mut configurations = list(root)?;
    let index = find(&configurations, id)?;
    platform::require_unregistered(id)?;
    configurations.remove(index);
    write_catalog(root, &configurations)
}

fn find(configurations: &[MountConfig], id: Uuid) -> Result<usize, &'static str> {
    configurations
        .iter()
        .position(|config| config.id == id)
        .ok_or("not_found")
}

fn lock_catalog(root: &Path) -> Result<File, &'static str> {
    fs::create_dir_all(root).map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(root.join("mounts.lock"))
        .map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    lock.lock().map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    Ok(lock)
}

fn write_catalog(root: &Path, configurations: &[MountConfig]) -> Result<(), &'static str> {
    let pending = NamedTempFile::new_in(root).map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    serde_json::to_writer(pending.as_file(), configurations)
        .map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    pending
        .as_file()
        .sync_all()
        .map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    pending
        .persist(root.join(CONFIGURATION_FILE))
        .map_err(|_| CONFIGURATION_UNAVAILABLE)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    fn connection() -> CheckedConnection {
        CheckedConnection {
            url: "https://example.test/dav/".into(),
            username: "user".into(),
        }
    }

    #[test]
    fn concurrent_creates_keep_separate_ids_and_reserve_each_drive_once() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path();
        thread::scope(|scope| {
            let first = scope.spawn(|| {
                save_new(
                    root,
                    connection(),
                    "Q:".to_string().try_into().unwrap(),
                    false,
                )
            });
            let second = scope.spawn(|| {
                save_new(
                    root,
                    connection(),
                    "Q:".to_string().try_into().unwrap(),
                    true,
                )
            });
            assert_eq!(
                [first.join().unwrap(), second.join().unwrap()]
                    .iter()
                    .filter(|result| result.is_ok())
                    .count(),
                1
            );
        });
        let other = save_new(
            root,
            connection(),
            "R:".to_string().try_into().unwrap(),
            true,
        )
        .unwrap();
        let records = list(root).unwrap();
        assert_eq!(records.len(), 2);
        assert_ne!(records[0].id, records[1].id);
        assert_eq!(records[1].id, other.id);
        let Connection::Webdav { id, .. } = records[1].connection;
        assert_ne!(id, other.id);
        let persisted = fs::read_to_string(root.join(CONFIGURATION_FILE)).unwrap();
        assert!(!persisted.contains("password"));
        assert!(persisted.contains(r#""kind":"driveLetter","value":"R:""#));
    }

    #[test]
    fn unreadable_catalog_is_not_replaced() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(CONFIGURATION_FILE);
        fs::write(&path, b"invalid json").unwrap();
        assert!(matches!(
            save_new(
                directory.path(),
                connection(),
                "Z:".to_string().try_into().unwrap(),
                false
            ),
            Err(CONFIGURATION_UNAVAILABLE)
        ));
        assert_eq!(fs::read(&path).unwrap(), b"invalid json");
    }

    #[cfg(windows)]
    #[test]
    fn edits_and_removes_unregistered_configurations_without_changing_identity_or_other_files() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path();
        let drive = DriveLetter("Q:".into());
        let saved = save_new(root, connection(), drive.clone(), false).unwrap();
        let other = save_new(root, connection(), DriveLetter("R:".into()), false).unwrap();
        let Connection::Webdav {
            id: connection_id, ..
        } = saved.connection;
        let mut edited = connection();
        edited.url.push_str("nested/");
        let changed = update_unregistered(root, saved.id, edited, drive.clone(), true).unwrap();
        assert_eq!(changed.id, saved.id);
        let Connection::Webdav { id, url, .. } = changed.connection;
        assert_eq!(id, connection_id);
        assert_eq!(url, "https://example.test/dav/nested/");
        assert!(changed.read_only);

        let cache_fixture = root.join("cache-fixture");
        fs::write(&cache_fixture, b"unrelated file").unwrap();
        remove_unregistered(root, saved.id).unwrap();
        assert_eq!(fs::read(cache_fixture).unwrap(), b"unrelated file");
        assert_eq!(
            list(root)
                .unwrap()
                .iter()
                .map(|record| record.id)
                .collect::<Vec<_>>(),
            [other.id]
        );
        assert_eq!(remove_unregistered(root, saved.id), Err("not_found"));
        assert!(matches!(
            update_unregistered(root, saved.id, connection(), drive, true),
            Err("not_found")
        ));
    }
}
