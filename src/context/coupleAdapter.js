// Adaptateur de persistance du document couple — la COUTURE du mode Local.
//
// Tout ce que FinanceContext écrit sur `couples/{id}` passe désormais par cette
// interface. Le jour où le mode Local arrive, il suffit d'en fournir une seconde
// implémentation (journal d'opérations + IndexedDB) : les vingt écrans, eux, ne
// bougent pas, puisqu'ils passent déjà tous par FinanceContext.
//
// ── Pourquoi `arrayUnion` pour les ajouts, et pas pour le reste ─────────────
//
// Le motif historique — relire le tableau depuis l'ÉTAT LOCAL, y ajouter un
// élément, réécrire le tableau entier — perd la modification concurrente du
// partenaire. Si Jessica ajoute un budget et que l'instantané n'est pas encore
// arrivé chez Nicolas, le budget de Jessica disparaît quand Nicolas en ajoute un.
// Ce n'est pas un défaut théorique du futur mode Local : il existe aujourd'hui.
//
// `arrayUnion` corrige le cas des AJOUTS pour de bon : c'est une transformation
// appliquée par le serveur, donc les deux ajouts survivent quel que soit l'ordre.
// Elle reste compatible hors connexion (elle est mise en file comme une écriture
// ordinaire), ce qui compte pour une app qui revendique de fonctionner sans
// réseau.
//
// Les MODIFICATIONS et SUPPRESSIONS ne peuvent pas en profiter : `arrayRemove`
// exige un élément identique au caractère près, et rien ne cible un élément par
// son `id`. Elles réécrivent donc le tableau, avec la fenêtre de concurrence
// résiduelle que cela suppose. On aurait pu la fermer avec `runTransaction`,
// écarté volontairement : une transaction Firestore exige un aller-retour
// serveur et ÉCHOUE hors connexion. Troquer le support hors-ligne contre une
// collision rare — deux personnes modifiant le même budget dans la même
// seconde — serait un mauvais échange. La fermeture définitive viendra du
// journal d'opérations du mode Local, qui règle les deux cas.

import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { patchIn, removeFrom } from "../utils/collectionOps";

// Sans couple actif il n'y a rien à écrire : on renvoie un adaptateur inerte
// plutôt que `null`. Les appelants gardent leur `if (!coupleId) return`, mais
// un oubli produit alors une écriture ignorée et non un plantage.
const NOOP = {
  addItem: async () => {},
  patchItem: async () => {},
  removeItem: async () => {},
  replaceList: async () => {},
  setFields: async () => {},
};

export function createCoupleAdapter(coupleId) {
  if (!coupleId) return NOOP;
  const ref = () => doc(db, "couples", coupleId);

  return {
    /** Ajoute un élément — atomique côté serveur, sans écraser un ajout concurrent. */
    async addItem(field, item) {
      await setDoc(ref(), { [field]: arrayUnion(item) }, { merge: true });
    },

    /** Fusionne des champs dans un élément existant. `list` = état courant connu. */
    async patchItem(field, list, id, updates) {
      await setDoc(ref(), { [field]: patchIn(list, id, updates) }, { merge: true });
    },

    async removeItem(field, list, id) {
      await setDoc(ref(), { [field]: removeFrom(list, id) }, { merge: true });
    },

    /** Réécrit la liste entière — réordonnancement, ou écriture en lot. */
    async replaceList(field, list) {
      await setDoc(ref(), { [field]: list }, { merge: true });
    },

    /** Champs scalaires ou maps du document couple. */
    async setFields(fields) {
      await setDoc(ref(), fields, { merge: true });
    },
  };
}
