import type { RoleGuide } from '../types'

/**
 * Guide administrateur - French copy of ../adminGuide.ts (2026-10-20). Same chapters, topics, ids
 * and paths as the English guide; change both together. Button names are the ones the French
 * screen shows; pages not translated yet (Technet ERP, Marketing, Sécurité, Gestion des
 * utilisateurs, Employés, Certifications) keep their English button names, written as on screen.
 */
export const ADMIN_GUIDE_FR: RoleGuide = {
  title: 'Guide administrateur',
  intro:
    "Comment gérer Technet Digital en tant qu'administrateur : les comptes, la présence du personnel, les opérations, les RH, le magasin et l'ERP. Il suit le menu de gauche, de haut en bas. Le Responsable des opérations a exactement les mêmes accès qu'un administrateur : ce guide est aussi le sien. Certaines pages ne sont pas encore traduites ; leurs boutons sont nommés ici en anglais, tels qu'ils apparaissent à l'écran.",
  roles: ['ADMIN', 'OPERATIONS_MANAGER'],
  updated: '2026-10-20',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pour commencer',
      topics: [
        {
          id: 'your-role',
          title: "Le rôle de l'administrateur",
          blocks: [
            { kind: 'p', text: "L'administrateur configure et fait fonctionner le système pour tous les autres. Vous pouvez ouvrir tous les modules, approuver ce que les autres envoient et gérer les comptes." },
            {
              kind: 'list',
              items: [
                "Vous ne pointez pas. Vous n'avez ni carte de pointage, ni page Mes congés ou Mes documents. Votre page d'accueil affiche à la place la présence de tous les autres.",
                "Votre compte n'a pas besoin de fiche employé. N'en reliez une que si vous travaillez aussi comme membre du personnel et devez apparaître dans la paie.",
                "Le Responsable des opérations a les mêmes accès que vous, à une exception près : seul un administrateur peut réinitialiser son propre mot de passe par e-mail.",
              ],
            },
          ],
        },
        {
          id: 'finding-your-way',
          title: "S'orienter dans l'application",
          blocks: [
            {
              kind: 'list',
              items: [
                "Sur un ordinateur, le menu est à gauche. Cliquez sur un module (par exemple Technet HR) pour ouvrir ses pages.",
                "Sur une tablette ou un téléphone, touchez le bouton de menu en haut à gauche pour ouvrir le menu. Sur un téléphone, une bande de raccourcis se trouve sous l'en-tête ; touchez Tout pour le menu complet.",
                "La zone de recherche de l'en-tête trouve les pages par leur nom. Tapez une partie du nom (par exemple « heures ») et appuyez sur Entrée.",
                "Dans un module, les onglets en haut passent d'une page à l'autre.",
                "Centre d'aide et Guide d'utilisation sont en bas du menu. Le Centre d'aide donne le numéro du support, le 5885 1000.",
              ],
            },
          ],
        },
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            { kind: 'p', text: "La cloche de l'en-tête montre ce qui demande votre attention : un technicien a pointé son arrivée, une demande de congé ou un rapport a été envoyé, une anomalie de présence grave a été signalée, etc. Cliquez sur une notification pour aller à l'élément concerné. Tout marquer comme lu remet le compteur à zéro." },
            { kind: 'note', text: "Ces notifications apparaissent uniquement dans l'application. Personne ne reçoit d'e-mail ou de SMS pour elles. Leur texte est pour l'instant en anglais." },
          ],
        },
        {
          id: 'install-language',
          title: "Installer l'application et choisir la langue",
          path: '/dashboard/settings',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Paramètres en bas du menu.',
                'Sous Langue, choisissez English, Français ou Kreol Morisien. Votre choix est enregistré sur votre compte.',
                "Sous Installer l'application, cliquez sur Installer Technet Digital pour l'ajouter à votre ordinateur ou téléphone. Sur un iPhone ou un iPad, suivez les étapes affichées (Partager, puis Sur l'écran d'accueil).",
              ],
            },
            { kind: 'tip', text: "Vous restez connecté 30 jours, et ces 30 jours repartent à chaque utilisation de l'application. Se déconnecter, en bas du menu, vous déconnecte immédiatement." },
          ],
        },
        {
          id: 'slow-first-load',
          title: 'Si une page est lente à charger',
          blocks: [
            { kind: 'p', text: "Le serveur se met en veille quand personne n'a utilisé l'application depuis environ 15 minutes. La première page ouverte ensuite peut prendre 30 à 60 secondes. Patientez plutôt que de recharger encore et encore. Une fois réveillé, tout est rapide." },
            { kind: 'p', text: "Quand une nouvelle version de l'application est publiée, une barre indique « Une nouvelle version de Technet Digital est disponible. » Cliquez sur Recharger." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'logins',
      title: 'Comptes et sécurité',
      intro: "Chaque compte est créé par un administrateur. Personne ne peut s'inscrire seul ni changer son propre mot de passe.",
      topics: [
        {
          id: 'add-user',
          title: 'Créer un compte pour une nouvelle personne',
          path: '/dashboard/users',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Gestion des utilisateurs, en bas du menu.',
                'Cliquez sur Add user.',
                "Saisissez le nom de la personne, l'e-mail avec lequel elle se connectera, un mot de passe et son rôle, puis cliquez sur Create user.",
                'Donnez vous-même son e-mail et son mot de passe à la personne.',
                "Si elle doit pointer, prendre des congés ou être payée, reliez le compte à sa fiche employé (sujet suivant).",
              ],
            },
            {
              kind: 'list',
              items: [
                "Technicien : personnel de terrain. Il pointe, voit ses interventions et dépose des rapports.",
                "Personnel de bureau : mêmes pages personnelles (présence, congés, documents).",
                "RH : Technet HR, le registre de présence, la validation des congés et des heures supplémentaires.",
                "Magasinier : Technet Store, ainsi que l'Inventaire et les Achats dans l'ERP.",
                "Chargé des ventes et Chargé des finances : la partie clients de l'ERP. Ils ne pointent pas, mais gardent Mes congés et Mes documents.",
                "Responsable des opérations : les mêmes accès qu'un administrateur.",
                'Administrateur : tout.',
              ],
            },
          ],
        },
        {
          id: 'link-employee',
          title: 'Relier un compte à une fiche employé',
          path: '/dashboard/hr/employees',
          blocks: [
            { kind: 'p', text: "Un compte seul ne peut pas pointer. La carte de pointage, les congés, la paie et les documents passent tous par la fiche employé. Gestion des utilisateurs affiche un bandeau comptant les comptes sans fiche employé, et une colonne Employee Record pour chaque compte." },
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet HR → Employés.',
                "Ouvrez la personne (ou cliquez sur Add Employee si elle n'y est pas encore ; son code employé est attribué automatiquement).",
                'Cliquez sur Edit et choisissez son compte sous Linked Login.',
                "Enregistrez. La prochaine fois qu'elle ouvre l'application, la carte de pointage apparaît.",
              ],
            },
          ],
        },
        {
          id: 'edit-user',
          title: "Changer un nom, un e-mail ou un rôle, ou réinitialiser un mot de passe",
          path: '/dashboard/users',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouvrez Gestion des utilisateurs et trouvez la personne (zone de recherche ou filtre par rôle).',
                "Cliquez sur Edit User pour changer son nom, son e-mail de connexion ou son rôle, puis sur Save changes.",
                'Cliquez sur Reset Password pour lui donner un nouveau mot de passe, puis sur Save password. Communiquez-lui le nouveau mot de passe.',
              ],
            },
            { kind: 'tip', text: "Changez l'e-mail de quelqu'un ici plutôt que de supprimer son compte pour en créer un autre. Supprimer un compte le détache de sa fiche employé et efface ses notifications." },
            { kind: 'note', text: "Si vous oubliez votre propre mot de passe, le lien « Mot de passe oublié ? » de la page de connexion peut envoyer à un administrateur un lien de réinitialisation par e-mail. Si l'envoi d'e-mails n'est pas configuré sur le serveur, la page l'indique et l'e-mail n'arrivera pas. Gardez un second compte administrateur pour que les administrateurs puissent se dépanner entre eux." },
          ],
        },
        {
          id: 'security-log',
          title: "La sécurité et le journal d'audit",
          path: '/dashboard/security',
          blocks: [
            {
              kind: 'list',
              items: [
                'Sécurité → My Account liste vos propres connexions récentes.',
                "Sécurité → Audit Log liste les événements de sécurité de toute l'entreprise : connexions réussies et échouées, réinitialisations de mot de passe, comptes créés, modifiés ou supprimés. Filtrez par type d'événement et par date.",
              ],
            },
            { kind: 'note', text: "Le journal d'audit ne couvre que les comptes et les mots de passe. Ce n'est pas l'historique de toutes les modifications faites dans l'application." },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Présence du personnel',
      intro: "Les techniciens pointent leur arrivée et leur départ sur leur téléphone. Chaque pointage enregistre l'heure et le lieu qu'ils ont saisis, l'heure de l'application, une position GPS et généralement une photo. Votre page d'accueil et les écrans de Technet Operations montrent tout cela.",
      topics: [
        {
          id: 'staff-attendance',
          title: "Le registre Présence du personnel (votre page d'accueil)",
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'Présence, le premier élément du menu, ouvre le registre Présence du personnel du mois : une ligne par visite.' },
            {
              kind: 'list',
              items: [
                "SAISI PAR LE PERSONNEL : ce que la personne a tapé, son heure et son lieu d'arrivée et de départ.",
                "ENREGISTRÉ PAR L'APPLICATION : ce que l'application a constaté, sa propre heure et la position GPS, avec un lien Carte et le nom du lieu.",
                "Des alertes signalent quand les deux ne concordent pas, par exemple une heure saisie très éloignée de celle de l'application.",
                "Le badge à côté de chaque visite indique Vérifié, Non vérifié ou Signalé. Cliquez sur Signalé pour voir pourquoi (voir Anomalies de présence).",
                "La colonne HEURES SUPP. permet d'approuver ou de refuser directement les heures supplémentaires du jour.",
                "Les flèches changent de mois, et Registre complet ouvre Présence de l'équipe.",
              ],
            },
            { kind: 'tip', text: "L'heure de l'application est l'heure officielle. L'heure saisie est gardée pour comparer, par exemple pour un technicien arrivé à 08:00 mais qui a ouvert l'application à 08:20." },
          ],
        },
        {
          id: 'absences',
          title: 'Les absences et justifier un jour',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Sous le registre, Absences liste les techniciens sans aucun pointage un jour ouvrable (du lundi au samedi). Les dimanches, jours fériés et congés approuvés ne comptent pas. Une personne reste absente pour aujourd'hui jusqu'à ce qu'elle pointe." },
            {
              kind: 'steps',
              items: [
                'Trouvez le jour dans la liste Absences.',
                'Cliquez sur Justifier, saisissez le motif (par exemple « Malade, certificat médical reçu ») et enregistrez.',
                'Cliquez sur Annuler la justification pour revenir en arrière.',
              ],
            },
            { kind: 'note', text: "Les absences ne changent la paie de personne. La paie ne les prend pas en compte." },
          ],
        },
        {
          id: 'export-attendance',
          title: 'Télécharger le rapport de présence (PDF ou Excel)',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Sur le registre Présence du personnel, cliquez sur Exporter.',
                "Choisissez les dates, ou un choix rapide : Hier (le rapport journalier), Ce mois-ci ou Tout l'historique.",
                'Cliquez sur Télécharger le PDF ou Télécharger Excel.',
              ],
            },
            { kind: 'p', text: 'Les rapports eux-mêmes sont en anglais, comme ceux de la pointeuse AiFace. Ils contiennent :' },
            {
              kind: 'list',
              items: [
                "Monthly Report : une ligne par personne, dans la présentation de la pointeuse AiFace (Should, Actual, Absence, Late, Leave Early, Holiday, Leave, Overtime, Overtime approved).",
                "Daily Report : les jours de chaque personne avec In1/Out1 à In3/Out3, les minutes de retard et de départ anticipé, et le statut du jour.",
                "Overtime Records : les heures supplémentaires saisies à la main par les RH (seulement s'il y en a).",
                "La liste des visites à vérifier avant de payer : celles restées ouvertes plus de 12 heures, ce qui signifie généralement un départ pointé en retard.",
                "Register : chaque visite, saisie contre enregistrée, avec les lieux GPS.",
              ],
            },
            { kind: 'tip', text: "Le fichier Excel a une feuille par partie, porte l'en-tête de l'entreprise et s'imprime avec les numéros de page." },
          ],
        },
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
                "Actuellement pointés liste qui est présent en ce moment. Une visite ouverte depuis de nombreuses heures est marquée « probablement oubliée ».",
                "Récapitulatif des présences est le Monthly Report d'AiFace. Cliquez sur un nom pour ouvrir le rapport journalier de cette personne.",
                'Registre des présences liste chaque visite jour par jour, avec la photo de pointage et les contrôles de conformité.',
                "Exporter le mois / Exporter la semaine télécharge le rapport Excel, et Télécharger le PDF le PDF, pour la période affichée.",
              ],
            },
          ],
        },
        {
          id: 'close-session',
          title: 'Clôturer un pointage oublié',
          path: '/dashboard/operations/team-attendance',
          blocks: [
            { kind: 'p', text: "Un poste encore ouvert après minuit est clôturé automatiquement à l'heure de fermeture de son propre jour (17:00, ou 13:00 le samedi), et le technicien est prévenu. Vous pouvez en clôturer un vous-même plus tôt, ou corriger l'heure." },
            {
              kind: 'steps',
              items: [
                "Dans Présence de l'équipe, trouvez la visite sous Actuellement pointés.",
                'Cliquez sur Clôturer la session.',
                "Réglez DÉPOINTÉ À sur l'heure réelle de départ. Laisser « maintenant » compte tout ce temps comme des heures sur site.",
                'Ajoutez une note si vous le souhaitez et confirmez.',
              ],
            },
            { kind: 'note', text: "Aucune position n'est enregistrée pour une session que vous clôturez, et la fiche indique qu'elle a été clôturée par la direction." },
          ],
        },
        {
          id: 'field-ops',
          title: 'Opérations terrain et Carte en direct',
          path: '/dashboard/operations/live-map',
          blocks: [
            {
              kind: 'list',
              items: [
                "Opérations terrain liste qui est pointé en ce moment, où il dit être et depuis combien de temps. Demander une vérification lui envoie une notification lui demandant d'ouvrir l'application. Cela ne récupère pas sa position instantanément.",
                "Carte en direct montre toutes les personnes en poste : où elles ont pointé, où elles ont été vues pour la dernière fois et une ligne entre les deux. Vert : près du pointage et vu récemment. Orange : pas vu depuis 45 minutes ou plus, ou une anomalie moyenne. Rouge : à 500 m ou plus du pointage, ou une anomalie grave. Elle se met à jour toutes les 15 secondes.",
                "Sous la carte, PAS ENCORE POINTÉ AUJOURD'HUI liste les techniciens absents jusqu'ici.",
              ],
            },
            { kind: 'note', text: "Un téléphone n'envoie sa position que lorsque l'application est ouverte à l'écran. Un téléphone verrouillé ou une application fermée n'envoie rien : « vu pour la dernière fois » peut donc être ancien sans que rien ne soit anormal." },
          ],
        },
        {
          id: 'checks',
          title: 'Contrôles de conformité et relevés de position',
          blocks: [
            {
              kind: 'list',
              items: [
                "Pendant chaque poste, l'application envoie 2 à 4 notifications à des heures au hasard, demandant au technicien de confirmer qu'il est sur site. Il a 5 minutes pour répondre, et reçoit un second rappel après environ 2 minutes et demie.",
                "Deux contrôles échoués d'affilée (sans réponse, ou répondus loin du pointage) créent une anomalie à examiner.",
                "Tant qu'un technicien a l'application ouverte, elle enregistre aussi sa position toutes les 15 minutes.",
                "Un téléphone dont les notifications sont désactivées apparaît comme « Aucun appareil enregistré ». Cela ne compte pas comme un échec.",
              ],
            },
            { kind: 'note', text: "Ces contrôles sont envoyés par un planificateur externe (cron-job.org). Si les contrôles, les rappels ou les noms de lieux cessent d'apparaître pour tout le monde, le planificateur s'est probablement arrêté : regardez d'abord son historique d'exécution. Il s'est arrêté entre le 29 septembre et le 12 octobre 2026." },
          ],
        },
        {
          id: 'anomalies',
          title: 'Examiner les anomalies de présence',
          path: '/dashboard/operations/anomalies',
          blocks: [
            { kind: 'p', text: "Technet Operations → Anomalies de présence liste ce que l'application n'a pas pu vérifier : loin de l'intervention, pointage près du domicile, déplacement impossible, faux GPS possible, heure ou lieu saisis qui ne correspondent pas, faible précision GPS, relevés manqués ou contrôles de conformité échoués. Chaque fiche montre une petite carte et les détails." },
            {
              kind: 'steps',
              items: [
                "Filtrez par statut, type, gravité, employé ou dates. Ouverte est la file à traiter.",
                'Lisez la fiche et regardez la carte.',
                "Choisissez Confirmer légitime (tout allait bien), Marquer faux positif (la règle s'est trompée), Confirmer la violation (c'était un vrai problème) ou Ignorer. Ajoutez une note si c'est utile.",
                'Annuler remet une décision dans la file.',
              ],
            },
            {
              kind: 'list',
              items: [
                'La gravité est Élevée, Moyenne ou Faible. Une nouvelle anomalie Élevée vous envoie aussi une notification.',
                "Les heures supplémentaires d'un jour avec des anomalies ouvertes affichent un avertissement avant l'approbation.",
                "Les RH ne peuvent pas valider le mois d'une personne tant qu'elle a des anomalies Élevées ouvertes.",
              ],
            },
            { kind: 'note', text: "Une anomalie est une raison de regarder, pas une preuve de faute. Le GPS dérive à l'intérieur des bâtiments, et un nom de lieu saisi comme « Moka » correspond au centre de la zone, à plusieurs kilomètres d'un vrai site." },
          ],
        },
        {
          id: 'known-places',
          title: 'Lieux connus',
          path: '/dashboard/operations/known-places',
          blocks: [
            { kind: 'p', text: "Les lieux connus sont des sites où vos techniciens travaillent vraiment. Un pointage à l'intérieur d'un lieu connu apparaît comme Vérifié. Il n'y a pas de liste à remplir : l'application apprend les lieux à partir des pointages que vous confirmez." },
            {
              kind: 'steps',
              items: [
                'Dans Anomalies de présence, cliquez sur Confirmer légitime pour un pointage.',
                "Choisissez Enregistrer comme nouveau lieu connu, donnez-lui un nom (et un client si vous le souhaitez) et un rayon (250 m convient à la plupart des sites), ou choisissez le lieu existant qui correspond.",
                'Confirmez. Les autres pointages récents au même endroit deviennent aussi Vérifié.',
              ],
            },
            { kind: 'p', text: "Dans Technet Operations → Lieux connus, vous pouvez renommer un lieu, changer son rayon, fusionner des doublons (Fusionner avec…) ou en supprimer un." },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Ordres de travail et rapports',
      topics: [
        {
          id: 'work-orders',
          title: 'Créer et attribuer un ordre de travail',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet Operations → Ordres de travail. Le client doit d'abord exister (Technet ERP → Clients).",
                'Cliquez sur Nouvel ordre de travail.',
                "Choisissez le client et la catégorie de travail, saisissez un titre, une description si besoin et la date prévue, puis choisissez les techniciens.",
                "Cliquez sur Créer l'ordre de travail. Le numéro est attribué automatiquement.",
              ],
            },
            {
              kind: 'list',
              items: [
                "Chaque technicien attribué reçoit une notification, et l'intervention apparaît sous Mes interventions d'aujourd'hui sur son téléphone le jour prévu. Les interventions encore ouvertes des jours précédents restent listées jusqu'à ce qu'elles soient terminées.",
                "Quand un technicien a exactement une intervention ce jour-là, le formulaire de pointage remplit son site et y relie le pointage.",
                "Pour corriger une erreur, utilisez l'action de modification dans la liste des ordres de travail : client, catégorie, titre, description, date et techniciens peuvent tous être changés.",
              ],
            },
          ],
        },
        {
          id: 'work-order-detail',
          title: "Statut d'un ordre de travail et emplacement du site",
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'list',
              items: [
                "Ouvrez un ordre de travail pour le faire avancer : Commencer le travail, En attente de pièces, Reprendre le travail, Marquer comme terminé, et Rouvrir si besoin. Le statut est commun à toutes les personnes attribuées.",
                "Définir l'emplacement du site : tapez une zone, une rue ou une ville (par exemple « Ebene, Mauritius »), pas un nom d'entreprise, puis enregistrez. Le site apparaît alors comme un lien vers la carte et sert à comparer les pointages avec l'intervention.",
                "La page liste aussi les pointages sur site et les rapports d'intervention de l'intervention.",
              ],
            },
            { kind: 'note', text: "La recherche d'adresse utilise les données gratuites d'OpenStreetMap. Les noms d'entreprises et les étages sont rarement trouvés. Utilisez la ville ou la rue." },
          ],
        },
        {
          id: 'daily-reports',
          title: 'Rapports journaliers',
          path: '/dashboard/operations/daily-reports',
          blocks: [
            { kind: 'p', text: "Les techniciens déposent un rapport journalier avec un résumé, leurs heures si besoin, les ordres de travail concernés et jusqu'à 3 photos. Les nouveaux rapports apparaissent EN ATTENTE DE VALIDATION." },
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet Operations → Rapports journaliers. Filtrez par date ou cherchez dans le texte.',
                'Lisez le rapport et ses photos.',
                'Approuvez-le ou refusez-le. Le technicien est prévenu dans les deux cas.',
              ],
            },
          ],
        },
        {
          id: 'intervention-reports',
          title: "Rapports d'intervention",
          path: '/dashboard/operations/intervention-reports',
          blocks: [
            { kind: 'p', text: "Un rapport d'intervention est la fiche de travail d'une visite sur site : client et contact, équipement, panne et travaux effectués, photos avant et après, matériel utilisé, le rapport du technicien et la signature du client." },
            {
              kind: 'list',
              items: [
                "Filtrez par client, statut, type de travail et dates, ou utilisez les boutons 3, 6 et 12 mois pour retrouver vite l'historique d'un client pendant un appel.",
                "Pour refuser un rapport, vous devez écrire un commentaire. Le technicien le voit et peut utiliser Correct and Resubmit.",
                "Sur un rapport, vous pouvez relier un ordre de travail et fixer un rappel de suivi. Le rapport apparaît alors sous RAPPELS À FAIRE une fois la date passée. Aucun e-mail ni SMS n'est envoyé.",
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'hr',
      title: 'Technet HR',
      intro: 'Tout ce qui concerne les personnes : fiches employés, congés, heures supplémentaires, validation de fin de mois, paie, certifications et disponibilité.',
      topics: [
        {
          id: 'hr-overview',
          title: "Vue d'ensemble RH",
          path: '/dashboard/hr',
          blocks: [
            { kind: 'p', text: "La Vue d'ensemble de Technet HR montre ce qui demande une action : l'effectif actif, qui est en congé aujourd'hui, les congés en attente d'approbation, les heures supplémentaires en attente ce mois-ci, la présence du mois dernier à valider et les certifications qui expirent dans les 60 prochains jours." },
          ],
        },
        {
          id: 'employees',
          title: 'Les fiches employés',
          path: '/dashboard/hr/employees',
          blocks: [
            {
              kind: 'list',
              items: [
                'Add Employee crée une fiche. Le code employé est attribué automatiquement.',
                "Ouvrez un employé pour modifier ses informations, relier son compte, fixer un salaire de base pour la paie et voir ses certifications.",
                "Domicile (RH uniquement) : son adresse personnelle. Un pointage à moins de 300 m de celle-ci crée une anomalie « pointage près du domicile », sauf s'il a une intervention près de chez lui ce jour-là. L'adresse n'est jamais montrée en dehors des RH.",
                "Documents personnels : les documents que l'employé a ajoutés lui-même (pièce d'identité, permis, certificats). Vous pouvez les voir et les télécharger.",
              ],
            },
          ],
        },
        {
          id: 'leave-approvals',
          title: 'Approuver les congés',
          path: '/dashboard/leave-approvals',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez Validation des congés dans le menu. En attente de validation liste les demandes qui attendent une décision.",
                "Approuvez ou refusez chacune. Si la personne n'a pas assez de solde, vous êtes averti et pouvez cliquer sur Approuver quand même.",
                "L'onglet Approuvés liste les congés approuvés. Vous pouvez les modifier, ou les annuler pour rendre les jours au solde.",
              ],
            },
            { kind: 'tip', text: "Technet HR → Congés montre toutes les demandes quel que soit leur statut, et permet de Saisir un congé pour quelqu'un." },
          ],
        },
        {
          id: 'leave-setup',
          title: 'Types de congé, soldes et jours fériés',
          path: '/dashboard/hr/leave',
          blocks: [
            {
              kind: 'list',
              items: [
                "Types de congé : cliquez sur Utiliser les valeurs par défaut de Maurice pour commencer, ou sur Ajouter un type de congé. Chaque type a un code, un nombre de jours par an, et indique s'il est payé et si des justificatifs sont demandés. Une fois un type utilisé, désactivez-le (décochez Actif) au lieu de le supprimer.",
                "Soldes : cliquez sur Générer les soldes (suivi de l'année, par exemple Générer les soldes 2026) pour créer les droits de chacun, puis ajustez si besoin les jours acquis ou reportés d'une personne. Les jours pris ne changent que lorsqu'un congé est approuvé ou annulé.",
                "Jours fériés : ajoutez les jours fériés de l'année. Ils sont exclus des jours ouvrables des congés et de la paie, des absences et des rapports. Les fêtes lunaires marquées « (unconfirmed) » sont des estimations : corrigez la date dès qu'elle est annoncée.",
              ],
            },
          ],
        },
        {
          id: 'overtime',
          title: 'Approuver les heures supplémentaires',
          path: '/dashboard/hr/overtime',
          blocks: [
            { kind: 'p', text: "Les heures supplémentaires sont calculées à partir des pointages : à partir de 17:30 en semaine et 13:30 le samedi, jusqu'à l'heure de départ saisie par le technicien sur sa dernière visite du jour. Tout le travail du dimanche compte. Chaque jour reste en attente jusqu'à son approbation ou son refus, et seules les heures approuvées comptent." },
            {
              kind: 'steps',
              items: [
                'Ouvrez Technet HR → Heures sup. Les jours en attente sont affichés en premier. Les flèches changent de mois.',
                "Regardez les avertissements : des anomalies ce jour-là, ou une visite restée ouverte plus de 12 heures (un départ pointé en retard gonfle les heures supplémentaires).",
                "Cliquez sur Approuver, ou sur Refuser avec un motif facultatif. Le technicien est prévenu.",
                'Annuler remet un jour décidé en attente.',
              ],
            },
            { kind: 'tip', text: "Anomalies de données de présence, en bas de la page, liste les fiches qui semblent fausses sur toute la période (un départ avant l'arrivée, des sessions qui se chevauchent, plus de 12 heures supplémentaires en un jour). Rien n'y est modifié automatiquement." },
          ],
        },
        {
          id: 'overtime-records',
          title: 'Saisir des heures supplémentaires à la main',
          path: '/dashboard/hr/overtime',
          blocks: [
            { kind: 'p', text: "Comme les Overtime Records du logiciel AiFace, vous pouvez saisir vous-même des heures supplémentaires, par exemple une intervention de nuit ou un jour où le chiffre de l'application est faux. Une saisie remplace les heures calculées par l'application pour cette personne et ce jour, compte comme approuvée et vous indique comme approbateur." },
            {
              kind: 'steps',
              items: [
                "Dans Technet HR → Heures sup., cliquez sur Ajouter un enregistrement. Ou, sur un jour en attente, cliquez sur Saisir à la place pour remplacer le chiffre calculé de ce jour.",
                "Choisissez l'employé et la date, le type (Normal, Jour de repos ou Jour férié), l'heure de début et de fin et un motif. Une heure de fin plus tôt que le début compte comme le lendemain.",
                "Cliquez sur Enregistrer. L'employé est prévenu.",
              ],
            },
            {
              kind: 'list',
              items: [
                "Les saisies portent un badge Saisie manuelle. Choisissez Saisies manuelles dans le filtre de statut pour ne lister qu'elles.",
                "Modifier change une saisie. Supprimer l'enregistrement la retire, et le jour revient à ses heures calculées, en attente.",
                'Les saisies apparaissent dans leur propre partie Overtime Records des rapports PDF et Excel.',
              ],
            },
          ],
        },
        {
          id: 'validations',
          title: "Valider la présence d'un mois",
          path: '/dashboard/hr/validations',
          blocks: [
            { kind: 'p', text: "À la fin de chaque mois, les RH confirment la présence de chaque employé. Jusque-là, le PDF de présence qu'un technicien télécharge porte la mention BROUILLON." },
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet HR → Validations. La page s'ouvre sur le mois dernier. Un mois peut être validé à partir de son dernier jour.",
                "Ouvrez le PDF d'une personne pour le vérifier, puis cliquez sur Valider, ou sur Tout valider pour tout le monde.",
                'Annuler retire une validation.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Une personne avec des anomalies Élevées ouvertes ne peut pas être validée avant leur examen. Tout valider l'ignore et indique combien de personnes ont été ignorées.",
                "Si une visite ou des heures supplémentaires approuvées changent après la validation, la ligne indique « Modifié depuis la validation » et le PDF redevient BROUILLON. Validez à nouveau.",
              ],
            },
          ],
        },
        {
          id: 'payroll',
          title: 'La paie',
          path: '/dashboard/hr/payroll',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Vérifiez que chaque employé à payer a un salaire de base sur sa fiche.',
                "Ouvrez Technet HR → Paie, choisissez le mois et l'année et cliquez sur Traiter la paie.",
                "Ouvrez le traitement pour voir, pour chaque personne, le salaire de base, les heures, les heures supplémentaires, les congés sans solde, la retenue et le net à payer.",
              ],
            },
            {
              kind: 'note',
              text: "Le net à payer est le salaire de base moins une retenue pour les congés sans solde approuvés. Les heures (issues des pointages) et les heures supplémentaires approuvées sont affichées mais pas payées, car aucun taux d'heures supplémentaires n'a été fixé. Les employés sans salaire de base sont laissés de côté. Les départs oubliés gonflent les heures.",
            },
          ],
        },
        {
          id: 'certifications',
          title: 'Certifications et formations',
          path: '/dashboard/hr/certifications',
          blocks: [
            { kind: 'p', text: "Technet HR → Certifications liste les certifications de chaque personne avec leur date d'expiration, ainsi que ses formations. Utilisez Add Certification ou Record Training. Les certifications qui expirent dans les 60 prochains jours apparaissent dans la Vue d'ensemble RH." },
          ],
        },
        {
          id: 'availability',
          title: 'Disponibilité',
          path: '/dashboard/hr/availability',
          blocks: [
            { kind: 'p', text: 'Technet HR → Disponibilité répartit les personnes, pour un jour donné, en Disponible, En congé et Absent.' },
            { kind: 'note', text: "La disponibilité lit les congés approuvés et l'ancien registre manuel du bureau, pas les pointages. Toute personne absente de ce registre apparaît comme Disponible. Pour savoir qui est vraiment sur le terrain, utilisez Opérations terrain ou la Carte en direct." },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Technet Store',
      intro: "Les outils et équipements sont suivis un par un. Le matériel comme la colle, le ruban ou les vis est suivi en quantité. Les administrateurs et le magasinier gèrent le magasin. Toute personne ayant une fiche employé peut faire des demandes.",
      topics: [
        {
          id: 'tools',
          title: 'Outils & équipements',
          path: '/dashboard/store/tools',
          blocks: [
            {
              kind: 'list',
              items: [
                "Ajouter un outil enregistre un outil. Un numéro d'étiquette (TL-0001, TL-0002…) est attribué automatiquement : inscrivez-le sur l'outil.",
                "Le registre montre le statut de chaque outil (Disponible, Sorti, En réparation, Retiré), qui l'a et quand il doit revenir. Les outils en retard sont signalés.",
                "Marquer rendu enregistre un retour et son état. Un outil rendu Endommagé passe En réparation jusqu'à ce que vous le remettiez Disponible.",
                "Historique montre chaque sortie d'un outil. Un outil déjà sorti au moins une fois ne peut pas être supprimé : retirez-le à la place.",
              ],
            },
          ],
        },
        {
          id: 'tool-requests',
          title: "Demandes d'outils",
          path: '/dashboard/store/requests',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouvrez Technet Store → Demandes d'outils. Les demandes En attente attendent le magasin.",
                "Cliquez sur Sortir, cochez les outils disponibles que vous remettez, fixez si besoin une date de retour et confirmez. Ou cliquez sur Refuser avec un motif facultatif.",
                "La personne qui a demandé est prévenue, et les outils apparaissent sous Mes outils sur son écran.",
              ],
            },
          ],
        },
        {
          id: 'materials',
          title: 'Le matériel et les demandes de matériel',
          path: '/dashboard/store/stock',
          blocks: [
            {
              kind: 'list',
              items: [
                "Matériel : Ajouter du matériel avec un nom, une unité (tube, rouleau, boîte…), un stock de départ et un stock minimum. Au minimum ou en dessous, il apparaît comme Bas.",
                "Le stock ne change que par Ajouter du stock (une livraison), Corriger le stock (après un inventaire) et la remise d'une demande. Historique liste chaque changement et qui l'a fait.",
                "Demandes de matériel : cliquez sur Remettre, associez chaque ligne à un article en stock et fixez la quantité. Tout sort du stock en une fois. Utilisez « Hors stock » pour ce qui a été acheté spécialement. La remise est refusée s'il manque quelque chose.",
              ],
            },
            { kind: 'note', text: "Le matériel du magasin est séparé de l'Inventaire de l'ERP. Ils ne sont pas reliés." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp',
      title: 'Technet ERP',
      intro: "Clients et devis, achats, inventaire, projets et documents. Les factures et les dépenses sont tenues dans QuickBooks, pas dans cette application. Les pages de l'ERP ne sont pas encore traduites : leurs boutons sont nommés ici en anglais.",
      topics: [
        {
          id: 'customers',
          title: 'Les clients et leur accès au portail',
          path: '/dashboard/erp/customers',
          blocks: [
            {
              kind: 'list',
              items: [
                "Technet ERP → Clients → Add Customer crée un client (nom, société, coordonnées, BRN, numéro de TVA, adresse).",
                "L'accès au portail donne à un client son propre compte sur Technet Connect, où il voit ses devis et l'avancement de ses interventions et peut demander un devis. Cliquez sur Grant portal access, saisissez son e-mail et donnez-lui le mot de passe affiché. Vous pouvez le réinitialiser ou le retirer plus tard.",
              ],
            },
          ],
        },
        {
          id: 'quote-requests',
          title: 'Le Call Log (demandes de devis)',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            { kind: 'p', text: "L'onglet Call Log de la page Devis contient les demandes de devis : celles qu'un client a envoyées depuis le portail, et celles que le personnel a notées après un appel ou un e-mail." },
            {
              kind: 'steps',
              items: [
                "Cliquez sur Log a Request et indiquez le client (ou le nom d'une société s'il est nouveau) et ce qu'il demande.",
                "Ajoutez une note de statut pour que les autres voient pourquoi la demande attend encore (par exemple « en attente des prix du fournisseur »).",
                "Envoyez un accusé de réception : modifiez l'e-mail, puis Save Draft ou Send. Send ouvre votre messagerie avec le texte déjà rempli.",
                'Convert to Quotation transforme la demande en devis brouillon, ou Decline la clôture.',
              ],
            },
            { kind: 'note', text: "Une demande qui n'a pas reçu d'accusé de réception, n'a pas été convertie ni refusée dans les 24 heures est marquée OVERDUE." },
          ],
        },
        {
          id: 'quotations',
          title: 'Les devis',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Cliquez sur New Quotation. Choisissez le client, saisissez le titre et la personne à contacter, et ajoutez les lignes (les boutons Labor et Transport ajoutent les lignes courantes).",
                "Fixez les conditions de paiement (les lignes doivent faire 100 % au total), la validité en jours (15 par défaut) et la disponibilité.",
                "Enregistrez. Le numéro du devis est attribué automatiquement et il commence en brouillon.",
                "Ouvrez-le pour vérifier, puis Download PDF ou Email Customer.",
                "Utilisez Mark as Sent une fois envoyé, puis Mark Approved, Mark Not Approved ou Mark Expired.",
              ],
            },
            {
              kind: 'list',
              items: [
                "Le client, les conditions et les lignes ne se modifient que tant que le devis est un brouillon.",
                "Follow-Up, sur le devis, note chaque appel : date, interlocuteur et résultat. Notez-y aussi le bon de commande ou la référence de confirmation du client.",
                'Attachments contient les fichiers liés au devis.',
                "Seul un administrateur peut ajouter un nouveau libellé de conditions de paiement. Les autres choisissent parmi les libellés déjà utilisés.",
              ],
            },
            { kind: 'note', text: "Email Customer télécharge le PDF et ouvre un e-mail avec le texte prêt. Un navigateur ne peut pas joindre le fichier à votre place : joignez vous-même le PDF téléchargé avant d'envoyer." },
          ],
        },
        {
          id: 'follow-up-contracts',
          title: 'Suivi et contrats',
          path: '/dashboard/erp/customers/follow-up',
          blocks: [
            {
              kind: 'list',
              items: [
                'Suivi liste les appels notés sur les devis, par client ou par date.',
                "Contrats : New Contract enregistre un contrat de service avec un client, sa valeur et ses dates de début et de fin.",
              ],
            },
          ],
        },
        {
          id: 'procurement',
          title: "Achats : demandes d'achat et bons de commande",
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Fournisseurs : Add Supplier avec les coordonnées et les conditions de paiement (par exemple « Net 30 »).",
                "Demandes d'achat : New Requisition liste ce qu'il faut. Ouvrez-la pour Approve ou Reject.",
                "Une demande approuvée peut être convertie : Convert to Purchase Order, en choisissant le fournisseur et les coûts unitaires.",
                "Bons de commande : ouvrez le bon et cliquez sur Send to Supplier une fois envoyé.",
                "À l'arrivée des marchandises, cliquez sur Record Receipt et saisissez les quantités reçues. Les articles liés à l'inventaire sont ajoutés au stock automatiquement. Le bon apparaît partiellement ou entièrement reçu.",
                'Une fois tout arrivé, cliquez sur Close Order.',
              ],
            },
            { kind: 'tip', text: "Cancel Order arrête un bon encore en brouillon, ou envoyé mais dont rien n'est encore arrivé." },
          ],
        },
        {
          id: 'inventory-projects-docs',
          title: 'Inventaire, projets et documents',
          blocks: [
            {
              kind: 'list',
              items: [
                "Inventaire : Add Item, puis Adjust stock pour les mouvements. Le Stock Ledger les liste. Le stock bas est signalé au niveau minimum.",
                'Projets : New Project avec le client, le responsable, les dates et le budget.',
                "Documents : Upload Document range un fichier dans une catégorie (contrat, RH, projet, devis…) et peut le relier à un client ou à un projet.",
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'other-modules',
      title: 'Connect, Marketing et Insight',
      topics: [
        {
          id: 'connect',
          title: 'Technet Connect (le portail client)',
          path: '/dashboard/connect',
          blocks: [
            { kind: 'p', text: "Les clients à qui vous donnez un accès se connectent au portail client et voient leurs propres devis et l'avancement de leurs interventions, et peuvent demander un devis. Les brouillons, les données GPS et les noms des techniciens ne leur sont jamais montrés. Leurs demandes de devis arrivent dans le Call Log." },
          ],
        },
        {
          id: 'marketing',
          title: 'Technet Digital Marketing',
          path: '/dashboard/marketing',
          blocks: [
            {
              kind: 'list',
              items: [
                "Campagnes : Add Campaign, puis ouvrez-la et cliquez sur Add Post pour chaque publication (titre, réseau, texte, date).",
                'Content Calendar liste toutes les publications prévues de toutes les campagnes, avec des filtres.',
                'Après avoir publié vous-même sur le réseau social, cliquez ici sur Mark Posted.',
              ],
            },
            { kind: 'note', text: "L'application ne publie pas sur les réseaux sociaux et n'écrit pas les publications à votre place. C'est une liste de planification." },
          ],
        },
        {
          id: 'insight',
          title: 'Technet Insight',
          path: '/dashboard/insight',
          blocks: [
            { kind: 'p', text: "Technet Insight, réservé aux administrateurs, montre l'entreprise d'un coup d'œil : projets actifs, ordres de travail actifs, articles en stock bas, demandes d'outils en attente et techniciens sur site." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'automatic',
      title: "Ce que l'application fait seule",
      topics: [
        {
          id: 'automatic-list',
          title: 'Rappels et nettoyage automatiques',
          blocks: [
            {
              kind: 'list',
              items: [
                "08:15 et 17:15, du lundi au samedi : un rappel aux techniciens qui n'ont pas pointé leur arrivée, ou qui sont encore pointés. Chacun peut les désactiver. Les contrôles de conformité ne peuvent pas être désactivés.",
                'Après 14 heures de pointage : un rappel « toujours pointé ? ».',
                "Après minuit : un poste encore ouvert est clôturé automatiquement à l'heure de fermeture de son jour.",
                'Les photos de pointage sont supprimées automatiquement après 90 jours.',
                "Quand un technicien pointe son départ avec des heures supplémentaires, les RH sont prévenues qu'elles sont à approuver.",
              ],
            },
            { kind: 'note', text: "Les rappels, les contrôles de conformité et les noms de lieux dépendent du planificateur cron-job.org. S'ils s'arrêtent tous, regardez son historique d'exécution." },
          ],
        },
      ],
    },
  ],
}
