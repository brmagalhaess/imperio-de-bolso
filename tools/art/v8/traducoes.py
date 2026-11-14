# pt → (en, es) dos textos novos dos 20 mapas (ADR 0034). Uso: python3 tools/art/v8/traducoes.py
import csv, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
T = {
"Quiosque de Pastel": ("Pastry Kiosk", "Quiosco de Empanadas"), "Barraca de Açaí": ("Açaí Stand", "Puesto de Açaí"),
"Pizzaria": ("Pizzeria", "Pizzería"), "Livraria": ("Bookstore", "Librería"), "Pet Shop": ("Pet Shop", "Tienda de Mascotas"),
"Restaurante Flutuante": ("Floating Restaurant", "Restaurante Flotante"), "Escola de Vela": ("Sailing School", "Escuela de Vela"), "Navio de Cruzeiro": ("Cruise Ship", "Crucero"),
"Galeria de Arte": ("Art Gallery", "Galería de Arte"), "Hotel 5 Estrelas": ("5-Star Hotel", "Hotel 5 Estrellas"), "Arranha-Céu": ("Skyscraper", "Rascacielos"),
"Fábrica de Eletrônicos": ("Electronics Factory", "Fábrica de Electrónicos"), "Fábrica de Aviões": ("Airplane Factory", "Fábrica de Aviones"), "Usina Hidrelétrica": ("Hydroelectric Plant", "Central Hidroeléctrica"),
"Café da Montanha": ("Mountain Café", "Café de Montaña"), "Hotel de Gelo": ("Ice Hotel", "Hotel de Hielo"), "Castelo na Neve": ("Snow Castle", "Castillo en la Nieve"),
"Bar de Sucos Tropicais": ("Tropical Juice Bar", "Bar de Jugos Tropicales"), "Parque dos Golfinhos": ("Dolphin Park", "Parque de Delfines"), "Ilha Particular": ("Private Island", "Isla Privada"),
"Restaurante Orbital": ("Orbital Restaurant", "Restaurante Orbital"), "Hotel Espacial": ("Space Hotel", "Hotel Espacial"), "Estação Espacial": ("Space Station", "Estación Espacial"),
"Loja de Tapa-Olhos": ("Eye Patch Shop", "Tienda de Parches"), "Taverna do Papagaio": ("Parrot Tavern", "Taberna del Loro"), "Loja de Mapas do Tesouro": ("Treasure Map Shop", "Tienda de Mapas del Tesoro"),
"Oficina de Barcos": ("Boat Workshop", "Taller de Barcos"), "Fábrica de Canhões": ("Cannon Factory", "Fábrica de Cañones"), "Casa das Moedas de Ouro": ("Gold Coin Mint", "Casa de la Moneda de Oro"),
"Escola de Piratas": ("Pirate School", "Escuela de Piratas"), "Farol Pirata": ("Pirate Lighthouse", "Faro Pirata"), "Caverna do Tesouro": ("Treasure Cave", "Cueva del Tesoro"),
"Galeão": ("Galleon", "Galeón"), "Forte Pirata": ("Pirate Fort", "Fuerte Pirata"), "Navio Fantasma": ("Ghost Ship", "Barco Fantasma"),
"Banca de Pérolas": ("Pearl Stand", "Puesto de Perlas"), "Salão do Polvo": ("Octopus Salon", "Salón del Pulpo"), "Jardim de Corais": ("Coral Garden", "Jardín de Corales"),
"Restaurante Submarino": ("Underwater Restaurant", "Restaurante Submarino"), "Escola de Sereias": ("Mermaid School", "Escuela de Sirenas"), "Cavalos-Marinhos Express": ("Seahorse Express", "Caballitos de Mar Express"),
"Hotel das Bolhas": ("Bubble Hotel", "Hotel de Burbujas"), "Templo de Netuno": ("Temple of Neptune", "Templo de Neptuno"), "Fábrica de Algas": ("Seaweed Factory", "Fábrica de Algas"),
"Submarino Turístico": ("Tourist Submarine", "Submarino Turístico"), "Palácio de Cristal": ("Crystal Palace", "Palacio de Cristal"), "Cidade Perdida": ("Lost City", "Ciudad Perdida"),
"Banca de Ovos de Dino": ("Dino Egg Stand", "Puesto de Huevos de Dino"), "Pet Shop de Raptors": ("Raptor Pet Shop", "Tienda de Raptores"), "Salada de Samambaia": ("Fern Salad Bar", "Ensaladas de Helecho"),
"Escola de Voo Pterodáctilo": ("Pterodactyl Flight School", "Escuela de Vuelo Pterodáctilo"), "Rodeio de Tricerátops": ("Triceratops Rodeo", "Rodeo de Triceratops"), "Parque de Fósseis": ("Fossil Park", "Parque de Fósiles"),
"Spa de Lama": ("Mud Spa", "Spa de Barro"), "Arena do T-Rex": ("T-Rex Arena", "Arena del T-Rex"), "Vulcão Turístico": ("Tourist Volcano", "Volcán Turístico"),
"Museu Jurássico": ("Jurassic Museum", "Museo Jurásico"), "Hotel na Árvore Gigante": ("Giant Tree Hotel", "Hotel en el Árbol Gigante"), "Parque dos Dinos": ("Dino Park", "Parque de Dinos"),
"Barraca de Peixe Gelado": ("Frozen Fish Stand", "Puesto de Pescado Helado"), "Iglu-Lanchonete": ("Igloo Snack Bar", "Iglú Cafetería"), "Escola de Patinação": ("Skating School", "Escuela de Patinaje"),
"Fábrica de Gravatas": ("Bow Tie Factory", "Fábrica de Corbatas"), "Tobogã de Gelo": ("Ice Slide", "Tobogán de Hielo"), "Aquário Polar": ("Polar Aquarium", "Acuario Polar"),
"Corrida de Trenó": ("Sled Race", "Carrera de Trineos"), "Teatro dos Pinguins": ("Penguin Theater", "Teatro de Pingüinos"), "Fábrica de Sorvete": ("Ice Cream Factory", "Fábrica de Helados"),
"Estação Polar": ("Polar Station", "Estación Polar"), "Castelo de Gelo": ("Ice Castle", "Castillo de Hielo"), "Palácio do Rei Pinguim": ("Penguin King Palace", "Palacio del Rey Pingüino"),
"Barraca de Algodão-Doce": ("Cotton Candy Stand", "Puesto de Algodón de Azúcar"), "Pirulitaria": ("Lollipop Shop", "Tienda de Piruletas"), "Confeitaria": ("Pastry Shop", "Pastelería"),
"Fábrica de Jujubas": ("Gummy Factory", "Fábrica de Gominolas"), "Casa de Biscoito": ("Gingerbread House", "Casa de Galleta"), "Rio de Chocolate": ("Chocolate River", "Río de Chocolate"),
"Fábrica de Chiclete": ("Bubble Gum Factory", "Fábrica de Chicle"), "Montanha de Sorvete": ("Ice Cream Mountain", "Montaña de Helado"), "Torre de Bolo": ("Cake Tower", "Torre de Pastel"),
"Parque dos Cupcakes": ("Cupcake Park", "Parque de Cupcakes"), "Castelo de Marshmallow": ("Marshmallow Castle", "Castillo de Malvavisco"), "Fábrica de Doces Gigante": ("Giant Candy Factory", "Fábrica de Dulces Gigante"),
"Loja de Piões": ("Spinning Top Shop", "Tienda de Peonzas"), "Oficina de Ursinhos": ("Teddy Bear Workshop", "Taller de Ositos"), "Fábrica de Pipas": ("Kite Factory", "Fábrica de Cometas"),
"Trem de Brinquedo": ("Toy Train", "Tren de Juguete"), "Castelo de Blocos": ("Block Castle", "Castillo de Bloques"), "Loja de Robôs": ("Robot Shop", "Tienda de Robots"),
"Parque dos Bonecos": ("Puppet Park", "Parque de Muñecos"), "Pista de Carrinhos": ("Toy Car Track", "Pista de Cochecitos"), "Fábrica de Balões": ("Balloon Factory", "Fábrica de Globos"),
"Caixa Surpresa Gigante": ("Giant Surprise Box", "Caja Sorpresa Gigante"), "Roda-Gigante": ("Ferris Wheel", "Noria"), "Palácio dos Brinquedos": ("Toy Palace", "Palacio de los Juguetes"),
"Lanchonete Lunar": ("Moon Diner", "Cafetería Lunar"), "Mina de Queijo Lunar": ("Moon Cheese Mine", "Mina de Queso Lunar"), "Estufa Lunar": ("Moon Greenhouse", "Invernadero Lunar"),
"Pista de Pulo Lunar": ("Moon Jump Park", "Pista de Saltos Lunar"), "Hotel da Cratera": ("Crater Hotel", "Hotel del Cráter"), "Fábrica de Capacetes": ("Helmet Factory", "Fábrica de Cascos"),
"Telescópio Lunar": ("Moon Telescope", "Telescopio Lunar"), "Usina de Hélio": ("Helium Plant", "Planta de Helio"), "Base de Rovers": ("Rover Base", "Base de Rovers"),
"Mercado Lunar": ("Moon Market", "Mercado Lunar"), "Domo Residencial": ("Residential Dome", "Domo Residencial"), "Porto Lunar": ("Moon Port", "Puerto Lunar"),
"Fazenda de Batatas Marcianas": ("Martian Potato Farm", "Granja de Papas Marcianas"), "Lava-Rápido de Poeira": ("Dust Car Wash", "Lavadero de Polvo"), "Mina de Ferro Vermelho": ("Red Iron Mine", "Mina de Hierro Rojo"),
"Hotel dos Marcianos": ("Martian Hotel", "Hotel de los Marcianos"), "Corrida de Rovers": ("Rover Race", "Carrera de Rovers"), "Fábrica de Oxigênio": ("Oxygen Factory", "Fábrica de Oxígeno"),
"Domo-Shopping": ("Dome Mall", "Centro Comercial Domo"), "Universidade de Marte": ("Mars University", "Universidad de Marte"), "Estação de Gelo Polar": ("Polar Ice Station", "Estación de Hielo Polar"),
"Resort do Monte Olimpo": ("Olympus Mons Resort", "Resort del Monte Olimpo"), "Torre de Comunicação": ("Communication Tower", "Torre de Comunicación"), "Cidade-Domo": ("Dome City", "Ciudad Domo"),
"Barraca de Novelos": ("Yarn Stand", "Puesto de Ovillos"), "Café dos Gatos": ("Cat Café", "Café de Gatos"), "Fábrica de Arranhadores": ("Scratching Post Factory", "Fábrica de Rascadores"),
"Spa da Soneca": ("Nap Spa", "Spa de la Siesta"), "Torre de Caixas de Papelão": ("Cardboard Box Tower", "Torre de Cajas de Cartón"), "Peixaria Real": ("Royal Fish Market", "Pescadería Real"),
"Academia do Laser": ("Laser Gym", "Gimnasio del Láser"), "Hotel Almofada": ("Pillow Hotel", "Hotel Almohada"), "Teatro do Miau": ("Meow Theater", "Teatro del Miau"),
"Parque do Ratinho": ("Toy Mouse Park", "Parque del Ratoncito"), "Foguete de Atum": ("Tuna Rocket", "Cohete de Atún"), "Palácio do Gato Rei": ("Cat King Palace", "Palacio del Gato Rey"),
"Coleta de Gelo dos Anéis": ("Ring Ice Collector", "Recolector de Hielo"), "Patinação Orbital": ("Orbital Skating", "Patinaje Orbital"), "Hotel dos Anéis": ("Ring Hotel", "Hotel de los Anillos"),
"Mina de Cristais": ("Crystal Mine", "Mina de Cristales"), "Posto de Combustível Estelar": ("Star Fuel Station", "Gasolinera Estelar"), "Restaurante Gravidade Zero": ("Zero Gravity Restaurant", "Restaurante Gravedad Cero"),
"Observatório dos Anéis": ("Ring Observatory", "Observatorio de los Anillos"), "Fábrica de Naves": ("Spaceship Factory", "Fábrica de Naves"), "Parque de Meteoros": ("Meteor Park", "Parque de Meteoros"),
"Estaleiro Espacial": ("Space Shipyard", "Astillero Espacial"), "Cidade Flutuante": ("Floating City", "Ciudad Flotante"), "Coroa de Saturno": ("Crown of Saturn", "Corona de Saturno"),
"Barraca de Gelatina": ("Jelly Stand", "Puesto de Gelatina"), "Pula-Pula Gigante": ("Giant Bouncy Castle", "Castillo Inflable Gigante"), "Fábrica de Geleca": ("Slime Factory", "Fábrica de Slime"),
"Hotel Balança-Balança": ("Wobbly Hotel", "Hotel Tambaleante"), "Piscina de Gelatina": ("Jelly Pool", "Piscina de Gelatina"), "Escorregador Arco-Íris": ("Rainbow Slide", "Tobogán Arcoíris"),
"Montanha Tremelique": ("Wobble Mountain", "Montaña Temblorosa"), "Fábrica de Bolhas": ("Bubble Factory", "Fábrica de Burbujas"), "Parque Elástico": ("Elastic Park", "Parque Elástico"),
"Torre Molenga": ("Squishy Tower", "Torre Blandita"), "Vulcão de Geleia": ("Jam Volcano", "Volcán de Mermelada"), "Castelo de Gelatina": ("Jelly Castle", "Castillo de Gelatina"),
"Central de Teletransporte": ("Teleport Center", "Central de Teletransporte"), "Mercado Intergaláctico": ("Intergalactic Market", "Mercado Intergaláctico"), "Fábrica de Estrelas": ("Star Factory", "Fábrica de Estrellas"),
"Hotel Supernova": ("Supernova Hotel", "Hotel Supernova"), "Universidade Cósmica": ("Cosmic University", "Universidad Cósmica"), "Estação Buraco Negro": ("Black Hole Station", "Estación Agujero Negro"),
"Banco Galáctico": ("Galactic Bank", "Banco Galáctico"), "Estaleiro de Naves-Mãe": ("Mothership Shipyard", "Astillero de Naves Nodriza"), "Arena dos Planetas": ("Planet Arena", "Arena de los Planetas"),
"Usina de Nebulosa": ("Nebula Plant", "Planta de Nebulosa"), "Esfera de Dyson": ("Dyson Sphere", "Esfera de Dyson"), "Palácio do Imperador": ("Emperor's Palace", "Palacio del Emperador"),
# Mapas e nomes curtos
"Ilha dos Piratas": ("Pirate Island", "Isla de los Piratas"), "Atlântida": ("Atlantis", "Atlántida"), "Vale dos Dinossauros": ("Dinosaur Valley", "Valle de los Dinosaurios"),
"Reino dos Pinguins": ("Penguin Kingdom", "Reino de los Pingüinos"), "Cidade dos Doces": ("Candy City", "Ciudad de los Dulces"), "Cidade dos Brinquedos": ("Toy City", "Ciudad de los Juguetes"),
"Base Lunar": ("Moon Base", "Base Lunar"), "Colônia em Marte": ("Mars Colony", "Colonia en Marte"), "Planeta dos Gatos": ("Cat Planet", "Planeta de los Gatos"),
"Anéis de Saturno": ("Rings of Saturn", "Anillos de Saturno"), "Planeta Gelatina": ("Jelly Planet", "Planeta Gelatina"), "Império Galáctico": ("Galactic Empire", "Imperio Galáctico"),
"a ilha dos piratas": ("Pirate Island", "la isla de los piratas"), "Atlântida ": ("Atlantis", "Atlántida"), "o vale dos dinossauros": ("Dinosaur Valley", "el valle de los dinosaurios"),
"o reino dos pinguins": ("the Penguin Kingdom", "el reino de los pingüinos"), "a cidade dos doces": ("Candy City", "la ciudad de los dulces"), "a cidade dos brinquedos": ("Toy City", "la ciudad de los juguetes"),
"a base lunar": ("the Moon Base", "la base lunar"), "a colônia em Marte": ("the Mars Colony", "la colonia en Marte"), "o planeta dos gatos": ("the Cat Planet", "el planeta de los gatos"),
"os anéis de Saturno": ("the Rings of Saturn", "los anillos de Saturno"), "o planeta gelatina": ("the Jelly Planet", "el planeta gelatina"), "o império galáctico": ("the Galactic Empire", "el imperio galáctico"),
# Conquistas
"Construa os 6 negócios da praia": ("Build all 6 beach businesses", "Construye los 6 negocios de la playa"),
"Capitão pirata": ("Pirate captain", "Capitán pirata"), "Rei dos mares": ("King of the seas", "Rey de los mares"), "Domador de dinossauros": ("Dinosaur tamer", "Domador de dinosaurios"),
"Amigo dos pinguins": ("Penguin pal", "Amigo de los pingüinos"), "Barão do açúcar": ("Sugar baron", "Barón del azúcar"), "Mestre dos brinquedos": ("Toy master", "Maestro de los juguetes"),
"Magnata da Lua": ("Moon tycoon", "Magnate de la Luna"), "Pioneiro de Marte": ("Mars pioneer", "Pionero de Marte"), "Melhor amigo dos gatos": ("Cats' best friend", "Mejor amigo de los gatos"),
"Senhor dos anéis": ("Lord of the rings", "Señor de los anillos"), "Rei da gelatina": ("Jelly king", "Rey de la gelatina"), "Imperador galáctico": ("Galactic emperor", "Emperador galáctico"),
"Quatrilionário": ("Quadrillionaire", "Cuatrillonario"), "Quintilionário": ("Quintillionaire", "Quintillonario"), "Sextilionário": ("Sextillionaire", "Sextillonario"), "Dono do universo": ("Owner of the universe", "Dueño del universo"),
"Fature 1 quatrilhão de moedas": ("Earn 1 quadrillion coins", "Gana 1 cuatrillón de monedas"), "Fature 1 quintilhão de moedas": ("Earn 1 quintillion coins", "Gana 1 quintillón de monedas"),
"Fature 1 sextilhão de moedas": ("Earn 1 sextillion coins", "Gana 1 sextillón de monedas"), "Fature 1 septilhão de moedas": ("Earn 1 septillion coins", "Gana 1 septillón de monedas"),
"Complete os 8 primeiros mapas (até o Centro Espacial) para vender: negócios e ajudantes.": ("Complete the first 8 maps (up to the Space Center) to sell: businesses and helpers.", "Completa los 8 primeros mapas (hasta el Centro Espacial) para vender: negocios y ayudantes."),
}
MAPS_EN = {"cidade": "City", "porto": "Port", "centro": "Financial Center", "industrial": "Industrial Park", "serra": "Snowy Mountains", "ilha": "Paradise Island", "espaco": "Space Center",
  "piratas": "Pirate Island", "atlantida": "Atlantis", "dinos": "Dinosaur Valley", "pinguins": "Penguin Kingdom", "doces": "Candy City", "brinquedos": "Toy City", "lua": "Moon Base",
  "marte": "Mars Colony", "gatos": "Cat Planet", "saturno": "Rings of Saturn", "gelatina": "Jelly Planet", "galaxia": "Galactic Empire"}
