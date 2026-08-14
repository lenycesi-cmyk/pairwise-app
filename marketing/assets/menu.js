// Méga-menu de l'en-tête du site — partagé par TOUTES les pages.
//
// Il vit dans un fichier à part, et non en ligne dans chaque page, parce que
// l'en-tête est recopié dans six fichiers : une logique dupliquée six fois
// diverge à la première retouche. Le balisage, lui, reste bien du HTML statique
// (généré par scripts/build-marketing-header.js) — l'injecter en JavaScript
// priverait les moteurs de recherche des liens internes, qui sont précisément
// la raison d'être de ce site.
(function () {
  "use strict";

  var menus = [].slice.call(document.querySelectorAll("[data-mm]"));
  if (!menus.length) return;

  function closeAll() {
    menus.forEach(function (m) {
      m.setAttribute("data-open", "0");
      m.querySelector("button").setAttribute("aria-expanded", "false");
    });
  }

  menus.forEach(function (m) {
    var btn = m.querySelector("button");
    // Ouverture au CLIC et non au survol : un panneau de cette taille s'ouvre
    // par accident dès qu'on traverse la barre en diagonale.
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var wasOpen = m.getAttribute("data-open") === "1";
      closeAll();
      if (!wasOpen) {
        m.setAttribute("data-open", "1");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  // Refermer au clic ailleurs et à Échap — sans quoi un menu ouvert reste en
  // travers de la page et il faut deviner comment s'en débarrasser.
  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll();
  });
})();
