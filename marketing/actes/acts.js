/* Pilote du défilement de la page « présentation ».
 *
 * CE QUE ÇA REMPLACE. Les cinq actes étaient orchestrés par un fichier maître
 * qui les empilait en plein écran et détournait la molette pour passer de l'un
 * à l'autre. Ici la page défile normalement : l'en-tête du site reste en haut,
 * et les actes se suivent au fil du défilement.
 *
 * POURQUOI DES IFRAMES ET NON UNE FUSION. Les actes partagent des sélecteurs
 * (`.scene`, `.stage`, `.closing`, `#world`) et des identifiants d'animation
 * qui se marcheraient dessus dans un même document. Chacun garde donc son
 * propre document, et n'a pas eu à être retouché.
 *
 * COMMENT LE DÉFILEMENT EST TRANSMIS. Chaque acte est déjà une page à
 * défilement normal : ses animations sont accrochées à SON scroll par des
 * ScrollTrigger en `scrub`. On mesure sa course de défilement, on donne à la
 * section parente cette même course en plus d'une hauteur d'écran, et on
 * recopie la position. Un pixel de molette ici vaut donc un pixel de molette
 * dans l'acte : le rythme réglé à l'origine est conservé au pixel près.
 *
 * MÊME ORIGINE OBLIGATOIRE. Lire et écrire le scroll d'une iframe suppose que
 * la page et les actes soient servis depuis la même origine HTTP. C'est le cas
 * en production (tout est dans marketing/) ; en `file://` le navigateur refuse,
 * et la page se rabat alors sur un acte par écran, sans animation pilotée.
 */
