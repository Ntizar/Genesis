# GÉNESIS — SPEC

## Visión
Web local (el ADN nunca sale del ordenador) que convierte un raw de 23andMe/Ancestry/MyHeritage
(o unas coordenadas G25 oficiales) en un **estudio completo de ascendencia por épocas históricas**:
modelo de mezcla NNLS 25D contra pools curados de ADN antiguo, mapas IGN de calidad,
PCA, timeline y informe exportable. Inspirado en los estudios G25/qpAdm de la comunidad
(hilo uomesk), pero con NNLS real, datos verificados y diseño Aurora 7.

## Alcance

### Sí hace
- Parsear raws TXT/CSV/VCF/GZ/ZIP (23andMe, Ancestry, MyHeritage, FTDNA, LivingDNA, VCF)
- Estimar K36 (MLE 100 iteraciones) → G25 simulada (ridge v2, error mediano validado 0,025)
- Aceptar coordenadas G25 oficiales pegadas (líneas Vahaduo, nombre + 25 valores)
- **Modelo de mezcla NNLS 25D real (Lawson-Hanson)** contra pools por época:
  Paleolítico/Mesolítico · Neolítico · Calcolítico · Bronce/Argar · Hierro · Roma · Visigodos/Alta Edad Media · Al-Ándalus
- Pools curados desde los datasheets G25 antiguos (centroide = media de miembros; miembros listados)
- Distancia individual de cada fuente al objetivo + ajuste global del modelo
- Comparativa con «español medio» (IBS de la hoja 1000G-50 derivada) y «europeo medio»
- PCA SVG (PC1/PC2 y PC3/PC4) con pools y muestra
- Timeline histórica con los % por época
- **Mapas IGN** (WMTS IGNBase-gris, CC BY 4.0): proximidad moderna/antigua con geocodificador
  rehecho (anclado, objetivo ≥95% cobertura) y ubicación de pools por época
- Informe HTML autocontenido descargable por muestra
- Todo el cálculo en el navegador; única red: teselas IGN (públicas) y CSS Aurora7 (CDN)

### NO hace (non-goals)
- No sube datos a ningún servidor, no hay cuentas ni analítica
- No es diagnóstico médico ni confirmación de parentesco
- No ejecuta qpAdm formal (estadística de paper académico); es NNLS sobre G25, etiquetado como tal
- No redistribuye datos que prohíba su licencia (SGDP/HGDP fuera; datasheets G25 con atribución
  como hace el paquete auditado y aviso de origen)
- No calcula haplogrupos (los raws comerciales no traen Y/mt completo)

## Pantallas
1. **Inicio/Analizar**: dropzone + demo sintética + índice de muestras cargadas
2. **Estudio** (por muestra): KPIs, donut de épocas, tarjetas de fuente (estilo uomesk),
   tabla completa, comparativa demográfica, PCA, timeline
3. **Mapas**: Leaflet + IGN gris; proximidad + pools
4. **Método**: explicación honesta del pipeline y sus límites
5. **Privacidad**

## Datos
| Fuente | Uso | Origen |
|---|---|---|
| K36 (165.688 SNP × 36) | motor heredado verificado | stevenliuyi/admix GPL-3.0 |
| Datasheets G25 modernas (11.899) / antiguas (7.292) | vecinos, pools, mapas | vahaduo.github.io (atribución) |
| Hoja 1000G-50 derivada (503) | cohortes comparativas | calculada con este motor (DATASETS.md del paquete) |
| Reglas geográficas ancladas + dict generado | geocodificador v2 | propio, verificado en Python |
| IGN WMTS IGNBase-gris | mapa base | © IGN CC BY 4.0 |

## Arquitectura
| Capa | Fichero | Responsabilidad |
|---|---|---|
| Shell | index.html | DOM, tabs, carga Aurora7 CDN |
| Estilos | css/genesis.css | solo layout específico (tokens --nz-*) |
| Motor | js/engine.js | parse, K36 MLE, ridge, NNLS, vecinos, comparativas |
| Pools | data/pools.json | centroides 25D + miembros + anclas geográficas |
| Geo | data/geo-es.json + js/geo.js | dict prefijo→coordenada (generado) + reglas fallback |
| Mapa | js/ign-map.js | Leaflet + WMTS IGN + capas |
| Informe | js/informe.js | HTML autocontenido exportable |
| UI | js/ui.js | tabs, render estudio, donut SVG, timeline |

## Criterios de éxito
- Pipeline Node end-to-end: demo sintética → modelo por épocas con dist < 0,04 y suma 100%
- NNLS validado contra casos conocidos (residuo 0 en sistemas bien planteables)
- Geocodificador ≥95% de muestras geolocalizadas y 0 falsos positivos conocidos (Rajasthan→China, Romanian→Italia, Turkmen→Turquía)
- Página abre por file:// y por Pages; sin errores de consola
- Móvil: 1 columna base; táctil 44px

## Anti-patrones (lo que evitamos)
- Regex sin anclar en el geocodificador (bug del paquete original)
- Rejilla 5% en vez de optimización real
- Presentar G25 simulada como oficial (siempre etiquetado + modo oficial disponible)
- Gradientes/glass/violeta (Aurora 7: sólido, azul monocromo #2563eb, mobile-first)
- Clases Aurora inventadas (solo las de components.json/specs)

## Referencias
- Paquete auditado: G25-Local v2.3 (motor verificado en Node, cifras exactas)
- Hilo uomesk: modelo NNLS 25D por épocas (Ibero/Celta/Imperial/Berber)
- Skills: dna-analysis · ign-wmts-tiles · aurora-design-system (Aurora 7)

Hecho con ❤️ por David Antizar
