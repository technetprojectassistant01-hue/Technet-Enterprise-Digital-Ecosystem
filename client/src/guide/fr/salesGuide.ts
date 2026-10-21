import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_FR } from './adminGuide'
import { HR_GUIDE_FR } from './hrGuide'
import { TECHNICIAN_GUIDE_FR } from './technicianGuide'

/**
 * Guide du chargé des ventes - French copy of ../salesGuide.ts (2026-10-20). Same chapters,
 * topics, ids and paths; shared topics come from the French Admin, HR and Technician guides.
 */

const admin = topicsFrom(ADMIN_GUIDE_FR)
const hr = topicsFrom(HR_GUIDE_FR)
const tech = topicsFrom(TECHNICIAN_GUIDE_FR)

export const SALES_GUIDE_FR: RoleGuide = {
  title: 'Guide du chargé des ventes',
  intro:
    "Le travail d'un chargé des ventes dans Technet Digital : les clients, les demandes de devis, les devis et leur suivi, le portail client et le calendrier marketing. Chaque sujet est une tâche, étape par étape. Les pages de l'ERP et du Marketing ne sont pas encore traduites ; leurs boutons sont nommés ici en anglais, tels qu'ils apparaissent à l'écran.",
  roles: ['SALES_OFFICER'],
  updated: '2026-10-20',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'your-role',
          title: 'Ce que peut faire un chargé des ventes',
          blocks: [
            { kind: 'p', text: "Les ventes s'occupent des clients et des devis. L'application s'ouvre sur Technet ERP, dont la Vue d'ensemble montre les clients, les devis, les contrats et l'activité récente." },
            {
              kind: 'list',
              items: [
                "Vous gérez les clients, les demandes de devis (le Call Log), les devis et leur suivi, et l'accès des clients au portail.",
                'Vous planifiez les publications dans Technet Digital Marketing.',
                "Vous pouvez ajouter des documents et demander un achat avec une demande d'achat.",
                "Les contrats, les projets, l'inventaire, les fournisseurs, les bons de commande et Technet Operations sont en consultation seule pour vous.",
                "Vous ne pointez pas : il n'y a donc pas de page Présence dans votre menu. Mes congés et Mes documents fonctionnent une fois que les RH ont relié votre compte à votre fiche employé.",
                'Les comptes sont créés par un administrateur. Vous ne pouvez ni créer ni réinitialiser de compte.',
              ],
            },
          ],
        },
        tech('sign-in'),
        admin('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            {
              kind: 'list',
              items: [
                "Un client a demandé un devis depuis le portail. Cliquez dessus pour ouvrir le Call Log.",
                'Un devis que vous avez créé a été marqué Approved ou Not Approved.',
                "Votre demande d'achat a été approuvée ou refusée.",
                'Votre demande de congé a été décidée, ou vos outils ou votre matériel sont prêts.',
              ],
            },
            { kind: 'p', text: "Cliquez sur une notification pour aller à l'élément. Tout marquer comme lu remet le compteur à zéro." },
            { kind: 'note', text: "Ces notifications apparaissent uniquement dans l'application. Personne ne reçoit d'e-mail ou de SMS pour elles. Leur texte est pour l'instant en anglais." },
          ],
        },
        admin('install-language'),
        admin('slow-first-load'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'sales',
      title: 'Clients et devis',
      intro: 'Technet ERP → Clients regroupe quatre pages : Clients, Devis (avec le Call Log), Suivi et Contrats.',
      topics: [
        admin('customers'),
        admin('quote-requests'),
        admin('quotations'),
        {
          id: 'follow-up-contracts',
          title: 'Suivi et contrats',
          path: '/dashboard/erp/customers/follow-up',
          blocks: [
            {
              kind: 'list',
              items: [
                "Suivi liste les appels notés sur les devis, par client ou par date. Pour noter un appel, ouvrez le devis et utilisez Follow-Up.",
                "Contrats liste les contrats de service avec les clients, leur valeur et leurs dates de début et de fin. Vous pouvez les lire ; ajouter ou modifier un contrat revient à un administrateur ou au chargé des finances.",
              ],
            },
          ],
        },
        admin('connect'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'marketing',
      title: 'Marketing',
      topics: [admin('marketing')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp-other',
      title: "Documents, achats et le reste de l'ERP",
      topics: [
        {
          id: 'documents',
          title: 'Documents',
          path: '/dashboard/erp/documents',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet ERP → Documents et cliquez sur Ajouter un document.',
                "Choisissez le FICHIER, donnez-lui un TITRE et une CATÉGORIE (contrat, projet, devis…), et choisissez le PROJET ou le CLIENT s'il en relève.",
                'Cliquez sur Ajouter un document. Toute personne qui peut ouvrir Documents le retrouvera.',
              ],
            },
          ],
        },
        {
          id: 'requisitions',
          title: "Demander un achat (demande d'achat)",
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet ERP → Achats → Demandes d'achat et cliquez sur Nouvelle demande d'achat.",
                "Saisissez le NUMÉRO DE DEMANDE (il ne doit pas être déjà utilisé), la date NÉCESSAIRE POUR LE et, si c'est pour un projet, le PROJET.",
                "Ajoutez une ligne par besoin : description, quantité et, si vous le connaissez, le coût unitaire. Cliquez sur Ajouter une ligne pour plus de lignes.",
                'Cliquez sur Envoyer la demande.',
              ],
            },
            { kind: 'p', text: "Le magasinier ou un administrateur l'approuve ou la refuse, et vous recevez une notification dans les deux cas. Une demande approuvée devient un bon de commande, que vous pouvez suivre dans Bons de commande." },
          ],
        },
        {
          id: 'view-only',
          title: 'Ce que vous voyez sans pouvoir le modifier',
          blocks: [
            {
              kind: 'list',
              items: [
                "Projets : le client, le responsable, les dates et le budget de chaque projet. Les projets sont gérés par un administrateur ou le Responsable des opérations.",
                "Inventaire, Fournisseurs et Bons de commande : les niveaux de stock et ce qui a été commandé. Le magasinier ou un administrateur les tient à jour.",
                "Technet Operations : Ordres de travail, Rapports journaliers et Rapports d'intervention, pour voir où en est l'intervention d'un client. Ils sont créés et approuvés par le Responsable des opérations ou un administrateur.",
                'Technet Store : les outils et le matériel du magasin.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'self-service',
      title: 'Congés, documents et magasin',
      intro: "Ces pages demandent que votre compte soit relié à votre fiche employé. Si elles indiquent qu'aucun dossier employé n'est lié à votre compte, demandez aux RH.",
      topics: [tech('request-leave'), tech('my-documents'), tech('request-tools'), tech('request-materials')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'account',
      title: 'Votre compte et aide',
      topics: [
        hr('account-security'),
        {
          id: 'support',
          title: 'À qui demander',
          path: '/dashboard/help',
          blocks: [
            {
              kind: 'list',
              items: [
                "Mot de passe, e-mail de connexion ou page que vous ne voyez pas : l'administrateur.",
                'Congés, ou Mes congés et Mes documents qui disent que votre compte n\'est pas relié : les RH.',
                "Tout le reste, ou si l'application ne marche pas : appelez le support au 5885 1000 (le numéro est aussi dans le Centre d'aide).",
              ],
            },
          ],
        },
      ],
    },
  ],
}
