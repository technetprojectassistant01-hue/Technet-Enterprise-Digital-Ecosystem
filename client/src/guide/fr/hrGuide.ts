import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_FR } from './adminGuide'

/**
 * Guide RH - French copy of ../hrGuide.ts (2026-10-20). Same chapters, topics, ids and paths;
 * shared topics come from the French Admin guide, exactly as the English one takes them from the
 * English Admin guide.
 */

const shared = topicsFrom(ADMIN_GUIDE_FR)

export const HR_GUIDE_FR: RoleGuide = {
  title: 'Guide RH',
  intro:
    "Le travail des RH dans Technet Digital : fiches employés, congés, heures supplémentaires, validation de fin de mois, paie et certifications, ainsi que la présence du personnel qui sert à les vérifier. Il suit votre menu de haut en bas.",
  roles: ['HR_OFFICER'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'your-role',
          title: 'Ce que les RH peuvent faire',
          blocks: [
            { kind: 'p', text: "Les RH s'occupent des personnes : leurs fiches, leurs congés, leurs heures supplémentaires, la validation de la présence et la paie. Votre menu contient Présence, Technet HR, Technet Store et Technet Operations." },
            {
              kind: 'list',
              items: [
                "Vous gérez tout dans Technet HR, y compris les salaires, les coordonnées bancaires et les numéros d'identité.",
                'Sur le registre de présence, vous pouvez approuver les heures supplémentaires et justifier les absences.',
                "Technet Operations et Technet Store sont en consultation seule pour vous : vous voyez les ordres de travail, les rapports, la présence, les anomalies et le magasin, mais les modifier revient aux administrateurs, au Responsable des opérations ou au magasinier.",
                "Vous ne pointez pas, et vous n'avez pas de page Mes congés ni Mes documents. Votre compte n'a pas besoin de fiche employé, sauf si vous êtes aussi payé par la paie.",
                'Les comptes sont créés par un administrateur. Vous ne pouvez ni créer ni réinitialiser de compte.',
              ],
            },
          ],
        },
        shared('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            { kind: 'p', text: "La cloche de l'en-tête montre ce qui attend les RH : une demande de congé envoyée ou modifiée, et des heures supplémentaires à approuver après le départ tardif d'un technicien. Cliquez sur une notification pour aller à l'élément. Tout marquer comme lu remet le compteur à zéro." },
            { kind: 'note', text: "Ces notifications apparaissent uniquement dans l'application. Personne ne reçoit d'e-mail ou de SMS pour elles. Leur texte est pour l'instant en anglais." },
          ],
        },
        shared('install-language'),
        shared('slow-first-load'),
        shared('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Présence du personnel',
      intro: "Les techniciens pointent leur arrivée et leur départ sur leur téléphone. Chaque pointage enregistre l'heure et le lieu qu'ils ont saisis, l'heure de l'application, une position GPS et généralement une photo. Les RH s'en servent pour approuver les heures supplémentaires, valider les mois et faire la paie.",
      topics: [
        shared('staff-attendance'),
        shared('absences'),
        shared('export-attendance'),
        {
          id: 'team-attendance',
          title: "Présence de l'équipe",
          path: '/dashboard/operations/team-attendance',
          blocks: [
            { kind: 'p', text: "Technet Operations → Présence de l'équipe est le registre complet, par mois ou par semaine." },
            {
              kind: 'list',
              items: [
                'Mois / Semaine change la période. Les flèches avancent et reculent.',
                "Choisissez un technicien pour ne voir qu'une personne. Cochez Inclure les anciens employés pour voir les personnes parties.",
                "Récapitulatif des présences est le Monthly Report d'AiFace. Cliquez sur un nom pour ouvrir le rapport journalier de cette personne.",
                'Registre des présences liste chaque visite jour par jour, avec la photo de pointage et les contrôles de conformité.',
                'Exporter le mois / Exporter la semaine télécharge le rapport Excel, et Télécharger le PDF le PDF, pour la période affichée.',
              ],
            },
            { kind: 'note', text: "Clôturer un pointage oublié revient à un administrateur ou au Responsable des opérations. Un poste encore ouvert après minuit est clôturé automatiquement à l'heure de fermeture de son jour (17:00, ou 13:00 le samedi)." },
          ],
        },
        {
          id: 'anomalies',
          title: 'Anomalies de présence (consultation)',
          path: '/dashboard/operations/anomalies',
          blocks: [
            { kind: 'p', text: "Technet Operations → Anomalies de présence liste ce que l'application n'a pas pu vérifier : loin de l'intervention, pointage près du domicile, déplacement impossible, faux GPS possible, heure ou lieu saisis qui ne correspondent pas, faible précision GPS, relevés manqués ou contrôles de conformité échoués." },
            {
              kind: 'list',
              items: [
                "Vous pouvez lire toutes les anomalies et filtrer par statut, type, gravité, employé et dates. Les décider (Confirmer légitime, Marquer faux positif, Confirmer la violation, Ignorer) revient à un administrateur ou au Responsable des opérations.",
                "Les heures supplémentaires d'un jour avec des anomalies ouvertes affichent un avertissement avant l'approbation.",
                "Vous ne pouvez pas valider le mois d'une personne tant qu'elle a des anomalies Élevées ouvertes. Demandez d'abord aux Opérations de les examiner.",
              ],
            },
            { kind: 'note', text: "Une anomalie est une raison de regarder, pas une preuve de faute. Le GPS dérive à l'intérieur des bâtiments, et un nom de lieu saisi comme « Moka » correspond au centre de la zone, à plusieurs kilomètres d'un vrai site." },
          ],
        },
        {
          id: 'field-ops',
          title: 'Opérations terrain, Carte en direct et Lieux connus (consultation)',
          path: '/dashboard/operations/live-map',
          blocks: [
            {
              kind: 'list',
              items: [
                "Opérations terrain liste qui est pointé en ce moment, où il dit être et depuis combien de temps.",
                "Carte en direct montre toutes les personnes en poste : où elles ont pointé et où elles ont été vues pour la dernière fois. Vert : près du pointage et vu récemment ; orange : pas vu depuis 45 minutes ou plus ; rouge : à 500 m ou plus, ou une anomalie grave.",
                "Lieux connus liste les sites que l'application a appris. Un pointage à l'intérieur de l'un d'eux apparaît comme Vérifié.",
              ],
            },
            { kind: 'note', text: "Un téléphone n'envoie sa position que lorsque l'application est ouverte à l'écran. Un téléphone verrouillé ou une application fermée n'envoie rien : « vu pour la dernière fois » peut donc être ancien sans que rien ne soit anormal." },
          ],
        },
        shared('checks'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'people',
      title: 'Employés',
      topics: [
        shared('hr-overview'),
        shared('employees'),
        {
          id: 'link-employee',
          title: 'Relier un employé à son compte',
          path: '/dashboard/hr/employees',
          blocks: [
            { kind: 'p', text: "Un employé ne peut pointer, demander un congé ou ajouter des documents qu'une fois sa fiche reliée à un compte. Un nouveau technicien « sans carte de pointage » signifie généralement que ce lien manque." },
            {
              kind: 'steps',
              items: [
                "Demandez à un administrateur de créer le compte de la personne dans Gestion des utilisateurs (les RH ne peuvent pas créer de comptes).",
                "Ouvrez Technet HR → Employés et ouvrez la personne, ou cliquez sur Ajouter un employé. Le code employé est attribué automatiquement.",
                'Cliquez sur Modifier, choisissez son compte sous Compte lié, puis enregistrez.',
                "La prochaine fois qu'elle ouvre l'application, la carte de pointage apparaît.",
              ],
            },
          ],
        },
        shared('certifications'),
        shared('availability'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'leave',
      title: 'Congés',
      topics: [
        {
          id: 'leave-requests',
          title: 'Approuver les congés',
          path: '/dashboard/hr/leave',
          blocks: [
            { kind: 'p', text: "Le personnel demande ses congés depuis Mes congés sur son téléphone. Vous êtes prévenu, et la demande attend dans Technet HR → Congés → Demandes." },
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet HR → Congés. Demandes montre toutes les demandes ; filtrez par statut pour voir celles en attente.',
                "Approuvez ou refusez chacune. Si la personne n'a pas assez de solde, vous êtes averti et pouvez cliquer sur Approuver quand même.",
                'La personne est prévenue. Les jours approuvés sont retirés de son solde.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Saisir un congé enregistre un congé vous-même, par exemple après un appel ou un formulaire papier.",
                'Modifier change une demande. Annuler un congé approuvé rend les jours au solde.',
                "Le personnel ne peut modifier ou retirer sa propre demande que tant qu'elle est en attente.",
              ],
            },
          ],
        },
        shared('leave-setup'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'overtime-pay',
      title: 'Heures supplémentaires, validation et paie',
      topics: [shared('overtime'), shared('overtime-records'), shared('validations'), shared('payroll')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Ordres de travail, rapports et magasin (consultation)',
      topics: [
        {
          id: 'operations-view',
          title: 'Ordres de travail et rapports',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'list',
              items: [
                "Ordres de travail liste les interventions prévues pour les techniciens, avec les personnes attribuées et le statut.",
                "Rapports journaliers et Rapports d'intervention montrent ce que les techniciens ont déposé pour chaque jour et chaque visite. Utilisez les filtres de date et de client pour en trouver un.",
              ],
            },
            { kind: 'note', text: "Créer des ordres de travail et approuver ou refuser les rapports revient à un administrateur ou au Responsable des opérations." },
          ],
        },
        {
          id: 'store-view',
          title: 'Technet Store',
          path: '/dashboard/store/tools',
          blocks: [
            { kind: 'p', text: "Vous voyez le registre des outils et équipements et le matériel en stock. Les sorties, les retours et les changements de stock sont faits par le magasinier ou un administrateur." },
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
                'Sécurité → Mon compte liste vos propres connexions récentes.',
                "Vous restez connecté 30 jours, et ces 30 jours repartent à chaque utilisation de l'application. Se déconnecter, en bas du menu, vous déconnecte immédiatement.",
              ],
            },
          ],
        },
      ],
    },
  ],
}
