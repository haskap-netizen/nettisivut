#!/usr/bin/env bash
# Vaihtaa kaikki sivuston absoluuttiset osoitteet github.io:sta omaan verkkotunnukseen.
#
#   bash tools/vaihda-domain.sh
#
# AJA TAMA VASTA KUN https://lapinhunajamarja.fi AUKEAA SELAIMESSA.
# Jos canonical- ja og:url-osoitteet osoittavat verkkotunnukseen joka ei viela
# vastaa, Google tulkitsee sivun kanoniseksi osoitteeksi kuolleen URLin.
#
# Oikea jarjestys:
#   1. Repo -> Settings -> Pages -> Custom domain: lapinhunajamarja.fi -> Save
#      (GitHub luo CNAME-tiedoston itse, ala tee sita kasin)
#   2. DNS-palvelussa apex-tietueet (lapinhunajamarja.fi):
#        A     185.199.108.153
#        A     185.199.109.153
#        A     185.199.110.153
#        A     185.199.111.153
#        AAAA  2606:50c0:8000::153
#        AAAA  2606:50c0:8001::153
#        AAAA  2606:50c0:8002::153
#        AAAA  2606:50c0:8003::153
#      ja www-alidomainille:
#        CNAME www -> haskap-netizen.github.io
#      (tarkista IP-osoitteet GitHubin dokumentaatiosta, ne voivat muuttua:
#       docs.github.com -> Pages -> Managing a custom domain)
#   3. Odota etta DNS leviaa, korkeintaan 24 h. Sitten Settings -> Pages ->
#      rastita "Enforce HTTPS".
#   4. Kun sivu aukeaa https-osoitteessa, aja tama skripti ja pushaa muutokset.

set -euo pipefail

VANHA="https://haskap-netizen.github.io/nettisivut"
UUSI="https://lapinhunajamarja.fi"

# HUOM: en/index.html on mukana. Se sisaltaa oman canonicalinsa, og-tagit ja
# JSON-LD:n, eli se on yhta tarkea kuin suomenkielinen sivu.
TIEDOSTOT=(index.html en/index.html sitemap.xml robots.txt)

for f in "${TIEDOSTOT[@]}"; do
  [ -f "$f" ] || { echo "Tiedostoa $f ei loydy — aja skripti repon juuressa."; exit 1; }
done

echo "Vaihdetaan: $VANHA  ->  $UUSI"
echo

for f in "${TIEDOSTOT[@]}"; do
  ennen=$(grep -c "haskap-netizen.github.io" "$f" || true)
  sed -i.bak "s|${VANHA}|${UUSI}|g" "$f" && rm -f "$f.bak"
  echo "  $f: $ennen osoitetta vaihdettu"
done

# 404.html: paluulinkit juureen, koska oma verkkotunnus tarjoillaan juuresta
# eika /nettisivut/-polusta.
if [ -f 404.html ]; then
  sed -i.bak -e 's|href="/nettisivut/"|href="/"|g' \
             -e 's|href="/nettisivut/en/"|href="/en/"|g' 404.html && rm -f 404.html.bak
  echo "  404.html: paluulinkit -> / ja /en/"
fi

echo
echo "Tarkistus — jaljella olevat github.io-viittaukset:"
if grep -rn "haskap-netizen.github.io" "${TIEDOSTOT[@]}" 404.html assets/site.js assets/site.css 2>/dev/null; then
  echo "  ^ nama jaivat, tarkista kasin"
else
  echo "  ei yhtaan, kaikki vaihdettu"
fi

echo
echo "Valmis. Muista viela:"
echo "  - Facebookin ja LinkedInin jakolinkkien valimuistit pitaa tyhjentaa"
echo "    erikseen niiden omilla debug-tyokaluilla."
echo "  - Lisaa uusi osoite Google Search Consoleen omana sivustonaan."
