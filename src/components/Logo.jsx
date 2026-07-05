// Logo PairWise : la marque (couple de cygnes origami sur tuile océan) +
// éventuellement le wordmark « Pair·Wise » (Wise en coral). L'asset est servi
// depuis public/icon-512.png.
export default function Logo({ size = 64, showWordmark = true, stacked = false }) {
  const mark = (
    <img
      src="/icon-512.png"
      alt="PairWise"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        objectFit: "cover",
        boxShadow: "var(--shadow)",
        display: "block",
      }}
    />
  );

  const wordmark = (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: size * 0.5,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: "var(--ink)",
      }}
    >
      Pair<span style={{ color: "var(--tang)" }}>Wise</span>
    </span>
  );

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: "center",
        gap: stacked ? size * 0.22 : size * 0.22,
      }}
    >
      {mark}
      {showWordmark && wordmark}
    </div>
  );
}
