import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Language = "fr" | "en" | "es" | "de";

export const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "fr", label: "Francais" },
  { value: "en", label: "English" },
  { value: "es", label: "Espanol" },
  { value: "de", label: "Deutsch" },
];

export const languageNames: Record<Language, string> = {
  fr: "Francais",
  en: "English",
  es: "Espanol",
  de: "Deutsch",
};

type Dictionary = {
  appName: string;
  navHome: string;
  navShop: string;
  navLibrary: string;
  navEngine: string;
  signOut: string;
  connected: string;
  buildChannel: string;
  languageLabel: string;
  shopTitle: string;
  shopDescription: string;
  libraryTitle: string;
  libraryDescription: string;
  engineTitle: string;
  engineDescription: string;
  switchLanguageNotification: string;
  languageToggle: string;
  languageSwitchedTitle: string;
  languageNowEnglish: string;
  languageNowFrench: string;
  closeNotificationAria: string;
  launching: string;
  updateDownloading: string;
  updateIsAvailable: string;
  updateCurrentVersionLabel: string;
  updateCheckFailed: string;
  updateNow: string;
  statsGamesInLibrary: string;
  statsActiveDownloads: string;
  statsFriendsOnline: string;
  statsWeeklyGift: string;
  freeLabel: string;
  releaseNotes: string;
  newRelease: string;
  engineAvailable: string;
  homeHeroDescription: string;
  downloadNow: string;
  featuredAndFree: string;
  seeAll: string;
  featuredMainTitle: string;
  featuredMainSubtitle: string;
  freeThisWeek: string;
  onSaleNow: string;
  browseDeals: string;
  authLoginLoadingText: string;
  authLoginLoadingSubtext: string;
  authLoginSuccessText: string;
  authLoginSuccessSubtext: string;
  authLoginErrorText: string;
  authLoginErrorSubtext: string;
  authEmailLabel: string;
  authEmailPlaceholder: string;
  authPasswordLabel: string;
  authPasswordPlaceholder: string;
  authForgotPassword: string;
  authSignIn: string;
  authOr: string;
  authContinueWithGithub: string;
  authRegisterLoadingText: string;
  authRegisterLoadingSubtext: string;
  authRegisterSuccessText: string;
  authRegisterSuccessSubtext: string;
  authRegisterErrorText: string;
  authRegisterErrorSubtext: string;
  authUsernameLabel: string;
  authUsernamePlaceholder: string;
  authConfirmPasswordLabel: string;
  authPasswordsDoNotMatch: string;
  authCreateAccount: string;
  authNoAccount: string;
  authCreateOne: string;
  authAlreadyHaveAccount: string;
  authRememberMe: string;
  navProfile: string;
  profileMemberSince: string;
  profileGamesOwned: string;
  profileTotalPlaytime: string;
  profileHours: string;
  profileAchievements: string;
  profileEditDisplayName: string;
  profileSaveChanges: string;
  navFriends: string;
  friendsTitle: string;
  friendsAdd: string;
  friendsAddPlaceholder: string;
  friendsNoFriends: string;
  friendsOnline: string;
  friendsOffline: string;
  friendsMessagePlaceholder: string;
  friendsChatStart: string;
  friendsTabFriends: string;
  friendsTabRequests: string;
  friendsRequestsEmpty: string;
  friendsAccept: string;
  friendsDecline: string;
  friendsRemove: string;
  // Voice call screen share & volume
  callPickScreen: string;
  callScreensTab: string;
  callAppsTab: string;
  callShareAudio: string;
  callAudioVolume: string;
  callSharingFrom: string;
  callHideView: string;
  callMinimize: string;
  callMaximize: string;
  callParticipants: string;
  friendPlaying: string;
  overlayMsgReply: string;
  overlaySend: string;
};

