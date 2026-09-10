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

  // Reperer d'un coup d'oeil, dans la console, si le navigateur execute bien
  // la derniere version : un pilote perime et une page a jour donnent des
  // symptomes trompeurs (deux actes empiles, barres de defilement en trop).
  var VERSION = "actes-4";
  if (window.console) console.info("PairWise " + VERSION);

  /* Hauteur de l'en-tête. Elle ÉTAIT écrite en dur à 64, la valeur de
     `header.site .bar` dans site.css. Mais elle grandit dès que la police de
     l'interface change, au zoom, ou si un lien passe à la ligne — et tout en
     dépend : le point où le pin se colle, et le calcul qui passe la main d'un
     acte au suivant. Une constante fausse décalait la scène sous l'en-tête et
     désalignait les transitions. On la mesure. */
  var BAR_H = 64;
  var bar = document.querySelector("header.site");

  function readBarHeight() {
    if (!bar) return;
    var h = Math.round(bar.getBoundingClientRect().height);
    if (h > 0 && h !== BAR_H) {
      BAR_H = h;
      document.documentElement.style.setProperty("--bar-h", h + "px");
    }
  }
  readBarHeight();
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
    /* DERNIER ACTE : une sortie d'un ecran, sans transition.
       Sans elle, la fin de la page tombait avant la fin de l'acte. Le
       defilement maximal vaut la hauteur du document moins une fenetre ; le
       pied de page ne suffisant pas a fournir cette fenetre, les derniers
       pixels de l'acte etaient INATTEIGNABLES — 531 px ici, soit tout juste sa
       scene de cloture et son bouton, qui n'apparaissaient donc jamais.
       Pendant cette sortie l'acte reste affiche, acheve : on ne voit pas un
       blanc, on lit la derniere image le temps d'atteindre le pied de page. */
    if (!nxt) return Math.round(window.innerHeight);
    if (!nxt.dataset.transition) return 0;
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
      hideScrollbar(doc);
      hide(doc, COMMON_HIDE);
      if (ADAPT[act.id]) ADAPT[act.id](doc);
    } catch (err) { /* décor : jamais bloquant */ }
    measure(act, frame);
    /* On surveille le CORPS, pas `documentElement`. La boîte de l'element racine
       ne grandit pas forcement avec son contenu — un acte qui pose une hauteur
       sur `html`, ou dont GSAP fabrique ses cales de pin dans le corps, la
       laisse a la hauteur de la fenetre. L'observateur ne se declenchait alors
       jamais et la course restait celle de la toute premiere mesure, prise
       avant que les polices et les pins n'aient fini de s'installer.
       Consequence : la fin de l'acte devenait inatteignable — l'acte 3 semblait
       se bloquer, et la scene de cloture de l'acte 5 n'apparaissait jamais. */
    if (typeof frame.contentWindow.ResizeObserver === "function") {
      var timer;
      var ro = new frame.contentWindow.ResizeObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () { measure(act, frame); }, 120);
      });
      ro.observe(doc.body);
    }

    /* Filet de securite : la hauteur peut encore bouger sans que la boite du
       corps change (une image qui arrive dans un bloc de hauteur fixe, une
       animation qui allonge une scene). On relit la hauteur quelques secondes,
       puis on arrete — ce n'est pas une boucle permanente. */
    var tries = 0;
    var poll = setInterval(function () {
      var d = docOf(frame);
      if (!d || ++tries > 20) { clearInterval(poll); return; }
      if (d.documentElement.scrollHeight - frame.clientHeight !== act._range) {
        measure(act, frame);
      }
    }, 400);
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
    /* Le bloc « Résumé ce mois-ci » retombait sur les marionnettes et leur
       coupait la tête. On agit sur son CONTENEUR : GSAP anime la transformation
       du bloc lui-même (`y`, `scale`), donc une transformation posée sur lui
       serait écrasée à la première image de l'animation.
       Le conteneur, lui, porte DEJA `translateX(-50%)` — c'est ce qui le
       centre. Ecrire `translateY(...)` seul remplacait cette valeur : le bloc
       perdait son centrage, derivait d'une demi-largeur vers la droite et
       recouvrait le selecteur « compte commun / dépenses partagées ». Les deux
       composantes vont donc ensemble.
       La carte est aussi resserree : a 432 px elle mangeait la scene, et le
       couple de widgets deborde d'autant en mode partage. */
    "acte-2": function (doc) {
      var st = doc.createElement("style");
      st.textContent =
        "#widgets{transform:translate(-50%,-40px)}" +
        "#widgets .sum{width:min(360px,88vw);padding:22px 24px}" +
        "#widgets .sum__patri{font-size:24px}" +
        "#widgets .sum__v{font-size:21px}";
      doc.head.appendChild(st);
    },
    /* L'acte 5 garde son « C'est parti », qui conclut l'histoire juste sous la
       phrase de fin. L'iframe ne recoit pas les clics — c'est ce qui laisse la
       molette traverser — donc on ne peut pas le rendre cliquable la ou il est.
       On calque par-dessus, DANS la page, un lien transparent aux memes
       coordonnees : il est cliquable, et un moteur de recherche le voit. */
    "acte-5": function () {}
  };

  /* Chaque acte reste scrollable — c'est indispensable, `overflow: hidden`
     casserait ses pins `sticky` — mais sa barre de défilement n'a aucun sens
     ici : on en voyait jusqu'à trois empilées à droite, celle de la page et
     celles des actes visibles. On masque la barre sans toucher au défilement. */
  function hideScrollbar(doc) {
    var st = doc.createElement("style");
    st.textContent =
      "html{scrollbar-width:none;-ms-overflow-style:none}" +
      "html::-webkit-scrollbar{width:0;height:0;display:none}";
    doc.head.appendChild(st);
  }

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
    /* Temps d'arret optionnel au DEBUT d'un acte : la scene reste sur sa
       premiere image pendant `data-hold` ecrans. Sans lui, un texte
       d'introduction defile a la vitesse du reste et on lui passe dessus sans
       le lire. C'est du temps ajoute par la page, pas une retouche de l'acte. */
    act._hold = reduced ? 0 : Math.round(window.innerHeight * (parseFloat(act.dataset.hold) || 0));
    /* La section ne fournit QUE la course : la course interne de l'acte, plus
       sa bande de transition. Elle n'a plus à réserver la hauteur d'un écran
       comme au temps de `sticky` — c'était précisément cet écran en trop qui
       laissait un vide entre deux actes, l'un ayant fini avant que l'autre
       n'arrive. Ainsi la fin d'un acte est le début exact du suivant. */
    act.style.height = (act._hold + range + act._band) + "px";
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
    var active = null;   // acte dont la bande de transition est en cours
    var activeT = 0;
    var current = null;  // acte que l'on est en train de regarder

    for (var i = 0; i < acts.length; i++) {
      var act = acts[i];
      if (!act._range || !act._frame) continue;
      var doc = docOf(act._frame);
      if (!doc) continue;
      var start = act.offsetTop - BAR_H;
      var hold = act._hold || 0;
      var p = (y - start - hold) / act._range;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var target = Math.round(p * act._range);
      if (doc.documentElement.scrollTop !== target) {
        doc.documentElement.scrollTop = target;
      }

      // L'acte occupe l'écran de son début jusqu'à la fin de sa bande.
      var band = act._band || 0;
      var end = start + hold + act._range + band;
      /* Borne INCLUSIVE, et le dernier acte trouvé l'emporte. `y < end` cachait
         l'acte a l'instant precis ou son animation atteignait sa fin : la scene
         de cloture de l'acte 5, et son bouton, n'apparaissaient donc jamais.
         Les sections se touchent, donc a la frontiere les deux repondent — et
         c'est le suivant qui doit gagner, d'ou l'ecrasement dans la boucle. */
      if (y >= start && y <= end) current = act;

      // La bande commence là où la course interne s'achève.
      if (!band) continue;
      var t = (y - (start + hold + act._range)) / band;
      if (t > 0 && t < 1) { active = act; activeT = t; }
    }

    /* Un seul acte visible à la fois — deux pendant une transition. Avant le
       premier et après le dernier, aucun : c'est ce qui laisse la bande de
       clôture et le pied de page s'afficher normalement. */
    if (current !== lastCurrent) {
      for (var j = 0; j < acts.length; j++) {
        var pin = acts[j].querySelector(".act__pin");
        if (pin) pin.classList.toggle("is-on", acts[j] === current);
      }
      lastCurrent = current;
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
    if (active) {
      var incoming = nextOf(active);
      // L'entrant doit être visible EN PLUS du courant, le temps du passage.
      var ip = incoming && incoming.querySelector(".act__pin");
      if (ip) ip.classList.add("is-on");
      veilOpacity = transition(active, incoming, activeT);
    }

    syncCtaHit();

    if (veil) {
      veil.style.opacity = veilOpacity;
      veil.style.display = veilOpacity > 0 ? "block" : "none";
    }
  }

  var lastActive = null;
  var lastCurrent = null;

  /* Calque de clic pour le bouton de l'acte 5. Sa position est relue a chaque
     rafraichissement : le bouton bouge avec la scene, et un lien fixe au
     mauvais endroit serait pire qu'aucun lien. */
  var ctaLink = document.getElementById("actCta");

  /* `elementFromPoint` touche un element TRANSPARENT : la scene de cloture de
     l'acte 5 existe des le depart avec une opacite nulle, et le calque de clic
     s'y posait donc bien avant qu'elle n'entre en scene. On remonte la chaine
     des parents pour verifier qu'il y a vraiment quelque chose a voir. */
  function isPainted(el, doc) {
    for (var n = el; n && n !== doc.documentElement; n = n.parentElement) {
      var cs = doc.defaultView.getComputedStyle(n);
      if (cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }

  function syncCtaHit() {
    if (!ctaLink) return;
    var act = document.getElementById("acte-5");
    var frame = act && act._frame;
    var pin = act && act.querySelector(".act__pin");
    var doc = frame && docOf(frame);
    var btn = doc && doc.getElementById("startCta");
    if (!btn || !pin || !pin.classList.contains("is-on")) { ctaLink.hidden = true; return; }
    var r = btn.getBoundingClientRect();
    var f = frame.getBoundingClientRect();
    /* Le bouton est-il VRAIMENT visible a cet endroit ? Ses coordonnees seules
       ne le disent pas : la scene de cloture existe dans le document bien avant
       d'entrer en scene, et se fier a elles laissait un rectangle cliquable
       invisible au milieu de la page, qui avalait les clics. On demande donc au
       document ce qu'il peint sous ce point. */
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var hit = r.width > 0 && cx >= 0 && cy >= 0 &&
      cx <= frame.clientWidth && cy <= frame.clientHeight &&
      doc.elementFromPoint(cx, cy);
    if (!hit || (hit !== btn && !btn.contains(hit)) || !isPainted(btn, doc)) {
      ctaLink.hidden = true;
      return;
    }
    ctaLink.hidden = false;
    ctaLink.style.left = Math.round(f.left + r.left) + "px";
    ctaLink.style.top = Math.round(f.top + r.top) + "px";
    ctaLink.style.width = Math.round(r.width) + "px";
    ctaLink.style.height = Math.round(r.height) + "px";
  }

  function resetAll() {
    for (var i = 0; i < acts.length; i++) {
      var pin = acts[i].querySelector(".act__pin");
      if (!pin) continue;
      pin.className = "act__pin" + (pin.classList.contains("is-on") ? " is-on" : "");
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

    into.className = "act__pin is-on is-entering";
    out.className = "act__pin is-on is-leaving";
    var e = ease(t);

    if (kind === "slide-up") {
      /* Le sortant quitte l'ecran ENTIEREMENT, a la meme vitesse que l'entrant
         arrive : les deux glissent comme une pellicule. Il ne reculait que de
         18 % auparavant, si bien qu'une bande de l'acte precedent restait
         visible a cote du nouveau pendant toute la transition — on croyait a un
         reste d'affichage, pas a un mouvement. */
      into.style.transform = "translate3d(0," + ((1 - e) * 100) + "%,0)";
      out.style.transform = "translate3d(0," + (-e * 100) + "%,0)";
    } else if (kind === "slide-left") {
      into.style.transform = "translate3d(" + ((1 - e) * 100) + "%,0,0)";
      out.style.transform = "translate3d(" + (-e * 100) + "%,0,0)";
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
      readBarHeight();
      acts.forEach(function (act) {
        if (act._frame && docOf(act._frame)) {
          act._range = 0;
          measure(act, act._frame);
        }
      });
    }, 150);
  });
})();
