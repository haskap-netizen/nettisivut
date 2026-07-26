#!/usr/bin/env bash
# Lataa Google Fontsin fonttitiedostot paikallisiksi ja muokkaa BOTH index.html
# ja en/index.html osoittamaan niihin.
#
# Miksi: sivu ei ole enaa riippuvainen Googlen palvelimista (yksi DNS+TLS-kattely
# vahemman ennen ensimmaista renderointia) eivatka kavijoiden IP-osoitteet vality
# Googlelle.
#
# Aja tama omalla koneella repon juuressa:
#   bash tools/self-host-fonts.sh
#
# Skripti on turvallista ajaa uudestaan: jos fontit on jo paikallistettu,
# se huomaa sen ja lopettaa.

set -euo pipefail

for f in index.html en/index.html; do
  [ -f "$f" ] || { echo "Tiedostoa $f ei loydy — aja skripti repon juuressa."; exit 1; }
done

if ! grep -q "fonts.googleapis.com" index.html; then
  echo "index.html ei enaa viittaa Google Fontsiin — fontit on jo paikallistettu."
  exit 0
fi

OUT="assets/fonts"
CSS_URL="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
# woff2-tiedostot saa vain modernilla User-Agentilla
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

mkdir -p "$OUT"
echo "Haetaan CSS..."
curl -sS -A "$UA" "$CSS_URL" -o "$OUT/fonts.css"

echo "Haetaan fonttitiedostot..."
grep -o 'https://fonts.gstatic.com[^)]*' "$OUT/fonts.css" | sort -u | while read -r url; do
  name="$(basename "${url%%\?*}")"
  echo "  $name"
  curl -sS -A "$UA" "$url" -o "$OUT/$name"
  # osoitetaan CSS paikalliseen tiedostoon
  sed -i.bak "s|$url|$name|g" "$OUT/fonts.css" && rm -f "$OUT/fonts.css.bak"
done

echo
echo "Muokataan HTML-tiedostot..."
# index.html on juuressa (assets/...), en/index.html yhta tasoa syvemmalla (../assets/...)
patch_html () {
  local file="$1" prefix="$2"
  python3 - "$file" "$prefix" <<'PY'
import re, sys
path, prefix = sys.argv[1], sys.argv[2]
html = open(path, encoding='utf-8').read()
# poistetaan preconnect-, preload-, stylesheet- ja noscript-rivit
html = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>\n', '', html)
html = re.sub(r'<link rel="preload" as="style" href="https://fonts\.googleapis\.com[^>]*>\n', '', html)
html = re.sub(r'<noscript><link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*></noscript>\n', '', html)
html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n',
              '<link rel="stylesheet" href="%sassets/fonts/fonts.css">\n' % prefix, html)
open(path, 'w', encoding='utf-8').write(html)
print("  %s ok" % path)
PY
}
patch_html index.html ""
patch_html en/index.html "../"

echo
echo "Valmis. Tiedostot: $OUT/"
du -sh "$OUT"
echo "Tarkista viela selaimessa etta fontit nayttavat oikeilta, ja committoi assets/fonts/."
