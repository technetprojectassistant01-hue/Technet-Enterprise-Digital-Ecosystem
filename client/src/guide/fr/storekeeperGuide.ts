import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_FR } from './adminGuide'

/**
 * Guide du magasinier - French copy of ../storekeeperGuide.ts (2026-10-20). Same chapters, topics,
 * ids and paths; shared topics come from the French Admin guide.
 */

const shared = topicsFrom(ADMIN_GUIDE_FR)

export const STOREKEEPER_GUIDE_FR: RoleGuide = {
  title: 'Guide du magasinier',
  intro:
    "Comment tenir le magasin dans Technet Digital : outils et équipements, matériel, les demandes qui arrivent, et l'inventaire et les achats dans l'ERP. Il suit votre menu de haut en bas. Les pages de l'ERP ne sont pas encore traduites ; leurs boutons sont nommés ici en anglais.",
  roles: ['STOREKEEPER'],
  updated: '2026-10-20',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'your-role',
          title: 'Le rôle du magasinier',
          blocks: [
            { kind: 'p', text: "Vous vous occupez du magasin : les outils et équipements remis un par un, le matériel suivi en quantité, et l'achat de stock par l'ERP. L'application s'ouvre sur Technet Store → Outils & équipements." },
            {
              kind: 'list',
              items: [
                'Technet Store : vous ajoutez les outils et le matériel, les remettez selon les demandes, enregistrez les retours et corrigez le stock.',
                "Technet ERP : Inventaire, Fournisseurs, Demandes d'achat et Bons de commande.",
                'Technet Operations : ordres de travail et rapports, en consultation seule.',
                "Vous ne pointez pas, et vous n'avez pas de page Mes congés ni Mes documents.",
                'Les comptes et mots de passe sont gérés par un administrateur.',
              ],
            },
          ],
        },
        shared('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            { kind: 'p', text: "La cloche de l'en-tête vous prévient quand quelqu'un envoie ou modifie une demande d'outils ou de matériel. Cliquez sur une notification pour l'ouvrir. Tout marquer comme lu remet le compteur à zéro." },
            { kind: 'note', text: "Ces notifications apparaissent uniquement dans l'application. Personne ne reçoit d'e-mail ou de SMS pour elles. Leur texte est pour l'instant en anglais." },
          ],
        },
        shared('install-language'),
        shared('slow-first-load'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Technet Store',
      intro: "Les outils et équipements sont suivis un par un. Le matériel comme la colle, le ruban ou les vis est suivi en quantité. Toute personne ayant une fiche employé peut vous envoyer une demande.",
      topics: [
        shared('tools'),
        {
          id: 'tool-statuses',
          title: "Statut et état d'un outil",
          path: '/dashboard/store/tools',
          blocks: [
            {
              kind: 'list',
              items: [
                'Disponible : au magasin, peut être remis.',
                "Sorti : quelqu'un l'a. Ce statut est mis quand vous le remettez et retiré quand vous enregistrez le retour. Vous ne pouvez pas le changer à la main.",
                'En réparation : rendu endommagé, ou envoyé en réparation. Remettez-le Disponible avec Modifier une fois réparé.',
                "Retiré : n'est plus utilisé. Retirez un outil plutôt que de le supprimer, pour garder son historique.",
                "L'état (Bon, Moyen, Endommagé) est noté quand vous ajoutez l'outil, puis à chaque retour.",
              ],
            },
            { kind: 'tip', text: "Cherchez dans le registre par étiquette, nom ou numéro de série. Les outils en retard sont signalés pour que vous puissiez les réclamer." },
          ],
        },
        shared('tool-requests'),
        shared('materials'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp',
      title: 'Inventaire et achats',
      intro: "Technet ERP → Inventaire et Achats. Ils sont séparés du Matériel du magasin : acheter ici ajoute à l'Inventaire, pas au Matériel.",
      topics: [
        {
          id: 'inventory',
          title: 'Inventaire',
          path: '/dashboard/erp/inventory',
          blocks: [
            {
              kind: 'list',
              items: [
                "Ajouter un article crée un article avec sa référence (RÉF.), sa catégorie, son unité, son coût unitaire, son emplacement, sa quantité de départ et son stock minimum.",
                "Le bouton Ajuster le stock (les flèches) enregistre une Entrée, une Sortie ou un Ajustement, avec un motif facultatif. Le Registre du stock liste chaque mouvement.",
                'Les articles au niveau minimum ou en dessous comptent comme STOCK BAS.',
                "Les marchandises reçues sur un bon de commande sont ajoutées automatiquement à l'Inventaire pour les lignes reliées à un article.",
              ],
            },
          ],
        },
        {
          id: 'requisitions',
          title: "Approuver les demandes d'achat",
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            { kind: 'p', text: "Une demande d'achat est une demande du bureau pour acheter quelque chose. Le personnel de bureau les crée avec Nouvelle demande d'achat ; vous et l'administrateur décidez." },
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet ERP → Achats → Demandes d'achat et ouvrez une demande EN ATTENTE.",
                "Cliquez sur Approuver, ou sur Refuser avec un motif. La personne qui a demandé est prévenue.",
                "Pour une demande approuvée, cliquez sur Convertir en bon de commande, choisissez le fournisseur et saisissez les coûts unitaires.",
              ],
            },
          ],
        },
        shared('procurement'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Ordres de travail et rapports (consultation)',
      topics: [
        {
          id: 'operations-view',
          title: 'Ordres de travail et rapports',
          path: '/dashboard/operations/work-orders',
          blocks: [
            { kind: 'p', text: "Technet Operations montre les interventions prévues pour les techniciens et les rapports journaliers et d'intervention qu'ils déposent. Les rapports d'intervention listent le matériel utilisé à chaque visite." },
            { kind: 'note', text: "Créer des interventions et approuver les rapports revient à un administrateur ou au Responsable des opérations." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'account',
      title: 'Votre compte',
      topics: [
        {
          id: 'account-security',
          title: 'Mot de passe et historique de connexion',
          path: '/dashboard/security',
          blocks: [
            {
              kind: 'list',
              items: [
                "Votre mot de passe est géré par un administrateur. Si vous l'oubliez, demandez-lui de le réinitialiser dans Gestion des utilisateurs.",
                'Sécurité → My Account liste vos propres connexions récentes.',
                "Vous restez connecté 30 jours, et ces 30 jours repartent à chaque utilisation de l'application. Se déconnecter, en bas du menu, vous déconnecte immédiatement.",
              ],
            },
          ],
        },
      ],
    },
  ],
}
