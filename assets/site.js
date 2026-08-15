// =============================================================================
//  Lapin Hunajamarja — sivuston yhteinen skripti.
//  Kaytossa seka suomen- etta englanninkielisella sivulla; kaikki kielikohtainen
//  (tekstit, kuukausien nimet, polkujen etuliite) tulee SITE-objektista, joka
//  maaritellaan kunkin sivun <head>-osassa. Ala kovakoodaa tanne kielikohtaista
//  sisaltoa.
// =============================================================================
const SITE = window.SITE;

const mapSectionElement = document.getElementById('map-section');

// Three.js ladataan vasta tarvittaessa: tyopoydalla heti, mobiilissa vasta
// kun kayttaja painaa play-nappia. Nain puhelimessa ei ladata 600 kt kirjastoa
// eika 1,4 Mt tekstuuria turhaan.
let threeLoader = null;
function loadThree(){
  if (window.THREE) return Promise.resolve();
  if (!threeLoader) {
    threeLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SITE.base + 'assets/three.min.js';
      s.onload = resolve;
      // Nollataan valimuisti, jotta epaonnistuneen latauksen jalkeen uusi yritys
      // hakee skriptin oikeasti uudelleen eika palauta samaa hylattya lupausta.
      s.onerror = () => { threeLoader = null; reject(new Error('three.js ei latautunut')); };
      document.head.appendChild(s);
    });
  }
  return threeLoader;
}

// Kevytversio: alle 700px, liike-efektit pois, tai jos Three.js ei lataudu.
// Tarkistetaan funktiona, jotta ikkunan koon muutos / laitteen kaanto huomataan.
const lightMQ  = window.matchMedia('(max-width: 700px)');
const motionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
// WebGL-tuki tarkistetaan kevyesti ETUKATEEN: jos konteksti ei aukea (3D estetty,
// ohjain mustalla listalla, laitteistokiihdytys pois paalta), palloa ei voi piirtaa
// eika 600 kt:n three.min.js:aa kannata edes hakea. Tulos muistiin — kontekstin
// luonti on hidas operaatio eika tulos muutu sivun elinkaaren aikana.
let webglSupported = null;
function hasWebGL(){
  if (webglSupported !== null) return webglSupported;
  try {
    const c = document.createElement('canvas');
    webglSupported = !!(window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (err) { webglSupported = false; }
  return webglSupported;
}

const wantsLightweight = () => lightMQ.matches || motionMQ.matches || !hasWebGL();

function showLightweightMap(){
  mapSectionElement?.classList.add('mobile-map-fallback');
}
function hideLightweightMap(){
  mapSectionElement?.classList.remove('mobile-map-fallback');
}

function initGlobe() {
const CONFIG = {
  destination: {
    name: SITE.globe.name,
    coordsLabel: "66°20′35″ N, 28°11′40″ E",
    // Siirretty pellon (orchardPoints) todelliseen keskipisteeseen, jotta
    // sykkivä piste näyttää keskeltä koko peltokaistaletta eikä sen länsipäästä.
    // HUOM: tämä on myös satelliittikuvan bbox:n keskipiste, joten koko
    // näkymä keskittyy nyt hieman eri kohtaan (siirtymä ~30m, ei vaikuta
    // Berry Processing Centerin näkymiseen kehyksessä).
    lat: 66.343097,
    lon: 28.195568
  },
  berry: {
    // Berry Processing Center. Siirretty vaiheittain käyttäjän tarkkojen
    // ohjeiden mukaan, viimeisimpänä 5m etelään + 5m länteen.
    lat: 66.343725,
    lon: 28.200640
  },
  // Haskap Orchard -pellon kulmapisteet. Alkuperäiset pisteet mitattiin käyttäjän
  // Google Earth -kuvakaappauksesta gridlineihin kalibroiden, minkä jälkeen aluetta
  // on käyttäjän pyynnöstä siirretty, kierretty ja pienennetty useaan otteeseen.
  // Koko pohjoisreuna (p2,p3,p5,p7,p8) siirretty vielä 10m etelään käyttäjän
  // ohjeen mukaan (menee nyt hieman enemmän metsän puolelle).
  // Piirretään SUORAAN satelliittikuvan pikselikoordinaatistoon, jotta rajaus
  // pysyy paikallaan kuvasuhteesta riippumatta.
  orchardPoints: [
    { lat: 66.343500, lon: 28.190740 }, // p2
    { lat: 66.343414, lon: 28.193194 }, // p3
    { lat: 66.343312, lon: 28.195446 }, // p5
    { lat: 66.343031, lon: 28.198706 }, // p7
    { lat: 66.342806, lon: 28.200312 }, // p8
    { lat: 66.342525, lon: 28.200131 }, // p9
    { lat: 66.342986, lon: 28.195390 }, // p6
    { lat: 66.343198, lon: 28.190621 }  // p4
  ],
  narrative: {
    line1: "Our farm is located in Northern Europe…",
    line2: "in Finnish Lapland."
  },
  earthTextureURL: SITE.base + "assets/globe/earth-blue-marble.webp",
  precisionBoxMeters: 2000,
  totalDurationMs: 24000,
  // Veden sinistämisen säädöt
  waterEnhance: {
    blueOverRedRatio: 1.18,  // sinisen pitää olla selvästi punaista suurempi - liian matala arvo (esim <1.05) alkaa tulkita JPEG-pakkauksen tummia metsälohkoja vedeksi
    minBlue: 75,              // vaadittu minimi sininen kirkkaus - erottaa aidon veden tummasta metsän varjosta/JPEG-kohinasta
    // Vesipikselit sekoitetaan kohti tätä vaaleansinistä väriä (ei enää vain kerrota kanavia,
    // koska se teki vedestä tummempaa - nyt vesi vaalenee aina kohti tätä väriä)
    lightBlueTarget: { r: 150, g: 205, b: 245 },
    blendAmount: 0.72,        // kuinka voimakkaasti alkuperäinen väri sekoitetaan kohti vaaleansinistä (0-1)
    landRedMultiplier: 1.02,  // kevyt yleiskorjaus muulle maastolle
    landGreenMultiplier: 1.02,
    landBlueMultiplier: 1.05
  }
};

document.getElementById('dest-name').textContent = CONFIG.destination.name;
document.getElementById('dest-coords').textContent = CONFIG.destination.coordsLabel;
document.getElementById('text-1').textContent = CONFIG.narrative.line1;
document.getElementById('text-2').textContent = CONFIG.narrative.line2;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Three.js ---------- */
const canvas = document.getElementById('globe-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Valot ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(5, 3, 4);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdfeeff, 0.6);
fill.position.set(-5, -2, -4);
scene.add(fill);

/* ---------- Tähdet ---------- */
(function addStars(){
  const count = 2200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++){
    const r = 60 + Math.random() * 340;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.cos(phi);
    positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent:true, opacity:0.8 });
  scene.add(new THREE.Points(geo, mat));
})();

/* ---------- Maapallo ---------- */
const EARTH_R = 2;
const earthGroup = new THREE.Group();
scene.add(earthGroup);

function proceduralFallbackTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,256);
  g.addColorStop(0, '#eef6f6');
  g.addColorStop(0.18, '#2a6f7a');
  g.addColorStop(0.5, '#173b52');
  g.addColorStop(0.82, '#2a6f7a');
  g.addColorStop(1, '#eef6f6');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,512,256);
  return new THREE.CanvasTexture(c);
}

