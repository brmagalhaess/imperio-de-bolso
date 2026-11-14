## Idioma do jogo (V1.2): Automático (idioma do aparelho), Português, English ou Español.
## A escolha fica só no aparelho (user://settings.cfg, seção "ui"). Traduções: i18n/translations.csv
## (chave = texto em pt-BR; gerado/conferido por tools/i18n/extract.py).
extends Node

const SETTINGS_PATH := "user://settings.cfg"
const SUPPORTED := ["pt_BR", "en", "es"]
const NAMES := {"pt_BR": "Português", "en": "English", "es": "Español"}

## "auto" ou um dos SUPPORTED.
var choice := "auto"
var settings_path := SETTINGS_PATH


func _ready() -> void:
	load_settings()


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(settings_path) == OK:
		choice = str(cfg.get_value("ui", "language", "auto"))
	if choice != "auto" and not SUPPORTED.has(choice):
		choice = "auto"
	apply()


func set_choice(value: String) -> void:
	choice = value if (value == "auto" or SUPPORTED.has(value)) else "auto"
	var cfg := ConfigFile.new()
	cfg.load(settings_path)
	cfg.set_value("ui", "language", choice)
	cfg.save(settings_path)
	apply()


func apply() -> void:
	TranslationServer.set_locale(resolve())


## Locale efetivo. Automático: português/inglês/espanhol do aparelho; qualquer outro → inglês.
func resolve() -> String:
	if choice != "auto":
		return choice
	return detect(OS.get_locale_language())


static func detect(language: String) -> String:
	match language:
		"pt":
			return "pt_BR"
		"es":
			return "es"
		_:
			return "en"


## Nome para a tela de Configurações ("Automático · English").
func label() -> String:
	if choice == "auto":
		return TranslationServer.translate("Automático · %s") % NAMES[resolve()]
	return NAMES[choice]
