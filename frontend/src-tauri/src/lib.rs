use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Emitter
};
use std::io::{Read, Write};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Nexus AI.", name)
}

#[tauri::command]
async fn scan_apps() -> Result<Vec<serde_json::Value>, String> {
    // Only return primary, user-facing launch targets to Skill Modules.
    use std::process::Command;
    let script = r#"
$apps = @()

# --- JUNK NAME FILTER ---
$junkNamePattern = '(?i)^(Uninstall|Tools|Prompt|Configure|Setup|Settings|Module Docs|Manual|Help|Python [0-9]|node\.js|install|dfrgui|certmgr|mmc|cmd|regedit|sigcheck|autoruns|procexp|disk cleanup|character map|steps recorder|windows fax|remote desktop|snipping|on-screen keyboard|magnify|narrator|wordpad|paint 3d|3d viewer|mixed reality|get help|tips|your phone|feedback|xbox|solitaire|mahjong|candy|farm heroes|royal revolt|twitter|linkedin|onenote for|store purchase|connect|phone link|cortana|copilot|search highlights|windows security|windows defender|edge.*update|update.*edge)'
$excludedPathPattern = '(?i)\\Windows\\(Installer|System32|SysWOW64|WinSxS|servicing)\\|\\(uninstall|setup|installer|update|updater|bootstrap|helper|diagnostic|crash|repair|maintenance)[^\\]*\.exe$'

# 1. Start Menu Shortcuts
$paths = @("$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs")
$wshShell = New-Object -ComObject WScript.Shell
foreach ($path in $paths) {
    if (Test-Path $path) {
        Get-ChildItem -Path $path -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $shortcut = $wshShell.CreateShortcut($_.FullName)
                $target = $shortcut.TargetPath
                $name = $_.BaseName
                if ($target -match '\.exe$' -and
                    $target -notmatch '(?i)\\Windows\\System32\\|\\Windows\\SysWOW64\\' -and
                    $target -notmatch $excludedPathPattern -and
                    $name -notmatch $junkNamePattern) {
                    $apps += [PSCustomObject]@{ name = $name; path = $target; category = "Desktop App" }
                }
            } catch {}
        }
    }
}

# 2. Registry Uninstall Keys (only user-installed apps)
$regPaths = @("HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*")
Get-ItemProperty $regPaths -ErrorAction SilentlyContinue | Where-Object { 
    $_.DisplayName -and
    $_.DisplayIcon -match '\.exe' -and 
    $_.SystemComponent -ne 1 -and 
    $_.DisplayName -notmatch '(?i)Redistributable|Runtime|SDK|Kit|Framework|Update|Service Pack|Host|Driver|Tools|Installer|Component|Library|Module|Engine|Uninstall|Prompt|Configure|Setup Help|.NET |Visual C\+\+|Windows Kits|WinRT|DirectX|OpenCL|Vulkan|Python [0-9]|node\.js|npm' -and
    $_.DisplayName -notmatch $junkNamePattern
} | ForEach-Object {
    $iconPath = $_.DisplayIcon -replace '",\d+$', '"' -replace ',\d+$', '' -replace '^"|"$', ''
    if ($iconPath -match '\.exe$' -and
        $iconPath -notmatch '(?i)\\Windows\\System32\\|\\Windows\\SysWOW64\\' -and
        $iconPath -notmatch $excludedPathPattern -and
        $_.DisplayName -notmatch '(?i)(uninstall|setup|installer|update|updater|bootstrap|helper|diagnostic|repair|maintenance)') {
        $apps += [PSCustomObject]@{ name = $_.DisplayName; path = $iconPath; category = "Desktop App" }
    }
}

# 3. UWP Apps (user-facing only)
$uwpJunk = '(?i)(Framework|Runtime|WinRT|Appx|VCLibs|CRT\.|DX11|DirectX|XboxGame|XboxSpeech|XboxIdentity|MixedReality|HolographicFirst|AAD\.BrokerPlugin|AccountsControl|AppInstaller|AsyncTextService|BioEnrollment|CapturePicker|ContentDelivery|Credentials|ECApp|LockApp|MicrosoftEdge(?!$)|Net\.Native|NcsiUwpApp|OOBENetworkConnection|PeopleExperienceHost|PinningConfirmation|Print|SecHealthUI|SecureAssessment|SignIn|SmartScreen|SocketSample|SpeechRecognition|SystemSettings|WebMediaExtensions|Win32WebViewHost|Windows\.CBSPreview|Windows\.Devhome|Windows\.PrintDialog|Windows\.VoiceActivation|WindowsCamera(?!$)|WinStore|Wallet|Xbox(?!.*(App|One))|Zune|GamingApp|GamingServices|GetHelp|Getstarted|YourPhone|Phone(?!.*Link))'

