fn main() {
    let manifest = tauri_build::AppManifest::new().commands(&[
        "read_environment",
        "install_components",
        "list_mount_configs",
        "prepare_mount",
        "remove_mount_config",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to build Tauri application resources");
}
