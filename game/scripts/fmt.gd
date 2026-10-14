## Formatação de números e textos da interface, no padrão do idioma do jogo
## (pt-BR/es: 1.234.567 e 12,5 · en: 1,234,567 e 12.5).
extends RefCounted


## Separador de milhares do idioma atual.
static func thousands() -> String:
	return "," if TranslationServer.get_locale().begins_with("en") else "."


## Separador decimal do idioma atual.
static func decimal() -> String:
	return "." if TranslationServer.get_locale().begins_with("en") else ","


## Agrupa milhares: "1234567" → "1.234.567" (en: "1,234,567"). Recebe string porque os
## saldos chegam da API como texto (BIGINT não cabe com segurança em float).
static func coins(value: Variant) -> String:
	var digits := str(value)
	var negative := digits.begins_with("-")
	if negative:
		digits = digits.substr(1)
	var sep := thousands()
	var out := ""
	var count := 0
	for i in range(digits.length() - 1, -1, -1):
		out = digits[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = sep + out
	return ("-" if negative else "") + out


## Segundos → "45 s", "2 min 05 s", "1 h 03 min".
static func duration(seconds: float) -> String:
	var s := int(ceil(max(seconds, 0.0)))
	if s < 60:
		return "%d s" % s
	if s < 3600:
		return "%d min %02d s" % [s / 60, s % 60]
	if s < 86400:
		return "%d h %02d min" % [s / 3600, (s % 3600) / 60]
	return "%d d %02d h" % [s / 86400, (s % 86400) / 3600]


## Renda por segundo: "+12/s", "+12,5/s", "+1.250/s".
static func rate(per_second: float) -> String:
	if per_second < 100.0 and abs(per_second - round(per_second)) > 0.05:
		return "+%s/s" % str(snappedf(per_second, 0.1)).replace(".", decimal())
	return "+%s/s" % coins(str(int(round(per_second))))