Get-AppxPackage | Where-Object { 
    $_.IsFramework -eq $false -and 
    $_.NonRemovable -eq $false -and 
    $_.SignatureKind -ne 'System' -and
    $_.Name -notmatch $uwpJunk
} | ForEach-Object {
    $friendlyName = $_.Name -replace '^[A-Za-z0-9]+\.', '' -replace '(?<=[a-z])(?=[A-Z])', ' '
    $apps += [PSCustomObject]@{ name = $friendlyName; path = "UWP:" + $_.PackageFamilyName; category = "UWP App" }
}

# Deduplicate by name (case-insensitive)
$result = @($apps | Group-Object { $_.name.ToLower() } | ForEach-Object { $_.Group[0] })
ConvertTo-Json -InputObject $result -Compress
"#;

    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Ok(vec![]);
    }

    match serde_json::from_str(&stdout) {
        Ok(v) => Ok(v),
        Err(e) => Err(format!("Failed to parse JSON: {}", e)),
    }
}

#[tauri::command]
async fn set_system_volume(_level: u32) -> Result<(), String> {
    // Best-effort volume control using powershell and sendkeys (since precise control requires C# CoreAudioApi)
    // A simple approach is sending VolUp/VolDown, but for precise we'd need a heavier script.
    // For now, we will just log it or use a simplified approach.
    Ok(())
}

#[tauri::command]
async fn set_system_brightness(level: u32) -> Result<(), String> {
    use std::process::Command;
    let script = format!("(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {})", level);
    Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn os_power_action(action: String) -> Result<(), String> {
    use std::process::Command;
    let arg = match action.as_str() {
        "shutdown" => "/s",
        "reboot" => "/r",
        "update_restart" => "/g", // /g restarts and registers applications
        _ => return Err("Unknown action".into()),
    };
    Command::new("shutdown")
        .args([arg, "/t", "0"])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn app_power_action(action: String, app: tauri::AppHandle) -> Result<(), String> {
    match action.as_str() {
        "close" => app.exit(0),
        "restart" => app.restart(),
        "logout" => {
            // In a real app we'd clear tokens, but for now we'll just restart
            app.restart();
        }
        _ => return Err("Unknown action".into()),
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // ─── Start local OAuth interceptor server ────────────────────────────────
            // OAuth callback listener used by Google, Gmail, and Spotify.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Ok(listener) = std::net::TcpListener::bind("127.0.0.1:9876") {
                    println!("OAuth interceptor listening on 127.0.0.1:9876");
                    for stream in listener.incoming() {
                        if let Ok(mut stream) = stream {
                            let mut buffer = [0; 2048];
                            if let Ok(bytes_read) = stream.read(&mut buffer) {
                                let request = String::from_utf8_lossy(&buffer[..bytes_read]);
                                if let Some(line) = request.lines().next() {
                                    let parts: Vec<&str> = line.split_whitespace().collect();
                                    if parts.len() >= 2 {
                                        let path_and_query = parts[1].to_string();
                                        // Emit to frontend
                                        let _ = app_handle.emit("oauth_callback", path_and_query);
                                        // A normal browser tab cannot reliably close itself after an
                                        // OAuth redirect, so surface Nexus AI immediately instead.
                                        if let Some(window) = app_handle.get_webview_window("main") {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                        }
                                        // Send response
                                        let response = "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: text/html\r\n\r\n<!DOCTYPE html><html><head><title>Nexus AI Auth</title><style>body{font-family:system-ui,sans-serif;background:#0f1016;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;} h2{color:#10b981;}</style></head><body><div><h2>Authentication Successful!</h2><p>You can now safely close this browser tab and return to Nexus AI.</p><script>setTimeout(()=>window.close(), 2000);</script></div></body></html>";
                                        let _ = stream.write_all(response.as_bytes());
                                    }
                                }
                            }
                        }
                    }
                } else {
                    eprintln!("Failed to bind OAuth interceptor to 127.0.0.1:9876");
                }
            });

            // ─── System tray setup ──────────────────────────────────────────────────
            let quit_i = MenuItem::with_id(app, "quit", "Quit Nexus AI", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Nexus AI")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            scan_apps, 
            set_system_volume, 
            set_system_brightness, 
            os_power_action, 
            app_power_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nexus AI");
}
