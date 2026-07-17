import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { getMemberKey } from "../utils/members";
import CommentThread from "./CommentThread";

// Fil de discussion d'UN actif — fin wrapper autour de CommentThread. Permet au
// couple d'échanger sur un investissement (on vend, on rachète…). Lit l'actif
// "live" du contexte (onSnapshot) pour l'affichage temps réel.
export default function AssetComments({ assetId }) {
  const { assets, members, addAssetComment, removeAssetComment } = useFinance();
  const { user } = useAuth();

  const asset = assets.find((a) => a.id === assetId);
  const me = members.find((m) => m.uid === user?.uid);
  const myKey = me ? getMemberKey(me) : user?.uid;

  if (!asset) return null;

  return (
    <CommentThread
      comments={asset.comments || []}
      members={members}
      myKey={myKey}
      onSend={(text) => addAssetComment(assetId, { memberId: myKey, text })}
      onSendGif={(gifUrl) => addAssetComment(assetId, { memberId: myKey, gifUrl })}
      onRemove={(id) => removeAssetComment(assetId, id)}
    />
  );
}
