# -*- coding: utf-8 -*-
"""
GÉNESIS — geocodificador v2: dict exacto prefijo→[lon,lat] + reglas por tokens.
Salida: data/geo-es.json  (dict por prefijo + estadística de cobertura)
Reproducible: python scripts/generar-geo.py
"""
import json, os, collections

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

# ---------------- Diccionarios de coordenadas [lon, lat] ----------------
# Países y naciones (se buscan por token exacto)
COUNTRIES = {
 "Spain":[-3.7,40.3],"Spanish":[-3.7,40.3],"Portugal":[-8.1,39.6],"Portuguese":[-8.1,39.6],
 "France":[2.3,46.6],"French":[2.3,46.6],"Gaul":[-2.0,47.0],"Germany":[10.3,51.2],"German":[10.3,51.2],
 "Italy":[12.5,42.8],"Italian":[12.5,42.8],"Switzerland":[8.2,46.8],"Austria":[14.3,47.6],
 "Netherlands":[5.3,52.2],"Dutch":[5.3,52.2],"Belgium":[4.6,50.6],"Belgian":[4.6,50.6],
 "England":[-1.3,52.5],"English":[-1.3,52.5],"Scotland":[-4.2,56.8],"Scottish":[-4.2,56.8],
 "Wales":[-3.8,52.3],"Welsh":[-3.8,52.3],"Ireland":[-8.0,53.2],"Irish":[-8.0,53.2],
 "Iceland":[-18.6,64.9],"Icelandic":[-18.6,64.9],"Norway":[8.8,61.2],"Norwegian":[8.8,61.2],
 "Sweden":[15.5,60.1],"Swedish":[15.5,60.1],"Denmark":[9.5,56.0],"Danish":[9.5,56.0],
 "Finland":[26.0,62.9],"Finnish":[26.0,62.9],"Finn":[26.0,62.9],
 "Estonia":[25.7,58.7],"Latvia":[24.9,56.9],"Lithuania":[23.9,55.3],
 "Poland":[19.4,52.1],"Polish":[19.4,52.1],"Czechia":[15.4,49.8],"Czech":[15.4,49.8],"Bohemia":[14.8,50.1],
 "Slovakia":[19.5,48.7],"Hungary":[19.3,47.2],"Hungarian":[19.3,47.2],"Magyar":[19.3,47.2],
 "Romania":[24.9,45.9],"Romanian":[24.9,45.9],"Bulgaria":[25.3,42.8],"Bulgarian":[25.3,42.8],
 "Serbia":[20.9,44.2],"Serbian":[20.9,44.2],"Croatia":[16.4,45.2],"Croatian":[16.4,45.2],
 "Bosnia":[17.8,44.2],"Bosnian":[17.8,44.2],"Montenegro":[19.3,42.8],"Albania":[20.1,41.1],"Albanian":[20.1,41.1],
 "Kosovo":[20.9,42.6],"Macedonia":[21.7,41.6],"Greece":[22.5,39.3],"Greek":[22.5,39.3],"Hellenic":[22.5,39.3],
 "Slovenia":[14.8,46.1],"Slovenian":[14.8,46.1],"Moldova":[28.5,47.2],"Ukraine":[31.2,49.0],"Ukrainian":[31.2,49.0],
 "Belarus":[27.9,53.5],"Russia":[39.0,55.8],"Russian":[39.0,55.8],
 "Georgia":[43.4,42.2],"Georgian":[43.4,42.2],"Kartvelian":[43.4,42.2],"Armenia":[45.0,40.3],"Armenian":[45.0,40.3],
 "Azerbaijan":[47.6,40.4],"Azeri":[47.6,40.4],"Turkey":[35.2,39.0],"Turkish":[35.2,39.0],"Anatolia":[32.5,38.5],
 "Cyprus":[33.2,35.1],"Cypriot":[33.2,35.1],"Malta":[14.4,35.9],"Maltese":[14.4,35.9],
 "Lebanon":[35.9,33.9],"Lebanese":[35.9,33.9],"Israel":[35.0,31.5],"Jordan":[36.8,31.3],
 "Syria":[38.5,35.0],"Syrian":[38.5,35.0],"Palestine":[35.2,31.9],"Palestinian":[35.2,31.9],
 "Iraq":[43.7,33.0],"Iran":[53.7,32.6],"Persian":[53.7,32.6],"Iranian":[53.7,32.6],
 "Saudi":[45.0,24.0],"Arabia":[45.0,24.0],"Arabian":[45.0,24.0],"Yemen":[47.5,15.6],"Oman":[56.1,21.5],
 "Kuwait":[47.6,29.3],"Qatar":[51.2,25.3],"Emirates":[54.0,24.0],
 "Egypt":[30.0,26.8],"Egyptian":[30.0,26.8],"Libya":[17.9,27.0],"Libyan":[17.9,27.0],
 "Tunisia":[9.6,34.1],"Tunisian":[9.6,34.1],"Algeria":[2.6,28.2],"Algerian":[2.6,28.2],
 "Morocco":[-6.3,31.9],"Moroccan":[-6.3,31.9],"Mauritania":[-10.9,20.3],
 "Mali":[-3.5,17.4],"Senegal":[-14.5,14.4],"Gambia":[-15.4,13.4],"Guinea":[-11.0,10.4],
 "Ghana":[-1.2,7.9],"Nigeria":[8.1,9.6],"Cameroon":[12.7,5.7],"Chad":[18.7,15.4],"Niger":[9.4,17.4],
 "Sudan":[30.0,15.5],"Ethiopia":[39.6,8.6],"Ethiopian":[39.6,8.6],"Kenya":[37.9,0.5],"Tanzania":[34.8,-6.3],
 "Uganda":[32.4,1.3],"Somalia":[45.9,6.0],"Eritrea":[38.8,15.2],"Djibouti":[42.6,11.7],
 "Kazakhstan":[67.3,48.2],"Kazakh":[67.3,48.2],"Uzbekistan":[63.1,41.4],"Uzbek":[63.1,41.4],
 "Turkmenistan":[59.4,39.1],"Tajikistan":[71.0,38.9],"Tajik":[71.0,38.9],"Kyrgyzstan":[74.5,41.5],"Kirghiz":[74.5,41.5],
 "Afghanistan":[66.0,33.8],"Mongolia":[103.0,46.8],"Mongol":[103.0,46.8],"Mongolian":[103.0,46.8],
 "China":[104.0,35.0],"Chinese":[104.0,35.0],"Korea":[127.5,36.5],"Korean":[127.5,36.5],
 "Japan":[138.5,36.5],"Japanese":[138.5,36.5],"Taiwan":[121.0,23.7],
 "India":[78.9,22.9],"Pakistan":[69.4,30.0],"Bangladesh":[90.3,23.7],"SriLanka":[80.7,7.9],
 "Nepal":[84.1,28.3],"Nepalese":[84.1,28.3],"Bhutan":[90.4,27.5],"Myanmar":[96.5,21.2],
 "Thailand":[101.0,15.1],"Thai":[101.0,15.1],"Vietnam":[106.3,16.6],"Cambodia":[104.9,12.6],"Laos":[103.8,18.5],
 "Malaysia":[102.2,4.2],"Indonesia":[113.9,-0.8],"Indonesian":[113.9,-0.8],"Philippines":[122.9,11.8],
 "Papua":[141.0,-6.5],"Australia":[134.0,-25.7],"NewZealand":[172.8,-41.5],"Maori":[172.8,-38.5],
 "USA":[-98.0,39.5],"Canada":[-106.0,56.1],"Mexico":[-102.5,23.9],"Mexican":[-102.5,23.9],
 "Guatemala":[-90.4,15.7],"Honduras":[-86.6,14.8],"Peru":[-74.4,-9.2],"Peruvian":[-74.4,-9.2],
 "Bolivia":[-64.7,-16.3],"Chile":[-71.4,-35.7],"Argentina":[-65.2,-35.4],"Argentinian":[-65.2,-35.4],
 "Brazil":[-53.1,-10.8],"Brazilian":[-53.1,-10.8],"Colombia":[-73.1,3.9],"Venezuela":[-66.2,7.1],
 "Puerto":[-66.4,18.2],"Cuba":[-79.0,21.5],"Dominican":[-70.5,18.9],"Haiti":[-72.7,18.9],"Jamaica":[-77.3,18.1],
 "Greenland":[-41.3,74.0],"Siberia":[95.0,62.0],"Caucasus":[44.0,42.8],"Levant":[36.5,33.5],
 "LebanonLevantine":[35.9,33.9],"Mesopotamia":[43.5,33.5],"Scythia":[60.0,48.0],"Baltic":[23.5,55.8],
 "Andorra":[1.5,42.5],"Luxembourg":[6.1,49.7],"Liechtenstein":[9.5,47.1],"Monaco":[7.4,43.7],"SanMarino":[12.4,43.9],
}

