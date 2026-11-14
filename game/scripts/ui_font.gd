## Fonte da interface: Fredoka (OFL, assets/fonts/OFL.txt) com peso ajustável.
extends RefCounted

const FREDOKA := preload("res://assets/fonts/Fredoka.ttf")

static var _cache := {}


static func weight(w: int) -> Font:
	if not _cache.has(w):
		var fv := FontVariation.new()
		fv.base_font = FREDOKA
		fv.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): w}
		_cache[w] = fv
	return _cache[w]


static func bold() -> Font:
	return weight(600)
