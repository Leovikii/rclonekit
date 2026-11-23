#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;

use tauri::Manager;
use tauri::async_runtime::Mutex;

mod mounts;
mod platform;
mod webdav;

type ComponentInstallLock = Arc<Mutex<()>>;

#[tauri::command]
async fn read_environment() -> Result<platform::Environment, &'static str> {
    tauri::async_runtime::spawn_blocking(platform::read_environment)
        .await
        .map_err(|_| "environment_unavailable")?
}

#[tauri::command]
async fn install_components(app: tauri::AppHandle) -> Result<platform::Installation, &'static str> {
    let lock = app.state::<ComponentInstallLock>().inner().clone();
    let pending = lock.try_lock_owned().map_err(|_| "busy")?;
    tauri::async_runtime::spawn_blocking(move || {
        let _pending = pending;
        platform::install_components()
    })
    .await
    .map_err(|_| "component_install_failed")?
}

#[tauri::command]
async fn list_mount_configs(
    app: tauri::AppHandle,
) -> Result<Vec<platform::MountState>, &'static str> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "configuration_unavailable")?;
    tauri::async_runtime::spawn_blocking(move || mounts::list(&root).map(platform::mount_states))
        .await
        .map_err(|_| "configuration_unavailable")?
}

#[tauri::command]
async fn prepare_mount(
    app: tauri::AppHandle,
    input: mounts::MountInput,
    id: Option<uuid::Uuid>,
) -> Result<mounts::MountConfig, &'static str> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "configuration_unavailable")?;
    let connection = input.connection.check().await?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(id) = id {
            return mounts::update_unregistered(
                &root,
                id,
                connection,
                input.drive,
                input.read_only,
            );
        }
        if !platform::available_drives()?
            .iter()
            .any(|drive| drive == input.drive.as_str())
        {
            return Err("drive_in_use");
        }
        mounts::save_new(&root, connection, input.drive, input.read_only)
    })
    .await
    .map_err(|_| "configuration_unavailable")?
}

#[tauri::command]
async fn remove_mount_config(app: tauri::AppHandle, id: uuid::Uuid) -> Result<(), &'static str> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "configuration_unavailable")?;
    tauri::async_runtime::spawn_blocking(move || mounts::remove_unregistered(&root, id))
        .await
        .map_err(|_| "configuration_unavailable")?
}

fn main() {
    tauri::Builder::default()
        .manage(ComponentInstallLock::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event
                && window.state::<ComponentInstallLock>().try_lock().is_err()
            {
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_environment,
            install_components,
            list_mount_configs,
            prepare_mount,
            remove_mount_config
        ])
        .run(tauri::generate_context!())
        .expect("failed to run RcloneKit");
}
