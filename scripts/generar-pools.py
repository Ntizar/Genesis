# -*- coding: utf-8 -*-
"""
GÉNESIS — generación de pools por época histórica desde datasheets G25 antiguas.
Salida: data/pools.json (centroides 25D + miembros + anclas geográficas)
Reproducible: python scripts/generar-pools.py
"""
import json, re, collections, math, os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

def cargar(archivo):
    lineas = open(os.path.join(RAIZ, "data", "src", archivo), encoding="utf-8").read().strip().split("\n")
    out = []
    for l in lineas[1:]:
        x = l.split(",")
        out.append((x[0], [float(v) for v in x[1:26]]))
    return out

antiguas = cargar("ancient.txt")

# ============ Definición de POOLS (prefijos exactos de datasheet; verificado) ============
# Cada pool: id, etiqueta, época (años), color, grupos de datasheet que incluye,
# grupos excluidos explícitos (outliers oEastMed etc. van a otros pools si procede)
POOLS = [
    {
        "id": "paleolitico", "etiqueta": "Paleolítico y Mesolítico", "inicio": -45000, "fin": -6000,
        "color": "#1d4ed8", "ancla": [43.35, -6.8],
        "grupos": ["Spain_UP_Azilian", "Spain_ElMiron", "Spain_HG.SG", "Portugal_Geometric_Mesolithic",
                   "France_NouvelleAquitaine_Mesolithic.SG", "Italy_North_Villabruna_HG", "Belgium_UP_GoyetQ116_1"],
        "notas": "Cazadores-recolectores del sur de Europa (Aziliense, El Mirón, Villabruna)."
    },
    {
        "id": "neolitico", "etiqueta": "Neolítico", "inicio": -6000, "fin": -2200,
        "color": "#2563eb", "ancla": [42.3, -1.5],
        "grupos": ["Spain_C", "Spain_C.SG", "Portugal_C", "Portugal_C.SG", "Spain_EN", "Spain_EN.SG",
                   "Portugal_MN.SG", "Portugal_LN_C", "Portugal_LN_C.SG", "Spain_MN.SG",
                   "Spain_MLN", "Spain_LN.SG", "Portugal_MBA.SG", "France_EN", "France_EN_MN",
                   "France_MN", "Spain_NE_Iberia_BA", "Gibraltar_EN"],
        "notas": "Agricultores y pastores del Neolítico y Calcolítico ibérico (incluye megalíticos y Los Millares)."
    },
    {
        "id": "bronce", "etiqueta": "Edad del Bronce y Argar", "inicio": -2200, "fin": -1000,
        "color": "#0ea5e9", "ancla": [37.6, -2.0],
        "grupos": ["Spain_EBA", "Spain_MBA", "Spain_LBA", "Spain_Almoloya_Argar", "Spain_Almoloya_Argar_Early",
                   "Spain_Almoloya_Argar_Late", "Spain_Bastida_Argar",
                   "Spain_Bastida_Argar_Late", "Spain_MolinosPapel_Early_Argar", "Spain_Zapateria_Argar",
                   "Spain_SE_Iberia_BA_Argar", "Spain_SE_Iberia_BA_Valencian", "Spain_Aritgues_LBA",
                   "Spain_SE_CabezoRedondo_BA", "Spain_LaHorna_BA_1d.LHO001", "Spain_Menorca_LBA_new",
                   "Spain_EBA_Mallorca", "Spain_Formentera_MBA", "Spain_MBA_Formentera_noUDG",
                   "Spain_BA.SG", "Gibraltar_EBA", "Portugal_MBA.SG" ,
                   "Spain_C_oSteppe", "Portugal_LN_C_oSteppe" if False else "Spain_C_oSteppe"],
        "notas": "Edad del Bronce hispana y cultura de El Argar (steppes influencia incipiente incluida)."
    },
    {
        "id": "hierro", "etiqueta": "Edad del Hierro (celtíberos, íberos, tartesios)", "inicio": -1000, "fin": -218,
        "color": "#0891b2", "ancla": [40.5, -3.5],
        "grupos": ["Spain_IA", "Spain_IA_Celt", "Spain_IA_Celt_o", "Spain_LIA", "Spain_EIA_Tartessian",
                   "France_HautsDeFrance_IA2.SG"],
        "notas": "Pueblos prerromanos: celtíberos, íberos, tartesios y galaicos."
    },
    {
        "id": "roma", "etiqueta": "Roma imperial y antigüedad tardía", "inicio": -218, "fin": 500,
        "color": "#f97316", "ancla": [41.9, 12.5],
        "grupos": ["Spain_Roman", "Spain_Roman_oLocal", "Spain_Roman_oMixed", "Spain_Hellenistic_oLocal",
                   "Spain_Hellenistic_oMixed", "Spain_Greek_oLocal", "Portugal_Conimbriga_Roman.SG",
                   "Portugal_Miroico_LateRoman.SG", "Portugal_MonteDaNora_LateRoman.SG",
                   "Italy_IA_Republic.SG", "Italy_IA_Republic_o.SG",
                   "Italy_Imperial.SG", "Italy_Lazio_Viterbo_Imperial", "Italy_Tuscany_Grosseto_Imperial",
                   "Italy_CasalBertone_RomanImperial", "Italy_IsolaSacra_RomanImperial.SG",
                   "Italy_IsolaSacra_RomanImperial_oEurope.SG", "Italy_Lazio_Viterbo_Etruscan",
                   "Italy_Tuscany_Grosseto_Etruscan", "Italy_Tuscany_Pisa_Etruscan",
                   "Italy_Tuscany_Siena_Etruscan", "Italy_Sardinia_SantImbenia_RomanImperial.SG"],
        "notas": "Hispania romana, Roma imperial y núcleo itálico (republicano, imperial y etrusco). Los flujos oAfrica/oLevant van a otros pools."
    },
    {
        "id": "visigodo", "etiqueta": "Visigodos y alta Edad Media", "inicio": 500, "fin": 900,
        "color": "#92400e", "ancla": [40.4, -3.7],
        "grupos": ["Spain_Visigoth", "Spain_Visigoth_Barcelona", "Spain_Visigoth_Granada",
                   "Spain_Carolingian", "Spain_Medieval", "Italy_North_EarlyMedieval_Langobards_1",
                   "Italy_North_EarlyMedieval_Langobards_2", "Italy_North_EarlyMedieval_Langobards_3"],
        "notas": "Época visigoda, carolingia y condados pirenaicos."
    },
    {
        "id": "alandalus", "etiqueta": "Al-Ándalus", "inicio": 711, "fin": 1492,
        "color": "#16a34a", "ancla": [37.5, -4.0],
        "grupos": ["Spain_Islamic", "Spain_Islamic_Almohade", "Spain_Islamic_Zira", "Spain_NazariPeriod_Muslim",
                   "Spain_NazariPeriod_LateMuslim", "Ibiza_Punic.SG", "Tunisia_Punic.SG",
                   "Tunisia_Punic_oAfrica1.SG", "Tunisia_Punic_oAfrica2.SG", "Morocco_Iberomaurusian",
                   "Morocco_EN.SG", "Morocco_LN.SG", "Algeria_NumidoRoman_Berber.SG",
                   "Portugal_Miroico_LateRoman_oAfrica.SG", "Spain_SW_Iberia_CA_oAsia",
                   "Italy_Sardinia_IA_Punic_1", "Italy_Sardinia_IA_Punic_2"],
        "notas": "Musiulmanes de al-Ándalus (hispánicos, bereberes y árabes) más sustrato norteafricano y púnico."
    },
]

