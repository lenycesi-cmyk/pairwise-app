import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { getMemberKey } from "../utils/members";
import CommentThread from "./CommentThread";

// Fil de discussion d'UNE transaction — fin wrapper autour de CommentThread.
// Lit la transaction "live" du contexte (onSnapshot) pour l'affichage temps réel.
export default function TransactionComments({ txId }) {
  const { transactions, members, addTransactionComment, removeTransactionComment } = useFinance();
  const { user } = useAuth();

  const tx = transactions.find((x) => x.id === txId);
  const me = members.find((m) => m.uid === user?.uid);
  const myKey = me ? getMemberKey(me) : user?.uid;

  if (!tx) return null;

  return (
    <CommentThread
      comments={tx.comments || []}
      members={members}
      myKey={myKey}
      onSend={(text) => addTransactionComment(txId, { memberId: myKey, text })}
      onSendGif={(gifUrl) => addTransactionComment(txId, { memberId: myKey, gifUrl })}
      onRemove={(id) => removeTransactionComment(txId, id)}
    />
  );
}
