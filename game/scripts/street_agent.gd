## Pessoa na calçada ou carro na rua (ilha única, 2026-11-26): anda de ponto em ponto por uma
## rede (ruas em volta dos lotes ou calçadas na beira deles), sem cortar caminho por cima dos
## negócios. `car` troca o desenho pela direção (frente/costas, espelhado).
extends Node2D

const Layout := preload("res://scripts/layout.gd")

var _nodes: PackedVector2Array
var _links: Array  # índice → Array de vizinhos
var _from := 0
var _to := 0
var _speed := 38.0
var _car := false
var _sprite: Sprite2D
var _front: Texture2D
var _back: Texture2D
var _pause := 0.0
var _phase := randf() * TAU


func _init(nodes: PackedVector2Array, links: Array, start: int, texture_name: String,
		scale_factor: float, car := false) -> void:
	_nodes = nodes
	_links = links
	_car = car
	_from = start % nodes.size()
	_to = _from
	position = nodes[_from]
	_sprite = Sprite2D.new()
	if car:
		_front = Layout.texture(texture_name + "_f")
		_back = Layout.texture(texture_name + "_b")
		_sprite.texture = _front
		_speed = randf_range(62.0, 84.0)
	else:
		_sprite.texture = Layout.texture(texture_name)
		_speed = randf_range(30.0, 42.0)
	_sprite.scale = Vector2.ONE * scale_factor
	_sprite.offset = Vector2(0, -_sprite.texture.get_height() * (0.42 if car else 0.5))
	add_child(_sprite)
	_next()


func _next() -> void:
	var options: Array = _links[_to]
	if options.is_empty():
		return
	# Sem meia-volta quando há outro caminho.
	var choices := options.filter(func(n): return n != _from)
	var pick: int = (choices if not choices.is_empty() else options).pick_random()
	_from = _to
	_to = pick
	var dir := _nodes[_to] - _nodes[_from]
	if _car:
		# A arte de frente olha para baixo-esquerda; a de costas vai para cima-direita.
		_sprite.texture = _front if dir.y >= 0.0 else _back
		_sprite.flip_h = dir.x > 0.0 if dir.y >= 0.0 else dir.x < 0.0
	else:
		_sprite.flip_h = dir.x < 0.0


func _process(delta: float) -> void:
	if _pause > 0.0:
		_pause -= delta
		return
	var to := _nodes[_to] - position
	var step := _speed * delta
	if to.length() <= step:
		position = _nodes[_to]
		if not _car and randf() < 0.25:
			_pause = randf_range(0.6, 2.4)
			_sprite.position.y = 0
		_next()
		return
	position += to.normalized() * step
	if not _car:
		_phase += delta * 12.0
		_sprite.position.y = -absf(sin(_phase)) * 4.0


## Rede a partir dos lotes: `offsets` são os 4 cantos em volta de cada centro. Pontos a menos de
## `merge` viram um só; `cross` liga cantos de lotes diferentes (atravessar a rua).
static func build(centers: Array, corner: Vector2, merge: float, cross: float) -> Dictionary:
	var nodes := PackedVector2Array()
	var links: Array = []
	var find := func(p: Vector2) -> int:
		for i in nodes.size():
			if nodes[i].distance_to(p) <= merge:
				return i
		nodes.append(p)
		links.append([])
		return nodes.size() - 1
	var rings: Array = []
	for c in centers:
		var ring: Array = []
		for off in [Vector2(0, -corner.y), Vector2(corner.x, 0), Vector2(0, corner.y), Vector2(-corner.x, 0)]:
			ring.append(find.call(c + off))
		rings.append(ring)
		for k in 4:
			var a: int = ring[k]
			var b: int = ring[(k + 1) % 4]
			if a != b and not links[a].has(b):
				links[a].append(b)
				links[b].append(a)
	if cross > 0.0:
		for i in rings.size():
			for j in range(i + 1, rings.size()):
				for a in rings[i]:
					for b in rings[j]:
						if a != b and nodes[a].distance_to(nodes[b]) <= cross and not links[a].has(b):
							links[a].append(b)
							links[b].append(a)
	return {"nodes": nodes, "links": links}
