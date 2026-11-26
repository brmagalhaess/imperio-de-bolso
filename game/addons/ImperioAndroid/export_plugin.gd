@tool
extends EditorPlugin

# Plugin Android do Império de Bolso (ADR 0032): login com Google (Credential Manager).
# Fonte em tools/android/imperio-plugin (gradle :plugin:assembleRelease gera o AAR).

var _export: ImperioExport


func _enter_tree() -> void:
	_export = ImperioExport.new()
	add_export_plugin(_export)


func _exit_tree() -> void:
	remove_export_plugin(_export)
	_export = null


class ImperioExport extends EditorExportPlugin:
	func _supports_platform(platform: EditorExportPlatform) -> bool:
		return platform is EditorExportPlatformAndroid

	func _get_android_libraries(_platform: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray(["ImperioAndroid/bin/ImperioAndroid-release.aar"])

	func _get_android_dependencies(_platform: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray([
			"androidx.credentials:credentials:1.5.0",
			"androidx.credentials:credentials-play-services-auth:1.5.0",
			"com.google.android.libraries.identity.googleid:googleid:1.1.1",
			"com.google.android.play:app-update:2.1.0",
			"org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0",
		])

	func _get_name() -> String:
		return "ImperioAndroid"
