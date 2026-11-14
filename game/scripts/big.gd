## Números inteiros sem limite para o dinheiro do jogo (ADR 0033), exatos como o `bigint` do
## servidor. Os saldos chegam da API como texto ("123456…"); estas funções somam, subtraem,
## comparam e multiplicam por um inteiro pequeno sem passar pelo int de 64 bits (que para em
## 9,2×10^18). Representação interna: blocos de 9 algarismos (base 10^9), do menos significativo.
extends RefCounted

const BASE := 1000000000
const WIDTH := 9


## Texto limpo: sem espaços, sem zeros à esquerda, "-0" vira "0".
static func norm(v: Variant) -> String:
	var s := str(v).strip_edges()
	var neg := s.begins_with("-")
	if neg or s.begins_with("+"):
		s = s.substr(1)
	var dot := s.find(".")
	if dot >= 0:
		s = s.substr(0, dot)
	s = s.lstrip("0")
	if s == "" or not s.is_valid_int() and not _all_digits(s):
		return "0"
	return ("-" + s) if neg else s


static func _all_digits(s: String) -> bool:
	for c in s:
		if c < "0" or c > "9":
			return false
	return true


static func is_neg(v: Variant) -> bool:
	return norm(v).begins_with("-")


static func _abs(s: String) -> String:
	return s.substr(1) if s.begins_with("-") else s


static func _chunks(digits: String) -> PackedInt64Array:
	var out := PackedInt64Array()
	var i := digits.length()
	while i > 0:
		var start := maxi(0, i - WIDTH)
		out.append(digits.substr(start, i - start).to_int())
		i = start
	return out


static func _join(chunks: PackedInt64Array) -> String:
	var n := chunks.size()
	while n > 1 and chunks[n - 1] == 0:
		n -= 1
	var s := str(chunks[n - 1])
	for i in range(n - 2, -1, -1):
		s += str(chunks[i]).pad_zeros(WIDTH)
	return s


## Compara valores absolutos: -1, 0, 1.
static func _cmp_abs(a: String, b: String) -> int:
	if a.length() != b.length():
		return -1 if a.length() < b.length() else 1
	if a == b:
		return 0
	return -1 if a < b else 1


static func _add_abs(a: String, b: String) -> String:
	var x := _chunks(a)
	var y := _chunks(b)
	var out := PackedInt64Array()
	var carry := 0
	for i in maxi(x.size(), y.size()):
		var s := carry + (x[i] if i < x.size() else 0) + (y[i] if i < y.size() else 0)
		out.append(s % BASE)
		carry = s / BASE
	if carry > 0:
		out.append(carry)
	return _join(out)


## a - b com a >= b (valores absolutos).
static func _sub_abs(a: String, b: String) -> String:
	var x := _chunks(a)
	var y := _chunks(b)
	var out := PackedInt64Array()
	var borrow := 0
	for i in x.size():
		var d := x[i] - borrow - (y[i] if i < y.size() else 0)
		borrow = 0
		if d < 0:
			d += BASE
			borrow = 1
		out.append(d)
	return _join(out)


## -1 se a < b, 0 se iguais, 1 se a > b.
static func cmp(a: Variant, b: Variant) -> int:
	var x := norm(a)
	var y := norm(b)
	var nx := x.begins_with("-")
	var ny := y.begins_with("-")
	if nx != ny:
		return -1 if nx else 1
	var c := _cmp_abs(_abs(x), _abs(y))
	return -c if nx else c


static func lt(a: Variant, b: Variant) -> bool:
	return cmp(a, b) < 0


static func lte(a: Variant, b: Variant) -> bool:
	return cmp(a, b) <= 0


static func add(a: Variant, b: Variant) -> String:
	var x := norm(a)
	var y := norm(b)
	var nx := x.begins_with("-")
	var ny := y.begins_with("-")
	var ax := _abs(x)
	var ay := _abs(y)
	if nx == ny:
		var s := _add_abs(ax, ay)
		return ("-" + s) if nx and s != "0" else s
	var c := _cmp_abs(ax, ay)
	if c == 0:
		return "0"
	if c > 0:
		var r := _sub_abs(ax, ay)
		return ("-" + r) if nx else r
	var r2 := _sub_abs(ay, ax)
	return ("-" + r2) if ny else r2


static func sub(a: Variant, b: Variant) -> String:
	var y := norm(b)
	return add(a, y.substr(1) if y.begins_with("-") else ("-" + y if y != "0" else "0"))


## a × n, com n inteiro (ciclos, níveis — cabe em 64 bits).
static func mul_int(a: Variant, n: int) -> String:
	var x := norm(a)
	if n == 0 or x == "0":
		return "0"
	var neg := x.begins_with("-") != (n < 0)
	var m := absi(n)
	var chunks := _chunks(_abs(x))
	# n pode passar de 10^9: multiplica em duas metades para não estourar 64 bits.
	var lo := m % BASE
	var hi := m / BASE
	var low := _mul_small(chunks, lo)
	var res := low
	if hi > 0:
		var high := _mul_small(chunks, hi)
		res = _add_abs(low, high + "0".repeat(WIDTH))
	return ("-" + res) if neg and res != "0" else res


static func _mul_small(chunks: PackedInt64Array, m: int) -> String:
	var out := PackedInt64Array()
	var carry := 0
	for c in chunks:
		var p := c * m + carry
		out.append(p % BASE)
		carry = p / BASE
	while carry > 0:
		out.append(carry % BASE)
		carry /= BASE
	return _join(out) if not out.is_empty() else "0"


## Aproximação em float (barras de progresso, proporções) — nunca para o saldo.
static func to_float(a: Variant) -> float:
	var s := norm(a)
	var neg := s.begins_with("-")
	s = _abs(s)
	if s.length() <= 15:
		return (-1.0 if neg else 1.0) * float(s.to_int())
	var f := float(s.substr(0, 15).to_int()) * pow(10.0, s.length() - 15)
	return -f if neg else f
