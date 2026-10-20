import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_FR } from './adminGuide'
import { HR_GUIDE_FR } from './hrGuide'
import { SALES_GUIDE_FR } from './salesGuide'
import { TECHNICIAN_GUIDE_FR } from './technicianGuide'

/**
 * Guide du chargé des finances - French copy of ../financeGuide.ts (2026-10-20). Same chapters,
 * topics, ids and paths; shared topics come from the French Admin, Sales, HR and Technician guides.
 */

const admin = topicsFrom(ADMIN_GUIDE_FR)
const sales = topicsFrom(SALES_GUIDE_FR)
const hr = topicsFrom(HR_GUIDE_FR)
const tech = topicsFrom(TECHNICIAN_GUIDE_FR)

export const FINANCE_GUIDE_FR: RoleGuide = {
  title: 'Guide du chargé des finances',
  intro:
    "Le travail d'un chargé des finances dans Technet Digital : les fiches clients et leur accès au portail, les contrats de service, les devis, les documents et les demandes d'achat. Chaque sujet est une tâche, étape par étape. Les pages de l'ERP ne sont pas encore traduites ; leurs boutons sont nommés ici en anglais, tels qu'ils apparaissent à l'écran.",
  roles: ['FINANCE_OFFICER'],
  updated: '2026-10-20',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'your-role',
          title: 'Ce que peut faire un chargé des finances',
          blocks: [
            { kind: 'p', text: "L'application s'ouvre sur Technet ERP, dont la Vue d'ensemble montre les clients, les devis, les contrats et l'activité récente." },
            {
              kind: 'list',
              items: [
                "Vous ajoutez et modifiez les clients, y compris leurs informations de facturation (BRN, numéro de TVA), et leur donnez accès au portail.",
                'Vous enregistrez et mettez à jour les contrats de service.',
                "Vous pouvez lire tous les devis, télécharger leur PDF et les envoyer par e-mail, mais créer et modifier les devis revient aux ventes.",
                "Vous pouvez ajouter des documents et demander un achat avec une demande d'achat.",
                "Les projets, l'inventaire, les fournisseurs, les bons de commande et Technet Operations sont en consultation seule pour vous.",
                "Vous ne pointez pas : il n'y a donc pas de page Présence dans votre menu. Mes congés et Mes documents fonctionnent une fois que les RH ont relié votre compte à votre fiche employé.",
                'Les comptes sont créés par un administrateur. Vous ne pouvez ni créer ni réinitialiser de compte.',
              ],
            },
            { kind: 'note', text: 'Les factures et les dépenses sont tenues dans QuickBooks, pas dans cette application.' },
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
      id: 'customers',
      title: 'Clients et contrats',
      intro: 'Technet ERP → Clients regroupe quatre pages : Clients, Devis, Suivi et Contrats.',
      topics: [
        admin('customers'),
        {
          id: 'contracts',
          title: 'Les contrats',
          path: '/dashboard/erp/customers/contracts',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet ERP → Clients → Contrats et cliquez sur New Contract. Le client doit d'abord exister.",
                "Choisissez le client (CUSTOMER), décrivez le service (SERVICE), et saisissez la valeur (VALUE), le statut (STATUS), la date de début (START DATE) et la date de fin (END DATE).",
                'Cliquez sur Create Contract.',
              ],
            },
            { kind: 'p', text: "Les actions de modification et de suppression, au bout de chaque ligne, servent à changer un contrat (par exemple son statut une fois terminé) ou à le supprimer." },
          ],
        },
        {
          id: 'quotations-view',
          title: 'Les devis (consultation)',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            {
              kind: 'list',
              items: [
                "Devis liste tous les devis avec leur client, leur statut et leur total. Ouvrez-en un pour voir ses lignes, ses conditions de paiement et ses pièces jointes.",
                "Download PDF enregistre le devis en PDF. Email Customer le télécharge et ouvre un e-mail avec le texte prêt ; joignez vous-même le PDF avant d'envoyer.",
                "Suivi liste les devis par client ou par date, pour voir ce qui a été proposé et quand.",
                "Créer, modifier et marquer les devis (envoyé, approuvé, non approuvé) revient aux ventes. Le Call Log des demandes de devis et l'historique des appels sur chaque devis ne sont visibles que par les ventes.",
              ],
            },
          ],
        },
        admin('connect'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp-other',
      title: "Documents, achats et le reste de l'ERP",
      topics: [sales('documents'), sales('requisitions'), sales('view-only')],
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
      topics: [hr('account-security'), sales('support')],
    },
  ],
}
