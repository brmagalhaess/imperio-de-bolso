shader_type canvas_item;
// Desfaz as bordas de um cenário no mar (mapa 2D, 2026-11-25): larguras em fração da imagem.
uniform float left = 0.07;
uniform float right = 0.0;
uniform float top = 0.0;
uniform float bottom = 0.05;

float edge(float width, float d) {
	return width <= 0.0 ? 1.0 : smoothstep(0.0, width, d);
}

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float a = edge(left, UV.x) * edge(right, 1.0 - UV.x) * edge(top, UV.y) * edge(bottom, 1.0 - UV.y);
	COLOR = vec4(c.rgb, c.a * a);
}
