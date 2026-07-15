// Stable per-couple member identifier, decoupled from Firebase Auth `uid`.
//
// Every member object carries a `memberId` set at creation time. For every
// member that exists today (and every member created by the normal
// create/join flow), `memberId === uid` — so this is purely additive:
// nothing that already reads `member.uid` as an identity key needs to
// change for existing data to keep working.
//
// The only case where `memberId` and `uid` diverge is a "placeholder"
// member — invited during onboarding before they've actually signed up —
// which has `uid: null` until they join and claim it. All attribution
// fields (paidBy, split, budget.memberUid, asset.ownership, ...) should be
// written and compared using `getMemberKey`, not `member.uid` directly, so
// they keep working once placeholder support lands.
export function getMemberKey(member) {
  return member?.memberId || member?.uid || null;
}

export function findMemberByKey(members, key) {
  return (members || []).find((m) => getMemberKey(m) === key) || null;
}

// Part BÉNÉFICIAIRE (« pour qui ») d'une transaction/récurrence attribuable à un
// membre, exprimée en FRACTION [0..1] du montant. `memberKey === null` = couple
// entier → 1. Sinon on suit le partage :
//   - partage avancé (splitDetails) : parts exactes (pourcentage ou montant) ;
//   - "50/50" : moitié pour chacun des deux membres ;
//   - split = clé d'un membre : 100 % pour ce membre ;
//   - sinon (non partagé / "100") : attribué à celui qui a payé (paidBy).
// members[0] ↔ part A, members[1] ↔ part B (ordre stable du couple).
export function memberShareFraction(tx, memberKey, members) {
  if (!memberKey) return 1;
  const aKey = members[0] ? getMemberKey(members[0]) : null;
  const bKey = members[1] ? getMemberKey(members[1]) : null;

  const d = tx.splitDetails;
  if (d && aKey && bKey) {
    let fa, fb;
    if (d.unit === "percent") {
      fa = (d.a ?? 0) / 100;
      fb = (d.b ?? 0) / 100;
    } else {
      const total = (d.a ?? 0) + (d.b ?? 0);
      if (total === 0) { fa = 0.5; fb = 0.5; }
      else { fa = (d.a ?? 0) / total; fb = (d.b ?? 0) / total; }
    }
    if (memberKey === aKey) return fa;
    if (memberKey === bKey) return fb;
    return 0;
  }

  if (tx.split === "50/50") return (memberKey === aKey || memberKey === bKey) ? 0.5 : 0;
  if (tx.split === aKey || tx.split === bKey) return tx.split === memberKey ? 1 : 0;
  // Non partagé / "100" / indéfini : rattaché au payeur.
  return tx.paidBy === memberKey ? 1 : 0;
}

// Part de PROPRIÉTÉ d'un actif attribuable à un membre, en FRACTION [0..1].
// `memberKey === null` = couple entier → 1. "shared" applique sharePct (défaut
// 50) au premier membre du couple, le reste au second.
export function assetMemberShareFraction(asset, memberKey, members) {
  if (!memberKey) return 1;
  if (asset.ownership === memberKey) return 1;
  if (asset.ownership === "shared") {
    const isFirst = members[0] && getMemberKey(members[0]) === memberKey;
    const pct = isFirst ? (asset.sharePct ?? 50) : 100 - (asset.sharePct ?? 50);
    return pct / 100;
  }
  return 0;
}