const dictionaries: Record<Language, Dictionary> = {
  fr: {
    appName: "PlanetForge Launcher",
    navHome: "Home",
    navShop: "Boutique",
    navLibrary: "Bibliotheque",
    navEngine: "PlanetForge Engine",
    signOut: "Se déconnecter",
    connected: "Connecté",
    buildChannel: "Canal: stable",
    languageLabel: "Langue",
    shopTitle: "Boutique",
    shopDescription: "Découvrez les offres, bundles et sorties de la semaine.",
    libraryTitle: "Bibliotheque",
    libraryDescription: "Retrouvez vos jeux installes, mises a jour et contenus.",
    engineTitle: "PlanetForge Engine",
    engineDescription: "Gerez les versions de l'engine, templates et outils.",
    switchLanguageNotification: "Langue changée en Français",
    languageToggle: "Changer en Anglais",
    languageSwitchedTitle: "Langue changee",
    languageNowEnglish: "Langue actuelle: Anglais",
    languageNowFrench: "Langue actuelle: Francais",
    closeNotificationAria: "Fermer la notification",
    launching: "Lancement...",
    updateDownloading: "Telechargement...",
    updateIsAvailable: "est disponible",
    updateCurrentVersionLabel: "actuelle",
    updateCheckFailed: "Echec de verification des mises a jour",
    updateNow: "Mettre a jour",
    statsGamesInLibrary: "Jeux dans la bibliotheque",
    statsActiveDownloads: "Telechargements actifs",
    statsFriendsOnline: "Amis en ligne",
    statsWeeklyGift: "Cadeau hebdo",
    freeLabel: "Gratuit",
    releaseNotes: "Notes de version",
    newRelease: "Nouvelle sortie",
    engineAvailable: "PlanetForge Engine 1.7 est disponible",
    homeHeroDescription: "Teleportation de maps, compilation GPU optimisee et pipeline Vulkan stable.",
    downloadNow: "Telecharger",
    featuredAndFree: "A la une et gratuits",
    seeAll: "Voir tout",
    featuredMainTitle: "PlanetForge Arena",
    featuredMainSubtitle: "Disponible gratuitement cette semaine",
    freeThisWeek: "Gratuit cette semaine",
    onSaleNow: "Promos du moment",
    browseDeals: "Voir les offres",
    authLoginLoadingText: "Authentification...",
    authLoginLoadingSubtext: "Connexion a PlanetForge",
    authLoginSuccessText: "Bon retour!",
    authLoginSuccessSubtext: "Ouverture du launcher...",
    authLoginErrorText: "Connexion echouee",
    authLoginErrorSubtext: "Email ou mot de passe invalide",
    authEmailLabel: "Email",
    authEmailPlaceholder: "you@example.com",
    authPasswordLabel: "Mot de passe",
    authPasswordPlaceholder: "........",
    authForgotPassword: "Mot de passe oublie ?",
    authSignIn: "Se connecter",
    authOr: "ou",
    authContinueWithGithub: "Continuer avec GitHub",
    authRegisterLoadingText: "Creation du compte...",
    authRegisterLoadingSubtext: "Configuration de votre profil",
    authRegisterSuccessText: "Compte cree !",
    authRegisterSuccessSubtext: "Bienvenue sur PlanetForge",
    authRegisterErrorText: "Inscription echouee",
    authRegisterErrorSubtext: "Email ou pseudo deja utilise",
    authUsernameLabel: "Pseudo",
    authUsernamePlaceholder: "MonPseudo42",
    authConfirmPasswordLabel: "Confirmer le mot de passe",
    authPasswordsDoNotMatch: "Les mots de passe ne correspondent pas",
    authCreateAccount: "Creer un compte",
    authNoAccount: "Pas de compte ?",
    authCreateOne: "En creer un",
    authAlreadyHaveAccount: "Vous avez deja un compte ?",
    authRememberMe: "Rester connecte",
    navProfile: "Profil",
    profileMemberSince: "Membre depuis",
    profileGamesOwned: "Jeux possedes",
    profileTotalPlaytime: "Temps de jeu",
    profileHours: "h",
    profileAchievements: "Succes",
    profileEditDisplayName: "Modifier le pseudo",
    profileSaveChanges: "Enregistrer",
    navFriends: "Amis",
    friendsTitle: "Amis",
    friendsAdd: "Ajouter un ami",
    friendsAddPlaceholder: "Code ami (ex: ABCD-1234)",
    friendsNoFriends: "Aucun ami pour l'instant",
    friendsOnline: "En ligne",
    friendsOffline: "Hors ligne",
    friendsMessagePlaceholder: "Message...",
    friendsChatStart: "Debut de la conversation",
    friendsTabFriends: "Amis",
    friendsTabRequests: "Demandes",
    friendsRequestsEmpty: "Aucune demande",
    friendsAccept: "Accepter",
    friendsDecline: "Refuser",
    friendsRemove: "Retirer",
    callPickScreen: "Choisir quoi partager",
    callScreensTab: "Écrans",
    callAppsTab: "Applications",
    callShareAudio: "Inclure le son du bureau",
    callAudioVolume: "Volume audio",
    callSharingFrom: "partage son écran",
    callHideView: "Fermer la vue",
    callMinimize: "Réduire",
    callMaximize: "Agrandir",
    callParticipants: "Participants",
    friendPlaying: "joue à",
    overlayMsgReply: "Répondre...",
    overlaySend: "Envoyer",
  },
  en: {
    appName: "PlanetForge Launcher",
    navHome: "Home",
    navShop: "Shop",
    navLibrary: "Library",
    navEngine: "PlanetForge Engine",
    signOut: "Sign out",
    connected: "Connected",
    buildChannel: "Channel: stable",
    languageLabel: "Language",
    shopTitle: "Shop",
    shopDescription: "Discover weekly offers, bundles, and new releases.",
    libraryTitle: "Library",
    libraryDescription: "Manage your installed games, updates, and content.",
    engineTitle: "PlanetForge Engine",
    engineDescription: "Manage engine versions, templates, and toolchains.",
    switchLanguageNotification: "Language switched to English",
    languageToggle: "Switch to French",
    languageSwitchedTitle: "Language switched",
    languageNowEnglish: "Current language: English",
    languageNowFrench: "Current language: French",
    closeNotificationAria: "Close notification",
    launching: "Launching...",
    updateDownloading: "Downloading...",
    updateIsAvailable: "is available",
    updateCurrentVersionLabel: "current",
    updateCheckFailed: "Update check failed",
    updateNow: "Update now",
    statsGamesInLibrary: "Games in library",
    statsActiveDownloads: "Active downloads",
    statsFriendsOnline: "Friends online",
    statsWeeklyGift: "Weekly gift",
    freeLabel: "Free",
    releaseNotes: "Release notes",
    newRelease: "New release",
    engineAvailable: "PlanetForge Engine 1.7 is available",
    homeHeroDescription: "Map streaming, optimized GPU compilation, and a stable Vulkan pipeline.",
    downloadNow: "Download now",
    featuredAndFree: "Featured and free",
    seeAll: "See all",
    featuredMainTitle: "PlanetForge Arena",
    featuredMainSubtitle: "Available free this week",
    freeThisWeek: "Free this week",
    onSaleNow: "On sale now",
    browseDeals: "Browse deals",
    authLoginLoadingText: "Authenticating...",
    authLoginLoadingSubtext: "Connecting to PlanetForge",
    authLoginSuccessText: "Welcome back!",
    authLoginSuccessSubtext: "Launching your launcher...",
    authLoginErrorText: "Login failed",
    authLoginErrorSubtext: "Invalid email or password",
    authEmailLabel: "Email",
    authEmailPlaceholder: "you@example.com",
    authPasswordLabel: "Password",
    authPasswordPlaceholder: "........",
    authForgotPassword: "Forgot password?",
    authSignIn: "Sign in",
    authOr: "or",
    authContinueWithGithub: "Continue with GitHub",
    authRegisterLoadingText: "Creating your account...",
    authRegisterLoadingSubtext: "Setting up your profile",
    authRegisterSuccessText: "Account created!",
    authRegisterSuccessSubtext: "Welcome to PlanetForge",
    authRegisterErrorText: "Registration failed",
    authRegisterErrorSubtext: "Email or username already taken",
    authUsernameLabel: "Username",
    authUsernamePlaceholder: "MyUsername42",
    authConfirmPasswordLabel: "Confirm password",
    authPasswordsDoNotMatch: "Passwords do not match",
    authCreateAccount: "Create account",
    authNoAccount: "No account?",
    authCreateOne: "Create one",
    authAlreadyHaveAccount: "Already have an account?",
    authRememberMe: "Stay signed in",
    navProfile: "Profile",
    profileMemberSince: "Member since",
    profileGamesOwned: "Games owned",
    profileTotalPlaytime: "Total playtime",
    profileHours: "h",
    profileAchievements: "Achievements",
    profileEditDisplayName: "Edit display name",
    profileSaveChanges: "Save",
    navFriends: "Friends",
    friendsTitle: "Friends",
    friendsAdd: "Add a friend",
    friendsAddPlaceholder: "Friend code (ex: ABCD-1234)",
    friendsNoFriends: "No friends yet",
    friendsOnline: "Online",
    friendsOffline: "Offline",
    friendsMessagePlaceholder: "Message...",
    friendsChatStart: "Start of conversation",
    friendsTabFriends: "Friends",
    friendsTabRequests: "Requests",
    friendsRequestsEmpty: "No requests",
    friendsAccept: "Accept",
    friendsDecline: "Decline",
    friendsRemove: "Remove",
    callPickScreen: "Choose what to share",
    callScreensTab: "Screens",
    callAppsTab: "Applications",
    callShareAudio: "Include desktop audio",
    callAudioVolume: "Audio volume",
    callSharingFrom: "is sharing their screen",
    callHideView: "Hide view",
    callMinimize: "Minimize",
    callMaximize: "Maximize",
    callParticipants: "Participants",
    friendPlaying: "is playing",
    overlayMsgReply: "Reply...",
    overlaySend: "Send",
  },
  es: {
    appName: "PlanetForge Launcher",
    navHome: "Inicio",
    navShop: "Tienda",
    navLibrary: "Biblioteca",
    navEngine: "PlanetForge Engine",
    signOut: "Cerrar sesion",
    connected: "Conectado",
    buildChannel: "Canal: estable",
    languageLabel: "Idioma",
    shopTitle: "Tienda",
    shopDescription: "Descubre ofertas semanales, bundles y nuevos lanzamientos.",
    libraryTitle: "Biblioteca",
    libraryDescription: "Administra tus juegos instalados, actualizaciones y contenido.",
    engineTitle: "PlanetForge Engine",
    engineDescription: "Administra versiones del engine, plantillas y herramientas.",
    switchLanguageNotification: "Idioma cambiado a Espanol",
    languageToggle: "Cambiar idioma",
    languageSwitchedTitle: "Idioma cambiado",
    languageNowEnglish: "Idioma actual: Ingles",
    languageNowFrench: "Idioma actual: Frances",
    closeNotificationAria: "Cerrar notificacion",
    launching: "Iniciando...",
    updateDownloading: "Descargando...",
    updateIsAvailable: "esta disponible",
    updateCurrentVersionLabel: "actual",
    updateCheckFailed: "La verificacion de actualizaciones fallo",
    updateNow: "Actualizar ahora",
    statsGamesInLibrary: "Juegos en la biblioteca",
    statsActiveDownloads: "Descargas activas",
    statsFriendsOnline: "Amigos en linea",
    statsWeeklyGift: "Regalo semanal",
    freeLabel: "Gratis",
    releaseNotes: "Notas de version",
    newRelease: "Nuevo lanzamiento",
    engineAvailable: "PlanetForge Engine 1.7 esta disponible",
    homeHeroDescription: "Streaming de mapas, compilacion GPU optimizada y pipeline Vulkan estable.",
    downloadNow: "Descargar ahora",
    featuredAndFree: "Destacados y gratis",
    seeAll: "Ver todo",
    featuredMainTitle: "PlanetForge Arena",
    featuredMainSubtitle: "Disponible gratis esta semana",
    freeThisWeek: "Gratis esta semana",
    onSaleNow: "En oferta ahora",
    browseDeals: "Ver ofertas",
    authLoginLoadingText: "Autenticando...",
    authLoginLoadingSubtext: "Conectando con PlanetForge",
    authLoginSuccessText: "Bienvenido de nuevo!",
    authLoginSuccessSubtext: "Abriendo tu launcher...",
    authLoginErrorText: "Error de inicio de sesion",
    authLoginErrorSubtext: "Email o contrasena invalido",
    authEmailLabel: "Email",
    authEmailPlaceholder: "you@example.com",
    authPasswordLabel: "Contrasena",
    authPasswordPlaceholder: "........",
    authForgotPassword: "Olvidaste tu contrasena?",
    authSignIn: "Iniciar sesion",
    authOr: "o",
    authContinueWithGithub: "Continuar con GitHub",
    authRegisterLoadingText: "Creando tu cuenta...",
    authRegisterLoadingSubtext: "Configurando tu perfil",
    authRegisterSuccessText: "Cuenta creada!",
    authRegisterSuccessSubtext: "Bienvenido a PlanetForge",
    authRegisterErrorText: "Registro fallido",
    authRegisterErrorSubtext: "Email o usuario ya en uso",
    authUsernameLabel: "Usuario",
    authUsernamePlaceholder: "MiUsuario42",
    authConfirmPasswordLabel: "Confirmar contrasena",
    authPasswordsDoNotMatch: "Las contrasenas no coinciden",
    authCreateAccount: "Crear cuenta",
    authNoAccount: "No tienes cuenta?",
    authCreateOne: "Crear una",
    authAlreadyHaveAccount: "Ya tienes cuenta?",
    authRememberMe: "Mantener sesion",
    navProfile: "Perfil",
    profileMemberSince: "Miembro desde",
    profileGamesOwned: "Juegos",
    profileTotalPlaytime: "Tiempo de juego",
    profileHours: "h",
    profileAchievements: "Logros",
    profileEditDisplayName: "Editar nombre",
    profileSaveChanges: "Guardar",
    navFriends: "Amigos",
    friendsTitle: "Amigos",
    friendsAdd: "Agregar amigo",
    friendsAddPlaceholder: "Codigo amigo (ej: ABCD-1234)",
    friendsNoFriends: "Sin amigos aun",
    friendsOnline: "En linea",
    friendsOffline: "Desconectado",
    friendsMessagePlaceholder: "Mensaje...",
    friendsChatStart: "Inicio de la conversacion",
    friendsTabFriends: "Amigos",
    friendsTabRequests: "Solicitudes",
    friendsRequestsEmpty: "Sin solicitudes",
    friendsAccept: "Aceptar",
    friendsDecline: "Rechazar",
    friendsRemove: "Eliminar",
    callPickScreen: "Elegir qué compartir",
    callScreensTab: "Pantallas",
    callAppsTab: "Aplicaciones",
    callShareAudio: "Incluir sonido del escritorio",
    callAudioVolume: "Volumen de audio",
    callSharingFrom: "está compartiendo pantalla",
    callHideView: "Cerrar vista",
    callMinimize: "Minimizar",
    callMaximize: "Maximizar",
    callParticipants: "Participantes",
    friendPlaying: "está jugando a",
    overlayMsgReply: "Responder...",
    overlaySend: "Enviar",
  },
  de: {
    appName: "PlanetForge Launcher",
    navHome: "Start",
    navShop: "Shop",
    navLibrary: "Bibliothek",
    navEngine: "PlanetForge Engine",
    signOut: "Abmelden",
    connected: "Verbunden",
    buildChannel: "Kanal: stabil",
    languageLabel: "Sprache",
    shopTitle: "Shop",
    shopDescription: "Entdecke wochentliche Angebote, Bundles und neue Releases.",
    libraryTitle: "Bibliothek",
    libraryDescription: "Verwalte installierte Spiele, Updates und Inhalte.",
    engineTitle: "PlanetForge Engine",
    engineDescription: "Verwalte Engine-Versionen, Vorlagen und Toolchains.",
    switchLanguageNotification: "Sprache auf Deutsch gestellt",
    languageToggle: "Sprache wechseln",
    languageSwitchedTitle: "Sprache gewechselt",
    languageNowEnglish: "Aktuelle Sprache: Englisch",
    languageNowFrench: "Aktuelle Sprache: Franzosisch",
    closeNotificationAria: "Benachrichtigung schliessen",
    launching: "Startet...",
    updateDownloading: "Wird heruntergeladen...",
    updateIsAvailable: "ist verfugbar",
    updateCurrentVersionLabel: "aktuell",
    updateCheckFailed: "Update-Prufung fehlgeschlagen",
    updateNow: "Jetzt aktualisieren",
    statsGamesInLibrary: "Spiele in der Bibliothek",
    statsActiveDownloads: "Aktive Downloads",
    statsFriendsOnline: "Freunde online",
    statsWeeklyGift: "Wochenbonus",
    freeLabel: "Kostenlos",
    releaseNotes: "Release Notes",
    newRelease: "Neues Release",
    engineAvailable: "PlanetForge Engine 1.7 ist verfugbar",
    homeHeroDescription: "Map-Streaming, optimierte GPU-Kompilierung und stabile Vulkan-Pipeline.",
    downloadNow: "Jetzt herunterladen",
    featuredAndFree: "Highlights und kostenlos",
    seeAll: "Alle anzeigen",
    featuredMainTitle: "PlanetForge Arena",
    featuredMainSubtitle: "Diese Woche kostenlos verfugbar",
    freeThisWeek: "Diese Woche kostenlos",
    onSaleNow: "Jetzt im Angebot",
    browseDeals: "Angebote ansehen",
    authLoginLoadingText: "Authentifizierung...",
    authLoginLoadingSubtext: "Verbindung zu PlanetForge",
    authLoginSuccessText: "Willkommen zuruck!",
    authLoginSuccessSubtext: "Launcher wird gestartet...",
    authLoginErrorText: "Anmeldung fehlgeschlagen",
    authLoginErrorSubtext: "Ungultige Email oder Passwort",
    authEmailLabel: "Email",
    authEmailPlaceholder: "you@example.com",
    authPasswordLabel: "Passwort",
    authPasswordPlaceholder: "........",
    authForgotPassword: "Passwort vergessen?",
    authSignIn: "Anmelden",
    authOr: "oder",
    authContinueWithGithub: "Mit GitHub fortfahren",
    authRegisterLoadingText: "Konto wird erstellt...",
    authRegisterLoadingSubtext: "Profil wird eingerichtet",
    authRegisterSuccessText: "Konto erstellt!",
    authRegisterSuccessSubtext: "Willkommen bei PlanetForge",
    authRegisterErrorText: "Registrierung fehlgeschlagen",
    authRegisterErrorSubtext: "Email oder Benutzername vergeben",
    authUsernameLabel: "Benutzername",
    authUsernamePlaceholder: "MeinName42",
    authConfirmPasswordLabel: "Passwort bestatigen",
    authPasswordsDoNotMatch: "Passworter stimmen nicht uberein",
    authCreateAccount: "Konto erstellen",
    authNoAccount: "Noch kein Konto?",
    authCreateOne: "Eins erstellen",
    authAlreadyHaveAccount: "Bereits ein Konto?",
    authRememberMe: "Angemeldet bleiben",
    navProfile: "Profil",
    profileMemberSince: "Mitglied seit",
    profileGamesOwned: "Spiele",
    profileTotalPlaytime: "Spielzeit",
    profileHours: "h",
    profileAchievements: "Erfolge",
    profileEditDisplayName: "Name bearbeiten",
    profileSaveChanges: "Speichern",
    navFriends: "Freunde",
    friendsTitle: "Freunde",
    friendsAdd: "Freund hinzufugen",
    friendsAddPlaceholder: "Freundescode (z.B. ABCD-1234)",
    friendsNoFriends: "Noch keine Freunde",
    friendsOnline: "Online",
    friendsOffline: "Offline",
    friendsMessagePlaceholder: "Nachricht...",
    friendsChatStart: "Beginn der Unterhaltung",
    friendsTabFriends: "Freunde",
    friendsTabRequests: "Anfragen",
    friendsRequestsEmpty: "Keine Anfragen",
    friendsAccept: "Annehmen",
    friendsDecline: "Ablehnen",
    friendsRemove: "Entfernen",
    callPickScreen: "Bildschirminhalt wählen",
    callScreensTab: "Bildschirme",
    callAppsTab: "Anwendungen",
    callShareAudio: "Desktop-Audio einschließen",
    callAudioVolume: "Lautstärke",
    callSharingFrom: "teilt seinen Bildschirm",
    callHideView: "Ansicht schließen",
    callMinimize: "Minimieren",
    callMaximize: "Maximieren",
    callParticipants: "Teilnehmer",
    friendPlaying: "spielt gerade",
    overlayMsgReply: "Antworten...",
    overlaySend: "Senden",
  },
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "ui-language";

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en" || stored === "es" || stored === "de") {
    return stored;
  }
  return "fr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    localStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: dictionaries[language],
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