# limpieza de la definición (evitar duplicados internos)
for p in POOLS:
    p["grupos"] = sorted(set(p["grupos"]))

# índice de grupos disponibles
disponibles = collections.defaultdict(list)
for nombre, v in antiguas:
    disponibles[nombre.split(":")[0]].append((nombre, v))

salida = {"version": "1.0", "fuente": "Datasheets G25 antiguas (vahaduo.github.io/g25download), centroides = media de miembros",
          "pools": []}
aviso = []
for p in POOLS:
    miembros = []
    for g in p["grupos"]:
        if g in disponibles:
            for nombre, v in disponibles[g]:
                miembros.append({"nombre": nombre, "v": v})
        else:
            aviso.append(f"{p['id']}: grupo '{g}' no existe en datasheet")
    if not miembros:
        aviso.append(f"{p['id']}: SIN miembros"); continue
    dim = len(miembros[0]["v"])
    c = [0.0]*dim
    for m in miembros:
        for i in range(dim): c[i] += m["v"][i]/len(miembros)
    nomes = sorted(m["nombre"] for m in miembros)
    salida["pools"].append({
        "id": p["id"], "etiqueta": p["etiqueta"], "inicio": p["inicio"], "fin": p["fin"],
        "color": p["color"], "ancla": p["ancla"], "notas": p["notas"],
        "n": len(miembros), "centroide": [round(x, 6) for x in c],
        "miembros": nomes,
    })

with open(os.path.join(RAIZ, "data", "pools.json"), "w", encoding="utf-8") as f:
    json.dump(salida, f, ensure_ascii=False)
print("Pools generados:")
for p in salida["pools"]:
    print(f"  {p['id']:12s} n={p['n']:4d}  {p['etiqueta'][:50]}")
print("\nAvisos:", len(aviso))
for a in aviso: print("  ⚠", a)
