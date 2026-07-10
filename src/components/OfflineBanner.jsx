import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useTranslation } from "../hooks/useTranslation";

// Bandeau discret indiquant l'état hors connexion. Quand on est hors ligne,
// il reste affiché ("les changements seront synchronisés à la reconnexion") ;
// au retour en ligne, une confirmation verte apparaît quelques secondes.
// Fixé en haut, au-dessus du contenu ; ne s'affiche pas quand tout est normal.
export default function OfflineBanner() {
  const { online, justReconnected } = useOnlineStatus();
  const t = useTranslation();

  if (online && !justReconnected) return null;

  const offline = !online;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 12.5,
        fontWeight: 500,
        color: "#fff",
        background: offline ? "var(--ink-3)" : "var(--sage)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      <i
        className={`ti ${offline ? "ti-cloud-off" : "ti-cloud-check"}`}
        style={{ fontSize: 14 }}
        aria-hidden="true"
      />
      {offline ? t("offline_banner") : t("offline_reconnected")}
    </div>
  );
}
