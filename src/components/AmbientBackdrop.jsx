// Ambiance décorative de la page d'accueil (onboarding · écran de saisie).
// Deux couches périphériques cumulées, toujours DERRIÈRE le contenu (z-index 0,
// pointer-events:none) et jamais concurrentes du champ de saisie :
//   B · Deux âmes   — le couple : deux halos (lui = sky, elle = blush) toujours
//                     en contact, qui vagabondent lentement sur l'écran.
//   C · Horizon     — bandes douces empilées en bas, façon collines apaisées
//                     (cf. maquette), qui dérivent lentement en parallaxe.
// Palette de l'app uniquement, opacités basses, cycles très lents. Les keyframes
// (préfixe pw-) et la coupure prefers-reduced-motion vivent dans src/index.css.
// Purement décoratif : ne touche à aucune logique de saisie.
export default function AmbientBackdrop() {
  return (
    <div
      className="pw-ambient"
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}
    >
      {/* B · Deux âmes — le couple qui vagabonde (pièce maîtresse). Le groupe
          porte le déplacement plein écran ; chaque lobe un micro-rapprochement. */}
      <div
        style={{
          position: "absolute", top: "42%", left: "50%",
          width: 270, height: 225, marginLeft: -135, marginTop: -112,
          animation: "pw-roam 52s ease-in-out infinite",
        }}
      >
        {/* Lui — sky, à gauche */}
        <div
          style={{
            position: "absolute", left: 0, top: 0, width: 225, height: 225, borderRadius: 99,
            filter: "blur(24px)",
            background: "radial-gradient(circle, color-mix(in srgb, var(--sky) 34%, transparent) 35%, transparent 66%)",
            animation: "pw-near-l 15s ease-in-out infinite",
          }}
        />
        {/* Elle — blush, à droite (chevauche → contact permanent) */}
        <div
          style={{
            position: "absolute", right: 0, top: 0, width: 225, height: 225, borderRadius: 99,
            filter: "blur(24px)",
            background: "radial-gradient(circle, color-mix(in srgb, var(--blush) 36%, transparent) 35%, transparent 66%)",
            animation: "pw-near-r 15s ease-in-out infinite",
          }}
        />
        {/* Zone de fusion réchauffée (sinon le recouvrement bleu×rose vire au mauve). */}
        <div
          style={{
            position: "absolute", left: "50%", top: "50%", width: 120, height: 120,
            marginLeft: -60, marginTop: -60, borderRadius: 99, filter: "blur(24px)",
            background: "radial-gradient(circle, color-mix(in srgb, var(--blush) 55%, white) 30%, transparent 62%)",
          }}
        />
      </div>

      {/* C · Horizon calme — collines douces empilées en bas de page (cf. maquette) :
          bandes larges à sommet arrondi qui dérivent lentement en parallaxe. */}
      {/* Colline arrière — sage, légèrement plus haute, dérive vers la gauche. */}
      <div
        style={{
          position: "absolute", left: "-15%", right: "-15%", bottom: 0, height: "26vh",
          borderTopLeftRadius: "100% 90%", borderTopRightRadius: "100% 90%",
          background: "color-mix(in srgb, var(--sage) 16%, transparent)", filter: "blur(2px)",
          animation: "pw-drift 26s ease-in-out infinite alternate",
        }}
      />
      {/* Colline avant — gris chaud plus dense, plus basse, dérive à contre-sens. */}
      <div
        style={{
          position: "absolute", left: "-20%", right: "-20%", bottom: 0, height: "18vh",
          borderTopLeftRadius: "100% 88%", borderTopRightRadius: "100% 88%",
          background: "color-mix(in srgb, var(--sage) 9%, var(--bg-card))", filter: "blur(1px)",
          animation: "pw-drift2 32s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