# Subregiones y grupos étnicos (prioridad sobre país: más específicos)
SUBREGIONS = {
 "Sicily":[14.1,37.5],"Sicilian":[14.1,37.5],"Sardinia":[9.1,40.1],"Sardinian":[9.1,40.1],
 "Corsica":[9.0,42.2],"Corsican":[9.0,42.2],"Ibiza":[1.40,38.98],"Menorca":[4.10,39.95],
 "Mallorca":[2.95,39.60],"Formentera":[1.45,38.70],"Gibraltar":[-5.35,36.14],"Balearic":[2.9,39.5],
 "Canarias":[-15.6,28.2],"Canary":[-15.6,28.2],"Andalucia":[-4.8,37.5],"Andalusia":[-4.8,37.5],
 "Cantabria":[-4.0,43.15],"Galicia":[-8.0,42.8],"Catalonia":[1.8,41.8],"Cataluna":[1.8,41.8],
 "Valencia":[-0.8,39.3],"Aragon":[-0.5,41.5],"Navarra":[-1.7,42.8],"Asturias":[-5.9,43.3],
 "Extremadura":[-6.0,39.2],"Murcia":[-1.2,37.9],"Basque":[-2.7,43.1],"Vasco":[-2.7,43.1],
 "Iberia":[-3.5,40.2],"Iberian":[-3.5,40.2],"Tuscany":[11.3,43.3],"Tuscan":[11.3,43.3],
 "Lazio":[12.6,41.9],"Liguria":[8.6,44.4],"Puglia":[16.8,40.9],"Apulia":[16.8,40.9],"Calabria":[16.2,39.0],
 "Veneto":[11.9,45.6],"Sicani":[13.5,37.4],
 "Turkmen":[59.0,39.2],"Han":[108.5,33.5],"Hui":[103.0,35.5],"Manchu":[125.0,43.5],
 "Rajasthan":[74.0,26.6],"Uttarakhand":[79.3,30.1],"Punjab":[74.9,31.0],"Bengal":[88.5,23.5],
 "Bengali":[88.5,23.5],"Gujarat":[71.6,22.7],"Tamil":[78.4,10.8],"Nadu":[78.5,11.0],
 "Kerala":[76.3,10.0],"Karnataka":[76.0,15.0],"Maharashtra":[75.7,19.5],"Kalash":[72.3,35.8],
 "Pashtun":[69.5,33.5],"Pashtoon":[69.5,33.5],"Baloch":[65.0,28.0],"Balochi":[65.0,28.0],
 "Kurd":[44.4,37.2],"Kurdish":[44.4,37.2],"Kurdistan":[44.4,37.2],"Kabyle":[4.0,36.4],
 "Tuareg":[2.0,19.0],"Bedouin":[45.0,25.0],"Druze":[35.6,33.4],"Ashkenazi":[20.0,50.0],
 "Sami":[22.0,68.5],"Saami":[22.0,68.5],"Amazigh":[-2.0,32.5],"Riffian":[-4.5,35.0],
 "Abkhaz":[41.0,43.2],"Abazin":[42.5,43.9],"Adygei":[40.0,44.5],"Adyge":[40.0,44.5],
 "Chechen":[45.8,43.3],"Ingush":[44.8,43.2],"Ossetian":[44.2,43.0],"Lezgin":[47.9,41.7],
 "Kumyk":[47.5,43.2],"Karachay":[41.8,43.6],"Balkar":[42.9,43.3],"Avar":[46.6,42.5],
 "Dargin":[47.2,42.4],"Lak":[47.1,42.2],"Tabasaran":[47.6,42.0],"Nogai":[46.0,44.5],
 "Chuvash":[47.3,55.5],"Tatar":[49.1,55.5],"Bashkir":[56.2,54.7],"Mordvin":[44.8,54.3],"Mordov":[44.8,54.3],
 "Udmurt":[52.7,57.4],"Komi":[54.0,60.0],"Mari":[47.9,56.6],"Karelian":[31.5,63.0],
 "Vepsa":[34.5,60.8],"Sorbian":[14.3,51.4],"Frisian":[5.9,53.1],"Tyrol":[11.3,47.2],
 "Cornish":[-4.7,50.5],"Pict":[-4.0,56.5],"Hebrides":[-7.0,57.8],"Orkney":[-3.0,59.0],
 "Sudanese":[30.0,15.5],"Nubian":[32.5,20.0],"Beja":[36.5,17.5],"Oromo":[38.5,8.0],"Amhara":[38.5,11.5],
 "Tigray":[39.5,13.8],"Somali":[45.5,5.5],"Fulani":[-4.0,13.5],"Mandenka":[-8.0,12.5],
 "Yoruba":[4.0,8.0],"Igbo":[7.5,6.0],"Hausa":[8.0,12.0],"Bantu":[20.0,-2.0],"Mbuti":[28.5,1.5],
 "San":[21.5,-22.5],"Khoisan":[20.0,-22.0],"Malagasy":[47.0,-19.0],"Saharawi":[-12.9,24.5],
 "Altai":[86.0,50.5],"Buryat":[108.0,52.5],"Yakut":[128.0,62.5],"Evenk":[110.0,60.0],
 "Khanty":[66.0,61.5],"Mansi":[64.0,61.0],"Selkup":[82.0,60.0],"Ket":[87.0,63.0],
 "Dolgani":[105.0,71.5],"Nganasan":[98.0,73.0],"Chukchi":[175.0,66.0],"Koryak":[168.0,59.0],
 "Eskimo":[-50.0,66.0],"Inuit":[-50.0,66.0],"Aleut":[-165.0,53.0],
 "Iroquois":[-77.0,43.5],"Algonquian":[-75.0,48.0],"Sioux":[-100.0,44.0],"Apache":[-110.0,34.0],
 "Navajo":[-108.0,36.0],"Maya":[-89.5,16.5],"Mixtec":[-97.5,17.0],"Zapotec":[-96.7,16.9],
 "Quechua":[-72.5,-13.5],"Aymara":[-68.5,-16.5],"Mapuche":[-72.0,-38.5],"Tupi":[-50.0,-5.0],
 "Karitiana":[-63.0,-11.0],"Surui":[-61.0,-11.5],"Piapoco":[-69.5,3.5],"Ticuna":[-70.0,-4.0],
 # segunda tanda: castas y estados de India, etnias chinas, islas, balcanes
 "Telugu":[78.4,10.8],"Nair":[76.3,10.0],"Thiyya":[75.8,11.3],"Kallar":[78.4,10.0],
 "Chakkiliyan":[78.4,11.0],"Irula":[76.9,11.6],"Kadar":[76.8,10.3],"Juang":[85.6,21.4],
 "Ulladan":[76.9,9.2],"Tharu":[83.0,27.5],"Santhal":[87.0,24.0],"Ho":[85.8,22.3],
 "Baniya":[77.5,28.0],"Agrawal":[77.5,28.0],"Brahmin":[78.5,27.0],"Rajput":[73.7,26.5],
 "Jat":[74.5,29.5],"Gujjar":[74.0,32.0],"Ahir":[77.0,27.5],"Yadav":[80.0,26.0],
 "Kurmi":[81.5,25.5],"Chamar":[77.5,27.5],"Mahar":[75.7,19.5],"Bhumihar":[84.0,25.5],
 "Kayastha":[85.0,25.6],"Kshatriya":[76.0,29.0],"Vaish":[77.5,26.0],"Kumhar":[80.9,26.8],
 "Uttar":[80.9,26.8],"Manipuri":[93.9,24.8],"Sherpa":[86.7,27.9],"Rolwaling":[86.5,27.9],
 "Kohistani":[72.6,35.4],"Burusho":[74.6,36.2],"Pamiri":[72.6,37.5],"Sarikoli":[75.2,37.4],
 "Wakhi":[74.5,37.5],"Shugnan":[72.8,37.6],
 "Miao":[108.5,26.5],"Leishan":[108.3,26.4],"Songtao":[109.2,28.2],"Dongxiang":[103.6,35.6],
 "Salar":[102.5,35.9],"Baoan":[102.9,35.8],"Akha":[100.8,22.2],"Lahu":[100.2,22.6],
 "Yuku":[98.9,27.5],"Baiku":[107.9,24.7],"Yao":[110.5,25.5],"Guizhou":[106.9,26.8],
 "Altaian":[86.0,50.5],"Nenets":[70.0,67.0],"Mordovian":[44.8,54.3],"Lezgian":[48.3,41.2],
 "Pomak":[24.9,41.7],"Rhodope":[24.9,41.6],"Dinka":[30.0,7.5],"Mozabite":[3.5,32.5],
 "Afrikaner":[24.0,-29.0],"Madagascar":[47.0,-19.0],"Temoro":[47.0,-19.0],"Vezo":[45.0,-23.0],
 "Guam":[144.8,13.4],"Latte":[144.8,13.4],"Sakilli":[78.4,11.0],
 # tercera tanda: India tribal/Sur de Asia, Cáucaso (Dagestán), Siberia/Asia Central, África austral
 "Pallan":[78.4,10.8],"Sena":[34.5,-17.5],"Sri_Lankan":[80.7,7.9],"Sri":[80.7,7.9],
 "Tamang":[85.3,27.9],"Simigaon":[85.0,27.9],"Umbundu":[15.5,-13.5],"Brahui":[66.5,28.5],
 "Karakalpak":[59.5,42.5],"Khakass":[90.0,53.5],"Makhuwa":[40.5,-13.5],"Onge":[92.5,10.7],
 "Gangcha":[100.5,37.0],"Tibetan":[91.1,29.7],"Birhor":[85.5,23.8],"Brokpa":[90.5,27.3],
 "Bukharian":[67.0,40.1],"Jamatia":[91.5,23.4],"Kabardin":[43.6,43.5],"Korwa":[82.5,22.5],
 "Dagestan":[47.5,42.9],"Ndau":[33.0,-19.5],"Panta":[78.5,15.5],"Kapu":[78.5,15.5],
 "Tindal":[46.7,42.5],"Tripuri":[91.7,23.6],"Vepsian":[34.5,61.5],"Zhuang":[108.5,23.8],
 "Bitonga":[35.5,-18.5],"Gond":[79.5,22.5],"Hinukh":[46.4,42.4],"Hunzib":[46.3,42.2],
 "Khatri":[75.5,31.5],"Uygur":[83.0,42.5],"Hazara":[67.5,34.3],"Jarawa":[92.7,12.0],
 "Mala":[79.5,16.5],"Maonan":[107.8,25.4],"Mulam":[109.2,24.8],"Nadar":[77.8,8.9],
 "Nyanja":[34.0,-14.0],"Paniya":[76.2,11.5],"Ratlub":[46.3,42.1],
 # cuarta tanda: Himalaya/Yunnan, India castas, Balcanes, Marruecos, Yemen, Siberia
 "Yugur":[93.5,38.5],"Bai":[100.2,25.7],"Balti":[75.5,35.3],"Belarusian":[27.5,53.7],
 "Blang":[100.3,21.5],"Bunt":[74.9,13.0],"Dolgan":[102.0,71.0],"Dungan":[74.6,42.9],
 "Madiga":[78.5,16.5],"Manyika":[32.5,-18.5],"Nasrani":[76.3,9.9],"Ror":[76.5,29.5],
 "Tsez":[46.3,42.3],"Vysya":[78.5,16.5],"Wa":[99.0,23.0],"Alevi":[39.3,39.3],
 "Dersim":[39.3,39.3],"Arain":[73.5,31.0],"TIZ":[-9.7,29.8],"ERR":[-4.4,31.9],
 "EmiratiC":[54.4,24.5],"Knanaya":[76.2,9.6],"Naga":[94.1,25.7],"Pumi":[99.8,27.3],
 "Sahariya":[76.5,25.0],"Siddi":[74.8,14.5],"Amran":[43.9,15.7],"Yukagir":[150.0,68.5],
 "Bagvalin":[46.3,42.4],"Chopi":[35.5,-24.0],"Kashmiri":[74.8,34.1],"Magar":[83.7,28.3],
 "Newar":[85.3,27.7],"Nyaneka":[15.0,-15.5],"Akhvakh":[46.4,42.4],"Assyrian":[43.5,36.5],
 "Asur":[85.5,23.5],"Erzya":[44.8,54.3],"Rumelia":[25.0,42.3],"Vishwabrahmin":[78.5,16.0],
 # quinta tanda (final): Sudeste Asiático, Cáucaso, Taiwán, islas
 "Alawite":[35.9,35.2],"Chamalin":[46.4,42.4],"Kamboj":[75.5,31.5],"Maratha":[75.7,19.5],
 "Oraon":[84.5,23.5],"Tarkhan":[75.5,31.0],"Ami":[121.2,23.6],"Andian":[46.4,42.5],
 "Bonan":[102.5,35.5],"Cherkes":[43.5,44.0],"EmiratiA":[54.4,24.5],"Hmong":[103.5,21.5],
 "Mal":[101.5,7.5],"Ingushian":[44.9,43.2],"Karen":[98.5,18.5],"Sgaw":[98.5,18.5],
 "Khamnegan":[110.5,52.5],"Khmer":[104.9,12.5],"Suay":[104.5,15.5],"Lao":[102.5,18.5],
 "Lawa":[98.5,18.0],"Mlabri":[100.5,18.8],"Moksha":[44.5,54.0],"Mon":[97.5,16.5],
 "Nanai":[135.5,49.5],"Nyah_Kur":[101.5,14.5],"Orcadian":[-3.0,59.0],"Riang":[91.7,23.3],
 "Lavoutte":[-61.0,13.9],"EleutheraIsl":[-76.7,25.3],"Tai_Lue":[100.5,21.8],
 "Tubalar":[86.5,52.5],"Tuvinian":[94.0,51.7],"Ulchi":[137.0,51.5],"Yemenite_Jew":[44.5,15.5],
 "Abkhasian":[41.0,43.2],"Atayal":[121.3,24.5],"Changana":[34.5,-23.5],"Chenchu":[78.5,16.0],
 # sexta tanda (cierre): etnias sueltas, judías yemeníes, groenlandeses, Caucasus resto
 "Mogush":[37.0,36.5],"Nasoi":[98.5,19.0],"Lue":[100.5,21.8],"Kur":[101.5,14.5],
 "Jew":[34.8,31.8],"Circassian":[43.5,44.0],"Gagauz":[28.5,45.5],"Sinhala":[80.7,7.5],
 "Luo":[34.5,-0.5],"Masai":[36.0,-2.5],"Mende":[-11.8,8.5],"Greenlander":[-51.0,64.2],
 "Faroes":[-6.9,62.0],"Nivkh":[142.0,51.5],"Ezid":[42.5,37.0],"Darginian":[47.0,42.6],
 "Kaitag":[47.3,42.4],"Karata":[46.6,42.5],"EmiratiB":[54.4,24.5],"Dhamar":[44.7,15.4],
 "Mahra":[51.5,16.0],"Vellalar":[80.0,9.5],"Ezhava":[76.2,9.5],"Igorot":[120.9,16.8],
 "Hunan":[111.0,27.5],"Qiang":[102.8,31.6],"Danba":[101.9,30.9],"Daofu":[101.3,30.9],
 "Andros":[-77.9,24.5],"Saudeleur":[158.2,6.9],"Bilbao":[-2.9,43.3],"Granada":[-3.6,37.2],
 "Sierra":[-11.8,8.5],"Leone":[-11.8,8.5],"Chhattisgarh":[82.0,21.3],"Kusunda":[84.5,27.8],
}

