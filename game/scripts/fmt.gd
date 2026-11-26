## Formatação de números e textos da interface, no padrão do idioma do jogo
## (pt-BR/es: 1.234.567 e 12,5 · en: 1,234,567 e 12.5).
extends RefCounted


## Separador de milhares do idioma atual.
static func thousands() -> String:
	return "," if TranslationServer.get_locale().begins_with("en") else "."


## Separador decimal do idioma atual.
static func decimal() -> String:
	return "." if TranslationServer.get_locale().begins_with("en") else ","


## Abaixo disso o número aparece inteiro ("9.999"); daí para cima, abreviado ("12,3K").
const COMPACT_FROM := 10000
## K mil · M milhão · B bilhão · T trilhão; depois aa, ab … az, ba … (padrão dos jogos idle).
const SUFFIXES := ["", "K", "M", "B", "T"]


## Moedas/diamantes na tela, abreviados como nos jogos do gênero (pedido do titular: o saldo
## gigante empurrava os campos): 9.999 · 12,3K · 123K · 1,23M · 45,6B · 7,89T · 1,5aa.
## Recebe string porque os saldos chegam da API como texto (BIGINT não cabe em float).
## Trunca (nunca arredonda para cima): a tela não mostra mais do que o jogador tem.
static func coins(value: Variant) -> String:
	var digits := str(value).strip_edges()
	var negative := digits.begins_with("-")
	if negative:
		digits = digits.substr(1)
	digits = digits.lstrip("0")
	if digits == "":
		return "0"
	if digits.length() <= 4 or (digits.length() == 5 and digits.to_int() < COMPACT_FROM):
		return ("-" if negative else "") + full(digits)
	var group := (digits.length() - 1) / 3  # 1 = K, 2 = M, ...
	var int_len := digits.length() - group * 3  # 1..3 algarismos antes da vírgula
	var whole := digits.substr(0, int_len)
	var frac := digits.substr(int_len, 3 - int_len).rstrip("0")
	var text := whole + ((decimal() + frac) if frac != "" else "")
	return ("-" if negative else "") + text + suffix(group)


## Sufixo do grupo de milhares: 1 → K, 4 → T, 5 → aa, 6 → ab, 30 → az, 31 → ba …
static func suffix(group: int) -> String:
	if group < SUFFIXES.size():
		return SUFFIXES[group]
	var n := group - SUFFIXES.size()
	var a := "a".unicode_at(0)
	return String.chr(a + (n / 26) % 26) + String.chr(a + n % 26)


## Número inteiro com separador de milhares: "1234567" → "1.234.567" (en: "1,234,567").
static func full(value: Variant) -> String:
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
	return "+%s/s" % coins("%.0f" % round(per_second))
