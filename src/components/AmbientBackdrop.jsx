// Ambiance décorative de la page d'accueil (onboarding · écran de saisie).
// Trois couches périphériques cumulées, toujours DERRIÈRE le contenu (z-index 0,
// pointer-events:none) et jamais concurrentes du champ de saisie :
//   A · Le Souffle  — halo qui respire, signature de marque (derrière le logo).
//   B · Deux âmes   — le couple : deux halos (lui = sky, elle = blush) toujours
//                     en contact, qui vagabondent lentement sur l'écran.
//   C · Horizon     — ellipses douces qui dérivent en bas de page.
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
      {/* A · Le Souffle — halos qui respirent, centrés vers le logo (haut). */}
      <div
        style={{
          position: "absolute", top: "31%", left: "50%",
          width: 150, height: 150, marginLeft: -75, marginTop: -75, borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--tang) 38%, transparent), transparent 70%)",
          filter: "blur(6px)", animation: "pw-breathe 7s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute", top: "31%", left: "50%",
          width: 200, height: 200, marginLeft: -100, marginTop: -100, borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--amber) 26%, transparent), transparent 72%)",
          filter: "blur(10px)", animation: "pw-breathe2 9s ease-in-out infinite",
        }}
      />

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

      {/* C · Horizon calme — ellipses qui dérivent tout en bas, en parallaxe. */}
      <div
        style={{
          position: "absolute", left: -60, right: -60, bottom: -30, height: 150, borderRadius: "50%",
          background: "color-mix(in srgb, var(--sage) 20%, transparent)", filter: "blur(30px)",
          animation: "pw-drift 18s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute", left: -60, right: -60, bottom: -60, height: 150, borderRadius: "50%",
          background: "color-mix(in srgb, var(--lavi) 12%, transparent)", filter: "blur(30px)",
          animation: "pw-drift2 22s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
