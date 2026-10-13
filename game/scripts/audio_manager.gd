## Sons e música (autoload "Audio"). Música e efeitos podem ser desligados nas Configurações;
## a escolha fica só no aparelho (user://settings.cfg). Origem/licença: assets/audio/CREDITOS.md.
extends Node

const SETTINGS_PATH := "user://settings.cfg"
const SFX_DIR := "res://assets/audio/sfx/"
## Nome do efeito → arquivos (um é sorteado) e volume em dB.
const SFX := {
	"click": [["click"], -10.0],
	"toggle": [["toggle"], -6.0],
	"error": [["error"], -8.0],
	"coin": [["coin_1", "coin_2", "coin_3", "coin_4"], -4.0],
	"buy": [["buy"], -6.0],
	"upgrade": [["upgrade"], -6.0],
	"hire": [["hire"], -6.0],
	"reward": [["reward"], -6.0],
	"bonus": [["bonus"], -6.0],
}
## Uma faixa por mapa (volume equalizado pela loudness medida das faixas).
const MUSIC := {
	"praia": ["res://assets/audio/music/praia.ogg", -14.0],
	"cidade": ["res://assets/audio/music/cidade.ogg", -16.0],
}
## Com uma janela aberta, a música abaixa para não brigar com a leitura.
const DUCK_DB := -7.0
const FADE_SECONDS := 0.6
## O mesmo efeito não repete antes disso (várias moedas coletadas juntas).
const MIN_REPEAT_MS := 70
const POOL_SIZE := 6

var settings_path := SETTINGS_PATH
var music_on := true
var sfx_on := true
## Último efeito tocado (para testes).
var last_sfx := ""

var _streams := {}
var _pool: Array[AudioStreamPlayer] = []
var _next := 0
var _last_ms := {}
var _music: AudioStreamPlayer
var _track := ""
var _ducked := false
var _tween: Tween


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	load_settings()
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	_music = AudioStreamPlayer.new()
	add_child(_music)
	# Toque em qualquer botão do jogo faz "clique" (menos os que têm som próprio).
	get_tree().node_added.connect(_on_node_added)
	# Moedas coletadas (toque na moeda, ajudantes, resumo offline).
	(func(): GameState.collected.connect(func(_items): play("coin"))).call_deferred()


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(settings_path) == OK:
		music_on = bool(cfg.get_value("audio", "music", true))
		sfx_on = bool(cfg.get_value("audio", "sfx", true))


func _save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.load(settings_path)
	cfg.set_value("audio", "music", music_on)
	cfg.set_value("audio", "sfx", sfx_on)
	cfg.save(settings_path)


func set_music_on(value: bool) -> void:
	music_on = value
	_save_settings()
	if value:
		var track := _track
		_track = ""
		play_music(track)
	else:
		_music.stop()


func set_sfx_on(value: bool) -> void:
	sfx_on = value
	_save_settings()


func play(name: String) -> void:
	if not sfx_on or not SFX.has(name):
		return
	var now := Time.get_ticks_msec()
	if now - int(_last_ms.get(name, -100000)) < MIN_REPEAT_MS:
		return
	_last_ms[name] = now
	var files: Array = SFX[name][0]
	var player := _pool[_next]
	_next = (_next + 1) % _pool.size()
	player.stream = _stream(SFX_DIR + str(files.pick_random()) + ".ogg")
	player.volume_db = SFX[name][1]
	player.pitch_scale = randf_range(0.95, 1.05) if name == "coin" else 1.0
	player.play()
	last_sfx = name


## Toca a faixa do mapa (com transição suave); a mesma faixa não reinicia.
func play_music(track: String) -> void:
	if not MUSIC.has(track):
		return
	if track == _track and (_music.playing or not music_on):
		return
	_track = track
	if not music_on:
		return
	var stream := _stream(MUSIC[track][0])
	if stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
	_kill_tween()
	if _music.playing:
		_tween = create_tween()
		_tween.tween_property(_music, "volume_db", -40.0, FADE_SECONDS)
		await _tween.finished
		if _track != track:
			return
	_music.stream = stream
	_music.volume_db = -40.0
	_music.play()
	_fade_to(_target_db())


func current_track() -> String:
	return _track


func is_music_playing() -> bool:
	return _music.playing


## Janela aberta: música mais baixa.
func set_ducked(value: bool) -> void:
	if value == _ducked:
		return
	_ducked = value
	if _music.playing:
		_fade_to(_target_db(), 0.25)


func _target_db() -> float:
	return float(MUSIC.get(_track, ["", -14.0])[1]) + (DUCK_DB if _ducked else 0.0)


func _fade_to(db: float, seconds := FADE_SECONDS) -> void:
	_kill_tween()
	_tween = create_tween()
	_tween.tween_property(_music, "volume_db", db, seconds)


func _kill_tween() -> void:
	if _tween and _tween.is_valid():
		_tween.kill()


func _stream(path: String) -> AudioStream:
	if not _streams.has(path):
		_streams[path] = load(path)
	return _streams[path]


func _on_node_added(node: Node) -> void:
	if node.has_meta("no_click_sfx"):
		return
	if node is BaseButton or (node is Control and node.has_signal("pressed") and node.has_method("_draw")):
		node.connect("pressed", play.bind("click"))
