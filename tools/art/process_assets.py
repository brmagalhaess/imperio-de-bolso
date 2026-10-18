#!/usr/bin/env python3
"""Prepara a arte gerada para o Godot (direção visual v2: ilha de praia cartoon).

    python3 tools/art/process_assets.py

- Sprites: remove o fundo claro ligado às bordas (flood fill com tolerância),
  suaviza a borda, recorta e redimensiona.
- Folhas (personagens, ícones): remove o fundo e separa cada item pelos vãos vazios.
- Cenários (ilha, cidade): viram o fundo da tela em 1080×1920 (JPEG).

Originais ficam em game/assets/source/ (intocados); saídas em game/assets/optimized/.
Sprites ficam em 2× o tamanho de exibição na resolução base 720×1280.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "game/assets/source"
OUT = ROOT / "game/assets/optimized"

# id final → (arquivo de origem escolhido, {"width" ou "height": px a 2×})
SPRITES = {
    # Mapas maiores (2026-10-15): 3 negócios novos por mapa, 5 evoluções cada.
    "padaria_lv1": ("g_padaria_lv1/g_padaria_lv1_v01.jpeg", {"width": 290}),
    "padaria_lv2": ("g_padaria_lv2/g_padaria_lv2_v01.jpeg", {"width": 305}),
    "padaria_lv3": ("g_padaria_lv3/g_padaria_lv3_v01.jpeg", {"width": 320}),
    "padaria_lv4": ("g_padaria_lv4/g_padaria_lv4_v01.jpeg", {"width": 330}),
    "padaria_lv5": ("g_padaria_lv5/g_padaria_lv5_v01.jpeg", {"width": 340}),
    "farmacia_lv1": ("g_farmacia_lv1/g_farmacia_lv1_v01.jpeg", {"width": 290}),
    "farmacia_lv2": ("g_farmacia_lv2/g_farmacia_lv2_v01.jpeg", {"width": 305}),
    "farmacia_lv3": ("g_farmacia_lv3/g_farmacia_lv3_v01.jpeg", {"width": 320}),
    "farmacia_lv4": ("g_farmacia_lv4/g_farmacia_lv4_v01.jpeg", {"width": 330}),
    "farmacia_lv5": ("g_farmacia_lv5/g_farmacia_lv5_v01.jpeg", {"width": 340}),
    "cinema_lv1": ("g_cinema_lv1/g_cinema_lv1_v01.jpeg", {"width": 290}),
    "cinema_lv2": ("g_cinema_lv2/g_cinema_lv2_v01.jpeg", {"width": 305}),
    "cinema_lv3": ("g_cinema_lv3/g_cinema_lv3_v01.jpeg", {"width": 320}),
    "cinema_lv4": ("g_cinema_lv4/g_cinema_lv4_v01.jpeg", {"width": 330}),
    "cinema_lv5": ("g_cinema_lv5/g_cinema_lv5_v01.jpeg", {"width": 340}),
    "feira_porto_lv1": ("g_feira_porto_lv1/g_feira_porto_lv1_v01.jpeg", {"width": 290}),
    "feira_porto_lv2": ("g_feira_porto_lv2/g_feira_porto_lv2_v01.jpeg", {"width": 305}),
    "feira_porto_lv3": ("g_feira_porto_lv3/g_feira_porto_lv3_v01.jpeg", {"width": 320}),
    "feira_porto_lv4": ("g_feira_porto_lv4/g_feira_porto_lv4_v01.jpeg", {"width": 330}),
    "feira_porto_lv5": ("g_feira_porto_lv5/g_feira_porto_lv5_v01.jpeg", {"width": 340}),
    "clube_nautico_lv1": ("g_clube_nautico_lv1/g_clube_nautico_lv1_v01.jpeg", {"width": 290}),
    "clube_nautico_lv2": ("g_clube_nautico_lv2/g_clube_nautico_lv2_v01.jpeg", {"width": 305}),
    "clube_nautico_lv3": ("g_clube_nautico_lv3/g_clube_nautico_lv3_v01.jpeg", {"width": 320}),
    "clube_nautico_lv4": ("g_clube_nautico_lv4/g_clube_nautico_lv4_v01.jpeg", {"width": 330}),
    "clube_nautico_lv5": ("g_clube_nautico_lv5/g_clube_nautico_lv5_v01.jpeg", {"width": 340}),
    "farol_lv1": ("g_farol_lv1/g_farol_lv1_v01.jpeg", {"width": 290}),
    "farol_lv2": ("g_farol_lv2/g_farol_lv2_v01.jpeg", {"width": 305}),
    "farol_lv3": ("g_farol_lv3/g_farol_lv3_v01.jpeg", {"width": 320}),
    "farol_lv4": ("g_farol_lv4/g_farol_lv4_v01.jpeg", {"width": 330}),
    "farol_lv5": ("g_farol_lv5/g_farol_lv5_v01.jpeg", {"width": 340}),
    "hospital_lv1": ("g_hospital_lv1/g_hospital_lv1_v01.jpeg", {"width": 290}),
    "hospital_lv2": ("g_hospital_lv2/g_hospital_lv2_v01.jpeg", {"width": 305}),
    "hospital_lv3": ("g_hospital_lv3/g_hospital_lv3_v01.jpeg", {"width": 320}),
    "hospital_lv4": ("g_hospital_lv4/g_hospital_lv4_v01.jpeg", {"width": 330}),
    "hospital_lv5": ("g_hospital_lv5/g_hospital_lv5_v01.jpeg", {"width": 340}),
    "universidade_lv1": ("g_universidade_lv1/g_universidade_lv1_v01.jpeg", {"width": 290}),
    "universidade_lv2": ("g_universidade_lv2/g_universidade_lv2_v01.jpeg", {"width": 305}),
    "universidade_lv3": ("g_universidade_lv3/g_universidade_lv3_v01.jpeg", {"width": 320}),
    "universidade_lv4": ("g_universidade_lv4/g_universidade_lv4_v01.jpeg", {"width": 330}),
    "universidade_lv5": ("g_universidade_lv5/g_universidade_lv5_v01.jpeg", {"width": 340}),
    "bolsa_valores_lv1": ("g_bolsa_valores_lv1/g_bolsa_valores_lv1_v01.jpeg", {"width": 290}),
    "bolsa_valores_lv2": ("g_bolsa_valores_lv2/g_bolsa_valores_lv2_v01.jpeg", {"width": 305}),
    "bolsa_valores_lv3": ("g_bolsa_valores_lv3/g_bolsa_valores_lv3_v01.jpeg", {"width": 320}),
    "bolsa_valores_lv4": ("g_bolsa_valores_lv4/g_bolsa_valores_lv4_v01.jpeg", {"width": 330}),
    "bolsa_valores_lv5": ("g_bolsa_valores_lv5/g_bolsa_valores_lv5_v01.jpeg", {"width": 340}),
    "fabrica_brinquedos_lv1": ("g_fabrica_brinquedos_lv1/g_fabrica_brinquedos_lv1_v01.jpeg", {"width": 290}),
    "fabrica_brinquedos_lv2": ("g_fabrica_brinquedos_lv2/g_fabrica_brinquedos_lv2_v01.jpeg", {"width": 305}),
    "fabrica_brinquedos_lv3": ("g_fabrica_brinquedos_lv3/g_fabrica_brinquedos_lv3_v01.jpeg", {"width": 320}),
    "fabrica_brinquedos_lv4": ("g_fabrica_brinquedos_lv4/g_fabrica_brinquedos_lv4_v01.jpeg", {"width": 330}),
    "fabrica_brinquedos_lv5": ("g_fabrica_brinquedos_lv5/g_fabrica_brinquedos_lv5_v01.jpeg", {"width": 340}),
    "centro_logistica_lv1": ("g_centro_logistica_lv1/g_centro_logistica_lv1_v01.jpeg", {"width": 290}),
    "centro_logistica_lv2": ("g_centro_logistica_lv2/g_centro_logistica_lv2_v01.jpeg", {"width": 305}),
    "centro_logistica_lv3": ("g_centro_logistica_lv3/g_centro_logistica_lv3_v01.jpeg", {"width": 320}),
    "centro_logistica_lv4": ("g_centro_logistica_lv4/g_centro_logistica_lv4_v01.jpeg", {"width": 330}),
    "centro_logistica_lv5": ("g_centro_logistica_lv5/g_centro_logistica_lv5_v01.jpeg", {"width": 340}),
    "parque_eolico_lv1": ("g_parque_eolico_lv1/g_parque_eolico_lv1_v01.jpeg", {"width": 290}),
    "parque_eolico_lv2": ("g_parque_eolico_lv2/g_parque_eolico_lv2_v01.jpeg", {"width": 305}),
    "parque_eolico_lv3": ("g_parque_eolico_lv3/g_parque_eolico_lv3_v01.jpeg", {"width": 320}),
    "parque_eolico_lv4": ("g_parque_eolico_lv4/g_parque_eolico_lv4_v01.jpeg", {"width": 330}),
    "parque_eolico_lv5": ("g_parque_eolico_lv5/g_parque_eolico_lv5_v01.jpeg", {"width": 340}),
    "queijaria_lv1": ("g_queijaria_lv1/g_queijaria_lv1_v01.jpeg", {"width": 290}),
    "queijaria_lv2": ("g_queijaria_lv2/g_queijaria_lv2_v01.jpeg", {"width": 305}),
    "queijaria_lv3": ("g_queijaria_lv3/g_queijaria_lv3_v01.jpeg", {"width": 320}),
    "queijaria_lv4": ("g_queijaria_lv4/g_queijaria_lv4_v01.jpeg", {"width": 330}),
    "queijaria_lv5": ("g_queijaria_lv5/g_queijaria_lv5_v01.jpeg", {"width": 340}),
    "vinicola_lv1": ("g_vinicola_lv1/g_vinicola_lv1_v01.jpeg", {"width": 290}),
    "vinicola_lv2": ("g_vinicola_lv2/g_vinicola_lv2_v01.jpeg", {"width": 305}),
    "vinicola_lv3": ("g_vinicola_lv3/g_vinicola_lv3_v01.jpeg", {"width": 320}),
    "vinicola_lv4": ("g_vinicola_lv4/g_vinicola_lv4_v01.jpeg", {"width": 330}),
    "vinicola_lv5": ("g_vinicola_lv5/g_vinicola_lv5_v01.jpeg", {"width": 340}),
    "pista_patinacao_lv1": ("g_pista_patinacao_lv1/g_pista_patinacao_lv1_v01.jpeg", {"width": 290}),
    "pista_patinacao_lv2": ("g_pista_patinacao_lv2/g_pista_patinacao_lv2_v01.jpeg", {"width": 305}),
    "pista_patinacao_lv3": ("g_pista_patinacao_lv3/g_pista_patinacao_lv3_v01.jpeg", {"width": 320}),
    "pista_patinacao_lv4": ("g_pista_patinacao_lv4/g_pista_patinacao_lv4_v01.jpeg", {"width": 330}),
    "pista_patinacao_lv5": ("g_pista_patinacao_lv5/g_pista_patinacao_lv5_v01.jpeg", {"width": 340}),
    "mercado_artesanato_lv1": ("g_mercado_artesanato_lv1/g_mercado_artesanato_lv1_v01.jpeg", {"width": 290}),
    "mercado_artesanato_lv2": ("g_mercado_artesanato_lv2/g_mercado_artesanato_lv2_v01.jpeg", {"width": 305}),
    "mercado_artesanato_lv3": ("g_mercado_artesanato_lv3/g_mercado_artesanato_lv3_v01.jpeg", {"width": 320}),
    "mercado_artesanato_lv4": ("g_mercado_artesanato_lv4/g_mercado_artesanato_lv4_v01.jpeg", {"width": 330}),
    "mercado_artesanato_lv5": ("g_mercado_artesanato_lv5/g_mercado_artesanato_lv5_v01.jpeg", {"width": 340}),
    "aquario_lv1": ("g_aquario_lv1/g_aquario_lv1_v01.jpeg", {"width": 290}),
    "aquario_lv2": ("g_aquario_lv2/g_aquario_lv2_v01.jpeg", {"width": 305}),
    "aquario_lv3": ("g_aquario_lv3/g_aquario_lv3_v01.jpeg", {"width": 320}),
    "aquario_lv4": ("g_aquario_lv4/g_aquario_lv4_v01.jpeg", {"width": 330}),
    "aquario_lv5": ("g_aquario_lv5/g_aquario_lv5_v01.jpeg", {"width": 340}),
    "hotel_flutuante_lv1": ("g_hotel_flutuante_lv1/g_hotel_flutuante_lv1_v01.jpeg", {"width": 290}),
    "hotel_flutuante_lv2": ("g_hotel_flutuante_lv2/g_hotel_flutuante_lv2_v01.jpeg", {"width": 305}),
    "hotel_flutuante_lv3": ("g_hotel_flutuante_lv3/g_hotel_flutuante_lv3_v01.jpeg", {"width": 320}),
    "hotel_flutuante_lv4": ("g_hotel_flutuante_lv4/g_hotel_flutuante_lv4_v01.jpeg", {"width": 330}),
    "hotel_flutuante_lv5": ("g_hotel_flutuante_lv5/g_hotel_flutuante_lv5_v01.jpeg", {"width": 340}),
    "escola_astronautas_lv1": ("g_escola_astronautas_lv1/g_escola_astronautas_lv1_v01.jpeg", {"width": 290}),
    "escola_astronautas_lv2": ("g_escola_astronautas_lv2/g_escola_astronautas_lv2_v01.jpeg", {"width": 305}),
    "escola_astronautas_lv3": ("g_escola_astronautas_lv3/g_escola_astronautas_lv3_v01.jpeg", {"width": 320}),
    "escola_astronautas_lv4": ("g_escola_astronautas_lv4/g_escola_astronautas_lv4_v01.jpeg", {"width": 330}),
    "escola_astronautas_lv5": ("g_escola_astronautas_lv5/g_escola_astronautas_lv5_v01.jpeg", {"width": 340}),
    "laboratorio_robos_lv1": ("g_laboratorio_robos_lv1/g_laboratorio_robos_lv1_v01.jpeg", {"width": 290}),
    "laboratorio_robos_lv2": ("g_laboratorio_robos_lv2/g_laboratorio_robos_lv2_v01.jpeg", {"width": 305}),
    "laboratorio_robos_lv3": ("g_laboratorio_robos_lv3/g_laboratorio_robos_lv3_v01.jpeg", {"width": 320}),
    "laboratorio_robos_lv4": ("g_laboratorio_robos_lv4/g_laboratorio_robos_lv4_v01.jpeg", {"width": 330}),
    "laboratorio_robos_lv5": ("g_laboratorio_robos_lv5/g_laboratorio_robos_lv5_v01.jpeg", {"width": 340}),
    "elevador_espacial_lv1": ("g_elevador_espacial_lv1/g_elevador_espacial_lv1_v01.jpeg", {"width": 290}),
    "elevador_espacial_lv2": ("g_elevador_espacial_lv2/g_elevador_espacial_lv2_v01.jpeg", {"width": 305}),
    "elevador_espacial_lv3": ("g_elevador_espacial_lv3/g_elevador_espacial_lv3_v01.jpeg", {"width": 320}),
    "elevador_espacial_lv4": ("g_elevador_espacial_lv4/g_elevador_espacial_lv4_v01.jpeg", {"width": 330}),
    "elevador_espacial_lv5": ("g_elevador_espacial_lv5/g_elevador_espacial_lv5_v01.jpeg", {"width": 340}),
    # Mapas 5–8 (2026-10-14): Polo Industrial, Serra Nevada, Ilha Paraíso, Centro Espacial
    "oficina_lv1": ("g_oficina_lv1/g_oficina_lv1_v01.jpeg", {"width": 300}),
    "oficina_lv2": ("g_oficina_lv2/g_oficina_lv2_v01.jpeg", {"width": 315}),
    "oficina_lv3": ("g_oficina_lv3/g_oficina_lv3_v01.jpeg", {"width": 330}),
    "oficina_lv4": ("g_oficina_lv4/g_oficina_lv4_v01.jpeg", {"width": 340}),
    "oficina_lv5": ("g_oficina_lv5/g_oficina_lv5_v01.jpeg", {"width": 350}),
    "moveis_lv1": ("g_moveis_lv1/g_moveis_lv1_v01.jpeg", {"width": 300}),
    "moveis_lv2": ("g_moveis_lv2/g_moveis_lv2_v01.jpeg", {"width": 315}),
    "moveis_lv3": ("g_moveis_lv3/g_moveis_lv3_v01.jpeg", {"width": 330}),
    "moveis_lv4": ("g_moveis_lv4/g_moveis_lv4_v01.jpeg", {"width": 340}),
    "moveis_lv5": ("g_moveis_lv5/g_moveis_lv5_v01.jpeg", {"width": 350}),
    "metalurgica_lv1": ("g_metalurgica_lv1/g_metalurgica_lv1_v01.jpeg", {"width": 300}),
    "metalurgica_lv2": ("g_metalurgica_lv2/g_metalurgica_lv2_v01.jpeg", {"width": 315}),
    "metalurgica_lv3": ("g_metalurgica_lv3/g_metalurgica_lv3_v01.jpeg", {"width": 330}),
    "metalurgica_lv4": ("g_metalurgica_lv4/g_metalurgica_lv4_v01.jpeg", {"width": 340}),
    "metalurgica_lv5": ("g_metalurgica_lv5/g_metalurgica_lv5_v01.jpeg", {"width": 350}),
    "montadora_lv1": ("g_montadora_lv1/g_montadora_lv1_v01.jpeg", {"width": 300}),
    "montadora_lv2": ("g_montadora_lv2/g_montadora_lv2_v01.jpeg", {"width": 315}),
    "montadora_lv3": ("g_montadora_lv3/g_montadora_lv3_v01.jpeg", {"width": 330}),
    "montadora_lv4": ("g_montadora_lv4/g_montadora_lv4_v01.jpeg", {"width": 340}),
    "montadora_lv5": ("g_montadora_lv5/g_montadora_lv5_v01.jpeg", {"width": 350}),
    "refinaria_lv1": ("g_refinaria_lv1/g_refinaria_lv1_v01.jpeg", {"width": 300}),
    "refinaria_lv2": ("g_refinaria_lv2/g_refinaria_lv2_v01.jpeg", {"width": 315}),
    "refinaria_lv3": ("g_refinaria_lv3/g_refinaria_lv3_v01.jpeg", {"width": 330}),
    "refinaria_lv4": ("g_refinaria_lv4/g_refinaria_lv4_v01.jpeg", {"width": 340}),
    "refinaria_lv5": ("g_refinaria_lv5/g_refinaria_lv5_v01.jpeg", {"width": 350}),
    "usina_solar_lv1": ("g_usina_solar_lv1/g_usina_solar_lv1_v01.jpeg", {"width": 300}),
    "usina_solar_lv2": ("g_usina_solar_lv2/g_usina_solar_lv2_v01.jpeg", {"width": 315}),
    "usina_solar_lv3": ("g_usina_solar_lv3/g_usina_solar_lv3_v01.jpeg", {"width": 330}),
    "usina_solar_lv4": ("g_usina_solar_lv4/g_usina_solar_lv4_v01.jpeg", {"width": 340}),
    "usina_solar_lv5": ("g_usina_solar_lv5/g_usina_solar_lv5_v01.jpeg", {"width": 350}),
    "chocolateria_lv1": ("g_chocolateria_lv1/g_chocolateria_lv1_v01.jpeg", {"width": 300}),
    "chocolateria_lv2": ("g_chocolateria_lv2/g_chocolateria_lv2_v01.jpeg", {"width": 315}),
    "chocolateria_lv3": ("g_chocolateria_lv3/g_chocolateria_lv3_v01.jpeg", {"width": 330}),
    "chocolateria_lv4": ("g_chocolateria_lv4/g_chocolateria_lv4_v01.jpeg", {"width": 340}),
    "chocolateria_lv5": ("g_chocolateria_lv5/g_chocolateria_lv5_v01.jpeg", {"width": 350}),
    "pousada_lv1": ("g_pousada_lv1/g_pousada_lv1_v01.jpeg", {"width": 300}),
    "pousada_lv2": ("g_pousada_lv2/g_pousada_lv2_v01.jpeg", {"width": 315}),
    "pousada_lv3": ("g_pousada_lv3/g_pousada_lv3_v01.jpeg", {"width": 330}),
    "pousada_lv4": ("g_pousada_lv4/g_pousada_lv4_v01.jpeg", {"width": 340}),
    "pousada_lv5": ("g_pousada_lv5/g_pousada_lv5_v01.jpeg", {"width": 350}),
    "aluguel_esqui_lv1": ("g_aluguel_esqui_lv1/g_aluguel_esqui_lv1_v01.jpeg", {"width": 300}),
    "aluguel_esqui_lv2": ("g_aluguel_esqui_lv2/g_aluguel_esqui_lv2_v01.jpeg", {"width": 315}),
    "aluguel_esqui_lv3": ("g_aluguel_esqui_lv3/g_aluguel_esqui_lv3_v01.jpeg", {"width": 330}),
    "aluguel_esqui_lv4": ("g_aluguel_esqui_lv4/g_aluguel_esqui_lv4_v01.jpeg", {"width": 340}),
    "aluguel_esqui_lv5": ("g_aluguel_esqui_lv5/g_aluguel_esqui_lv5_v01.jpeg", {"width": 350}),
    "teleferico_lv1": ("g_teleferico_lv1/g_teleferico_lv1_v01.jpeg", {"width": 300}),
    "teleferico_lv2": ("g_teleferico_lv2/g_teleferico_lv2_v01.jpeg", {"width": 315}),
    "teleferico_lv3": ("g_teleferico_lv3/g_teleferico_lv3_v01.jpeg", {"width": 330}),
    "teleferico_lv4": ("g_teleferico_lv4/g_teleferico_lv4_v01.jpeg", {"width": 340}),
    "teleferico_lv5": ("g_teleferico_lv5/g_teleferico_lv5_v01.jpeg", {"width": 350}),
    "spa_termal_lv1": ("g_spa_termal_lv1/g_spa_termal_lv1_v01.jpeg", {"width": 300}),
    "spa_termal_lv2": ("g_spa_termal_lv2/g_spa_termal_lv2_v01.jpeg", {"width": 315}),
    "spa_termal_lv3": ("g_spa_termal_lv3/g_spa_termal_lv3_v01.jpeg", {"width": 330}),
    "spa_termal_lv4": ("g_spa_termal_lv4/g_spa_termal_lv4_v01.jpeg", {"width": 340}),
    "spa_termal_lv5": ("g_spa_termal_lv5/g_spa_termal_lv5_v01.jpeg", {"width": 350}),
    "estacao_esqui_lv1": ("g_estacao_esqui_lv1/g_estacao_esqui_lv1_v01.jpeg", {"width": 300}),
    "estacao_esqui_lv2": ("g_estacao_esqui_lv2/g_estacao_esqui_lv2_v01.jpeg", {"width": 315}),
    "estacao_esqui_lv3": ("g_estacao_esqui_lv3/g_estacao_esqui_lv3_v01.jpeg", {"width": 330}),
    "estacao_esqui_lv4": ("g_estacao_esqui_lv4/g_estacao_esqui_lv4_v01.jpeg", {"width": 340}),
    "estacao_esqui_lv5": ("g_estacao_esqui_lv5/g_estacao_esqui_lv5_v01.jpeg", {"width": 350}),
    "escola_mergulho_lv1": ("g_escola_mergulho_lv1/g_escola_mergulho_lv1_v01.jpeg", {"width": 300}),
    "escola_mergulho_lv2": ("g_escola_mergulho_lv2/g_escola_mergulho_lv2_v01.jpeg", {"width": 315}),
    "escola_mergulho_lv3": ("g_escola_mergulho_lv3/g_escola_mergulho_lv3_v01.jpeg", {"width": 330}),
    "escola_mergulho_lv4": ("g_escola_mergulho_lv4/g_escola_mergulho_lv4_v01.jpeg", {"width": 340}),
    "escola_mergulho_lv5": ("g_escola_mergulho_lv5/g_escola_mergulho_lv5_v01.jpeg", {"width": 350}),
    "bangalos_lv1": ("g_bangalos_lv1/g_bangalos_lv1_v01.jpeg", {"width": 300}),
    "bangalos_lv2": ("g_bangalos_lv2/g_bangalos_lv2_v01.jpeg", {"width": 315}),
    "bangalos_lv3": ("g_bangalos_lv3/g_bangalos_lv3_v01.jpeg", {"width": 330}),
    "bangalos_lv4": ("g_bangalos_lv4/g_bangalos_lv4_v01.jpeg", {"width": 340}),
    "bangalos_lv5": ("g_bangalos_lv5/g_bangalos_lv5_v01.jpeg", {"width": 350}),
    "parque_aquatico_lv1": ("g_parque_aquatico_lv1/g_parque_aquatico_lv1_v01.jpeg", {"width": 300}),
    "parque_aquatico_lv2": ("g_parque_aquatico_lv2/g_parque_aquatico_lv2_v01.jpeg", {"width": 315}),
    "parque_aquatico_lv3": ("g_parque_aquatico_lv3/g_parque_aquatico_lv3_v01.jpeg", {"width": 330}),
    "parque_aquatico_lv4": ("g_parque_aquatico_lv4/g_parque_aquatico_lv4_v01.jpeg", {"width": 340}),
    "parque_aquatico_lv5": ("g_parque_aquatico_lv5/g_parque_aquatico_lv5_v01.jpeg", {"width": 350}),
    "clube_golfe_lv1": ("g_clube_golfe_lv1/g_clube_golfe_lv1_v01.jpeg", {"width": 300}),
    "clube_golfe_lv2": ("g_clube_golfe_lv2/g_clube_golfe_lv2_v01.jpeg", {"width": 315}),
    "clube_golfe_lv3": ("g_clube_golfe_lv3/g_clube_golfe_lv3_v01.jpeg", {"width": 330}),
    "clube_golfe_lv4": ("g_clube_golfe_lv4/g_clube_golfe_lv4_v01.jpeg", {"width": 340}),
    "clube_golfe_lv5": ("g_clube_golfe_lv5/g_clube_golfe_lv5_v01.jpeg", {"width": 350}),
    "heliponto_lv1": ("g_heliponto_lv1/g_heliponto_lv1_v01.jpeg", {"width": 300}),
    "heliponto_lv2": ("g_heliponto_lv2/g_heliponto_lv2_v01.jpeg", {"width": 315}),
    "heliponto_lv3": ("g_heliponto_lv3/g_heliponto_lv3_v01.jpeg", {"width": 330}),
    "heliponto_lv4": ("g_heliponto_lv4/g_heliponto_lv4_v01.jpeg", {"width": 340}),
    "heliponto_lv5": ("g_heliponto_lv5/g_heliponto_lv5_v01.jpeg", {"width": 350}),
    "resort_lv1": ("g_resort_lv1/g_resort_lv1_v01.jpeg", {"width": 300}),
    "resort_lv2": ("g_resort_lv2/g_resort_lv2_v01.jpeg", {"width": 315}),
    "resort_lv3": ("g_resort_lv3/g_resort_lv3_v01.jpeg", {"width": 330}),
    "resort_lv4": ("g_resort_lv4/g_resort_lv4_v01.jpeg", {"width": 340}),
    "resort_lv5": ("g_resort_lv5/g_resort_lv5_v01.jpeg", {"width": 350}),
    "observatorio_lv1": ("g_observatorio_lv1/g_observatorio_lv1_v01.jpeg", {"width": 300}),
    "observatorio_lv2": ("g_observatorio_lv2/g_observatorio_lv2_v01.jpeg", {"width": 315}),
    "observatorio_lv3": ("g_observatorio_lv3/g_observatorio_lv3_v01.jpeg", {"width": 330}),
    "observatorio_lv4": ("g_observatorio_lv4/g_observatorio_lv4_v01.jpeg", {"width": 340}),
    "observatorio_lv5": ("g_observatorio_lv5/g_observatorio_lv5_v01.jpeg", {"width": 350}),
    "museu_espaco_lv1": ("g_museu_espaco_lv1/g_museu_espaco_lv1_v01.jpeg", {"width": 300}),
    "museu_espaco_lv2": ("g_museu_espaco_lv2/g_museu_espaco_lv2_v01.jpeg", {"width": 315}),
    "museu_espaco_lv3": ("g_museu_espaco_lv3/g_museu_espaco_lv3_v01.jpeg", {"width": 330}),
    "museu_espaco_lv4": ("g_museu_espaco_lv4/g_museu_espaco_lv4_v01.jpeg", {"width": 340}),
    "museu_espaco_lv5": ("g_museu_espaco_lv5/g_museu_espaco_lv5_v01.jpeg", {"width": 350}),
    "fabrica_satelites_lv1": ("g_fabrica_satelites_lv1/g_fabrica_satelites_lv1_v01.jpeg", {"width": 300}),
    "fabrica_satelites_lv2": ("g_fabrica_satelites_lv2/g_fabrica_satelites_lv2_v01.jpeg", {"width": 315}),
    "fabrica_satelites_lv3": ("g_fabrica_satelites_lv3/g_fabrica_satelites_lv3_v01.jpeg", {"width": 330}),
    "fabrica_satelites_lv4": ("g_fabrica_satelites_lv4/g_fabrica_satelites_lv4_v01.jpeg", {"width": 340}),
    "fabrica_satelites_lv5": ("g_fabrica_satelites_lv5/g_fabrica_satelites_lv5_v01.jpeg", {"width": 350}),
    "centro_controle_lv1": ("g_centro_controle_lv1/g_centro_controle_lv1_v01.jpeg", {"width": 300}),
    "centro_controle_lv2": ("g_centro_controle_lv2/g_centro_controle_lv2_v01.jpeg", {"width": 315}),
    "centro_controle_lv3": ("g_centro_controle_lv3/g_centro_controle_lv3_v01.jpeg", {"width": 330}),
    "centro_controle_lv4": ("g_centro_controle_lv4/g_centro_controle_lv4_v01.jpeg", {"width": 340}),
    "centro_controle_lv5": ("g_centro_controle_lv5/g_centro_controle_lv5_v01.jpeg", {"width": 350}),
    "foguete_lv1": ("g_foguete_lv1/g_foguete_lv1_v01.jpeg", {"width": 300}),
    "foguete_lv2": ("g_foguete_lv2/g_foguete_lv2_v01.jpeg", {"width": 315}),
    "foguete_lv3": ("g_foguete_lv3/g_foguete_lv3_v01.jpeg", {"width": 330}),
    "foguete_lv4": ("g_foguete_lv4/g_foguete_lv4_v01.jpeg", {"width": 340}),
    "foguete_lv5": ("g_foguete_lv5/g_foguete_lv5_v01.jpeg", {"width": 350}),
    "porto_espacial_lv1": ("g_porto_espacial_lv1/g_porto_espacial_lv1_v01.jpeg", {"width": 300}),
    "porto_espacial_lv2": ("g_porto_espacial_lv2/g_porto_espacial_lv2_v01.jpeg", {"width": 315}),
    "porto_espacial_lv3": ("g_porto_espacial_lv3/g_porto_espacial_lv3_v01.jpeg", {"width": 330}),
    "porto_espacial_lv4": ("g_porto_espacial_lv4/g_porto_espacial_lv4_v01.jpeg", {"width": 340}),
    "porto_espacial_lv5": ("g_porto_espacial_lv5/g_porto_espacial_lv5_v01.jpeg", {"width": 350}),
    # Porto da Marina e Centro Financeiro (2026-10-13)
    "peixaria_lv1": ("g_peixaria_lv1/g_peixaria_lv1_v01.jpeg", {"width": 290}),
    "peixaria_lv2": ("g_peixaria_lv2/g_peixaria_lv2_v01.jpeg", {"width": 305}),
    "peixaria_lv3": ("g_peixaria_lv3/g_peixaria_lv3_v01.jpeg", {"width": 320}),
    "peixaria_lv4": ("g_peixaria_lv4/g_peixaria_lv4_v01.jpeg", {"width": 330}),
    "peixaria_lv5": ("g_peixaria_lv5/g_peixaria_lv5_v01.jpeg", {"width": 340}),
    "loja_surf_lv1": ("g_loja_surf_lv1/g_loja_surf_lv1_v01.jpeg", {"width": 290}),
    "loja_surf_lv2": ("g_loja_surf_lv2/g_loja_surf_lv2_v01.jpeg", {"width": 305}),
    "loja_surf_lv3": ("g_loja_surf_lv3/g_loja_surf_lv3_v01.jpeg", {"width": 320}),
    "loja_surf_lv4": ("g_loja_surf_lv4/g_loja_surf_lv4_v01.jpeg", {"width": 330}),
    "loja_surf_lv5": ("g_loja_surf_lv5/g_loja_surf_lv5_v01.jpeg", {"width": 340}),
    "frutos_mar_lv1": ("g_frutos_mar_lv1/g_frutos_mar_lv1_v01.jpeg", {"width": 290}),
    "frutos_mar_lv2": ("g_frutos_mar_lv2/g_frutos_mar_lv2_v01.jpeg", {"width": 305}),
    "frutos_mar_lv3": ("g_frutos_mar_lv3/g_frutos_mar_lv3_v01.jpeg", {"width": 320}),
    "frutos_mar_lv4": ("g_frutos_mar_lv4/g_frutos_mar_lv4_v01.jpeg", {"width": 330}),
    "frutos_mar_lv5": ("g_frutos_mar_lv5/g_frutos_mar_lv5_v01.jpeg", {"width": 340}),
    "marina_lv1": ("g_marina_lv1/g_marina_lv1_v01.jpeg", {"width": 290}),
    "marina_lv2": ("g_marina_lv2/g_marina_lv2_v01.jpeg", {"width": 305}),
    "marina_lv3": ("g_marina_lv3/g_marina_lv3_v01.jpeg", {"width": 320}),
    "marina_lv4": ("g_marina_lv4/g_marina_lv4_v01.jpeg", {"width": 330}),
    "marina_lv5": ("g_marina_lv5/g_marina_lv5_v01.jpeg", {"width": 340}),
    "estaleiro_lv1": ("g_estaleiro_lv1_r2/g_estaleiro_lv1_r2_v01.jpeg", {"width": 290}),
    "estaleiro_lv2": ("g_estaleiro_lv2/g_estaleiro_lv2_v01.jpeg", {"width": 305}),
    "estaleiro_lv3": ("g_estaleiro_lv3/g_estaleiro_lv3_v01.jpeg", {"width": 320}),
    "estaleiro_lv4": ("g_estaleiro_lv4/g_estaleiro_lv4_v01.jpeg", {"width": 330}),
    "estaleiro_lv5": ("g_estaleiro_lv5/g_estaleiro_lv5_v01.jpeg", {"width": 340}),
    "terminal_lv1": ("g_terminal_lv1/g_terminal_lv1_v01.jpeg", {"width": 290}),
    "terminal_lv2": ("g_terminal_lv2/g_terminal_lv2_v01.jpeg", {"width": 305}),
    "terminal_lv3": ("g_terminal_lv3/g_terminal_lv3_v01.jpeg", {"width": 320}),
    "terminal_lv4": ("g_terminal_lv4/g_terminal_lv4_v01.jpeg", {"width": 330}),
    "terminal_lv5": ("g_terminal_lv5/g_terminal_lv5_v01.jpeg", {"width": 340}),
    "joalheria_lv1": ("g_joalheria_lv1/g_joalheria_lv1_v01.jpeg", {"width": 300}),
    "joalheria_lv2": ("g_joalheria_lv2/g_joalheria_lv2_v01.jpeg", {"width": 315}),
    "joalheria_lv3": ("g_joalheria_lv3/g_joalheria_lv3_v01.jpeg", {"width": 330}),
    "joalheria_lv4": ("g_joalheria_lv4/g_joalheria_lv4_v01.jpeg", {"width": 340}),
    "joalheria_lv5": ("g_joalheria_lv5/g_joalheria_lv5_v01.jpeg", {"width": 350}),
    "banco_lv1": ("g_banco_lv1/g_banco_lv1_v01.jpeg", {"width": 300}),
    "banco_lv2": ("g_banco_lv2/g_banco_lv2_v01.jpeg", {"width": 315}),
    "banco_lv3": ("g_banco_lv3/g_banco_lv3_v01.jpeg", {"width": 330}),
    "banco_lv4": ("g_banco_lv4/g_banco_lv4_v01.jpeg", {"width": 340}),
    "banco_lv5": ("g_banco_lv5/g_banco_lv5_v01.jpeg", {"width": 350}),
    "torre_lv1": ("g_torre_lv1/g_torre_lv1_v01.jpeg", {"width": 300}),
    "torre_lv2": ("g_torre_lv2/g_torre_lv2_v01.jpeg", {"width": 315}),
    "torre_lv3": ("g_torre_lv3/g_torre_lv3_v01.jpeg", {"width": 330}),
    "torre_lv4": ("g_torre_lv4/g_torre_lv4_v01.jpeg", {"width": 340}),
    "torre_lv5": ("g_torre_lv5/g_torre_lv5_v01.jpeg", {"width": 350}),
    "convencoes_lv1": ("g_convencoes_lv1/g_convencoes_lv1_v01.jpeg", {"width": 300}),
    "convencoes_lv2": ("g_convencoes_lv2/g_convencoes_lv2_v01.jpeg", {"width": 315}),
    "convencoes_lv3": ("g_convencoes_lv3/g_convencoes_lv3_v01.jpeg", {"width": 330}),
    "convencoes_lv4": ("g_convencoes_lv4/g_convencoes_lv4_v01.jpeg", {"width": 340}),
    "convencoes_lv5": ("g_convencoes_lv5/g_convencoes_lv5_v01.jpeg", {"width": 350}),
    "estadio_lv1": ("g_estadio_lv1/g_estadio_lv1_v01.jpeg", {"width": 300}),
    "estadio_lv2": ("g_estadio_lv2/g_estadio_lv2_v01.jpeg", {"width": 315}),
    "estadio_lv3": ("g_estadio_lv3/g_estadio_lv3_v01.jpeg", {"width": 330}),
    "estadio_lv4": ("g_estadio_lv4/g_estadio_lv4_v01.jpeg", {"width": 340}),
    "estadio_lv5": ("g_estadio_lv5/g_estadio_lv5_v01.jpeg", {"width": 350}),
    "aeroporto_lv1": ("g_aeroporto_lv1/g_aeroporto_lv1_v01.jpeg", {"width": 300}),
    "aeroporto_lv2": ("g_aeroporto_lv2/g_aeroporto_lv2_v01.jpeg", {"width": 315}),
    "aeroporto_lv3": ("g_aeroporto_lv3/g_aeroporto_lv3_v01.jpeg", {"width": 330}),
    "aeroporto_lv4": ("g_aeroporto_lv4/g_aeroporto_lv4_v01.jpeg", {"width": 340}),
    "aeroporto_lv5": ("g_aeroporto_lv5/g_aeroporto_lv5_v01.jpeg", {"width": 350}),
    "water_cart_lv1": ("g_water_cart_lv1/g_water_cart_lv1_v01.jpeg", {"width": 250}),
    "water_cart_lv2": ("g_water_cart_lv2/g_water_cart_lv2_v01.jpeg", {"width": 260}),
    "water_cart_lv3": ("g_water_cart_lv3/g_water_cart_lv3_v01.jpeg", {"width": 270}),
    "water_cart_lv4": ("g_water_cart_lv4/g_water_cart_lv4_v01.jpeg", {"width": 280}),
    "water_cart_lv5": ("g_water_cart_lv5/g_water_cart_lv5_v01.jpeg", {"width": 290}),
    "popcorn_cart_lv1": ("g_popcorn_cart_lv1/g_popcorn_cart_lv1_v01.jpeg", {"width": 240}),
    "popcorn_cart_lv2": ("g_popcorn_cart_lv2/g_popcorn_cart_lv2_v01.jpeg", {"width": 260}),
    "popcorn_cart_lv3": ("g_popcorn_cart_lv3/g_popcorn_cart_lv3_v01.jpeg", {"width": 280}),
    "popcorn_cart_lv4": ("g_popcorn_cart_lv4/g_popcorn_cart_lv4_v01.jpeg", {"width": 290}),
    "popcorn_cart_lv5": ("g_popcorn_cart_lv5/g_popcorn_cart_lv5_v01.jpeg", {"width": 300}),
    "icecream_cart_lv1": ("g_icecream_cart_lv1/g_icecream_cart_lv1_v01.jpeg", {"width": 230}),
    "icecream_cart_lv2": ("g_icecream_cart_lv2/g_icecream_cart_lv2_v01.jpeg", {"width": 250}),
    "icecream_cart_lv3": ("g_icecream_cart_lv3/g_icecream_cart_lv3_v01.jpeg", {"width": 270}),
    "icecream_cart_lv4": ("g_icecream_cart_lv4/g_icecream_cart_lv4_v01.jpeg", {"width": 280}),
    "icecream_cart_lv5": ("g_icecream_cart_lv5/g_icecream_cart_lv5_v01.jpeg", {"width": 290}),
    "coconut_kiosk_lv1": ("g_coconut_kiosk_lv1/g_coconut_kiosk_lv1_v01.jpeg", {"width": 250}),
    "coconut_kiosk_lv2": ("g_coconut_kiosk_lv2/g_coconut_kiosk_lv2_v01.jpeg", {"width": 280}),
    "coconut_kiosk_lv3": ("g_coconut_kiosk_lv3/g_coconut_kiosk_lv3_v01.jpeg", {"width": 310}),
    "coconut_kiosk_lv4": ("g_coconut_kiosk_lv4/g_coconut_kiosk_lv4_v01.jpeg", {"width": 320}),
    "coconut_kiosk_lv5": ("g_coconut_kiosk_lv5/g_coconut_kiosk_lv5_v01.jpeg", {"width": 330}),
    "lot_lock": ("g_lot_lock/g_lot_lock_v01.jpeg", {"width": 130}),
    # Cidade-maquete (mockup D)
    "market_lv1": ("g_market_lv1/g_market_lv1_v01.jpeg", {"width": 280}),
    "market_lv2": ("g_market_lv2/g_market_lv2_v01.jpeg", {"width": 290}),
    "market_lv3": ("g_market_lv3_r2/g_market_lv3_r2_v01.jpeg", {"width": 300}),
    "market_lv4": ("g_market_lv4/g_market_lv4_v01.jpeg", {"width": 310}),
    "market_lv5": ("g_market_lv5/g_market_lv5_v01.jpeg", {"width": 320}),
    "restaurant_lv1": ("g_restaurant_lv1_r2/g_restaurant_lv1_r2_v01.jpeg", {"width": 280}),
    "restaurant_lv2": ("g_restaurant_lv2/g_restaurant_lv2_v01.jpeg", {"width": 290}),
    "restaurant_lv3": ("g_restaurant_lv3/g_restaurant_lv3_v01.jpeg", {"width": 300}),
    "restaurant_lv4": ("g_restaurant_lv4/g_restaurant_lv4_v01.jpeg", {"width": 310}),
    "restaurant_lv5": ("g_restaurant_lv5/g_restaurant_lv5_v01.jpeg", {"width": 320}),
    "supermarket_lv1": ("g_supermarket_lv1/g_supermarket_lv1_v01.jpeg", {"width": 280}),
    "supermarket_lv2": ("g_supermarket_lv2_r2/g_supermarket_lv2_r2_v01.jpeg", {"width": 290}),
    "supermarket_lv3": ("g_supermarket_lv3/g_supermarket_lv3_v01.jpeg", {"width": 310}),
    "supermarket_lv4": ("g_supermarket_lv4/g_supermarket_lv4_v01.jpeg", {"width": 320}),
    "supermarket_lv5": ("g_supermarket_lv5/g_supermarket_lv5_v01.jpeg", {"width": 330}),
    "gym_lv1": ("g_gym_lv1/g_gym_lv1_v01.jpeg", {"width": 280}),
    "gym_lv2": ("g_gym_lv2/g_gym_lv2_v01.jpeg", {"width": 290}),
    "gym_lv3": ("g_gym_lv3/g_gym_lv3_v01.jpeg", {"width": 310}),
    "gym_lv4": ("g_gym_lv4/g_gym_lv4_v01.jpeg", {"width": 320}),
    "gym_lv5": ("g_gym_lv5/g_gym_lv5_v01.jpeg", {"width": 330}),
    "hotel_lv1": ("g_hotel_lv1_r2/g_hotel_lv1_r2_v01.jpeg", {"width": 270}),
    "hotel_lv2": ("g_hotel_lv2/g_hotel_lv2_v01.jpeg", {"width": 280}),
    "hotel_lv3": ("g_hotel_lv3/g_hotel_lv3_v01.jpeg", {"width": 290}),
    "hotel_lv4": ("g_hotel_lv4/g_hotel_lv4_v01.jpeg", {"width": 300}),
    "hotel_lv5": ("g_hotel_lv5/g_hotel_lv5_v01.jpeg", {"width": 310}),
    "mall_lv1": ("g_mall_lv1_r2/g_mall_lv1_r2_v01.jpeg", {"width": 290}),
    "mall_lv2": ("g_mall_lv2/g_mall_lv2_v01.jpeg", {"width": 300}),
    "mall_lv3": ("g_mall_lv3/g_mall_lv3_v01.jpeg", {"width": 320}),
    "mall_lv4": ("g_mall_lv4/g_mall_lv4_v01.jpeg", {"width": 330}),
    "mall_lv5": ("g_mall_lv5/g_mall_lv5_v01.jpeg", {"width": 340}),
    "beach_umbrella": ("g_beach_umbrella/g_beach_umbrella_v01.jpeg", {"width": 150}),
    "icon_helpers": ("g_icon_helpers/g_icon_helpers_v01.jpeg", {"width": 176}),
}

# Folhas: arquivo → lista de ids na ordem de leitura (linhas de cima p/ baixo, esq. → dir.)
SHEETS = {
    "g_helpers_novos_a/g_helpers_novos_a_v01.png": (
        ["helper_padaria", "helper_farmacia", "helper_cinema", "helper_feira_porto", "helper_clube_nautico", "helper_farol", "helper_hospital"],
        {"height": 140},
    ),
    "g_helpers_novos_b/g_helpers_novos_b_v01.png": (
        ["helper_universidade", "helper_bolsa_valores", "helper_fabrica_brinquedos", "helper_centro_logistica", "helper_parque_eolico", "helper_queijaria", "helper_vinicola"],
        {"height": 140},
    ),
    "g_helpers_novos_c/g_helpers_novos_c_v01.png": (
        ["helper_pista_patinacao", "helper_mercado_artesanato", "helper_aquario", "helper_hotel_flutuante", "helper_escola_astronautas", "helper_laboratorio_robos", "helper_elevador_espacial"],
        {"height": 140},
    ),
    "g_helpers_industrial/g_helpers_industrial_v01.png": (
        ["helper_oficina", "helper_moveis", "helper_metalurgica", "helper_montadora", "helper_refinaria", "helper_usina_solar"],
        {"height": 140},
    ),
    "g_helpers_serra/g_helpers_serra_v01.png": (
        ["helper_chocolateria", "helper_pousada", "helper_aluguel_esqui", "helper_teleferico", "helper_spa_termal", "helper_estacao_esqui"],
        {"height": 140},
    ),
    "g_helpers_ilha/g_helpers_ilha_v01.png": (
        ["helper_escola_mergulho", "helper_bangalos", "helper_parque_aquatico", "helper_clube_golfe", "helper_heliponto", "helper_resort"],
        {"height": 140},
    ),
    "g_helpers_espaco/g_helpers_espaco_v01.png": (
        ["helper_observatorio", "helper_museu_espaco", "helper_fabrica_satelites", "helper_centro_controle", "helper_foguete", "helper_porto_espacial"],
        {"height": 140},
    ),
    "g_characters2/g_characters2_v01.png": (
        ["char_vendor", "char_woman", "char_boy", "char_grandma", "char_tourist", "char_kid"],
        {"height": 132},
    ),
    # Pacotes promocionais (ADR 0024): ícones da coluna direita e da tela do pacote.
    "g_offers_a/g_offers_a_v02.png": (
        ["offer_iniciante", "offer_combo_turbo", "offer_empreendedor", "offer_fim_de_semana",
         "offer_investidor", "offer_express", "offer_mala_de_ouro", "offer_magnata"],
        {"width": 200},
    ),
    "g_offers_b/g_offers_b_v01.png": (
        ["offer_tesouro_real", "offer_lenda", "offer_carnaval", "offer_pascoa",
         "offer_dia_das_maes", "offer_festa_junina", "offer_dia_dos_pais", "offer_independencia"],
        {"width": 200},
    ),
    "g_offers_c/g_offers_c_v01.png": (
        ["offer_dia_das_criancas", "offer_black_friday", "offer_natal", "offer_ano_novo"],
        {"width": 200},
    ),
    "g_ui_icons/g_ui_icons_v01.png": (
        ["icon_build", "icon_shop", "icon_map", "icon_profile",
         "icon_coin", None, "icon_settings", "icon_help"],  # None = bolha (desenhada no código)
        {"width": 176},
    ),
    "g_helpers_praia/g_helpers_praia_v01.png": (
        ["helper_agua", "helper_pipoca", "helper_sorveteria", "helper_quiosque_coco",
         "helper_mercadinho"],
        {"height": 140},
    ),
    "g_helpers_porto/g_helpers_porto_v01.png": (
        ["helper_peixaria", "helper_loja_surf", "helper_frutos_mar", "helper_marina",
         "helper_estaleiro", "helper_terminal"],
        {"height": 140},
    ),
    "g_helpers_centro/g_helpers_centro_v01.png": (
        ["helper_joalheria", "helper_banco", "helper_torre", "helper_convencoes",
         "helper_estadio", "helper_aeroporto"],
        {"height": 140},
    ),
    "g_helpers_cidade/g_helpers_cidade_v01.png": (
        ["helper_restaurante", "helper_supermercado", "helper_academia", "helper_hotel",
         "helper_shopping"],
        {"height": 140},
    ),
}
SHEET_OVERRIDES = {"icon_coin": {"width": 96}}

SCENES = {
    "island_base": ("g_island_base/g_island_base_v01.png", (1080, 1920)),
    "city_base": ("g_city_base/g_city_base_v01.png", (1080, 1920)),
    "porto_base": ("g_porto_base/g_porto_base_v01.jpeg", (1080, 1920)),
    "centro_base": ("g_centro_base/g_centro_base_v02.jpeg", (1080, 1920)),
    "industrial_base": ("g_industrial_base/g_industrial_base_v01.jpeg", (1080, 1920)),
    "serra_base": ("g_serra_base/g_serra_base_v01.jpeg", (1080, 1920)),
    "ilha_base": ("g_ilha_base/g_ilha_base_v01.jpeg", (1080, 1920)),
    "espaco_base": ("g_espaco_base/g_espaco_base_v01.jpeg", (1080, 1920)),
}

BG_TOLERANCE = 30  # distância máxima de cor até o fundo (0–441)


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """True nos pixels de fundo conectados à borda e parecidos com a cor de fundo."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.float32)
    bg = np.median(border, axis=0)
    close = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2) <= BG_TOLERANCE

    mask = np.zeros((h, w), dtype=bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                mask[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not mask[y, x]:
                mask[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True
                queue.append((ny, nx))
    return mask


def cutout(im: Image.Image) -> Image.Image:
    """RGB → RGBA com o fundo removido e borda suavizada (sem recortar)."""
    rgb = np.asarray(im.convert("RGB"))
    alpha = Image.fromarray(np.where(background_mask(rgb), 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = im.convert("RGB")
    rgba.putalpha(alpha)
    return rgba


def trim_and_resize(rgba: Image.Image, target: dict) -> Image.Image:
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    rgba = rgba.crop(bbox)
    w, h = rgba.size
    if "width" in target:
        size = (target["width"], round(h * target["width"] / w))
    else:
        size = (round(w * target["height"] / h), target["height"])
    return rgba.resize(size, Image.LANCZOS)


def runs(filled: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """Intervalos [início, fim) de posições preenchidas separados por vãos ≥ min_gap."""
    out, start, gap = [], None, 0
    for i, f in enumerate(filled):
        if f:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        out.append((start, len(filled) - gap))
    return out


def split_touching(items: list[Image.Image], expected: int) -> list[Image.Image]:
    """Figuras encostadas: divide a peça mais larga na coluna mais vazia do seu miolo."""
    while len(items) < expected:
        i = max(range(len(items)), key=lambda k: items[k].width)
        item = items[i]
        cover = (np.asarray(item.getchannel("A")) > 8).sum(axis=0)
        lo, hi = int(item.width * 0.3), int(item.width * 0.7)
        cut = lo + int(np.argmin(cover[lo:hi]))
        left = item.crop((0, 0, cut, item.height))
        right = item.crop((cut, 0, item.width, item.height))
        items[i:i + 1] = [left, right]
    return items


def split_sheet(rgba: Image.Image) -> list[Image.Image]:
    """Separa itens de uma folha: primeiro em linhas, depois em colunas, pelos vãos."""
    a = np.asarray(rgba.getchannel("A")) > 8
    gap = 3
    items = []
    for y0, y1 in runs(a.any(axis=1), gap):
        row = a[y0:y1]
        for x0, x1 in runs(row.any(axis=0), gap):
            if (x1 - x0) * (y1 - y0) > 400:  # ignora sujeira
                items.append(rgba.crop((x0, y0, x1, y1)))
    return items


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    for name, (rel, target) in SPRITES.items():
        if not (SRC / rel).exists():
            print(f"(ainda sem origem) {name}: {rel}")
            continue
        im = Image.open(SRC / rel)
        im.thumbnail((1024, 1024), Image.LANCZOS)
        out = trim_and_resize(cutout(im), target)
        out.save(OUT / f"{name}.png", optimize=True)
        print(f"sprite {name}: {out.size[0]}×{out.size[1]}")

    for rel, (names, target) in SHEETS.items():
        im = Image.open(SRC / rel)
        im.thumbnail((2048, 2048), Image.LANCZOS)
        items = split_touching(split_sheet(cutout(im)), len(names))
        if len(items) != len(names):
            raise SystemExit(f"{rel}: esperava {len(names)} itens, encontrei {len(items)}")
        for name, item in zip(names, items):
            if name is None:
                continue
            out = trim_and_resize(item, SHEET_OVERRIDES.get(name, target))
            out.save(OUT / f"{name}.png", optimize=True)
            print(f"folha  {name}: {out.size[0]}×{out.size[1]}")

    for name, (rel, size) in SCENES.items():
        scene = Image.open(SRC / rel).convert("RGB").resize(size, Image.LANCZOS)
        scene.save(OUT / f"{name}.jpg", quality=88, optimize=True)
        print(f"cena   {name}: {size[0]}×{size[1]}")


if __name__ == "__main__":
    main()