function createLabelTexture(text, color = '#4a9eff', fontSize = 36) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold ${fontSize}px Manrope, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width/2, canvas.height/2);
  return new THREE.CanvasTexture(canvas);
}

let labelSprites = [];
let trackingLabels = []; // { sprite, lat } - pidetään aina kameran pituusasteen kohdalla, keskellä leveyspiiriä
let arcticSeaSprite = null;
let continentSprites = [];

// Yhteinen tyyli sekä Equatorille että Arctic Circlelle, jotta ne ovat
// taatusti keskenään identtiset - sama fontti JA sama väri.
const LATITUDE_LABEL_FONT_SIZE = 22;
const LATITUDE_LABEL_FONT = `bold ${LATITUDE_LABEL_FONT_SIZE}px Manrope, Arial, sans-serif`;
const LATITUDE_LABEL_COLOR = '#eaf3f2';

function addLabels() {
  // Päiväntasaaja
  const equatorTexture = createLabelTexture('Equator', LATITUDE_LABEL_COLOR, LATITUDE_LABEL_FONT_SIZE);
  const eqMat = new THREE.SpriteMaterial({
    map: equatorTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.9
  });
  const eqSprite = new THREE.Sprite(eqMat);
  const eqPos = latLonToVector3(0, 0, EARTH_R * 1.03);
  eqSprite.position.copy(eqPos);
  eqSprite.scale.set(1.2, 0.28, 1);
  earthGroup.add(eqSprite);
  labelSprites.push(eqSprite);
  trackingLabels.push({ sprite: eqSprite, lat: 0 });
 
  // Arctic Circle
  const arcticTexture = createLabelTexture('Arctic Circle', LATITUDE_LABEL_COLOR, LATITUDE_LABEL_FONT_SIZE);
  const arcticMat = new THREE.SpriteMaterial({
    map: arcticTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.9
  });
  const arcticSprite = new THREE.Sprite(arcticMat);
  const arcticPos = latLonToVector3(66.5, 0, EARTH_R * 1.03);
  arcticSprite.position.copy(arcticPos);
  arcticSprite.scale.set(1.2, 0.28, 1);
  earthGroup.add(arcticSprite);
  labelSprites.push(arcticSprite);
  trackingLabels.push({ sprite: arcticSprite, lat: 66.5 });
 
  // Arctic Sea
  const asCanvas = document.createElement('canvas');
  asCanvas.width = 512;
  asCanvas.height = 128;
  const ctx = asCanvas.getContext('2d');
  ctx.clearRect(0, 0, asCanvas.width, asCanvas.height);
  ctx.font = 'italic 24px Fraunces, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#9b8cff';
  ctx.fillText('Arctic Sea', asCanvas.width/2, asCanvas.height/2);
  const asTexture = new THREE.CanvasTexture(asCanvas);
 
  const asMat = new THREE.SpriteMaterial({
    map: asTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0
  });
  arcticSeaSprite = new THREE.Sprite(asMat);
  const asPos = latLonToVector3(72, 28, EARTH_R * 1.10);
  arcticSeaSprite.position.copy(asPos);
  arcticSeaSprite.scale.set(1.4, 0.28, 1);
  earthGroup.add(arcticSeaSprite);
 
  // Maanosien nimet
  const continents = [
    { name: 'Europe', lat: 50, lon: 10, color: '#ffd93d' },
    { name: 'Asia', lat: 35, lon: 108, color: '#ffd93d' },
    { name: 'North America', lat: 45, lon: -100, color: '#ffd93d' },
    { name: 'South America', lat: -15, lon: -60, color: '#ffd93d' },
    { name: 'Africa', lat: 5, lon: 20, color: '#ffd93d' },
    { name: 'Australia', lat: -25, lon: 135, color: '#ffd93d' },
    { name: 'Antarctica', lat: -80, lon: 0, color: '#ffd93d' }
  ];
 
  continents.forEach(({ name, lat, lon, color }) => {
    const texture = createLabelTexture(name, color, 24);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.5
    });
    const sprite = new THREE.Sprite(mat);
    const pos = latLonToVector3(lat, lon, EARTH_R * 1.08);
    sprite.position.copy(pos);
    sprite.scale.set(1.8, 0.35, 1);
    earthGroup.add(sprite);
    continentSprites.push(sprite);
  });
}

function addLatitudeLines() {
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x4a9eff,
    transparent: true,
    opacity: 0.25,
    depthWrite: false
  });
  const arcticMaterial = new THREE.LineBasicMaterial({
    color: 0x7cffcb,
    transparent: true,
    opacity: 0.2,
    depthWrite: false
  });
 
  const latitudes = [
    { lat: 0, material: lineMaterial },
    { lat: 66.5, material: arcticMaterial }
  ];
 
  latitudes.forEach(({ lat, material }) => {
    const points = [];
    const segments = 64;
    const radius = EARTH_R * 1.002;
    const phi = (90 - lat) * Math.PI / 180;
   
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      points.push(new THREE.Vector3(x, y, z));
    }
   
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    earthGroup.add(line);
  });
}

const loader = new THREE.TextureLoader();
loader.crossOrigin = 'anonymous';
let earthMesh;
loader.load(
  CONFIG.earthTextureURL,
  (tex) => buildEarth(tex),
  undefined,
  () => buildEarth(proceduralFallbackTexture())
);

function buildEarth(texture){
  const geo = new THREE.SphereGeometry(EARTH_R, 64, 64);
  const mat = new THREE.MeshPhongMaterial({ map: texture, shininess: 6 });
  earthMesh = new THREE.Mesh(geo, mat);
  earthGroup.add(earthMesh);

  addLatitudeLines();

  // Varmistetaan että 'Manrope'-fontti on todella ladattu ennen kuin Equator- ja
  // Arctic Circle -tekstuurit piirretään canvakselle. Ilman tätä toinen niistä
  // saattoi hitaalla yhteydellä piirtyä selaimen oletus-sans-serif-fontilla
  // ennen kuin Manrope ehti latautua, jolloin tekstit näyttivät eri fonteilta.
  const ensureFonts = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load(LATITUDE_LABEL_FONT),
        document.fonts.load('bold 24px Manrope')
      ]).catch(() => {})
    : Promise.resolve();

  ensureFonts.then(() => {
    addLabels();

    const glowGeo = new THREE.SphereGeometry(EARTH_R * 1.035, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x6fd7ff, transparent: true, opacity: 0.10, side: THREE.BackSide
    });
    earthGroup.add(new THREE.Mesh(glowGeo, glowMat));

    finishLoading();
  });
}

/* ---------- Revontulet ---------- */
function auroraSprite(color, scale){
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128,128,0,128,128,128);
  grad.addColorStop(0, color + 'aa');
  grad.addColorStop(0.5, color + '33');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,256,256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, opacity:0, blending: THREE.AdditiveBlending, depthWrite:false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}
