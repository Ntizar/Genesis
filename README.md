# GÉNESIS — Tu genoma cuenta 50.000 años de historia

Estudio de ascendencia **100% en tu navegador**: arrastra tu raw de 23andMe, AncestryDNA, MyHeritage, FTDNA o LivingDNA (o pega coordenadas G25 oficiales de Vahaduo) y obtén modelo por épocas históricas de Iberia, vecinos modernos y antiguos, composición K36, PCA y mapa de procedencias.

**Privacidad total**: no hay servidores ni cuentas. El análisis ocurre en tu navegador — puedes desconectar el WiFi y funciona igual. Tu ADN nunca sale del ordenador.

## Uso

Abre https://ntizar.github.io/Genesis/ y arrastra tu fichero raw (`.txt`, `.csv`, `.vcf`, `.gz` o `.zip`). También puedes:

- Pegar coordenadas G25 oficiales (Eurogenes/Vahaduo): estudio exacto contra 11.899 referencias modernas y 7.292 antiguas.
- Lanzar la demo sintética: `?demo=1` (50% ibérico + 20% norte de Europa + 15% norte de África + 15% América).
- Deep-links: `?tab=estudio|mapa`.

## Metodología (honesta)

- El raw local se imputa a frecuencias K36 (MLE) y se proyecta a G25 25D con regresión de cresta calibrada sobre 327 HGDP. Con ~800–800.000 SNP el **pico por vecino más cercano es fiable; las proporciones entre componentes europeos son orientativas** (limitación del panel, no del método). Para proporciones exactas, usa coordenadas G25 oficiales.
- Modelo por épocas: NNLS (Lawson-Hanson) sobre 7 pools curados de Iberia (Paleolítico → Al-Ándalus, 549 muestras antiguas).
- Geolocalización de referencias: matching por tokens sobre 19.191 muestras (95,99% de cobertura), coordenadas regionales corregidas para Iberia y sur de Francia.

## Tests

```bash
node tests/test-motor.js   # motor: parseo 5 formatos, MLE, ridge (14 tests)
node tests/test-nnls.js    # NNLS 25D Lawson-Hanson (11 tests)
node tests/test-app.js     # pipeline completo end-to-end (12 tests)
node tests/diag-ui.js      # UI en DOM real (jsdom): demo + pestañas
```

## Créditos y licencias

- Motor K36 + ridge: basado en [stevenliuyi/admix](https://github.com/stevenliuyi/admix) (GPL-3.0).
- Frecuencias y datasheets G25: Eurogenes vía [Vahaduo](https://www.vahaduo.com/) (incrustadas con atribución).
- Referencias: 1000 Genomes fase 3, Allen Ancient DNA Resource (David Reich Lab).
- Cartografía: © IGN — Instituto Geográfico Nacional (CC BY 4.0); Natural Earth (dominio público).
- Diseño: Aurora 7. Leaflet 1.9.4 (BSD-2) servido localmente.

---

Hecho con ❤️ por David Antizar