MAPS_ES = {"cidade": "ciudad", "porto": "puerto", "centro": "centro financiero", "industrial": "polo industrial", "serra": "sierra", "ilha": "isla", "espaco": "centro espacial",
  "piratas": "Isla de los Piratas", "atlantida": "Atlántida", "dinos": "Valle de los Dinosaurios", "pinguins": "Reino de los Pingüinos", "doces": "Ciudad de los Dulces", "brinquedos": "Ciudad de los Juguetes",
  "lua": "Base Lunar", "marte": "Colonia en Marte", "gatos": "Planeta de los Gatos", "saturno": "Anillos de Saturno", "gelatina": "Planeta Gelatina", "galaxia": "Imperio Galáctico"}
# Descrições "Construa os 12 negócios ..." vêm do servidor (achievements.ts).
import re
ach = (ROOT / "backend/src/economy/achievements.ts").read_text()
for d, desc in re.findall(r'\["(\w+)", "[^"]+", "(Construa os 12 negócios [^"]+)"', ach):
    T[desc] = (f"Build all 12 {MAPS_EN[d]} businesses", f"Construye los 12 negocios de {MAPS_ES[d]}")
T.pop("Atlântida ")
p = ROOT / "game/i18n/translations.csv"
rows = list(csv.reader(open(p, encoding="utf-8")))
have = {r[0] for r in rows}
added = 0
with open(p, "a", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    for pt, (en, es) in T.items():
        if pt not in have:
            w.writerow([pt, pt, en, es]); added += 1
print("traduções novas:", added)
