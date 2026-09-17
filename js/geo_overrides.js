/* Correcciones de coordenadas regionales (2026-09-17): el generador asignó centroides de
   país a muchas subregiones de España y Francia (p.ej. Spanish_Girona en el centro de España).
   Formato [lon, lat], igual que geo_data.js. Fuentes: capitales de provincia/región. */
var GENESIS_GEO_OVERRIDES = {
  /* España — provincias y subregiones apiladas en [-3.7,40.3] */
  Spanish_Alacant: [-0.65, 38.82],
  Spanish_Baleares: [2.65, 39.57],
  Spanish_Barcelones: [2.17, 41.38],
  Spanish_Biscay: [-2.93, 43.26],
  Spanish_Burgos: [-3.70, 42.34],
  Spanish_Camp_de_Tarragona: [1.25, 41.15],
  Spanish_Castella: [-0.10, 39.99],
  Spanish_Castilla_La_Mancha: [-3.90, 39.40],
  Spanish_Castilla_Y_Leon: [-4.72, 41.65],
  Spanish_Catalunya_Central: [1.80, 41.73],
  Spanish_Eivissa: [1.43, 38.91],
  Spanish_Girona: [2.82, 41.98],
  Spanish_La_Rioja: [-2.45, 42.45],
  Spanish_Lleida: [0.62, 41.62],
  Spanish_Penedes: [1.55, 41.35],
  'Spanish_Peri-Barcelona': [2.10, 41.42],
  Spanish_Pirineu: [1.40, 42.40],
  Spanish_Soria: [-2.47, 41.76],
  "Spanish_Terres_de_l'Ebre": [0.52, 40.81],
  /* País Vasco / Navarra — desagregado */
  Basque_Araba: [-2.67, 42.85],
  Basque_Baztan: [-1.55, 43.15],
  Basque_Biscay: [-2.93, 43.26],
  Basque_French: [-1.48, 43.48],
  Basque_Gipuzkoa: [-1.98, 43.32],
  Basque_Gipuzkoa_Southwest: [-2.20, 43.15],
  Basque_Lower_Navarre: [-1.24, 43.16],
  Basque_Navarre_Center: [-1.65, 42.82],
  Basque_Navarre_North: [-2.00, 43.10],
  /* Francia — subregiones apiladas en [2.3,46.6] */
  French_Alsace: [7.75, 48.58],
  French_Auvergne: [3.08, 45.78],
  French_Bearn: [-0.37, 43.30],
  French_Bigorre: [0.08, 43.23],
  French_Brittany: [-1.68, 48.11],
  French_Chalosse: [-1.05, 43.71],
  French_Nord: [3.06, 50.63],
  French_Occitanie: [1.44, 43.60],
  French_Paris: [2.35, 48.86],
  'French_Pas-de-Calais': [2.88, 50.29],
  French_Polynesia_400BP: [-149.43, -17.65],
  French_Provence: [5.39, 43.30],
  'French_Seine-Maritime': [1.10, 49.44],
  French_South: [1.44, 43.60]
};
if (typeof GENESIS_GEO !== 'undefined') Object.assign(GENESIS_GEO.geo, GENESIS_GEO_OVERRIDES);
