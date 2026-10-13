## Cliente passeando pela areia entre pontos da planta, com pulinho ao andar.
extends Node2D

const Layout := preload("res://scripts/layout.gd")

const SPEED := 38.0  # px/s

var _sprite: Sprite2D
var _target := Vector2.ZERO
var _pause := 0.0
var _phase := randf() * TAU


func _init(texture_name: String, start: Vector2) -> void:
	position = start
	_target = start
	_sprite = Sprite2D.new()
	_sprite.texture = Layout.texture(texture_name)
	_sprite.scale = Vector2.ONE * Layout.CHAR_SCALE
	_sprite.offset = Vector2(0, -_sprite.texture.get_height() / 2.0)
	add_child(_sprite)


func _process(delta: float) -> void:
	if _pause > 0.0:
		_pause -= delta
		_sprite.position.y = 0
		return
	var to := _target - position
	if to.length() < 2.0:
		_target = Layout.WAYPOINTS.pick_random()
		_pause = randf_range(0.8, 3.0)
		return
	position += to.normalized() * min(SPEED * delta, to.length())
	_sprite.flip_h = to.x < 0
	_phase += delta * 12.0
	_sprite.position.y = -abs(sin(_phase)) * 4.0
