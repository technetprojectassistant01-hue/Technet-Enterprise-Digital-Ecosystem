import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { TECHNICIAN_GUIDE_FR } from './technicianGuide'

/**
 * Guide du personnel de bureau - French copy of ../officeGuide.ts (2026-10-20). Same chapters,
 * topics, ids and paths; shared topics come from the French Technician guide.
 */

const tech = topicsFrom(TECHNICIAN_GUIDE_FR)

export const OFFICE_GUIDE_FR: RoleGuide = {
  title: 'Guide du personnel de bureau',
  intro:
    "Comment le personnel de bureau utilise Technet Digital : pointer l'arrivée et le départ, les congés, les documents, et demander des outils et du matériel au magasin. Chaque sujet est une tâche, étape par étape.",
  roles: ['EMPLOYEE'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'your-role',
          title: 'Ce que vous pouvez faire',
          blocks: [
            {
              kind: 'list',
              items: [
                'Présence : pointez votre arrivée en commençant le travail et votre départ en partant.',
                'Mes congés : demandez un congé et consultez votre solde.',
                "Mes documents : gardez des copies de votre pièce d'identité, de votre permis et de vos certificats.",
                'Technet Store : demandez des outils et du matériel.',
                'Technet Operations : consultez les ordres de travail et les rapports, et déposez des rapports si des interventions vous sont confiées.',
              ],
            },
          ],
        },
        tech('sign-in'),
        tech('install'),
        tech('permissions'),
        tech('language'),
        tech('no-card'),
        tech('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: "Pointer l'arrivée et le départ",
      intro: "Pointez votre arrivée en commençant le travail et votre départ en partant. Votre téléphone enregistre l'heure, votre position et une photo.",
      topics: [
        tech('check-in'),
        tech('check-out'),
        tech('compliance-check'),
        tech('location-while-in'),
        tech('reminders'),
        tech('no-signal'),
        {
          id: 'my-attendance',
          title: 'Voir votre présence et la télécharger',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Sous la carte, Aujourd'hui montre les visites du jour, et Ma présence montre le mois : jours, heures, transport, retards et heures supplémentaires approuvées." },
            {
              kind: 'list',
              items: [
                "Les horaires sont du lundi au vendredi 08:00–17:00 et le samedi 08:00–13:00. Vous êtes en retard si votre premier pointage, selon l'heure de l'application, est après 08:30.",
                "Les heures supplémentaires comptent à partir de 17:30 en semaine et 13:30 le samedi. Elles n'apparaissent ici qu'après approbation des RH.",
              ],
            },
            {
              kind: 'steps',
              items: [
                'Pour avoir un PDF, touchez Exporter en PDF, choisissez les dates et touchez Télécharger le PDF.',
                "Le PDF porte la mention BROUILLON jusqu'à ce que les RH valident le mois. Vous recevez une notification quand c'est fait, et le téléchargement suivant n'a plus la mention BROUILLON.",
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'leave-docs',
      title: 'Congés et documents',
      topics: [tech('request-leave'), tech('my-documents')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Outils et matériel',
      topics: [tech('request-tools'), tech('request-materials')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'jobs',
      title: 'Interventions et rapports',
      intro: 'Seulement si des interventions vous sont confiées. Sinon, vous pouvez sauter ce chapitre.',
      topics: [tech('my-jobs'), tech('job-status'), tech('daily-report'), tech('intervention-report')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'help',
      title: "Obtenir de l'aide",
      topics: [tech('support')],
    },
  ],
}
