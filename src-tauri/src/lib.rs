mod calculator;

use calculator::{evaluate_expression, format_result};

/// Tauri command: evaluate a full math expression string in Rust.
#[tauri::command]
fn evaluate_expr(expr: String) -> Result<String, String> {
    let result = evaluate_expression(&expr)?;
    Ok(format_result(result))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![evaluate_expr])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
