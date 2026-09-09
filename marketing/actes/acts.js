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

  /* Chargement paresseux : les actes 2 à 4 pèsent plusieurs centaines de Ko
     (marionnettes et images en base64). Les charger tous d'entrée ferait payer
     l'acte 5 à quelqu'un qui ne dépasse pas le premier écran. La marge d'un
     écran laisse le temps du chargement avant que l'acte n'entre en scène. */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { mount(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: "100% 0px" });

  acts.forEach(function (act) { io.observe(act); });

  function mount(act) {
    var pin = act.querySelector(".act__pin");
    var frame = document.createElement("iframe");
    frame.src = act.dataset.src;
    frame.title = act.getAttribute("aria-label") || "";
    frame.setAttribute("loading", "eager");
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
      // On EXIGE que le document soit celui de l'acte. Une iframe fraîchement
      // insérée en porte d'abord un autre, vide (`about:blank`), le temps que la
      // navigation démarre — et celui-là a déjà un corps et une hauteur. S'en
      // contenter, c'est mesurer un document vide (course nulle) et poser ses
      // adaptations sur un document jeté à l'instant suivant : le style injecté
      // disparaissait, l'observateur de taille ne se déclenchait plus jamais.
      if (doc && doc.body && doc.URL === frame.src && doc.documentElement.scrollHeight > 0) {
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
    if (ADAPT[act.id]) { try { ADAPT[act.id](doc); } catch (err) { /* décor : jamais bloquant */ } }
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
  var ADAPT = {
    "acte-1": function (doc) { hide(doc, ".nav"); },
    "acte-5": function (doc) {
      var cta = doc.getElementById("startCta");
      if (cta) { cta.href = "https://app.pairwise.finance/"; cta.target = "_top"; }
    }
  };

  function hide(doc, selector) {
    var st = doc.createElement("style");
    st.textContent = selector + "{display:none !important}";
    doc.head.appendChild(st);
  }

  function measure(act, frame) {
    var doc = docOf(frame);
    if (!doc) { degrade(act); return; }

    /* On coupe le défilement PROPRE de l'acte. Sans cela la molette passée
       au-dessus de l'iframe ferait défiler l'acte seul, et la page resterait
       immobile : les deux défilements se disputeraient le geste. `overflow:
       hidden` retire l'acte de la chaîne de défilement — le geste remonte donc
       à la page — sans empêcher qu'on lui pose sa position par le script. */
    doc.documentElement.style.overflow = "hidden";
    doc.body.style.overflow = "hidden";

    // La hauteur imposée à la section fausserait la mesure suivante si elle
    // entrait dans le calcul : on mesure la hauteur PROPRE de l'acte, qui n'en
    // dépend pas, contre la hauteur visible de l'iframe.
    var range = doc.documentElement.scrollHeight - frame.clientHeight;
    if (!(range > 0) || reduced) { degrade(act); return; }
    if (act._range === range) return; // rien n'a bougé : pas de reflow inutile

    act._range = range;
    act.style.height = (frame.clientHeight + range) + "px";
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
    }
  }

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
