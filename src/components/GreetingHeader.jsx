import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { buildMemberColorMap, AVATAR_COLOR_PALETTE } from "../utils/memberColors";
import { getMemberKey } from "../utils/members";
import { useMediaQuery } from "../hooks/useMediaQuery";

// Bloc d'accueil affiché en tête de chaque page principale (Accueil, Budget,
// Patrimoine, Rapports) à la place de l'ancien titre d'onglet — celui-ci était
// redondant avec le menu de gauche. « Bonjour {prénom} » avec le prénom dans la
// couleur d'avatar choisie par l'utilisateur (Réglages), puis un sous-titre
// gris propre à la page ; {month} est interpolé avec le mois courant localisé.
// `month` : chaîne de mois déjà formatée (ex. « Juillet 2026 ») à interpoler
// dans le sous-titre — passée par les écrans qui naviguent par mois (Accueil)
// pour que le texte suive la période sélectionnée. À défaut, on retombe sur le
// mois courant localisé.
export default function GreetingHeader({ subtitleKey, marginLeft = 0, month }) {
  const { user } = useAuth();
  const { members, language } = useFinance();
  const t = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const colorMap = buildMemberColorMap(members);
  const me = members.find((m) => m.uid === user?.uid);
  const myColor = (me && colorMap[getMemberKey(me)]) || AVATAR_COLOR_PALETTE[0];
  const name = user?.displayName || me?.name || "";

  const locale = language === "en" ? "en-US" : "fr-FR";
  let monthStr = month;
  if (!monthStr) {
    const raw = new Date().toLocaleDateString(locale, { month: "long", year: "numeric" });
    monthStr = raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  const subtitle = t(subtitleKey).replace("{month}", monthStr);

  return (
    <div style={{ marginLeft }}>
      <h1 style={{ fontSize: isDesktop ? 22 : 19, margin: 0, fontWeight: 800, lineHeight: 1.15, whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--ink)" }}>{t("greeting_hello")}</span>{" "}
        <span style={{ color: myColor.text }}>{name}</span>
      </h1>
      <p style={{ fontSize: isDesktop ? 13.5 : 12.5, color: "var(--ink-2)", margin: "3px 0 0", fontWeight: 500, lineHeight: 1.35 }}>
        {subtitle}
      </p>
    </div>
  );
}
