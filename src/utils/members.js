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