function latLonToVector3(lat, lon, radius){
  const phi = (90 - lat) * (Math.PI/180);
  const theta = (lon + 180) * (Math.PI/180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}
const poleGreen = auroraSprite('#7cffcb', 3.4);
const poleViolet = auroraSprite('#9b8cff', 2.6);
poleGreen.position.copy(latLonToVector3(88, 0, EARTH_R * 1.15));
poleViolet.position.copy(latLonToVector3(84, 40, EARTH_R * 1.2));
earthGroup.add(poleGreen, poleViolet);

/* ---------- Haskap-sininen 3D-piste ---------- */
const pinGroup = new THREE.Group();
const destNormal = latLonToVector3(CONFIG.destination.lat, CONFIG.destination.lon, 1);
const pinBase = destNormal.clone().multiplyScalar(EARTH_R);
const pinTip  = destNormal.clone().multiplyScalar(EARTH_R * 1.12);

const headGeo = new THREE.SphereGeometry(0.0012, 16, 16);
const headMat = new THREE.MeshBasicMaterial({
  color: 0x4a9eff,
  transparent: true,
  opacity: 0
});
const head = new THREE.Mesh(headGeo, headMat);
head.position.copy(pinTip);
pinGroup.add(head);

const glowGeo2 = new THREE.SphereGeometry(0.0025, 16, 16);
const glowMat2 = new THREE.MeshBasicMaterial({
  color: 0x4a9eff,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending
});
const glow = new THREE.Mesh(glowGeo2, glowMat2);
glow.position.copy(pinTip);
pinGroup.add(glow);

earthGroup.add(pinGroup);

/* ---------- Berry Processing Center - punainen 3D-piste ---------- */
const berryGroup = new THREE.Group();
const berryNormal = latLonToVector3(CONFIG.berry.lat, CONFIG.berry.lon, 1);
const berryTip = berryNormal.clone().multiplyScalar(EARTH_R * 1.12);

const berryHeadGeo = new THREE.SphereGeometry(0.025, 16, 16);
const berryHeadMat = new THREE.MeshBasicMaterial({
  color: 0xff4757,
  transparent: true,
  opacity: 0
});
const berryHead = new THREE.Mesh(berryHeadGeo, berryHeadMat);
berryHead.position.copy(berryTip);
berryGroup.add(berryHead);

const berryGlowGeo = new THREE.SphereGeometry(0.05, 16, 16);
const berryGlowMat = new THREE.MeshBasicMaterial({
  color: 0xff4757,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending
});
const berryGlow = new THREE.Mesh(berryGlowGeo, berryGlowMat);
berryGlow.position.copy(berryTip);
berryGroup.add(berryGlow);

earthGroup.add(berryGroup);

/* ---------- KAMERAPOLKU ---------- */
const destLonUnwrapped = 360 + CONFIG.destination.lon;

const KF = [
  { p: 0.00, lat: 20,  lon: 0,                                    r: 8.0 },
  { p: 0.12, lat: 20,  lon: 120,                                  r: 7.8 },
  { p: 0.24, lat: 20,  lon: 240,                                  r: 7.6 },
  { p: 0.36, lat: 20,  lon: 360,                                  r: 7.3 },
  { p: 0.48, lat: 25,  lon: 360 + CONFIG.destination.lon * 0.10,  r: 6.5 },
  { p: 0.60, lat: 35,  lon: 360 + CONFIG.destination.lon * 0.25,  r: 5.7 },
  { p: 0.72, lat: 48,  lon: 360 + CONFIG.destination.lon * 0.45,  r: 4.9 },
  { p: 0.82, lat: 58,  lon: 360 + CONFIG.destination.lon * 0.62,  r: 4.2 },
  { p: 0.90, lat: 63.5, lon: 360 + CONFIG.destination.lon * 0.80, r: 3.8 },
  { p: 0.96, lat: 65.5, lon: 360 + CONFIG.destination.lon * 0.93, r: 3.5 },
  { p: 1.00, lat: CONFIG.destination.lat, lon: destLonUnwrapped,  r: 3.5 }
];

function smoothInterpolate(points, key, t) {
  const n = points.length;
  if (t <= points[0].p) return points[0][key];
  if (t >= points[n-1].p) return points[n-1][key];
 
  let i = 0;
  while (i < n - 1 && t > points[i + 1].p) i++;
  if (i >= n - 1) i = n - 2;
 
  const p0 = points[i];
  const p1 = points[i + 1];
  const dt = p1.p - p0.p || 1e-6;
  const s = Math.min(Math.max((t - p0.p) / dt, 0), 1);
  const eased = s * s * (3 - 2 * s);
 
  return p0[key] + (p1[key] - p0[key]) * eased;
}

function cameraStateAt(p){
  const pc = Math.min(Math.max(p, 0), 1);
  return {
    lat: smoothInterpolate(KF, 'lat', pc),
    lon: smoothInterpolate(KF, 'lon', pc),
    r: smoothInterpolate(KF, 'r', pc)
  };
}

function smoothstep(edge0, edge1, x){
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/* ---------- Aikavääristys ----------
   Kamerapolun p (0..1) ei enää etene tasaisella nopeudella. Alun täysi
   pyörähdys (KF p 0..0.36, lon 0 -> 360) pidetään täsmälleen entisen
   nopeuden mukaisena, mutta loppulähestyminen (Afrikka -> Eurooppa ->
   Lappi) ajetaan APPROACH_SPEED-kertaisella nopeudella. Kaikki muut
   ajoitukset (tekstit, revontulet, pinit) on ilmaistu p:n avulla, joten
   ne seuraavat mukana automaattisesti. */
const SPIN_END_P = 0.36;      // kohta jossa pyörähdys päättyy kamerapolulla
const APPROACH_SPEED = 1.3;   // 1 = ennallaan, 1.3 = 30 % nopeampi loppuosa

// Kulunut aika (ms) -> kamerapolun p
function pAtMs(ms){
  const d = CONFIG.totalDurationMs;
  const spinMs = SPIN_END_P * d;
  return ms <= spinMs ? ms / d : SPIN_END_P + ((ms - spinMs) / d) * APPROACH_SPEED;
}
// Kamerapolun p -> kulunut aika (ms). Käytetään narratiivin setTimeouteissa.
function msAtP(f){
  const d = CONFIG.totalDurationMs;
  return (f <= SPIN_END_P ? f : SPIN_END_P + (f - SPIN_END_P) / APPROACH_SPEED) * d;
}
// Todellinen kesto ruudulla (24 s -> n. 20,5 s oletusarvoilla)
const ANIM_END_MS = msAtP(1);

/* ---------- Satelliittikuva ---------- */

// Muuntaa kuvan luonnollisen pikselikoon (esim. 1024x1024) ja ikkunan koon
// perusteella "object-fit: cover" -skaalauksen, jotta DOM-pinit voidaan
// sijoittaa TARKALLEEN samaan kohtaan kuin kuvalle piirretty sisältö,
// riippumatta näytön kuvasuhteesta.
// Mitat luetaan #sat-reveal -elementista eika ikkunasta: karttaosio on
// korkeudeltaan 100vh, joka mobiilissa eroaa window.innerHeight-arvosta
// aina kun selaimen osoiterivi on nakyvissa.
function coverTransform(imgW, imgH){
  const host = document.getElementById('sat-reveal');
  const r = host.getBoundingClientRect();
  const scale = Math.max(r.width / imgW, r.height / imgH);
  const dispW = imgW * scale, dispH = imgH * scale;
  return { scale, offsetX: (r.width - dispW) / 2, offsetY: (r.height - dispH) / 2,
           hostW: r.width, hostH: r.height };
}

// Kuvakangas skaalautuu 1.55 -> 1 vajaan kolmen sekunnin ajan. Pinit eivat
// skaalaudu sen mukana, joten niiden sijainti lasketaan kuvakankaan
// senhetkisesta skaalasta keskipisteen ymparilla.
function currentCanvasScale(){
  const c = document.getElementById('sat-canvas');
  const tr = getComputedStyle(c).transform;
  if (!tr || tr === 'none') return 1;
  const m = tr.match(/matrix\(([^)]+)\)/);
  if (!m) return 1;
  const a = parseFloat(m[1].split(',')[0]);
  return isFinite(a) && a > 0 ? a : 1;
}

function positionPins(){
  if (!window.__satPixelPos) return;
  const canvasEl = document.getElementById('sat-canvas');
  if (!canvasEl.width || !canvasEl.height) return;
  const t = coverTransform(canvasEl.width, canvasEl.height);
  const s = currentCanvasScale();
  const cx = t.hostW / 2, cy = t.hostH / 2;
  const place = (el, pt) => {
    const x = t.offsetX + pt.px * t.scale;
    const y = t.offsetY + pt.py * t.scale;
    el.style.left = (cx + (x - cx) * s) + 'px';
    el.style.top  = (cy + (y - cy) * s) + 'px';
  };
  const { haskap, berry } = window.__satPixelPos;
  place(document.getElementById('sat-pin'), haskap);
  place(document.getElementById('berry-pin'), berry);
}
window.addEventListener('resize', positionPins);

// Pidetaan pinit kuvan mukana koko zoomauksen ajan.
let pinTrackRaf = null;
function trackPins(durationMs){
  const end = performance.now() + durationMs;
  const step = () => {
    positionPins();
    pinTrackRaf = performance.now() < end ? requestAnimationFrame(step) : null;
  };
  if (pinTrackRaf) cancelAnimationFrame(pinTrackRaf);
  pinTrackRaf = requestAnimationFrame(step);
}

function buildSatelliteImage(){
  const lat = CONFIG.destination.lat;
  const lon = CONFIG.destination.lon;
  const halfMeters = CONFIG.precisionBoxMeters / 2;
  const dLat = halfMeters / 111320;
  const dLon = halfMeters / (111320 * Math.cos(lat * Math.PI / 180));
  const minLon = lon - dLon, maxLon = lon + dLon;
  const minLat = lat - dLat, maxLat = lat + dLat;
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export`
    + `?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&size=1024,1024`
    + `&imageSR=4326&format=jpg&f=image`;

  const canvasEl = document.getElementById('sat-canvas');
  const reveal = document.getElementById('sat-reveal');
  const img = new Image();
  img.crossOrigin = 'anonymous';

  // lon/lat -> kuvan pikselikoordinaatti (riippuu vain bbox:sta ja kuvan koosta)
  const pxX = (lonVal, w) => (lonVal - minLon) / (maxLon - minLon) * w;
  const pxY = (latVal, h) => (maxLat - latVal) / (maxLat - minLat) * h;

  img.onload = () => {
    canvasEl.width = img.width;
    canvasEl.height = img.height;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(img, 0, 0);

    try {
      const frame = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const d = frame.data;
      const w = CONFIG.waterEnhance;

      for (let i = 0; i < d.length; i += 4){
        const r = d[i], g = d[i+1], b = d[i+2];

        // Tunnista "vetinen" pikseli: sininen selvästi hallitseva kanava
        const isWater = b > r * w.blueOverRedRatio && b > g * 1.08 && b > w.minBlue;

        if (isWater){
          // Sekoitetaan kohti vaaleansinistä väriä - tämä VAALENTAA vettä
          // (aiempi kertolasku-versio tummensi sitä, koska punaista/vihreää
          // vain vähennettiin ilman että kokonaiskirkkautta nostettiin).
          const t = w.blendAmount;
          d[i]   = r * (1 - t) + w.lightBlueTarget.r * t;
          d[i+1] = g * (1 - t) + w.lightBlueTarget.g * t;
          d[i+2] = b * (1 - t) + w.lightBlueTarget.b * t;
        } else {
          // kevyt yleiskorjaus muulle maisemalle
          d[i]   = Math.min(255, r * w.landRedMultiplier);
          d[i+1] = Math.min(255, g * w.landGreenMultiplier);
          d[i+2] = Math.min(255, b * w.landBlueMultiplier);
        }
      }
      ctx.putImageData(frame, 0, 0);
    } catch (e) {
      // Jos getImageData epäonnistuu (esim. CORS-rajoitus), näytetään kuva sellaisenaan
      console.warn('Veden sinistämistä ei voitu suorittaa:', e);
    }

    // ---- Haskap Orchard -rajaus + Berry Processing Center -merkintä ----
    // Piirretään SUORAAN kuvan omaan pikselikoordinaatistoon (0..img.width/height),
    // jolloin merkinnät pysyvät kohdallaan riippumatta siitä miten canvas
    // lopulta skaalataan/rajataan ruudulle (object-fit: cover).
    try {
      const W = canvasEl.width, H = canvasEl.height;
      const orchardPx = CONFIG.orchardPoints.map(p => ({ x: pxX(p.lon, W), y: pxY(p.lat, H) }));

      ctx.save();
      ctx.beginPath();
      orchardPx.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
      ctx.closePath();
      ctx.setLineDash([W * 0.010, W * 0.010]);
      ctx.lineWidth = Math.max(1.5, W * 0.0022);
      ctx.strokeStyle = 'rgba(255,71,87,0.55)';
      ctx.shadowColor = 'rgba(255,71,87,0.55)';
      ctx.shadowBlur = W * 0.006;
      ctx.stroke();
      ctx.restore();

      // Otsikkoteksti pellon keskipisteen ALAPUOLELLE, jotta se ei jää
      // Haskap-pinin (joka on tarkalleen keskipisteessä) alle piiloon
      const cx = orchardPx.reduce((s, p) => s + p.x, 0) / orchardPx.length;
      const cy = orchardPx.reduce((s, p) => s + p.y, 0) / orchardPx.length;
      // Käytetään pellon TODELLISTA eteläisintä reunaa (ei vain keskipisteen
      // etäisyyttä), koska kapea/vino peltokaistale voi olla lähempänä
      // keskipistettä joissain kohdissa kuin toisissa - näin teksti ei koskaan
      // mene katkoviivan päälle riippumatta muodosta.
      const orchardMaxY = Math.max(...orchardPx.map(p => p.y));
      const orchardTextY = orchardMaxY + W * 0.016;
      ctx.save();
      ctx.font = `700 ${Math.round(W * 0.0145)}px Manrope, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = W * 0.0035;
      ctx.strokeStyle = 'rgba(10,5,6,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = W * 0.006;
      ctx.strokeText('HASKAP ORCHARD', cx, orchardTextY);
      ctx.fillStyle = '#ff9aa3';
      ctx.shadowBlur = 0;
      ctx.fillText('HASKAP ORCHARD', cx, orchardTextY);
      ctx.restore();

      // Berry Processing Center -teksti pisteen yläpuolelle
      const berryPx = { x: pxX(CONFIG.berry.lon, W), y: pxY(CONFIG.berry.lat, H) };
      ctx.save();
      ctx.font = `700 ${Math.round(W * 0.012)}px Manrope, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.lineWidth = W * 0.003;
      ctx.strokeStyle = 'rgba(10,5,6,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = W * 0.006;
      ctx.strokeText('BERRY PROCESSING CENTER', berryPx.x, berryPx.y - W * 0.035);
      ctx.fillStyle = '#ff9aa3';
      ctx.shadowBlur = 0;
      ctx.fillText('BERRY PROCESSING CENTER', berryPx.x, berryPx.y - W * 0.035);
      ctx.strokeStyle = 'rgba(255,71,87,0.55)';
      ctx.lineWidth = Math.max(1, W * 0.0012);
      ctx.beginPath();
      ctx.moveTo(berryPx.x, berryPx.y - W * 0.028);
      ctx.lineTo(berryPx.x, berryPx.y - W * 0.006); // viiva ulottuu nyt kiinni pisteeseen
      ctx.stroke();
      ctx.restore();

      // Selkeä pistemerkki TARKALLEEN Berry Processing Centerin koordinaatissa
      // (piirretty suoraan canvakselle, jotta merkki näkyy varmasti riippumatta
      // DOM-pinin asemoinnista)
      ctx.save();
      ctx.beginPath();
      ctx.arc(berryPx.x, berryPx.y, W * 0.007, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4757';
      ctx.shadowColor = 'rgba(255,71,87,0.8)';
      ctx.shadowBlur = W * 0.012;
      ctx.fill();
      ctx.lineWidth = Math.max(1, W * 0.0015);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();

      // Tallennetaan pikselisijainnit DOM-pinien (sat-pin, berry-pin) asemointia varten
      window.__satPixelPos = {
        haskap: { px: pxX(CONFIG.destination.lon, W), py: pxY(CONFIG.destination.lat, H) },
        berry: berryPx
      };
      positionPins();
    } catch (e) {
      console.warn('Peltorajauksen piirtäminen epäonnistui:', e);
    }
  };

  img.onerror = () => { reveal.dataset.failed = '1'; };
  img.src = url;
}
buildSatelliteImage();

/* ---------- Ajoitus ---------- */
function scheduleNarrative(){
  const t1 = document.getElementById('text-1');
  const t2 = document.getElementById('text-2');
  const card = document.getElementById('destination-card');
  const replayBtn = document.getElementById('replay');
  const satReveal = document.getElementById('sat-reveal');
  const satPin = document.getElementById('sat-pin');
  const berryPin = document.getElementById('berry-pin');

  [t1, t2].forEach(el => el.classList.remove('visible'));
  card.classList.remove('visible');
  replayBtn.classList.remove('visible');
  satReveal.classList.remove('visible');
  satPin.classList.remove('visible');
  berryPin.classList.remove('visible');

  if (reducedMotion){
    card.classList.add('visible');
    replayBtn.classList.add('visible');
    if (!satReveal.dataset.failed){
      satReveal.classList.add('visible');
      trackPins(200);
      satPin.classList.add('visible');
      berryPin.classList.add('visible');
    }
    return;
  }

  setTimeout(() => t1.classList.add('visible'), msAtP(0.05));
  setTimeout(() => t1.classList.remove('visible'), msAtP(0.40));
  setTimeout(() => t2.classList.add('visible'), msAtP(0.50));
  setTimeout(() => t2.classList.remove('visible'), msAtP(0.74));
 
  setTimeout(() => {
    if (!satReveal.dataset.failed) {
      satReveal.classList.add('visible');
      trackPins(3200);
      canvas.style.transition = 'opacity 2.5s ease';
      canvas.style.opacity = '0';
    }
  }, msAtP(0.96));
 
  setTimeout(() => {
    if (!satReveal.dataset.failed) {
      satPin.classList.add('visible');
      berryPin.classList.add('visible');
    }
    card.classList.add('visible');
  }, msAtP(0.985));
 
  setTimeout(() => {
    replayBtn.classList.add('visible');
  }, msAtP(0.995));
}

/* ---------- Animaatio ---------- */
let startTime = performance.now();
let loaded = false;

function finishLoading(){
  loaded = true;
  document.getElementById('loader').classList.add('hidden');
  canvas.classList.add('ready');
  if (mapInView) startMapAnimation();
}

function startMapAnimation(){
  if (mapStarted || !loaded) return;
  mapStarted = true;
  startTime = performance.now();
  scheduleNarrative();
  requestAnimationFrame(tick);
}

function tick(now){
  if (!mapInView) return;
  requestAnimationFrame(tick);
  if (!loaded) return;

  const elapsed = now - startTime;
  const p = reducedMotion ? 1 : Math.min(pAtMs(elapsed), 1);

  const cam = cameraStateAt(p);
  let camRadius = cam.r;

  // Jatketaan zoomausta hieman pidemmälle heti animaation lopussa (samaan aikaan
  // kun satelliittikuva skaalautuu sisään), jotta siirtymä 3D-maapallosta
  // satelliittikuvaan tuntuu jatkuvalta sukellukselta eikä pelkältä leikkauksesta.
  const postZoomMs = 2600; // sama kesto kuin CSS-risteytys/skaalaus
  if (p >= 1){
    const postElapsed = Math.min(elapsed - ANIM_END_MS, postZoomMs);
    const postT = postElapsed / postZoomMs;
    const eased = postT * postT * (3 - 2 * postT); // smoothstep
    camRadius = cam.r - (cam.r - cam.r * 0.62) * eased;
  }

  const camPos = latLonToVector3(cam.lat, cam.lon, camRadius);
  camera.position.copy(camPos);

  const targetPos = latLonToVector3(CONFIG.destination.lat, CONFIG.destination.lon, 0);
  camera.lookAt(targetPos);

  if (p >= 1 && (elapsed - ANIM_END_MS) >= postZoomMs){
    const idle = (now - startTime - ANIM_END_MS - postZoomMs) * 0.00003;
    camera.position.x += Math.sin(idle) * 0.01;
    camera.position.y += Math.cos(idle * 0.8) * 0.008;
    camera.lookAt(targetPos);
  }

  // Revontulet
  const poleVisibility = smoothstep(0.25, 0.40, p) * (1 - smoothstep(0.70, 0.88, p));
  poleGreen.material.opacity = poleVisibility * 0.9;
  poleViolet.material.opacity = poleVisibility * 0.7;

  // Haskap-sininen 3D-piste
  const pinIn = smoothstep(0.88, 0.95, p);
  const pinOut = 1 - smoothstep(0.95, 1.0, p);
  const pinVisibility = pinIn * pinOut;
  head.material.opacity = pinVisibility * 0.9;
  glow.material.opacity = pinVisibility * 0.18;

  // Berry-punainen 3D-piste
  const berryIn = smoothstep(0.88, 0.95, p);
  const berryOut = 1 - smoothstep(0.95, 1.0, p);
  const berryVisibility = berryIn * berryOut;
  berryHead.material.opacity = berryVisibility * 0.9;
  berryGlow.material.opacity = berryVisibility * 0.3;

  // Equator ja Arctic Circle - pidetään aina kameraa kohti, keskellä leveyspiiriä
  trackingLabels.forEach(({ sprite, lat }) => {
    sprite.position.copy(latLonToVector3(lat, cam.lon, EARTH_R * 1.03));
  });
  const labelOpacity = 0.9 * (1 - smoothstep(0.92, 0.98, p) * 0.15);
  labelSprites.forEach(sprite => {
    if (sprite) {
      sprite.material.opacity = labelOpacity;
    }
  });

  // Arctic Sea
  const arcticVisibility = smoothstep(0.38, 0.50, p) * (1 - smoothstep(0.88, 0.96, p));
  if (arcticSeaSprite) {
    arcticSeaSprite.material.opacity = arcticVisibility * 0.7;
  }

  // Maanosien nimet
  const continentOpacity = 0.5 * (1 - smoothstep(0.92, 0.98, p) * 0.3);
  continentSprites.forEach(sprite => {
    if (sprite) {
      sprite.material.opacity = continentOpacity;
    }
  });

  renderer.render(scene, camera);
}

document.getElementById('replay').addEventListener('click', () => {
  startTime = performance.now();
  canvas.style.opacity = '1';
  canvas.style.transition = 'opacity 1.2s ease';
  const satReveal = document.getElementById('sat-reveal');
  satReveal.classList.remove('visible');
  satReveal.dataset.failed = '';
  document.getElementById('sat-pin').classList.remove('visible');
  document.getElementById('berry-pin').classList.remove('visible');
  buildSatelliteImage();
  scheduleNarrative();
});

// Pysäytetään WebGL-renderöinti kun karttaosio ei ole näkyvissä (käyttäjä on
// vierittänyt eteenpäin tarinaan), jottei raskas 3D-piirto kuluta suoritinta/GPU:ta
// eikä häiritse loppusivun vieritystä. Käynnistyy automaattisesti uudelleen, kun
// osio tulee takaisin näkyviin (esim. Matka-linkkiä klikattaessa).
let mapInView = false;
let mapStarted = false;
const mapVisibilityObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const wasInView = mapInView;
    mapInView = entry.isIntersecting;
    if (mapInView && !wasInView) {
      if (!mapStarted) startMapAnimation();
      else requestAnimationFrame(tick);
    }
  });
}, { threshold: 0 });
mapVisibilityObserver.observe(document.getElementById('map-section'));
}

// --- Kaynnistys ---
const globePlay = document.getElementById('globe-play');

let globeStarted = false;
function startGlobe(){
  if (globeStarted) return Promise.resolve();
  if (globePlay) { globePlay.disabled = true; globePlay.classList.add('loading'); }
  return loadThree().then(() => {
    if (globeStarted) return;
    globeStarted = true;
    hideLightweightMap();
    mapSectionElement?.classList.add('globe-active');
    initGlobe();
  }).catch(() => {
    // Epaonnistumisessa palataan kevytversioon. wireLightweight() hakee posterin —
    // tyopoydalla sita ei ole ladattu, joten ilman tata kehys jaa tyhjaksi.
    globeStarted = false;
    mapSectionElement?.classList.remove('globe-active');
    wireLightweight();
    showLightweightMap();
    if (globePlay) {
      globePlay.disabled = false;
      globePlay.classList.remove('loading');
      setPlayLabel(SITE.globe.loadError);
    }
  });
}

// Vaihdetaan vain tekstisisalto, ei koko napin sisusta: textContent tuhoaisi
// .gp-icon- ja .gp-label-elementit ja nappi menettaisi ikoninsa.
function setPlayLabel(text){
  if (!globePlay) return;
  const label = globePlay.querySelector('.gp-label');
  if (label) label.textContent = text;
  else globePlay.textContent = text;
}

// Kevytversion kuva ladataan vain kevytversiossa, jottei tyopoyta lataa sita turhaan.
function loadMapPoster(){
  const img = document.getElementById('real-map-img');
  if (!img) return;
  img.onload = () => img.classList.add('loaded');
  img.src = SITE.base + 'assets/globe/karttapallo-mobiili.webp';
}

let lightweightWired = false;
function wireLightweight(){
  if (lightweightWired) return;
  lightweightWired = true;
  loadMapPoster();
  const poster = document.getElementById('real-map');
  if (!hasWebGL()) {
    // Ilman WebGL:aa palloa ei voi kaynnistaa lainkaan, joten nappia ja
    // klikattavuutta ei nayteta ollenkaan — kuva jaa staattiseksi kartaksi.
    if (globePlay) globePlay.style.display = 'none';
    poster?.removeAttribute('role');
    poster?.removeAttribute('tabindex');
    poster?.removeAttribute('aria-label');
    return;
  }
  globePlay?.addEventListener('click', startGlobe);
  poster?.addEventListener('click', startGlobe);
  poster?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGlobe(); }
  });
}

// Tilan vaihto: kun pallo on kerran kaynnistetty, sita ei enaa pureta lennossa.
let mapMode = null;
function applyMapMode(){
  if (globeStarted) return;
  const want = wantsLightweight() ? 'light' : 'globe';
  if (want === mapMode) return;
  mapMode = want;
  if (want === 'light') { showLightweightMap(); wireLightweight(); }
  else { startGlobe(); }
}
// Karttaosio on kuudentena sivulla, joten sen assetteja (three.min.js 600 kt +
// tekstuuri 648 kt tyopoydalla, poster 127 kt mobiilissa) ei ladata sivun
// latauksessa — ne kilpailisivat hero-kuvasta ja pilaisivat LCP:n.
// Lataus alkaa vasta kun osio lahestyy nakymaa, hyvissa ajoin ennen saapumista.
function scheduleMapMode(){
  if (!mapSectionElement || !('IntersectionObserver' in window)) { applyMapMode(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting){
      io.disconnect();
      applyMapMode();
      lightMQ.addEventListener('change', applyMapMode);
      motionMQ.addEventListener('change', applyMapMode);
    }
  }, { rootMargin: '150% 0px' });
  io.observe(mapSectionElement);
}
scheduleMapMode();


// ================= MAIN SITE SCRIPT =================

  // Jokainen osa kaynnistetaan erikseen: jos yksi kaatuu, muut toimivat silti.
  function safe(name, fn){
    try { fn(); } catch (err) { console.error('[' + name + ']', err); }
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- scroll reveal (ensimmaisena: talla on sisallon nakyvyys kiinni) ----
  safe('reveal', function(){
    const revealEls = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      revealEls.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },{threshold:0.15});
    revealEls.forEach(el=>io.observe(el));
  });

  // ---- temperature extremes chart ----
  // Kuukausien nimet tulevat SITE.charts.monthsShort-taulukosta (kielikohtainen),
  // mittausarvot ovat samat molemmilla kielilla.
  const tempValues = [
    {max:2.6,  min:-34.8}, {max:2.4,  min:-30.0}, {max:6.4,  min:-21.2},
    {max:13.6, min:-17.2}, {max:25.3, min:-10.4}, {max:28.2, min:-2.7},
    {max:28.0, min:0.2},   {max:27.5, min:-0.6},  {max:21.2, min:-5.1},
    {max:13.3, min:-16.2}, {max:6.7,  min:-19.9}, {max:3.1,  min:-27.5},
  ];
  const tempData = tempValues.map((v, i) => ({m: SITE.charts.monthsShort[i], max: v.max, min: v.min}));
  function fmtTemp(v){
    const rounded = Math.round(v);
    if(rounded>0) return '+'+rounded+'°';
    if(rounded===0) return '0°';
    return '\u2212'+Math.abs(rounded)+'°';
  }
  function buildTempChart(){
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('tempChart');
    const W = 1160, marginLeft = 44, marginRight = 16;
    const plotTop = 34, plotBottom = 388;
    const domainTop = 40, domainBottom = -50;
    const plotHeight = plotBottom - plotTop;
    const y = (val) => plotTop + (domainTop - val) / (domainTop - domainBottom) * plotHeight;
    const y0 = y(0);
    const usableW = W - marginLeft - marginRight;
    const slot = usableW / tempData.length;
    const barW = slot * 0.44;

    // Yksikko merkitaan kerran y-akselin ylapaahan, ei jokaiseen asteikkolukemaan:
    // otsikossa (°C) oli otsikkokoossa turhan hallitseva.
    const unit = document.createElementNS(svgNS,'text');
    unit.setAttribute('x', marginLeft-10); unit.setAttribute('y', plotTop-16);
    unit.setAttribute('text-anchor','end');
    unit.setAttribute('class','axis-label axis-unit');
    unit.textContent = '\u00B0C';
    svg.appendChild(unit);

    [40,20,0,-20,-40].forEach(v=>{
      const gy = y(v);
      const line = document.createElementNS(svgNS,'line');
      line.setAttribute('x1', marginLeft); line.setAttribute('x2', W-marginRight);
      line.setAttribute('y1', gy); line.setAttribute('y2', gy);
      line.setAttribute('stroke', 'rgba(185,199,209,0.14)');
      line.setAttribute('stroke-width', v===0 ? 1.2 : 1);
      svg.appendChild(line);
      const lbl = document.createElementNS(svgNS,'text');
      lbl.setAttribute('x', marginLeft-10); lbl.setAttribute('y', gy+4);
      lbl.setAttribute('text-anchor','end');
      lbl.setAttribute('class','axis-label');
      lbl.textContent = (v>0?'+':v<0?'\u2212':'') + Math.abs(v);
      svg.appendChild(lbl);
    });

    tempData.forEach((d,i)=>{
      const cx = marginLeft + i*slot + slot/2;
      const g = document.createElementNS(svgNS,'g');
      g.setAttribute('class','bar-group');
      g.style.setProperty('--i', i);

      const maxTop = y(d.max);
      const maxRect = document.createElementNS(svgNS,'rect');
      maxRect.setAttribute('x', cx-barW/2);
      maxRect.setAttribute('y', maxTop);
      maxRect.setAttribute('width', barW);
      maxRect.setAttribute('height', Math.max(2, y0-maxTop));
      maxRect.setAttribute('rx', 5);
      maxRect.setAttribute('fill', 'url(#maxGrad)');
      g.appendChild(maxRect);

      const minBottom = y(d.min);
      const minRect = document.createElementNS(svgNS,'rect');
      minRect.setAttribute('x', cx-barW/2);
      minRect.setAttribute('y', y0);
      minRect.setAttribute('width', barW);
      minRect.setAttribute('height', Math.max(2, minBottom-y0));
      minRect.setAttribute('rx', 5);
      minRect.setAttribute('fill', 'url(#minGrad)');
      g.appendChild(minRect);

      const maxLbl = document.createElementNS(svgNS,'text');
      maxLbl.setAttribute('x', cx); maxLbl.setAttribute('y', maxTop-10);
      maxLbl.setAttribute('text-anchor','middle');
      maxLbl.setAttribute('class','value-label max');
      maxLbl.textContent = fmtTemp(d.max);
      g.appendChild(maxLbl);

      const minLbl = document.createElementNS(svgNS,'text');
      minLbl.setAttribute('x', cx); minLbl.setAttribute('y', minBottom+20);
      minLbl.setAttribute('text-anchor','middle');
      minLbl.setAttribute('class','value-label min');
      minLbl.textContent = fmtTemp(d.min);
      g.appendChild(minLbl);

      const mLbl = document.createElementNS(svgNS,'text');
      mLbl.setAttribute('x', cx); mLbl.setAttribute('y', plotBottom+34);
      mLbl.setAttribute('text-anchor','middle');
      mLbl.setAttribute('class','month-label');
      mLbl.textContent = d.m;
      g.appendChild(mLbl);

      svg.appendChild(g);
    });

    const chartIo = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          svg.classList.add('chart-in');
          chartIo.unobserve(svg);
        }
      });
    },{threshold:0.2});
    chartIo.observe(svg);
  }
  safe('tempChart', buildTempChart);

  // ---- daylight timeline (horizontal bar chart) ----
  // Kuukausien nimet tulevat SITE.charts.monthsLong-taulukosta (kielikohtainen).
  const daylightHours = [4.5, 8.2, 11.8, 15.5, 19.6, 23.7, 21.2, 16.8, 13.1, 9.4, 5.7, 2.8];
  const daylightData = daylightHours.map((h, i) => ({m: SITE.charts.monthsLong[i], h: h}));

  function buildDaylightTimeline(){
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('daylightTimeline');
    if(!svg) return;

    const W = 1100, H = 280;
    const L = 60, R = 40;
    const chartW = W - L - R;
    const barH = 130;
    const barTop = 55;
    const bottomY = barTop + barH;

    const maxH = 24;
    const gap = chartW / daylightData.length;
    const barW = gap * 0.5;

    // Y-axis labels
    [0, 6, 12, 18, 24].forEach(v => {
      const yPos = bottomY - (v / maxH) * barH;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', L - 6);
      line.setAttribute('x2', W - R);
      line.setAttribute('y1', yPos);
      line.setAttribute('y2', yPos);
      line.setAttribute('stroke', 'rgba(185,199,209,0.12)');
      line.setAttribute('stroke-width', v === 0 || v === 24 ? 0.5 : 1);
      svg.appendChild(line);

      const lbl = document.createElementNS(svgNS, 'text');
      lbl.setAttribute('x', L - 12);
      lbl.setAttribute('y', yPos + 4);
      lbl.setAttribute('text-anchor', 'end');
      lbl.setAttribute('class', 'tl-axis');
      lbl.textContent = v + ' h';
      svg.appendChild(lbl);
    });

    // 24h reference line (yötön yö threshold)
    const y24 = bottomY - (24 / maxH) * barH;
    const refLine = document.createElementNS(svgNS, 'line');
    refLine.setAttribute('x1', L);
    refLine.setAttribute('x2', W - R);
    refLine.setAttribute('y1', y24);
    refLine.setAttribute('y2', y24);
    refLine.setAttribute('stroke', 'rgba(239,185,76,0.15)');
    refLine.setAttribute('stroke-width', 1);
    refLine.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(refLine);

    const refLabel = document.createElementNS(svgNS, 'text');
    refLabel.setAttribute('x', W - R - 6);
    refLabel.setAttribute('y', y24 - 6);
    refLabel.setAttribute('text-anchor', 'end');
    refLabel.setAttribute('class', 'tl-axis');
    refLabel.setAttribute('fill', 'rgba(239,185,76,0.4)');
    refLabel.textContent = SITE.charts.midnightSunLabel;
    svg.appendChild(refLabel);

    daylightData.forEach((d, i) => {
      const cx = L + i * gap + gap / 2;
      const barHeight = (d.h / maxH) * barH;
      const isHigh = d.h >= 20;

      // Bar
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', cx - barW / 2);
      rect.setAttribute('y', bottomY - barHeight);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barHeight);
      rect.setAttribute('rx', 3);
      rect.setAttribute('class', isHigh ? 'tl-bar-high' : 'tl-bar');
      rect.style.setProperty('--i', i);
      rect.style.transform = 'scaleY(0)';
      rect.style.transformOrigin = 'bottom';
      svg.appendChild(rect);

      // Value label on top of bar
      const valLbl = document.createElementNS(svgNS, 'text');
      valLbl.setAttribute('x', cx);
      valLbl.setAttribute('y', bottomY - barHeight - 8);
      valLbl.setAttribute('class', isHigh ? 'tl-label-high' : 'tl-label');
      valLbl.style.setProperty('--i', i);
      valLbl.textContent = Math.round(d.h) + ' h';
      svg.appendChild(valLbl);

      // Month label
      const mLbl = document.createElementNS(svgNS, 'text');
      mLbl.setAttribute('x', cx);
      mLbl.setAttribute('y', bottomY + 24);
      mLbl.setAttribute('text-anchor', 'middle');
      mLbl.setAttribute('class', 'tl-month');
      mLbl.textContent = d.m;
      svg.appendChild(mLbl);

      // Small tick mark
      const tick = document.createElementNS(svgNS, 'line');
      tick.setAttribute('x1', cx);
      tick.setAttribute('x2', cx);
      tick.setAttribute('y1', bottomY + 4);
      tick.setAttribute('y2', bottomY + 12);
      tick.setAttribute('stroke', 'rgba(185,199,209,0.2)');
      tick.setAttribute('stroke-width', 1);
      svg.appendChild(tick);
    });

    // Observer to trigger animation
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          svg.classList.add('chart-in');
          // Animate bars with scaleY
          svg.querySelectorAll('.tl-bar, .tl-bar-high').forEach(el => {
            el.style.transform = 'scaleY(1)';
          });
          io.unobserve(svg);
        }
      });
    }, { threshold: 0.2 });
    io.observe(svg);
  }
  safe('daylightTimeline', buildDaylightTimeline);

  // ---- starfield in hero ----
  // Animaatio pyorii vain kun hero on nakyvissa ja valilehti on aktiivinen.
  // Aiemmin requestAnimationFrame jatkui koko istunnon ajan = turhaa akunkulutusta.
  safe('starfield', function(){
    const starCanvas = document.getElementById('stars');
    const hero = document.querySelector('.hero');
    if (!starCanvas || !hero) return;
    const starCtx = starCanvas.getContext('2d');
    let stars = [];
    let rafId = null;
    let heroVisible = true;

    function sizeCanvas(){
      starCanvas.width = starCanvas.offsetWidth;
      starCanvas.height = starCanvas.offsetHeight;
      stars = Array.from({length: Math.floor((starCanvas.width*starCanvas.height)/9000)}, ()=>({
        x: Math.random()*starCanvas.width,
        y: Math.random()*starCanvas.height*0.75,
        r: Math.random()*1.3+0.2,
        p: Math.random()*Math.PI*2,
        s: Math.random()*0.015+0.005
      }));
    }
    function paint(t){
      starCtx.clearRect(0,0,starCanvas.width,starCanvas.height);
      starCtx.fillStyle = '#fff';
      stars.forEach(st=>{
        const tw = 0.55 + Math.sin(t*st.s + st.p)*0.45;
        starCtx.globalAlpha = Math.max(0, tw*0.85);
        starCtx.beginPath();
        starCtx.arc(st.x, st.y, st.r, 0, Math.PI*2);
        starCtx.fill();
      });
      starCtx.globalAlpha = 1;
    }
    function loop(t){ paint(t); rafId = requestAnimationFrame(loop); }
    function start(){ if (rafId === null && !prefersReducedMotion) rafId = requestAnimationFrame(loop); }
    function stop(){ if (rafId !== null){ cancelAnimationFrame(rafId); rafId = null; } }

    window.addEventListener('resize', () => { sizeCanvas(); if (rafId === null) paint(0); });
    sizeCanvas();

    if (prefersReducedMotion){ paint(0); return; }   // staattinen tahtitaivas, ei animaatiota

    if ('IntersectionObserver' in window){
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        heroVisible && !document.hidden ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => {
      document.hidden || !heroVisible ? stop() : start();
    });
  });

  // ---- seasons background: subtle shift between cool Arctic blue-green tones ----
  // Laskenta ajetaan enintaan kerran ruudunpaivityksessa ja vain kun osio on lahella nakymaa.
  safe('seasonsBg', function(){
    const seasonsSection = document.getElementById('seasons');
    const seasonsBg = document.getElementById('seasonsBg');
    if (!seasonsSection || !seasonsBg) return;
    let inView = true, ticking = false;

    function lerpColor(a,b,t){
      const ah=a.match(/\w\w/g).map(x=>parseInt(x,16));
      const bh=b.match(/\w\w/g).map(x=>parseInt(x,16));
      const rc=ah.map((c,i)=>Math.round(c+(bh[i]-c)*t));
      return '#'+rc.map(c=>c.toString(16).padStart(2,'0')).join('');
    }
    function updateSeasonsBg(){
      const rect = seasonsSection.getBoundingClientRect();
      const vh = window.innerHeight;
      let t = 1 - (rect.bottom / (rect.height + vh));
      t = Math.min(1, Math.max(0, t));
      const c1 = lerpColor('41545C','3A505B', Math.min(1,t*2));
      const c2 = lerpColor('354D59','2D4552', Math.min(1,Math.max(0,(t-0.3)*1.6)));
      seasonsBg.style.background = `radial-gradient(circle at 80% 16%, rgba(199,220,218,.16) 0%, rgba(199,220,218,.05) 24%, transparent 45%), linear-gradient(160deg, ${c1} 0%, ${c2} 100%)`;
    }
    function onScroll(){
      if (!inView || ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateSeasonsBg(); ticking = false; });
    }
    if ('IntersectionObserver' in window){
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        if (inView) onScroll();
      }, { rootMargin: '300px 0px' }).observe(seasonsSection);
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    updateSeasonsBg();
  });

  // ---- videon poster vasta kun video lahestyy nakymaa ----
  // poster-attribuutti ladataan aina heti, myos preload="none":lla, ja video on
  // gallerian lopussa. 78 kt pois hero-kuvan tielta.
  safe('videoPoster', function(){
    const v = document.querySelector('.gallery-video video[data-poster]');
    if (!v) return;
    const apply = () => { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); };
    if (!('IntersectionObserver' in window)) { apply(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting){ io.disconnect(); apply(); }
    }, { rootMargin: '200% 0px' });
    io.observe(v);
  });

  // ---- ylävalikon kontrasti vieritettäessä ----
  safe('navContrast', function(){
    const nav = document.querySelector('nav');
    if (!nav) return;
    const update = () => nav.classList.toggle('scrolled', window.scrollY > 48);
    update();
    window.addEventListener('scroll', update, {passive:true});
  });

  // ---- mobile menu toggle ----
  safe('mobileMenu', function(){
    const navToggle = document.getElementById('nav-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!navToggle || !mobileMenu) return;
    const links = Array.from(mobileMenu.querySelectorAll('a'));
    const isOpen = () => mobileMenu.classList.contains('open');

    function setOpen(open, refocus){
      mobileMenu.classList.toggle('open', open);
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      // Taustan vieritys lukkoon, jottei sivu rullaa valikon alla.
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) links[0]?.focus();
      else if (refocus) navToggle.focus();
    }

    navToggle.addEventListener('click', () => setOpen(!isOpen(), false));
    links.forEach(a => a.addEventListener('click', () => setOpen(false, false)));

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape'){ e.preventDefault(); setOpen(false, true); return; }
      // Pidetaan fokus valikossa: koko ruudun peittavan valikon takana ei saa voida tabata.
      if (e.key === 'Tab' && links.length){
        const first = links[0], last = links[links.length - 1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });

    // Ei leveyteen sidottua automaattista sulkemista: valikko on kaytossa
    // kaikilla naytoilla, joten ikkunan koon muutos ei saa sulkea sita.
  });
