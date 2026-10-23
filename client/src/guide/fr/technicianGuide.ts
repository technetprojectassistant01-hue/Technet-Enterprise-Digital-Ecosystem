import type { RoleGuide } from '../types'

/**
 * Guide du technicien - French copy of ../technicianGuide.ts (2026-10-20). Same chapters, topics,
 * ids and paths; change both together. Short sentences and the exact French button names, for
 * people who are not very technical.
 */
export const TECHNICIAN_GUIDE_FR: RoleGuide = {
  title: 'Guide du technicien',
  intro:
    "Comment utiliser Technet Digital sur votre téléphone : pointer votre arrivée et votre départ, vos interventions du jour, les rapports, les congés, les outils et les documents. Chaque sujet est une tâche, étape par étape.",
  roles: ['FIELD_TECHNICIAN'],
  updated: '2026-10-23',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'sign-in',
          title: 'Se connecter',
          blocks: [
            {
              kind: 'list',
              items: [
                "Votre e-mail et votre mot de passe vous sont donnés par l'administrateur. Vous ne pouvez pas changer votre mot de passe vous-même.",
                "Si vous oubliez votre mot de passe, demandez à l'administrateur d'en mettre un nouveau.",
                "Vous restez connecté 30 jours, et ces 30 jours repartent à chaque utilisation. Vous aurez donc rarement à vous reconnecter.",
              ],
            },
          ],
        },
        {
          id: 'install',
          title: "Mettre l'application sur votre téléphone",
          path: '/dashboard/settings',
          blocks: [
            { kind: 'p', text: "Installez l'application pour l'ouvrir depuis une icône, comme les autres applications. Sur un iPhone, c'est obligatoire : les contrôles de conformité et les rappels n'arrivent que sur une application installée." },
            {
              kind: 'list',
              items: [
                "Android : quand la fenêtre « Installer Technet Digital » apparaît, touchez Installer maintenant.",
                "iPhone : ouvrez le site dans Safari, touchez Partager, puis Sur l'écran d'accueil, puis Ajouter. Sur les iPhone récents, Partager se trouve dans le bouton ⋯.",
                "Vous avez manqué la fenêtre ? Ouvrez Paramètres et touchez Installer Technet Digital.",
              ],
            },
          ],
        },
        {
          id: 'permissions',
          title: 'Autoriser la position et les notifications',
          blocks: [
            { kind: 'p', text: "L'application a besoin de deux autorisations. Répondez Autoriser aux deux." },
            {
              kind: 'list',
              items: [
                "Position : nécessaire pour pointer. Sans elle, Pointer l'arrivée ne marche pas.",
                "Notifications : nécessaires pour les contrôles de conformité pendant votre poste. L'application les demande après votre premier pointage. Touchez Autoriser, puis encore Autoriser quand votre téléphone le demande.",
              ],
            },
            { kind: 'tip', text: "Si vous avez touché « Ne pas autoriser » par erreur, l'application montre comment le réactiver dans les réglages du téléphone. Suivez les étapes, puis touchez Réessayer." },
          ],
        },
        {
          id: 'language',
          title: 'Changer la langue',
          path: '/dashboard/settings',
          blocks: [
            { kind: 'p', text: "Ouvrez Paramètres et choisissez English, Français ou Kreol sous Langue. Votre choix est enregistré sur votre compte. Ce guide existe en anglais, en français et en kreol. Télécharger le PDF, en haut de ce guide, l'enregistre dans un fichier à garder ou à imprimer, dans la langue choisie." },
          ],
        },
        {
          id: 'no-card',
          title: 'Je ne vois pas la carte de pointage',
          blocks: [
            { kind: 'p', text: "Votre compte n'est pas encore relié à votre fiche employé. Demandez aux RH de le relier. Une fois fait, la carte apparaît la prochaine fois que vous ouvrez l'application." },
          ],
        },
        {
          id: 'form-drafts',
          title: "Si un formulaire se ferme avant l'envoi",
          blocks: [
            { kind: 'p', text: "Quand vous remplissez quelque chose de nouveau (un rapport journalier, une demande d'outils ou de matériel, une demande de congé, un document), le téléphone garde ce que vous tapez. Si l'application ou le formulaire se ferme par erreur, rouvrez le même formulaire. Un message indique « Nous avons remis ce que vous aviez saisi » et votre texte est de retour." },
            {
              kind: 'list',
              items: [
                "Le brouillon disparaît dès que vous envoyez.",
                'Pour repartir d\'un formulaire vide, touchez Supprimer le brouillon.',
                'Les photos et les fichiers ne sont pas gardés. Ajoutez-les à nouveau.',
                'Le brouillon reste uniquement sur ce téléphone, pour votre compte.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: "Pointer l'arrivée et le départ",
      intro: "Pointez votre arrivée en arrivant sur un site et votre départ en le quittant. Votre téléphone enregistre l'heure, votre position et une photo.",
      topics: [
        {
          id: 'check-in',
          title: "Pointer l'arrivée",
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez l'application. La carte Ma présence est en haut de la page Présence.",
                "Vérifiez HEURE D'ARRIVÉE. Elle est remplie avec l'heure actuelle. Ne la changez que si vous êtes arrivé plus tôt.",
                "Saisissez TRANSPORT (MUR), le coût de votre trajet. Mettez 0 s'il n'y en a pas eu, et dites pourquoi dans la case qui apparaît.",
                "SITE et EMPLACEMENT sont facultatifs : le client ou le bâtiment (par exemple « Celero Level 5 ») et la ville ou la zone (par exemple « Ebène »). Si vous avez une seule intervention aujourd'hui, ils sont remplis pour vous.",
                'Touchez Prendre une photo et prenez une photo avec la caméra avant.',
                "Touchez Pointer l'arrivée.",
              ],
            },
            {
              kind: 'list',
              items: [
                'La carte affiche alors PRÉSENT et depuis combien de temps vous êtes sur site.',
                'Vous pouvez pointer plusieurs fois par jour si vous allez sur plusieurs sites.',
                "Si vous êtes déjà pointé, l'application vous le dit et propose Aller au départ. Pointez d'abord le départ de cette visite.",
              ],
            },
            { kind: 'note', text: "L'heure de l'application est l'heure officielle. Si vous tapez une heure très différente, votre responsable voit les deux : tapez toujours l'heure réelle." },
          ],
        },
        {
          id: 'check-out',
          title: 'Pointer le départ',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Sur la carte Ma présence, vérifiez HEURE DE DÉPART. Elle est remplie avec l'heure actuelle.",
                "Saisissez TRANSPORT (MUR) pour le retour (0 s'il n'y en a pas, avec la raison).",
                "Ajoutez le site et l'emplacement si vous le souhaitez.",
                'Touchez Pointer le départ.',
              ],
            },
            {
              kind: 'note',
              text: "Vous avez oublié de pointer le départ ? Après minuit, l'application le fait automatiquement à l'heure de fermeture (17:00, ou 13:00 le samedi) et vous envoie une notification. Les heures supplémentaires de ce jour sont perdues sauf si les RH corrigent : pointez donc votre départ vous-même en partant.",
            },
          ],
        },
        {
          id: 'compliance-check',
          title: 'Les contrôles de conformité',
          blocks: [
            { kind: 'p', text: "Pendant votre poste, une notification vous demande de confirmer que vous êtes sur site. Elle arrive 2 à 4 fois par poste, à des heures au hasard." },
            {
              kind: 'steps',
              items: [
                'Touchez la notification. La page Contrôle de conformité s\'ouvre.',
                "Touchez Confirmer votre présence sur site. L'application enregistre votre position.",
                'Vous voyez « Merci — enregistré. »',
              ],
            },
            {
              kind: 'list',
              items: [
                "Vous avez 5 minutes. Sans réponse, un second rappel arrive après environ 2 minutes et demie.",
                "Une réponse trop tardive affiche « Ce contrôle a expiré. » Cela compte comme manqué.",
                'Deux contrôles manqués de suite sont signalés à votre responsable.',
                'Ces contrôles ne peuvent pas être désactivés.',
              ],
            },
          ],
        },
        {
          id: 'location-while-in',
          title: 'Votre position pendant le poste',
          blocks: [
            { kind: 'p', text: "Tant que vous êtes pointé, l'application enregistre aussi votre position toutes les 15 minutes quand elle est ouverte à l'écran. Elle ne peut rien enregistrer quand l'application est fermée ou le téléphone verrouillé, et rien n'est enregistré quand vous n'êtes pas pointé." },
            { kind: 'p', text: "Vos responsables voient vos lieux d'arrivée et de départ, la photo et ces positions." },
          ],
        },
        {
          id: 'reminders',
          title: 'Les rappels de pointage',
          path: '/dashboard',
          blocks: [
            {
              kind: 'list',
              items: [
                "Le bouton Me le rappeler, sur la carte Ma présence, active les rappels : 08:15 si vous n'avez pas pointé votre arrivée, et 17:15 si vous êtes encore pointé, du lundi au samedi. Quand ils sont actifs, il affiche Rappels activés.",
                'Touchez-le pour désactiver ou réactiver les rappels. Les contrôles de conformité arrivent dans tous les cas.',
                'Envoyer un test envoie une notification de test pour vérifier que votre téléphone les reçoit.',
                'Si vous êtes encore pointé après 14 heures, vous recevez un rappel « toujours pointé ? ».',
              ],
            },
          ],
        },
        {
          id: 'no-signal',
          title: 'Pas de réseau',
          blocks: [
            { kind: 'p', text: "Vous pouvez pointer et envoyer des rapports sans réseau. Ils sont gardés sur votre téléphone et partent tout seuls quand le réseau revient. Vous n'avez pas à les refaire." },
            {
              kind: 'list',
              items: [
                "Tant que quelque chose attend, le haut de l'écran affiche « En attente de synchronisation ». Touchez-le, puis Réessayer maintenant pour l'envoyer tout de suite.",
                "Sur un iPhone, ce qui attend part la prochaine fois que vous ouvrez l'application avec du réseau.",
                'Vos interventions et rapports restent visibles sans réseau si vous les avez ouverts une fois connecté.',
              ],
            },
          ],
        },
        {
          id: 'my-attendance',
          title: 'Voir votre présence et la télécharger',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Sous la carte, Aujourd'hui montre les visites du jour, et Ma présence montre le mois : jours, heures, transport, retards, absences et heures supplémentaires approuvées." },
            {
              kind: 'list',
              items: [
                "Les horaires sont du lundi au vendredi 08:00–17:00 et le samedi 08:00–13:00. Vous êtes en retard si votre premier pointage, selon l'heure de l'application, est après 08:30.",
                "Les heures supplémentaires comptent à partir de 17:30 en semaine et 13:30 le samedi. Elles n'apparaissent ici qu'après approbation des RH.",
                "Un jour ouvrable sans pointage apparaît comme Absent, sauf si vous étiez en congé approuvé ou si les RH l'ont justifié.",
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
      id: 'jobs',
      title: 'Vos interventions et rapports',
      topics: [
        {
          id: 'my-jobs',
          title: "Mes interventions d'aujourd'hui",
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Mes interventions d'aujourd'hui, sous la carte de pointage, liste les interventions qui vous sont attribuées aujourd'hui. Toujours ouvert depuis un jour précédent liste les plus anciennes qui ne sont pas terminées." },
            {
              kind: 'list',
              items: [
                "Ouvrir dans Maps montre l'adresse du site dans votre application de cartes.",
                'Appeler le client appelle le client.',
                "Avec vous montre qui d'autre est sur l'intervention.",
                "Ouvrir l'intervention ouvre l'ordre de travail complet.",
              ],
            },
            { kind: 'tip', text: "Aucune intervention listée alors qu'on vous a dit d'aller quelque part ? Contactez votre superviseur." },
          ],
        },
        {
          id: 'job-status',
          title: 'Mettre à jour une intervention',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez l'intervention (Ouvrir l'intervention, ou Technet Operations → Ordres de travail).",
                'Touchez Commencer le travail quand vous commencez.',
                "Touchez En attente de pièces si vous devez vous arrêter pour des pièces, et Reprendre le travail quand vous continuez.",
                "Touchez Marquer comme terminé quand l'intervention est finie.",
              ],
            },
            { kind: 'note', text: "Le statut est commun : quand vous marquez une intervention terminée, elle l'est pour tous ceux qui y sont. Seul un responsable peut la rouvrir." },
          ],
        },
        {
          id: 'daily-report',
          title: 'Déposer un rapport journalier',
          path: '/dashboard/operations/daily-reports',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet Operations → Rapports journaliers et touchez Nouveau rapport journalier.',
                "Écrivez le RÉSUMÉ de ce que vous avez fait aujourd'hui.",
                'Ajoutez si vous voulez vos heures, les techniciens avec vous et les ordres de travail concernés.',
                "Si vous avez déposé aujourd'hui un rapport d'intervention pour ces interventions, il est listé. Touchez Insérer pour le copier dans votre résumé.",
                "Ajoutez jusqu'à 3 photos avec Ajouter une photo.",
                'Touchez Envoyer le rapport. Votre responsable l\'approuve ou le refuse, et vous recevez une notification.',
              ],
            },
          ],
        },
        {
          id: 'intervention-report',
          title: "Déposer un rapport d'intervention",
          path: '/dashboard/operations/intervention-reports',
          blocks: [
            { kind: 'p', text: "Remplissez-le juste après une visite sur site. Commencez depuis Technet Operations → Rapports d'intervention → Nouvelle intervention, ou depuis une intervention avec Déposer un rapport." },
            {
              kind: 'steps',
              items: [
                "Client et contact : choisissez le client, l'ordre de travail s'il y en a un, et la personne à contacter.",
                'Équipement / système (facultatif) : équipement, marque, modèle, numéros de série et photos.',
                "Panne et travaux effectués : ce qui a été signalé, ce que vous avez fait, les photos avant et après, et le matériel utilisé. Pour plusieurs unités, utilisez le détail par unité.",
                'Techniciens et horaires : qui était là.',
                'Garantie et rapport : la garantie, votre rapport et vos recommandations.',
                "Signature et pièce jointe : le client signe sur l'écran, et vous pouvez ajouter une photo de la fiche papier signée.",
                'Envoyez.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Si l'application se ferme avant l'envoi, votre brouillon est gardé. Les photos, le fichier et la signature sont à remettre.",
                "Si votre responsable refuse le rapport, ouvrez-le, lisez son commentaire et touchez Correct and Resubmit.",
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
      topics: [
        {
          id: 'request-leave',
          title: 'Demander un congé',
          path: '/dashboard/my-leave',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Mes congés dans le menu et touchez Demander un congé.',
                'Choisissez le type de congé et les dates de début et de fin (ou Demi-journée). Vérifiez JOURS DÉCOMPTÉS.',
                'Ajoutez un motif et des remarques si vous voulez (par exemple « Certificat médical obtenu »).',
                'Touchez Envoyer la demande. Les RH sont prévenues et vous recevez une notification quand elles décident.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Mon solde montre combien de jours il vous reste pour chaque type.',
                "Tant qu'une demande est EN ATTENTE, vous pouvez la Modifier ou la Retirer. Une fois que les RH ont décidé, vous pouvez seulement la retirer.",
              ],
            },
          ],
        },
        {
          id: 'my-documents',
          title: 'Garder vos documents',
          path: '/dashboard/my-documents',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Mes documents et touchez Ajouter un document.',
                'Donnez-lui un NOM (par exemple « Permis de conduire ») et choisissez le TYPE.',
                "Touchez pour choisir une photo ou un PDF (jusqu'à 10 Mo) et envoyez.",
              ],
            },
            { kind: 'p', text: 'Seuls vous et les RH voyez ces documents. Vous pouvez les télécharger ou les supprimer à tout moment.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Outils et matériel',
      topics: [
        {
          id: 'request-tools',
          title: 'Demander des outils',
          path: '/dashboard/store/requests',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet Store → Demandes d'outils et touchez Demander des outils.",
                "Écrivez les outils ou équipements dont vous avez besoin, et si vous voulez le type ou la marque, pour quoi faire et pour quand.",
                'Touchez Envoyer la demande. Le magasin est prévenu, et vous recevez une notification quand vos outils sont prêts.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Tant que la demande est en attente, vous pouvez la Modifier. Vous pouvez la Supprimer tant qu'aucun outil n'a été sorti.",
                "Technet Store → Outils & équipements montre Mes outils : chaque outil qui vous a été remis et quand le rendre. Rendez les outils au magasin : c'est lui qui enregistre le retour.",
              ],
            },
          ],
        },
        {
          id: 'request-materials',
          title: 'Demander du matériel',
          path: '/dashboard/store/materials',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet Store → Demandes de matériel et touchez Demander du matériel.',
                "Pour chaque article, écrivez la DESCRIPTION (par exemple « Colle silicone »), la référence si vous la connaissez, et la QUANTITÉ. Touchez Ajouter un autre article pour plus de lignes.",
                "Dites si vous voulez pour quoi c'est et pour quand.",
                'Touchez Envoyer la demande. Vous recevez une notification quand c\'est prêt.',
              ],
            },
            { kind: 'p', text: 'Technet Store → Matériel montre Mon matériel : ce qui vous a été remis.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'help',
      title: "Obtenir de l'aide",
      topics: [
        {
          id: 'support',
          title: 'À qui demander',
          path: '/dashboard/help',
          blocks: [
            {
              kind: 'list',
              items: [
                "Mot de passe, e-mail de connexion ou page que vous ne voyez pas : l'administrateur.",
                'Carte de pointage absente, congés, heures supplémentaires ou PDF de présence : les RH.',
                'Interventions et rapports : votre superviseur.',
                "Tout le reste, ou si l'application ne marche pas : appelez le support au 5885 1000 (le numéro est aussi dans le Centre d'aide).",
              ],
            },
          ],
        },
      ],
    },
  ],
}