(function () {
  "use strict";

  var BAR_H = 64; // header.site .bar — voir assets/site.css
  var acts = [].slice.call(document.querySelectorAll(".act"));
  if (!acts.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Longueur d'une bande de transition, en fraction de la hauteur visible.
     0,8 écran : assez long pour que le mouvement se lise, assez court pour
     qu'on ne croie pas la page bloquée. En mouvement réduit il n'y a pas de
     bande du tout — les actes se succèdent net. */
  var BAND_RATIO = 0.8;

  var veil = document.getElementById("actVeil");

  // La bande appartient à l'acte SORTANT, mais l'effet est déclaré sur
  // l'entrant (c'est la transition qui l'amène, comme dans le montage
  // d'origine). Un acte sans suivant n'a pas de bande.
  function nextOf(act) {
    var i = acts.indexOf(act);
    return i >= 0 && i + 1 < acts.length ? acts[i + 1] : null;
  }
  function bandOf(act) {
    if (reduced) return 0;
    var nxt = nextOf(act);
    if (!nxt || !nxt.dataset.transition) return 0;
    return Math.round(window.innerHeight * BAND_RATIO);
  }

  /* Chargement paresseux : les actes 2 à 4 pèsent plusieurs centaines de Ko
     (marionnettes et images en base64). Les charger tous d'entrée ferait payer
     l'acte 5 à quelqu'un qui ne dépasse pas le premier écran. La marge d'un
     écran laisse le temps du chargement avant que l'acte n'entre en scène. */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { mount(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: "150% 0px" });

  acts.forEach(function (act) { io.observe(act); });

  function mount(act) {
    var pin = act.querySelector(".act__pin");
    var frame = document.createElement("iframe");
    frame.src = act.dataset.src;
    frame.title = act.getAttribute("aria-label") || "";
    frame.setAttribute("loading", "eager");
    // L'acte est un décor : la molette et le doigt doivent traverser jusqu'à
    // la page, qui seule commande le défilement. Le lien qui compte
    // (« C'est parti ») vit dans la page, où il est cliquable et indexable.
    frame.setAttribute("tabindex", "-1");
    frame.style.pointerEvents = "none";
    pin.appendChild(frame);
    act._frame = frame;
    whenReady(frame, function () { watch(act, frame); });
  }

  /* On n'attend PAS l'événement `load` de l'iframe. Il ne se déclenche qu'une
     fois chaque ressource externe arrivée — polices, icônes, GSAP — et un seul
     CDN lent (ou bloqué par un bloqueur de publicités) le retarde de plusieurs
     secondes, voire indéfiniment. La section garderait pendant tout ce temps sa
     hauteur de repli et la page défilerait faux. On attend donc seulement que
     le document ait un corps et une hauteur. */
  function whenReady(frame, cb) {
    var tries = 0;
    (function poll() {
      var doc = docOf(frame);
      // On écarte le document INITIAL de l'iframe. Fraîchement insérée, elle en
      // porte un autre, vide (`about:blank`), le temps que la navigation
      // démarre — et celui-là a déjà un corps et une hauteur. S'en contenter,
      // c'est mesurer un document vide (course nulle) et poser ses adaptations
      // sur un document jeté à l'instant suivant : le style injecté disparaît,
      // l'observateur de taille ne se déclenche plus jamais.
      //
      // Le test porte sur `about:blank` et NON sur l'égalité avec `frame.src` :
      // l'hébergement sert le site en `cleanUrls`, donc une URL en `.html` est
      // redirigée vers la même sans extension. L'égalité n'était jamais vraie
      // en production, et rien ne s'appliquait — c'est ce qui laissait l'acte 1
      // afficher son propre logo par-dessus celui du site.
      if (doc && doc.body && doc.URL !== "about:blank" && doc.documentElement.scrollHeight > 0) {
        cb();
        return;
      }
      if (++tries > 200) return; // ~20 s : on abandonne, le repli s'applique
      setTimeout(poll, 50);
    })();
  }

  /* La hauteur d'un acte bouge APRÈS la première mesure : une police qui
     arrive, une image qui se pose, GSAP qui installe ses pins. Une mesure
     unique laisserait la fin de l'acte tomber à côté de la fin de sa section.
     On remesure donc à chaque changement de hauteur du document de l'acte. */
  function watch(act, frame) {
    var doc = docOf(frame);
    if (!doc) { degrade(act); return; }
    try {
      hide(doc, COMMON_HIDE);
      if (ADAPT[act.id]) ADAPT[act.id](doc);
    } catch (err) { /* décor : jamais bloquant */ }
    measure(act, frame);
    if (typeof frame.contentWindow.ResizeObserver !== "function") return;
    var timer;
    var ro = new frame.contentWindow.ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () { measure(act, frame); }, 120);
    });
    ro.observe(doc.documentElement);
  }

  function docOf(frame) {
    try { return frame.contentDocument; } catch (err) { return null; }
  }

  /* ADAPTATIONS INJECTÉES, plutôt que des retouches dans les fichiers d'actes.
     Les actes viennent d'un outil de conception et seront réexportés : toute
     modification faite dans leur fichier serait perdue au prochain export. On
     les laisse donc intacts et on applique ici le peu qui dépend du contexte.

     • L'acte 1 porte son propre en-tête (logo + « C'est parti »), qui faisait
       doublon avec celui du site, juste au-dessus. On le masque.
     • Le « C'est parti » de l'acte 5 est un `href="#"` de démonstration. On le
       branche sur l'app, avec `target="_top"` sans quoi le clic chargerait
       l'app DANS l'iframe, à l'intérieur de la page. */
  // Les cinq actes portent une étiquette « prototype · acte N » héritée de
  // leur mise au point. Elle vaut pour toutes.
  var COMMON_HIDE = ".proto-tag, .tag";

  var ADAPT = {
    "acte-1": function (doc) { hide(doc, ".nav"); },
    // Le bouton de clôture de l'acte 5 devient inerte (l'iframe ne reçoit plus
    // les clics) : on le masque plutôt que de laisser un bouton mort à
    // l'écran. C'est la bande de clôture de la page qui prend le relais,
    // juste en dessous.
    "acte-5": function (doc) { hide(doc, "#startCta"); }
  };

  function hide(doc, selector) {
    var st = doc.createElement("style");
    st.textContent = selector + "{display:none !important}";
    doc.head.appendChild(st);
  }

  function measure(act, frame) {
    var doc = docOf(frame);
    if (!doc) { degrade(act); return; }

    /* NE PAS poser `overflow: hidden` ici pour empêcher l'acte de défiler
       tout seul. Ça marche — et ça casse `position: sticky` à l'intérieur du
       document : les pins des actes cessent de se coller, les scènes
       remontent avec le défilement et les animations se déroulent hors de
       l'écran. C'est le geste de l'utilisateur qu'il faut neutraliser, pas la
       capacité de l'acte à défiler ; d'où `pointer-events: none` sur l'iframe,
       posé à la création. */

    // La hauteur imposée à la section fausserait la mesure suivante si elle
    // entrait dans le calcul : on mesure la hauteur PROPRE de l'acte, qui n'en
    // dépend pas, contre la hauteur visible de l'iframe.
    var range = doc.documentElement.scrollHeight - frame.clientHeight;
    if (!(range > 0) || reduced) { degrade(act); return; }
    if (act._range === range) return; // rien n'a bougé : pas de reflow inutile

    act._range = range;
    // La bande de transition prolonge la section APRÈS la fin de la course
    // interne : l'acte y reste collé sur sa dernière scène pendant que le
    // suivant se superpose. Sans elle, les deux ne se croiseraient jamais.
    act._band = bandOf(act);
    act.style.height = (frame.clientHeight + range + act._band) + "px";
    act.dataset.measured = "1";
    sync();
  }

  /* Repli : l'acte reste sur sa première scène, à hauteur d'écran. C'est ce
     qui arrive en `file://`, en mouvement réduit, ou si un acte ne défile pas.
     La page reste lisible et continue de défiler d'un acte au suivant. */
  function degrade(act) {
    act.dataset.measured = "1";
    act.style.height = "";
    act._range = 0;
  }

  function sync() {
    var y = window.scrollY;
    var veilOpacity = 0;
    var active = null;
    var activeT = 0;

    for (var i = 0; i < acts.length; i++) {
      var act = acts[i];
      if (!act._range || !act._frame) continue;
      var doc = docOf(act._frame);
      if (!doc) continue;
      // La section « colle » dès que son haut atteint le bas de l'en-tête.
      var start = act.offsetTop - BAR_H;
      var p = (y - start) / act._range;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var target = Math.round(p * act._range);
      if (doc.documentElement.scrollTop !== target) {
        doc.documentElement.scrollTop = target;
      }

      // La bande commence là où la course interne s'achève.
      var band = act._band || 0;
      if (!band) continue;
      var t = (y - (start + act._range)) / band;
      if (t > 0 && t < 1) { active = act; activeT = t; }
    }

    /* UNE SEULE jonction est active à la fois, et c'est ce qui doit gouverner
       la remise à zéro. Le même élément est l'ENTRANT d'une jonction et le
       SORTANT de la suivante : laisser chaque jonction nettoyer ses deux
       panneaux faisait effacer, par la jonction d'après, l'état que celle
       d'avant venait de poser — la transition ne se voyait jamais. On remet
       donc tout à plat une fois, puis on n'applique que la jonction active. */
    if (active !== lastActive) {
      resetAll();
      lastActive = active;
    }
    if (active) veilOpacity = transition(active, nextOf(active), activeT);

    if (veil) {
      veil.style.opacity = veilOpacity;
      veil.style.display = veilOpacity > 0 ? "block" : "none";
    }
  }

  var lastActive = null;

  function resetAll() {
    for (var i = 0; i < acts.length; i++) {
      var pin = acts[i].querySelector(".act__pin");
      if (!pin) continue;
      pin.className = "act__pin";
      pin.style.transform = "";
      pin.style.opacity = "";
      pin.style.transformOrigin = "";
      acts[i].classList.remove("is-flipping");
    }
  }

  /* Applique la transition qui amène `incoming` par-dessus `leaving`.
     `t` va de 0 (rien) à 1 (l'entrant a pris toute la place). Rend
     l'opacité que le voile noir doit avoir, 0 si la transition n'en use pas. */
  function transition(leaving, incoming, t) {
    if (!incoming) return 0;
    var kind = incoming.dataset.transition;
    var out = leaving.querySelector(".act__pin");
    var into = incoming.querySelector(".act__pin");
    if (!out || !into) return 0;

    into.className = "act__pin is-entering";
    out.className = "act__pin is-leaving";
    var e = ease(t);

    if (kind === "slide-up") {
      into.style.transform = "translate3d(0," + ((1 - e) * 100) + "%,0)";
      // Le sortant recule un peu : sans ce décalage les deux plans avancent
      // du même pas et le mouvement paraît plat.
      out.style.transform = "translate3d(0," + (-e * 18) + "%,0)";
    } else if (kind === "slide-left") {
      into.style.transform = "translate3d(" + ((1 - e) * 100) + "%,0,0)";
      out.style.transform = "translate3d(" + (-e * 18) + "%,0,0)";
    } else if (kind === "flip-boat") {
      leaving.classList.add("is-flipping");
      out.style.transformOrigin = "50% 100%";
      // La perspective est DANS la transformation : posée en CSS sur l'élément
      // lui-même, elle ne vaudrait que pour ses enfants et la bascule
      // resterait plate — un écrasement vertical au lieu d'un basculement.
      out.style.transform = "perspective(1400px) rotateX(" + (e * 78) + "deg)";
      out.style.opacity = String(1 - e);
      into.style.transformOrigin = "50% 0%";
      into.style.transform = "perspective(1400px) rotateX(" + (-(1 - e) * 78) + "deg)";
    } else if (kind === "fade-black") {
      // On plonge dans le noir puis on en ressort : c'est la porte franchie
      // à la fin de l'acte 4 qui appelle ce fondu.
      into.style.opacity = t > 0.5 ? "1" : "0";
      return 1 - Math.abs(2 * t - 1);
    }
    return 0;
  }

  // Même courbe que les transitions d'origine : départ franc, arrivée douce.
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; sync(); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Un redimensionnement change la hauteur visible, donc la course interne de
     chaque acte : sans remesure, la fin d'un acte tomberait avant ou après la
     fin de sa section, et la dernière scène serait tronquée ou figée. */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      acts.forEach(function (act) {
        if (act._frame && docOf(act._frame)) {
          act._range = 0;
          measure(act, act._frame);
        }
      });
    }, 150);
  });
})();
