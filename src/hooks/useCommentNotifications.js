import { useEffect, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";
import { showLocalNotification } from "../utils/localNotification";

// Notifie quand le partenaire commente une transaction. Toujours monté via
// CommentNotifierRunner dans App.jsx (même pattern que BudgetAlertsRunner).
// On compare le nombre de commentaires par transaction entre deux snapshots
// Firestore : pas de stockage, juste un ref — au premier snapshot on
// initialise sans notifier (sinon chaque ouverture d'app re-notifierait
// tout l'historique).
export function useCommentNotifications() {
  const { transactions, members } = useFinance();
  const { user } = useAuth();
  const t = useTranslation();
  const seenCounts = useRef(null);

  useEffect(() => {
    if (!transactions.length || !user) return;

    const me = members.find((m) => m.uid === user.uid);
    const myKey = me ? getMemberKey(me) : user.uid;

    if (seenCounts.current === null) {
      seenCounts.current = new Map(
        transactions.map((tx) => [tx.id, tx.comments?.length || 0])
      );
      return;
    }

    for (const tx of transactions) {
      const prev = seenCounts.current.get(tx.id) || 0;
      const comments = tx.comments || [];
      if (comments.length > prev) {
        const newOnes = comments.slice(prev).filter((c) => c.memberId !== myKey);
        if (newOnes.length > 0 && "Notification" in window && Notification.permission === "granted") {
          const last = newOnes[newOnes.length - 1];
          const author = members.find((m) => getMemberKey(m) === last.memberId);
          showLocalNotification(`${author?.name || "💬"} — ${tx.description}`, {
            body: last.gifUrl ? "GIF" : last.text,
            tag: `comment_${tx.id}`,
          });
        }
      }
      seenCounts.current.set(tx.id, comments.length);
    }
  }, [transactions, members, user, t]);
}