def resolver(prefijo):
    toks = [t for t in prefijo.replace("-", "_").replace(":", "_").split("_") if t]
    # 1) subregión/étnico (más específico) en orden de aparición
    for t in toks:
        if t in SUBREGIONS: return SUBREGIONS[t], t
    # 2) país: primero el 1er token, luego el resto
    if toks and toks[0] in COUNTRIES: return COUNTRIES[toks[0]], toks[0]
    for t in toks[1:]:
        if t in COUNTRIES: return COUNTRIES[t], t
    # 3) variantes con sufijo numérico/común (ej. India2)
    for t in toks:
        for base in (t[:t.find("2")], t[:t.find("3")]):
            if base and base != t:
                if base in SUBREGIONS: return SUBREGIONS[base], base
                if base in COUNTRIES: return COUNTRIES[base], base
    return None, None

def cargar_prefijos(archivo):
    lineas = open(os.path.join(RAIZ, "data", "src", archivo), encoding="utf-8").read().strip().split("\n")[1:]
    c = collections.Counter()
    n_por_prefijo = collections.Counter()
    for l in lineas:
        p = l.split(",")[0].split(":")[0]
        c[p] += 1
    return c

mod = cargar_prefijos("modern.txt")
ant = cargar_prefijos("ancient.txt")
todos = collections.Counter()
todos.update(mod); todos.update(ant)

geo = {}
sin_resolver = {}
for p in sorted(todos):
    coord, via = resolver(p)
    if coord: geo[p] = coord
    else: sin_resolver[p] = todos[p]

total = sum(todos.values())
resueltas = sum(todos[p] for p in geo)
salida = {
    "version": "1.0",
    "metodo": "dict exacto prefijo→coordenada; reglas por tokens (subregion>pais), generado por scripts/generar-geo.py",
    "geo": geo,
    "cobertura": {
        "muestras": total, "geolocalizadas": resueltas,
        "pct": round(100*resueltas/total, 2),
        "prefijos": len(todos), "prefijos_geo": len(geo),
    },
}
with open(os.path.join(RAIZ, "data", "geo-es.json"), "w", encoding="utf-8") as f:
    json.dump(salida, f, ensure_ascii=False)

print(f"Cobertura: {resueltas}/{total} muestras ({salida['cobertura']['pct']}%) · {len(geo)}/{len(todos)} prefijos")
print("\nSin resolver (top 40 por nº de muestras):")
for p, n in sorted(sin_resolver.items(), key=lambda kv: -kv[1])[:40]:
    print(f"  {p}: {n}")
