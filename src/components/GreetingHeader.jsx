import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { buildMemberColorMap, AVATAR_COLOR_PALETTE } from "../utils/memberColors";
import { getMemberKey } from "../utils/members";

// Bloc d'accueil affiché en tête de chaque page principale (Accueil, Budget,
// Patrimoine, Rapports) à la place de l'ancien titre d'onglet — celui-ci était
// redondant avec le menu de gauche. « Bonjour {prénom} » avec le prénom dans la
// couleur d'avatar choisie par l'utilisateur (Réglages), puis un sous-titre
// gris propre à la page ; {month} est interpolé avec le mois courant localisé.
export default function GreetingHeader({ subtitleKey, marginLeft = 0 }) {
  const { user } = useAuth();
  const { members, language } = useFinance();
  const t = useTranslation();

  const colorMap = buildMemberColorMap(members);
  const me = members.find((m) => m.uid === user?.uid);
  const myColor = (me && colorMap[getMemberKey(me)]) || AVATAR_COLOR_PALETTE[0];
  const name = user?.displayName || me?.name || "";

  const locale = language === "en" ? "en-US" : "fr-FR";
  const raw = new Date().toLocaleDateString(locale, { month: "long", year: "numeric" });
  const month = raw.charAt(0).toUpperCase() + raw.slice(1);
  const subtitle = t(subtitleKey).replace("{month}", month);

  return (
    <div style={{ marginLeft }}>
      <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800, lineHeight: 1.15, whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--ink)" }}>{t("greeting_hello")}</span>{" "}
        <span style={{ color: myColor.text }}>{name}</span>
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "4px 0 0", fontWeight: 500 }}>
        {subtitle}
      </p>
    </div>
  );
}
