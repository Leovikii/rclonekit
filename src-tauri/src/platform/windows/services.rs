use std::io;
use std::ptr::null;

use uuid::Uuid;
use windows_sys::Win32::Foundation::ERROR_SERVICE_DOES_NOT_EXIST;
use windows_sys::Win32::System::Services::{
    CloseServiceHandle, OpenSCManagerW, OpenServiceW, SC_HANDLE, SC_MANAGER_CONNECT,
    SERVICE_QUERY_STATUS,
};

use crate::mounts::MountConfig;
use crate::platform::MountState;

struct ServiceHandle(SC_HANDLE);

impl ServiceHandle {
    fn connect() -> io::Result<Self> {
        // SAFETY: null names select the local computer's active service database.
        let handle = unsafe { OpenSCManagerW(null(), null(), SC_MANAGER_CONNECT) };
        if handle.is_null() {
            Err(io::Error::last_os_error())
        } else {
            Ok(Self(handle))
        }
    }

    fn contains(&self, name: &str) -> io::Result<bool> {
        let name: Vec<u16> = name.encode_utf16().chain([0]).collect();
        // SAFETY: self is a live SCM handle and the service name is NUL-terminated.
        let service = unsafe { OpenServiceW(self.0, name.as_ptr(), SERVICE_QUERY_STATUS) };
        if !service.is_null() {
            let _service = Self(service);
            return Ok(true);
        }
        let error = io::Error::last_os_error();
        if error.raw_os_error() == Some(ERROR_SERVICE_DOES_NOT_EXIST as i32) {
            Ok(false)
        } else {
            Err(error)
        }
    }
}

impl Drop for ServiceHandle {
    fn drop(&mut self) {
        // SAFETY: this wrapper alone owns the open SCM or service handle.
        unsafe { CloseServiceHandle(self.0) };
    }
}

fn service_name(id: Uuid) -> String {
    format!("RcloneKit-{}", id.simple())
}

pub(crate) fn mount_states(configs: Vec<MountConfig>) -> Vec<MountState> {
    if configs.is_empty() {
        return Vec::new();
    }
    let manager = ServiceHandle::connect().ok();
    configs
        .into_iter()
        .map(|config| {
            let mounted = match manager
                .as_ref()
                .and_then(|manager| manager.contains(&service_name(config.id)).ok())
            {
                Some(false) => Some(false),
                _ => None,
            };
            MountState { config, mounted }
        })
        .collect()
}

pub(crate) fn require_unregistered(id: Uuid) -> Result<(), &'static str> {
    let manager = ServiceHandle::connect().map_err(|_| "status_unavailable")?;
    match manager.contains(&service_name(id)) {
        Ok(false) => Ok(()),
        Ok(true) | Err(_) => Err("status_unavailable"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_existing_and_absent_registration_with_query_only_access() {
        let manager = ServiceHandle::connect().unwrap();
        assert!(manager.contains("EventLog").unwrap());
        assert!(!manager.contains(&service_name(Uuid::new_v4())).unwrap());
    }

    #[test]
    fn registration_name_is_derived_only_from_mount_identity() {
        let id = Uuid::parse_str("01234567-89ab-4def-8123-456789abcdef").unwrap();
        assert_eq!(
            service_name(id),
            "RcloneKit-0123456789ab4def8123456789abcdef"
        );
    }
}
