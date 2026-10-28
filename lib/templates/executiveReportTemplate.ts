/**
 * PLANTILLA ESTÀNDARD — Informe Executiu Geocontent · v0.1
 * Motor: Mustache (sense lògica). {{x}} escapa HTML; {{{x}}} és HTML cru (només per SVG generat pel codi).
 * Sense JavaScript ni recursos externs: gràfiques en CSS/SVG inline, perquè el PDF surti igual a qualsevol entorn.
 * Marca: el backend ha d'enviar SEMPRE marca.color_primari i marca.color_secundari (p. ex. del bioma) i logo_url
 * (data URI o URL absoluta accessible pel renderitzador).
 * Dades: contracte d'entrada (càlculs del backend) + sortida de la IA (textos). Les gràfiques es referencien per id:
 * grafiques.g_usuaris.titular / .lectura, etc.
 */
export const EXECUTIVE_REPORT_MUSTACHE_TEMPLATE = `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe Executiu — {{client.nom}}</title>
<style>
@page{size:A4;margin:16mm 14mm}
*{box-sizing:border-box}
body{--c1:{{marca.color_primari}};--c2:{{marca.color_secundari}};--c3:#b9c7c0;--ink:#1f2933;--mut:#667085;--line:#e4e7ec;--ok:#2f8f5b;--warn:#b7791f;--bad:#b42318;
 margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#fff}
.pag{max-width:820px;margin:0 auto;padding:24px}
h1,h2,h3{line-height:1.2;margin:0}
h2{font-size:18px;color:var(--c1);margin:0 0 4px}
h3{font-size:14px;margin:14px 0 6px}
section{margin:0 0 26px}
.card,.kpi,.prop,.fila-ruta{break-inside:avoid}
.mut{color:var(--mut)}.pet{font-size:12px}.nd{color:var(--mut);font-style:italic}
.lectura{color:var(--mut);font-size:12.5px;margin:6px 0 0}
.titular{font-weight:600;margin:0 0 2px}
/* Capçalera */
.cap{display:flex;align-items:center;gap:16px;border-bottom:3px solid var(--c1);padding-bottom:14px;margin-bottom:20px}
.cap img{height:56px;max-width:140px;object-fit:contain}
.cap .nom{font-size:22px;font-weight:700;color:var(--c1)}
.cap .dreta{margin-left:auto;text-align:right}
.banner{background:#fff7e6;border-left:4px solid var(--warn);padding:10px 14px;margin:0 0 20px;font-size:13px}
/* Resum */
.resum{background:var(--c2);border-radius:10px;padding:18px 20px}
.resum h1{font-size:20px;margin-bottom:8px}.resum p{margin:0 0 8px}
/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.kpi{border:1px solid var(--line);border-top:4px solid var(--c3);border-radius:8px;padding:12px}
.kpi.estat-positiu{border-top-color:var(--ok)}.kpi.estat-atencio{border-top-color:var(--warn)}
.kpi .et{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut)}
.kpi .val{font-size:26px;font-weight:700;color:var(--c1)}
.kpi .dif{font-size:12px;font-weight:600}.estat-positiu .dif{color:var(--ok)}.estat-atencio .dif{color:var(--warn)}
.fiab{display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--mut);margin-top:4px}
.fiab-baixa{background:#fff7e6;border-color:#f3d9a4;color:var(--warn)}
/* Gràfiques de barres */
.card{border:1px solid var(--line);border-radius:10px;padding:16px;margin:0 0 12px}
.fila{display:grid;grid-template-columns:34% 1fr 56px;gap:10px;align-items:center;margin:7px 0}
.fila .e{font-size:12.5px;overflow-wrap:anywhere}.fila .n{font-size:12px;text-align:right;font-variant-numeric:tabular-nums}
.barra{height:12px;background:#f2f4f7;border-radius:6px;overflow:hidden;display:flex}
.barra+.barra{margin-top:3px}
.barra i{display:block;height:100%}
.b-act{background:var(--c1)}.b-ant{background:var(--c3)}.b-mal{background:#d9a29b}
.q1{background:var(--ok)}.q2{background:#8cc5a3}.q3{background:#e5b95a}.q4{background:#d9776b}
.llegenda{display:flex;flex-wrap:wrap;gap:12px;font-size:11.5px;color:var(--mut);margin:8px 0 0}
.llegenda b{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
/* Estrelles i taula de rutes */
.estrelles{position:relative;display:inline-block;font-size:16px;letter-spacing:2px;color:#d0d5dd;white-space:nowrap}
.estrelles i{position:absolute;left:0;top:0;width:var(--p);overflow:hidden;color:#e0a100;font-style:normal;white-space:nowrap}
.fila-ruta{display:grid;grid-template-columns:1fr 130px 90px 70px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}
.fila-ruta:last-child{border:0}
.semafor{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;text-align:center}
.s-consolidada{background:#e3f4ea;color:var(--ok)}.s-a_vigilar{background:#fff1d6;color:var(--warn)}
.s-a_revisar{background:#fde4e1;color:var(--bad)}.s-sense_dades{background:#f2f4f7;color:var(--mut)}
svg.spark{width:70px;height:24px}svg.spark polyline{fill:none;stroke:var(--c1);stroke-width:2}
/* Text */
.dues{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.tag{display:inline-block;font-size:11px;padding:1px 8px;border-radius:99px;background:var(--c2);color:var(--c1);margin-right:4px}
.prop{border:1px solid var(--line);border-left:5px solid var(--c1);border-radius:8px;padding:12px 14px;margin:0 0 10px}
.prop .p{font-weight:700;color:var(--c1);margin-right:6px}
blockquote{margin:6px 0;padding:6px 12px;border-left:3px solid var(--c3);color:var(--mut);font-style:italic}
ul{margin:4px 0 0;padding-left:18px}
.peu{border-top:1px solid var(--line);padding-top:10px;font-size:11.5px;color:var(--mut)}
@media print{.pag{padding:0;max-width:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media(max-width:640px){.kpis,.dues{grid-template-columns:1fr}.fila-ruta{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<div class="pag">

<!-- 1. CAPÇALERA -->
<header class="cap">
  {{#marca.logo_url}}<img src="{{marca.logo_url}}" alt="Logotip de {{client.nom}}">{{/marca.logo_url}}
  <div><div class="nom">{{client.nom}}</div><div class="mut pet">Impacte turístic digital · Geocontent</div></div>
  <div class="dreta"><strong>Informe Executiu</strong><br><span class="pet mut">{{periode.inici}} – {{periode.final}}</span>
  {{#periode_anterior.disponible}}<br><span class="pet mut">Comparat amb {{periode_anterior.inici}} – {{periode_anterior.final}}</span>{{/periode_anterior.disponible}}</div>
</header>

{{#preliminar}}<div class="banner"><strong>Informe preliminar.</strong> El volum de dades encara és baix: les xifres són indicis i no permeten treure tendències.</div>{{/preliminar}}

<!-- 2. RESUM EXECUTIU -->
<section class="resum">
  <h1>{{resum_executiu.titular}}</h1>
  {{#resum_executiu.paragrafs}}<p>{{.}}</p>{{/resum_executiu.paragrafs}}
</section>

<!-- 3. KPIs -->
<section>
  <h2>Indicadors clau</h2>
  <p class="mut pet">Cada indicador mostra el valor, el canvi respecte al període anterior i la fiabilitat de la dada.</p>
  <div class="kpis">
  {{#kpis}}
    <div class="kpi estat-{{estat}}">
      <div class="et">{{nom}}</div>
      {{#disponible}}<div class="val">{{valor}}</div>
      {{#canvi}}<div class="dif">{{canvi}}</div>{{/canvi}}{{/disponible}}
      {{^disponible}}<div class="val nd">No disponible</div>{{/disponible}}
      <span class="fiab fiab-{{fiabilitat}}">Fiabilitat {{fiabilitat}} · n={{n}}</span>
      <p class="lectura">{{lectura}}</p>
    </div>
  {{/kpis}}
  </div>
</section>

<!-- 4. COMPORTAMENT -->
<section>
  <h2>Comportament dels visitants</h2>
  <div class="card">
    <p class="titular">{{grafiques.g_usuaris.titular}}</p>
    {{#g_usuaris}}
    <div class="fila"><div class="e">{{etiqueta}}</div>
      <div><div class="barra"><i class="b-act" style="width:{{pct_actual}}%"></i></div>
      {{#te_anterior}}<div class="barra"><i class="b-ant" style="width:{{pct_anterior}}%"></i></div>{{/te_anterior}}</div>
      <div class="n">{{actual}}{{#te_anterior}}<br><span class="mut">{{anterior}}</span>{{/te_anterior}}</div></div>
    {{/g_usuaris}}
    <div class="llegenda"><span><b class="b-act"></b>Període actual</span><span><b class="b-ant"></b>Període anterior</span></div>
    <p class="lectura">{{grafiques.g_usuaris.lectura}}</p>
  </div>
  <div class="card">
    <p class="titular">{{grafiques.g_rutes.titular}}</p>
    {{#g_rutes}}
    <div class="fila"><div class="e">{{nom}}</div>
      <div class="barra"><i class="b-act" style="width:{{pct_completades}}%"></i><i class="b-mal" style="width:{{pct_abandonades}}%"></i></div>
      <div class="n">{{completades}} / {{abandonades}}</div></div>
    {{/g_rutes}}
    <div class="llegenda"><span><b class="b-act"></b>Completades</span><span><b class="b-mal"></b>Abandonades</span></div>
    <p class="lectura">{{grafiques.g_rutes.lectura}}</p>
  </div>
</section>

<!-- 5. VALORACIÓ PER RUTA -->
<section>
  <h2>Valoració de les rutes</h2>
  <div class="card">
    <p class="titular">{{grafiques.g_estrelles.titular}}</p>
    {{#rutes}}
    <div class="fila-ruta">
      <div><strong>{{nom}}</strong><div class="pet mut">{{lectura}}</div></div>
      <div>{{#valoracio.disponible}}<span class="estrelles" style="--p:{{valoracio.pct_estrelles}}%">★★★★★<i>★★★★★</i></span>
        <div class="pet">{{valoracio.mitjana}} / 5 · n={{valoracio.n}}</div>{{/valoracio.disponible}}
        {{^valoracio.disponible}}<span class="nd pet">Sense valoracions</span>{{/valoracio.disponible}}</div>
      <div>{{#valoracio.sparkline}}<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-label="Evolució de la valoració"><polyline points="{{valoracio.sparkline}}"/></svg>{{/valoracio.sparkline}}<div class="pet mut">{{evolucio}}</div></div>
      <div class="semafor s-{{semafor}}">{{semafor_text}}</div>
    </div>
    {{/rutes}}
    <p class="lectura">{{grafiques.g_estrelles.lectura}}</p>
  </div>
</section>

<!-- 6. QUIZZES -->
<section>
  <h2>Resolució dels quizzes</h2>
  <div class="card">
    <p class="titular">{{grafiques.g_quiz.titular}}</p>
    {{#g_quiz}}
    <div class="fila"><div class="e">{{etiqueta}}</div>
      <div class="barra"><i class="q1" style="width:{{pct1}}%"></i><i class="q2" style="width:{{pct2}}%"></i><i class="q3" style="width:{{pct3}}%"></i><i class="q4" style="width:{{pct4}}%"></i></div>
      <div class="n">n={{n}}</div></div>
    {{/g_quiz}}
    <div class="llegenda"><span><b class="q1"></b>1r intent</span><span><b class="q2"></b>2n</span><span><b class="q3"></b>3r</span><span><b class="q4"></b>4t</span></div>
    <p class="lectura">{{grafiques.g_quiz.lectura}}</p>
    {{#quiz.pois_a_revisar.0}}<h3>POIs a revisar</h3>{{/quiz.pois_a_revisar.0}}
    <ul>{{#quiz.pois_a_revisar}}<li><strong>{{nom}}</strong>: {{motiu}}</li>{{/quiz.pois_a_revisar}}</ul>
  </div>
</section>

<!-- 7. EMBUT PER RUTA -->
<section>
  <h2>On es perd l'interès dins de cada ruta</h2>
  <p class="mut pet">Desbloquejos per punt d'interès, en l'ordre de la ruta.</p>
  {{#g_embut}}
  <div class="card">
    <h3>{{ruta_nom}}</h3>
    {{#pois}}
    <div class="fila"><div class="e">{{ordre}}. {{nom}}</div>
      <div class="barra"><i class="b-act" style="width:{{pct}}%"></i></div><div class="n">{{desbloquejos}}</div></div>
    {{/pois}}
  </div>
  {{/g_embut}}
  <p class="lectura">{{grafiques.g_embut.lectura}}</p>
</section>

<!-- 8. COMENTARIS -->
<section>
  <h2>Què diuen els usuaris</h2>
  <div class="card">
    <p class="titular">{{grafiques.g_comentaris.titular}}</p>
    {{#g_comentaris}}
    <div class="fila"><div class="e">{{etiqueta}}</div>
      <div class="barra"><i class="b-act" style="width:{{pct}}%"></i></div><div class="n">{{n}}</div></div>
    {{/g_comentaris}}
    <p class="lectura">{{grafiques.g_comentaris.lectura}}</p>
    <p>{{comentaris.sensibilitat}}</p>
    {{#comentaris.temes}}<div class="pet"><span class="tag">{{tipus}}</span>{{tema}} · {{n}} comentaris{{#cas_aillat}} · cas aïllat{{/cas_aillat}}</div>{{/comentaris.temes}}
    {{#comentaris.citacions}}<blockquote>{{.}}</blockquote>{{/comentaris.citacions}}
  </div>
  <div class="card">
    <h3>Què s'ha fet bé</h3>
    <ul>{{#ben_fet}}<li><strong>{{tema}}.</strong> {{evidencia}}</li>{{/ben_fet}}</ul>
    {{^ben_fet}}<p class="nd">No hi ha prou evidència per destacar punts forts en aquest període.</p>{{/ben_fet}}
  </div>
</section>

<!-- 9. SEGUIMENT I PROPOSTES -->
{{#seguiment_anterior.0}}
<section>
  <h2>Seguiment de l'informe anterior</h2>
  <div class="card"><ul>{{#seguiment_anterior}}<li><strong>{{proposta}}</strong> — {{estat_text}}. {{nota}}</li>{{/seguiment_anterior}}</ul></div>
</section>
{{/seguiment_anterior.0}}

<section>
  <h2>Propostes de millora</h2>
  {{#propostes}}
  <div class="prop">
    <div><span class="p">{{prioritat}}</span><strong>{{titol}}</strong></div>
    <p style="margin:6px 0">{{accio}}</p>
    <div class="pet"><span class="tag">{{palanca_text}}</span><span class="tag">Esforç {{esforc}}</span>{{#on_text}}<span class="tag">{{on_text}}</span>{{/on_text}}</div>
    <div class="pet mut" style="margin-top:6px">A mirar al proper informe: {{kpi_a_mirar}}</div>
  </div>
  {{/propostes}}
  {{^propostes}}<p class="nd">Les dades actuals no justifiquen canvis concrets. Es recomana continuar mesurant.</p>{{/propostes}}
</section>

<!-- 10. MAPA DE CALOR (SVG anònim generat pel codi) -->
{{#mapa_calor_svg}}
<section><h2>Mapa de calor</h2><div class="card">{{{mapa_calor_svg}}}<p class="lectura">Acumulació anònima de visitants per punt d'interès. No mostra trajectòries individuals.</p></div></section>
{{/mapa_calor_svg}}

<!-- 11. LIMITACIONS I PEU -->
{{#limitacions.0}}
<section><h2>Limitacions d'aquest informe</h2><ul class="pet mut">{{#limitacions}}<li>{{.}}</li>{{/limitacions}}</ul></section>
{{/limitacions.0}}

<footer class="peu">Informe generat per la plataforma Geocontent per a {{client.nom}} · període {{periode.inici}} – {{periode.final}} · generat el {{generat_el}}.</footer>

</div>
</body>
</html>`;
