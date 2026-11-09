export const LOCALES = ["hu", "en", "de", "it", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
/** Canonical / dictionary / email fallback when a translation cell is missing. */
export const DEFAULT_LOCALE: Locale = "hu";
/** Guest UI when Accept-Language is missing or unsupported (e.g. Japanese). */
export const FALLBACK_GUEST_LOCALE: Locale = "en";

/** Neutral UI copy when a key is absent from every language. Never show the raw key. */
export const MISSING_MESSAGE_FALLBACK = "…";

export const LOCALE_META: Record<
    Locale,
    { name: string; nativeName: string; dateLocale: string; currency: string }
> = {
    // Currency stays HUF. Country and currency will be separate account fields later; they are not derived from UI language.
    hu: { name: "Hungarian", nativeName: "Magyar", dateLocale: "hu-HU", currency: "HUF" },
    en: { name: "English", nativeName: "English", dateLocale: "en-GB", currency: "HUF" },
    de: { name: "German", nativeName: "Deutsch", dateLocale: "de-DE", currency: "HUF" },
    it: { name: "Italian", nativeName: "Italiano", dateLocale: "it-IT", currency: "HUF" },
    es: { name: "Spanish", nativeName: "Español", dateLocale: "es-ES", currency: "HUF" },
    fr: { name: "French", nativeName: "Français", dateLocale: "fr-FR", currency: "HUF" },
};

function row(hu: string, en: string, de: string, it: string, es: string, fr: string): Record<Locale, string> {
    return { hu, en, de, it, es, fr };
}

export const MESSAGES: Record<string, Record<Locale, string>> = {
    "seo.title": row("LiveShow", "LiveShow", "LiveShow", "LiveShow", "LiveShow", "LiveShow"),
    "seo.description": row(
        "Élő események, prémium streamek és visszanézhető tartalmak.",
        "Live events, premium streams and on-demand archives.",
        "Live-Events, Premium-Streams und Archive.",
        "Eventi dal vivo, streaming premium e archivi.",
        "Eventos en vivo, streams premium y archivos.",
        "Événements en direct, streams premium et archives.",
    ),
    "nav.home": row("Főoldal", "Home", "Startseite", "Home", "Inicio", "Accueil"),
    "nav.events": row("Események", "Events", "Events", "Eventi", "Eventos", "Événements"),
    "nav.live": row("Élő", "Live", "Live", "Live", "En vivo", "En direct"),
    "nav.archive": row("Visszanézés", "Watch again", "Archiv", "Replay", "Repetición", "Replay"),
    "nav.streamers": row("Tartalomkészítők", "Creators", "Creator", "Creator", "Creadores", "Créateurs"),
    "nav.leaderboard": row("Ranglista", "Leaderboard", "Rangliste", "Classifica", "Clasificación", "Classement"),
    "nav.search": row("Keresés", "Search", "Suche", "Cerca", "Buscar", "Recherche"),
    "nav.notifications": row("Értesítések", "Notifications", "Benachrichtigungen", "Notifiche", "Notificaciones", "Notifications"),
    "nav.login": row("Belépés", "Log in", "Anmelden", "Accedi", "Entrar", "Connexion"),
    "nav.register": row("Regisztráció", "Sign up", "Registrieren", "Registrati", "Registro", "Inscription"),
    "nav.profile": row("Profil", "Profile", "Profil", "Profilo", "Perfil", "Profil"),
    "nav.logout": row("Kijelentkezés", "Log out", "Abmelden", "Esci", "Salir", "Déconnexion"),
    "nav.admin": row("Admin", "Admin", "Admin", "Admin", "Admin", "Admin"),
    "nav.streamerLogin": row("Tartalomkészítő belépés", "Creator login", "Creator-Login", "Accesso creator", "Acceso creator", "Connexion créateur"),
    "nav.language": row("Nyelv", "Language", "Sprache", "Lingua", "Idioma", "Langue"),
    "footer.legal": row("Jogi", "Legal", "Rechtliches", "Legale", "Legal", "Mentions légales"),
    "footer.terms": row("ÁSZF", "Terms", "AGB", "Termini", "Términos", "CGU"),
    "footer.privacy": row("Adatkezelés", "Privacy", "Datenschutz", "Privacy", "Privacidad", "Confidentialité"),
    "auth.loginTitle": row("Belépés", "Log in", "Anmelden", "Accedi", "Iniciar sesión", "Connexion"),
    "auth.registerTitle": row("Regisztráció", "Sign up", "Registrieren", "Registrazione", "Registro", "Inscription"),
    "auth.email": row("Email", "Email", "E-Mail", "Email", "Correo", "E-mail"),
    "auth.password": row("Jelszó", "Password", "Passwort", "Password", "Contraseña", "Mot de passe"),
    "auth.showPassword": row("Jelszó megjelenítése", "Show password", "Passwort anzeigen", "Mostra password", "Mostrar contraseña", "Afficher le mot de passe"),
    "auth.hidePassword": row("Jelszó elrejtése", "Hide password", "Passwort verbergen", "Nascondi password", "Ocultar contraseña", "Masquer le mot de passe"),
    "auth.name": row("Név", "Name", "Name", "Nome", "Nombre", "Nom"),
    "auth.submitLogin": row("Belépés", "Log in", "Anmelden", "Accedi", "Entrar", "Se connecter"),
    "auth.submitRegister": row("Nézőként regisztrálok", "Sign up as viewer", "Als Zuschauer registrieren", "Registrati come spettatore", "Registrarse como espectador", "S'inscrire comme spectateur"),
    "auth.haveAccount": row("Van már fiókod?", "Already have an account?", "Schon ein Konto?", "Hai già un account?", "¿Ya tienes cuenta?", "Déjà un compte ?"),
    "auth.noAccount": row("Nincs fiókod?", "No account?", "Kein Konto?", "Nessun account?", "¿Sin cuenta?", "Pas de compte ?"),
    "auth.forgot": row("Elfelejtett jelszó", "Forgot password", "Passwort vergessen", "Password dimenticata", "Olvidé la contraseña", "Mot de passe oublié"),
    "auth.viewerAccount": row("Nézői fiók", "Viewer account", "Zuschauerkonto", "Account spettatore", "Cuenta de espectador", "Compte spectateur"),
    "auth.busy": row("Mentés...", "Saving...", "Speichern...", "Salvataggio...", "Guardando...", "Enregistrement..."),
    "auth.loginError": row("Hiba történt a bejelentkezés során.", "Login failed.", "Anmeldung fehlgeschlagen.", "Accesso non riuscito.", "Error al iniciar sesión.", "Échec de la connexion."),
    "auth.registerError": row("Hiba történt a regisztráció során.", "Registration failed.", "Registrierung fehlgeschlagen.", "Registrazione non riuscita.", "Error al registrarse.", "Échec de l'inscription."),
    "home.upcoming": row("Közelgő", "Upcoming", "Demnächst", "In arrivo", "Próximos", "À venir"),
    "home.liveNow": row("Most élőben", "Live now", "Jetzt live", "Ora in diretta", "Ahora en vivo", "En direct"),
    "home.popular": row("Népszerű", "Popular", "Beliebt", "Popolari", "Populares", "Populaires"),
    "home.archive": row("Archívum", "Archive", "Archiv", "Archivio", "Archivo", "Archives"),
    "home.faq": row("Gyakori kérdések", "FAQ", "FAQ", "FAQ", "FAQ", "FAQ"),
    "shows.title": row("Események", "Events", "Events", "Eventi", "Eventos", "Événements"),
    "live.title": row("Élő adások", "Live streams", "Live-Streams", "Dirette", "En vivo", "En direct"),
    "archive.title": row("Visszanézés", "Watch again", "Archiv", "Replay", "Repetición", "Replay"),
    "streamers.title": row("Tartalomkészítők", "Creators", "Creator", "Creator", "Creadores", "Créateurs"),
    "wish.title": row("Kívánságfal", "Wish wall", "Wunschliste", "Muro dei desideri", "Muro de deseos", "Mur des envies"),
    "wish.intro": row(
        "Küldj ötletet vagy kihívást a tartalomkészítőknek. Elfogadás nem jelent azonnali teljesítést.",
        "Send an idea or challenge to creators. Acceptance does not mean it is done right away.",
        "Sende eine Idee oder Herausforderung. Annahme heißt nicht sofortige Umsetzung.",
        "Invia un'idea o una sfida. L'accettazione non significa realizzazione immediata.",
        "Envía una idea o un reto. Aceptar no significa que se cumpla al momento.",
        "Envoie une idée ou un défi. L'acceptation ne signifie pas une réalisation immédiate.",
    ),
    "wish.public": row("Nyilvános", "Public", "Öffentlich", "Pubblico", "Público", "Public"),
    "wish.private": row("Privát", "Private", "Privat", "Privato", "Privado", "Privé"),
    "wish.publicHint": row(
        "Mindenki látja a falon.",
        "Everyone can see it on the wall.",
        "Alle sehen es an der Pinnwand.",
        "Tutti lo vedono sul muro.",
        "Todos lo ven en el muro.",
        "Tout le monde le voit sur le mur.",
    ),
    "wish.privateHint": row(
        "Csak a tartalomkészítők és te látjátok.",
        "Only creators and you can see it.",
        "Nur Creator und du sehen es.",
        "Lo vedono solo i creator e tu.",
        "Solo lo ven los creators y tú.",
        "Seuls les créateurs et toi le voyez.",
    ),
    "wish.prompt": row("Mit szeretnél látni a streamben?", "What would you like to see on stream?", "Was möchtest du im Stream sehen?", "Cosa vorresti vedere in diretta?", "¿Qué te gustaría ver en el stream?", "Que voudrais-tu voir en direct ?"),
    "wish.placeholder": row("Írd ide a kívánságodat...", "Write your wish...", "Schreib deinen Wunsch...", "Scrivi il tuo desiderio...", "Escribe tu deseo...", "Écris ton envie..."),
    "wish.submit": row("Küldés", "Send", "Senden", "Invia", "Enviar", "Envoyer"),
    "wish.login": row("Kívánság beküldéséhez", "To send a wish,", "Zum Senden", "Per inviare un desiderio", "Para enviar un deseo", "Pour envoyer une envie"),
    "wish.loginAction": row("jelentkezz be", "log in", "anmelden", "accedi", "inicia sesión", "connecte-toi"),
    "wish.emptyPublic": row("Még nincs nyilvános kívánság. Légy te az első.", "No public wishes yet. Be the first.", "Noch keine öffentlichen Wünsche. Sei der Erste.", "Nessun desiderio pubblico. Sii il primo.", "Aún no hay deseos públicos. Sé el primero.", "Pas encore d'envies publiques. Sois le premier."),
    "wish.emptyPrivate": row("Még nincs privát kívánságod.", "You have no private wishes yet.", "Du hast noch keine privaten Wünsche.", "Non hai ancora desideri privati.", "Aún no tienes deseos privados.", "Tu n'as pas encore d'envies privées."),
    "wish.submitted": row("Beküldve:", "Submitted:", "Gesendet:", "Inviato:", "Enviado:", "Envoyé :"),
    "wish.error": row("A beküldés sikertelen.", "Could not send the wish.", "Senden fehlgeschlagen.", "Invio non riuscito.", "No se pudo enviar.", "Échec de l'envoi."),
    "leaderboard.title": row("Ranglista", "Leaderboard", "Rangliste", "Classifica", "Clasificación", "Classement"),
    "leaderboard.intro": row(
        "A sorrend a nézők által felhasznált jegyeken alapul. A pontos bevétel nem nyilvános.",
        "Ranking is based on tickets used by viewers. Exact revenue is not public.",
        "Die Reihenfolge basiert auf eingesetzten Tickets. Der genaue Umsatz ist nicht öffentlich.",
        "La classifica si basa sui biglietti usati dagli spettatori. Il ricavo esatto non è pubblico.",
        "La clasificación se basa en los tickets usados. Los ingresos exactos no son públicos.",
        "Le classement est basé sur les tickets utilisés. Le revenu exact n'est pas public.",
    ),
    "leaderboard.empty": row("Még nincs ranglista-adat.", "No ranking data yet.", "Noch keine Ranglistendaten.", "Nessun dato in classifica.", "Aún no hay datos de clasificación.", "Pas encore de classement."),
    "leaderboard.error": row("A ranglista nem tölthető be.", "Could not load the leaderboard.", "Rangliste konnte nicht geladen werden.", "Impossibile caricare la classifica.", "No se pudo cargar la clasificación.", "Impossible de charger le classement."),
    "search.placeholder": row("Keresés események között...", "Search events...", "Events suchen...", "Cerca eventi...", "Buscar eventos...", "Rechercher des événements..."),
    "search.noHits": row("Nincs találat.", "No results.", "Keine Treffer.", "Nessun risultato.", "Sin resultados.", "Aucun résultat."),
    "search.close": row("Bezárás", "Close", "Schließen", "Chiudi", "Cerrar", "Fermer"),
    "tickets.balance": row("Jegyegyenleg", "Ticket balance", "Ticketguthaben", "Saldo biglietti", "Saldo de tickets", "Solde de tickets"),
    "tickets.buy": row("Vásárlás", "Buy", "Kaufen", "Acquista", "Comprar", "Acheter"),
    "tickets.loginToBuy": row("A vásárláshoz jelentkezz be.", "Log in to buy.", "Zum Kaufen anmelden.", "Accedi per acquistare.", "Inicia sesión para comprar.", "Connectez-vous pour acheter."),
    "payment.success": row("Sikeres fizetés", "Payment successful", "Zahlung erfolgreich", "Pagamento riuscito", "Pago correcto", "Paiement réussi"),
    "payment.failed": row("Sikertelen fizetés", "Payment failed", "Zahlung fehlgeschlagen", "Pagamento non riuscito", "Pago fallido", "Paiement échoué"),
    "payment.back": row("Vissza", "Back", "Zurück", "Indietro", "Volver", "Retour"),
    "profile.title": row("Nézői profil", "Viewer profile", "Zuschauerprofil", "Profilo spettatore", "Perfil de espectador", "Profil spectateur"),
    "profile.language": row("Felület nyelve", "Interface language", "Sprache der Oberfläche", "Lingua dell'interfaccia", "Idioma de la interfaz", "Langue de l'interface"),
    "profile.save": row("Mentés", "Save", "Speichern", "Salva", "Guardar", "Enregistrer"),
    "profile.saved": row("Mentve.", "Saved.", "Gespeichert.", "Salvato.", "Guardado.", "Enregistré."),
    "profile.displayName": row("Megjelenített név", "Display name", "Anzeigename", "Nome visualizzato", "Nombre visible", "Nom affiché"),
    "common.loading": row("Betöltés...", "Loading...", "Laden...", "Caricamento...", "Cargando...", "Chargement..."),
    "common.error": row("Hiba történt.", "Something went wrong.", "Ein Fehler ist aufgetreten.", "Si è verificato un errore.", "Ha ocurrido un error.", "Une erreur s'est produite."),
    "validate.tooLong": row(
        "Legfeljebb {n} karakter lehet.",
        "Must be at most {n} characters.",
        "Darf höchstens {n} Zeichen lang sein.",
        "Deve contenere al massimo {n} caratteri.",
        "Debe tener como máximo {n} caracteres.",
        "Doit contenir au plus {n} caractères.",
    ),
    "validate.tooShort": row(
        "Legalább {n} karakter kell.",
        "Must be at least {n} characters.",
        "Muss mindestens {n} Zeichen lang sein.",
        "Deve contenere almeno {n} caratteri.",
        "Debe tener al menos {n} caracteres.",
        "Doit contenir au moins {n} caractères.",
    ),
    "validate.required": row("Ez a mező kötelező.", "This field is required.", "Dieses Feld ist erforderlich.", "Questo campo è obbligatorio.", "Este campo es obligatorio.", "Ce champ est obligatoire."),
    "validate.string": row("Érvénytelen szöveg.", "Invalid text.", "Ungültiger Text.", "Testo non valido.", "Texto no válido.", "Texte invalide."),
    "validate.number": row("Érvénytelen szám.", "Invalid number.", "Ungültige Zahl.", "Numero non valido.", "Número no válido.", "Nombre invalide."),
    "validate.email": row("Érvénytelen e-mail cím.", "Invalid email address.", "Ungültige E-Mail-Adresse.", "Email non valida.", "Correo no válido.", "E-mail invalide."),
    "validate.unknownField": row("Ismeretlen mező.", "Unknown field.", "Unbekanntes Feld.", "Campo sconosciuto.", "Campo desconocido.", "Champ inconnu."),
    "common.copy": row("Másolás", "Copy", "Kopieren", "Copia", "Copiar", "Copier"),
    "common.copied": row("Másolva", "Copied", "Kopiert", "Copiato", "Copiado", "Copié"),
    "player.subtitles": row("Felirat", "Subtitles", "Untertitel", "Sottotitoli", "Subtítulos", "Sous-titres"),
    "player.subtitlesOff": row("Ki", "Off", "Aus", "Off", "Desactivado", "Désactivé"),
    "player.audio": row("Hangsáv", "Audio track", "Tonspur", "Traccia audio", "Pista de audio", "Piste audio"),
    "player.default": row("Alapértelmezett", "Default", "Standard", "Predefinito", "Predeterminado", "Par défaut"),
    "email.registrationSubject": row("Sikeres regisztráció", "Registration complete", "Registrierung abgeschlossen", "Registrazione completata", "Registro completado", "Inscription terminée"),
    "email.verifySubject": row("E-mail megerősítése", "Confirm your email", "E-Mail bestätigen", "Conferma email", "Confirma tu correo", "Confirmez votre e-mail"),
    "email.verifyBody": row("Kérjük, erősítsd meg az e-mail címed, hogy jegyet vehess és interaktív funkciókat használhass.", "Please confirm your email to buy tickets and use interactive features.", "Bitte bestätige deine E-Mail, um Tickets zu kaufen.", "Conferma l'email per acquistare biglietti.", "Confirma tu correo para comprar tickets.", "Confirmez votre e-mail pour acheter des tickets."),
    "email.verifyTtl": row("A megerősítő link 24 óráig érvényes.", "The confirmation link is valid for 24 hours.", "Der Bestätigungslink ist 24 Stunden gültig.", "Il link è valido 24 ore.", "El enlace vale 24 horas.", "Le lien est valable 24 heures."),
    "email.verifyCta": row("E-mail megerősítése", "Confirm email", "E-Mail bestätigen", "Conferma email", "Confirmar correo", "Confirmer l'e-mail"),
    "email.passwordResetSubject": row("Jelszó helyreállítása", "Password reset", "Passwort zurücksetzen", "Reimposta password", "Restablecer contraseña", "Réinitialiser le mot de passe"),
    "email.ticketSubject": row("Jegyvásárlás visszaigazolása", "Ticket purchase confirmed", "Ticketkauf bestätigt", "Acquisto biglietto confermato", "Compra de ticket confirmada", "Achat de ticket confirmé"),
    "email.liveReminderSubject": row("Élő adás emlékeztető", "Live stream reminder", "Live-Erinnerung", "Promemoria diretta", "Recordatorio en vivo", "Rappel du direct"),
    "cat.zene": row("Zene", "Music", "Musik", "Musica", "Música", "Musique"),
    "cat.talkshow": row("Talkshow", "Talk show", "Talkshow", "Talk show", "Talk show", "Talk-show"),
    "cat.sport": row("Sport", "Sports", "Sport", "Sport", "Deporte", "Sport"),
    "cat.oktatas": row("Oktatás", "Education", "Bildung", "Educazione", "Educación", "Éducation"),
    "cat.humor": row("Humor", "Comedy", "Comedy", "Commedia", "Comedia", "Humour"),
    "cat.gaming": row("Gaming", "Gaming", "Gaming", "Gaming", "Gaming", "Jeux"),
    "cat.muveszet": row("Művészet", "Art", "Kunst", "Arte", "Arte", "Art"),
    "cat.egyeb": row("Egyéb", "Other", "Sonstiges", "Altro", "Otro", "Autre"),
    "pack.alap": row("Alap", "Basic", "Basis", "Base", "Básico", "Base"),
    "pack.ezust": row("Ezüst", "Silver", "Silber", "Argento", "Plata", "Argent"),
    "pack.arany": row("Arany", "Gold", "Gold", "Oro", "Oro", "Or"),
    "pack.gyemant": row("Gyémánt", "Diamond", "Diamant", "Diamante", "Diamante", "Diamant"),
    "error.emailRequired": row("Email és jelszó kötelező.", "Email and password are required.", "E-Mail und Passwort sind Pflicht.", "Email e password obbligatori.", "El correo y la contraseña son obligatorios.", "E-mail et mot de passe obligatoires."),
    "error.invalidLogin": row("Hibás email vagy jelszó.", "Wrong email or password.", "Falsche E-Mail oder Passwort.", "Email o password errati.", "Correo o contraseña incorrectos.", "E-mail ou mot de passe incorrect."),
    "error.invalidEmail": row("Érvényes email cím szükséges.", "A valid email address is required.", "Eine gültige E-Mail-Adresse ist erforderlich.", "Serve un indirizzo email valido.", "Se requiere un correo válido.", "Une adresse e-mail valide est requise."),
    "error.passwordLength": row("A jelszó legalább 8 karakter legyen.", "Password must be at least 8 characters.", "Das Passwort muss mindestens 8 Zeichen haben.", "La password deve avere almeno 8 caratteri.", "La contraseña debe tener al menos 8 caracteres.", "Le mot de passe doit contenir au moins 8 caractères."),
    "error.nameRequired": row("A név kötelező.", "Name is required.", "Name ist Pflicht.", "Il nome è obbligatorio.", "El nombre es obligatorio.", "Le nom est obligatoire."),
    "home.featured": row("Kiemelt események", "Featured events", "Highlights", "Eventi in evidenza", "Eventos destacados", "Événements à la une"),
    "home.soon": row("Hamarosan indul", "Starting soon", "Startet bald", "In arrivo", "Empieza pronto", "Bientôt"),
    "home.liveStreams": row("Élő közvetítések", "Live streams", "Live-Übertragungen", "Dirette", "Directos", "Directs"),
    "home.popularEvents": row("Legnépszerűbb események", "Most popular", "Beliebteste Events", "I più popolari", "Más populares", "Les plus populaires"),
    "home.watchAgain": row("Visszanézhető tartalmak", "Watch again", "Zum Nachschauen", "Da rivedere", "Para repetir", "À revoir"),
    "home.favorites": row("Kedvenceid", "Your favorites", "Deine Favoriten", "I tuoi preferiti", "Tus favoritos", "Vos favoris"),
    "home.continue": row("Folytasd a nézést", "Continue watching", "Weiterschauen", "Continua a guardare", "Seguir viendo", "Continuer"),
    "home.empty": row("Hamarosan új események.", "New events coming soon.", "Neue Events folgen.", "Nuovi eventi in arrivo.", "Pronto habrá eventos.", "De nouveaux événements arrivent."),
    "tickets.packs": row("Jegycsomagok", "Ticket packs", "Ticketpakete", "Pacchetti biglietti", "Paquetes de tickets", "Packs de tickets"),
    "tickets.packsHint": row("Egy közös jegyegyenleg. A jegy élőben kérdésre, vagy a műsor után értékelésre használható.", "One shared ticket balance. Use tickets for live questions or post-show reviews.", "Ein gemeinsames Ticketguthaben. Tickets für Live-Fragen oder Bewertungen.", "Un saldo biglietti condiviso. Usa i biglietti per domande live o recensioni.", "Un saldo compartido. Usa tickets para preguntas en vivo o reseñas.", "Un solde unique. Utilisez les tickets pour les questions live ou les avis."),
    "payment.processing": row("Fizetés feldolgozása...", "Processing payment...", "Zahlung wird verarbeitet...", "Elaborazione pagamento...", "Procesando el pago...", "Traitement du paiement..."),
    "payment.wait": row("Kérjük, várjon.", "Please wait.", "Bitte warten.", "Attendere.", "Espere.", "Veuillez patienter."),
    "payment.thanks": row("Köszönjük a vásárlást!", "Thank you for your purchase!", "Danke für Ihren Kauf!", "Grazie per l'acquisto!", "¡Gracias por su compra!", "Merci pour votre achat !"),
    "payment.okBody": row("A fizetés sikeresen megtörtént. A jegyed aktiválva van.", "Payment succeeded. Your tickets are active.", "Zahlung erfolgreich. Ihre Tickets sind aktiv.", "Pagamento riuscito. I biglietti sono attivi.", "Pago correcto. Tus tickets están activos.", "Paiement réussi. Vos tickets sont actifs."),
    "payment.retry": row("Kérjük, próbálja meg újra.", "Please try again.", "Bitte erneut versuchen.", "Riprova.", "Inténtalo de nuevo.", "Veuillez réessayer."),
    "payment.myTickets": row("Jegyeim", "My tickets", "Meine Tickets", "I miei biglietti", "Mis tickets", "Mes tickets"),
    "legal.aszf": row("ÁSZF", "Terms", "AGB", "Termini", "Términos", "CGU"),
    "legal.privacy": row("Adatkezelési tájékoztató", "Privacy policy", "Datenschutz", "Privacy", "Privacidad", "Confidentialité"),
    "legal.faq": row("FAQ", "FAQ", "FAQ", "FAQ", "FAQ", "FAQ"),
    "legal.contact": row("Kapcsolat", "Contact", "Kontakt", "Contatti", "Contacto", "Contact"),
    "email.footer": row("Ez egy automatikus értesítés a LiveShow platformról.", "This is an automated LiveShow notification.", "Dies ist eine automatische LiveShow-Benachrichtigung.", "Questa è una notifica automatica LiveShow.", "Esta es una notificación automática de LiveShow.", "Ceci est une notification automatique LiveShow."),
    "email.welcome": row("Üdv a LiveShow-n!", "Welcome to LiveShow!", "Willkommen bei LiveShow!", "Benvenuto su LiveShow!", "¡Bienvenido a LiveShow!", "Bienvenue sur LiveShow !"),
    "email.welcomeStreamer": row("Tartalomkészítő fiókod jóváhagyásra vár. Értesítünk, ha az admin elfogadta.", "Your creator account is pending approval.", "Dein Creator-Konto wartet auf Freigabe.", "Il tuo account creator è in attesa di approvazione.", "Tu cuenta de creador está pendiente de aprobación.", "Votre compte créateur est en attente d'approbation."),
    "email.watchFree": row("Az élő adások és az archív felvételek ingyenesen nézhetők. Jegyet az interaktív funkciókhoz vehetsz.", "Live and archive viewing is free. Buy tickets for interactive features.", "Live und Archiv sind kostenlos. Tickets für interaktive Funktionen.", "Dirette e archivio sono gratuiti. Acquista biglietti per le funzioni interattive.", "Ver en vivo y archivo es gratis. Compra tickets para funciones interactivas.", "Le direct et les archives sont gratuits. Achetez des tickets pour les fonctions interactives."),
    "email.ticketBody": row("A jegyed aktív a következő műsorra:", "Your ticket is active for:", "Dein Ticket ist aktiv für:", "Il biglietto è attivo per:", "Tu ticket está activo para:", "Votre ticket est actif pour :"),
    "email.packBody": row("Jegycsomagod aktív:", "Your ticket pack is active:", "Dein Ticketpaket ist aktiv:", "Il pacchetto è attivo:", "Tu paquete está activo:", "Votre pack est actif :"),
    "email.openShow": row("Műsor megnyitása", "Open event", "Event öffnen", "Apri evento", "Abrir evento", "Ouvrir l'événement"),
    "email.soon": row("hamarosan", "soon", "bald", "presto", "pronto", "bientôt"),
    "email.reminderBody": row("Hamarosan kezdődik:", "Starting soon:", "Startet bald:", "Inizia presto:", "Empieza pronto:", "Commence bientôt :"),
    "email.start": row("Kezdés", "Start", "Beginn", "Inizio", "Inicio", "Début"),
    "email.enterLive": row("Belépés az élő adásba", "Join the live stream", "Zum Livestream", "Entra in diretta", "Entrar en vivo", "Rejoindre le direct"),
    "email.resetBody": row("Jelszó-helyreállítást kértél a LiveShow fiókodhoz.", "You requested a LiveShow password reset.", "Du hast eine Passwortzurücksetzung angefordert.", "Hai richiesto il ripristino della password.", "Pediste restablecer tu contraseña.", "Vous avez demandé une réinitialisation du mot de passe."),
    "email.resetTtl": row("A link 30 percig érvényes, és csak egyszer használható.", "The link is valid for 30 minutes and can be used once.", "Der Link ist 30 Minuten gültig und einmal verwendbar.", "Il link è valido 30 minuti e si usa una sola volta.", "El enlace vale 30 minutos y es de un solo uso.", "Le lien est valable 30 minutes et ne s'utilise qu'une fois."),
    "email.resetCta": row("Új jelszó beállítása", "Set a new password", "Neues Passwort setzen", "Imposta una nuova password", "Establecer nueva contraseña", "Définir un nouveau mot de passe"),
    "email.resetIgnore": row("Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.", "If you did not request this, ignore this email.", "Falls nicht du das warst, ignoriere diese E-Mail.", "Se non sei stato tu, ignora questa email.", "Si no lo pediste, ignora este correo.", "Si vous n'êtes pas à l'origine, ignorez cet e-mail."),
    "report.cta": row("Jelentés", "Report", "Melden", "Segnala", "Denunciar", "Signaler"),
    "studio.translations.heading": row(
        "Fordítások (opcionális)",
        "Translations (optional)",
        "Übersetzungen (optional)",
        "Traduzioni (facoltative)",
        "Traducciones (opcional)",
        "Traductions (facultatif)",
    ),
    "studio.originalLocale": row(
        "Eredeti nyelv",
        "Original language",
        "Originalsprache",
        "Lingua originale",
        "Idioma original",
        "Langue d’origine",
    ),
    "studio.translations.hint": row(
        "A cím és a leírás az eredeti nyelven marad az alap. A többi nyelv mezői üresen hagyhatók. A rendszer nem fordítja le őket helyetted.",
        "Title and description in the original language stay the default. Other languages can be left empty. The system will not translate them for you.",
        "Titel und Beschreibung in der Originalsprache bleiben die Grundlage. Andere Sprachen können leer bleiben. Das System übersetzt sie nicht automatisch.",
        "Titolo e descrizione nella lingua originale restano il valore predefinito. Le altre lingue possono restare vuote. Il sistema non le traduce.",
        "El título y la descripción en el idioma original siguen siendo el valor base. Los demás idiomas pueden quedar vacíos. El sistema no los traduce.",
        "Le titre et la description dans la langue d’origine restent la base. Les autres langues peuvent rester vides. Le système ne les traduit pas.",
    ),
    "studio.translations.open": row(
        "Más nyelveken is megadom",
        "I’ll provide it in other languages too",
        "Ich gebe es auch in anderen Sprachen an",
        "Lo inserisco anche in altre lingue",
        "También lo indico en otros idiomas",
        "Je le renseigne aussi dans d’autres langues",
    ),
    "studio.translations.writeHint": row(
        "Ezt te írod meg, a rendszer nem fordítja le helyetted.",
        "You write this yourself; the system will not translate it for you.",
        "Das schreibst du selbst; das System übersetzt es nicht für dich.",
        "Lo scrivi tu; il sistema non lo traduce al posto tuo.",
        "Lo escribes tú; el sistema no lo traduce por ti.",
        "Vous le rédigez vous-même ; le système ne le traduit pas à votre place.",
    ),
    "studio.translations.done": row("Kész", "Done", "Fertig", "Fatto", "Listo", "Terminé"),
    "studio.translations.pickLanguage": row(
        "Nyelv hozzáadása",
        "Add a language",
        "Sprache hinzufügen",
        "Aggiungi una lingua",
        "Añadir un idioma",
        "Ajouter une langue",
    ),
    "studio.translations.remove": row(
        "{lang} eltávolítása",
        "Remove {lang}",
        "{lang} entfernen",
        "Rimuovi {lang}",
        "Quitar {lang}",
        "Retirer {lang}",
    ),
    "studio.translations.confirmOriginalChange": row(
        "A(z) {lang} nyelven megadott szöveg el fog veszni, mert ez lesz az eredeti nyelv. Folytatod?",
        "The text entered in {lang} will be lost because that will become the original language. Continue?",
        "Der in {lang} eingegebene Text geht verloren, weil das die Originalsprache wird. Fortfahren?",
        "Il testo inserito in {lang} andrà perso perché diventerà la lingua originale. Continuare?",
        "El texto escrito en {lang} se perderá porque ese será el idioma original. ¿Continuar?",
        "Le texte saisi en {lang} sera perdu car ce sera la langue d’origine. Continuer ?",
    ),
    "content.originalLanguage": row(
        "A tartalom az eredeti nyelvén látható.",
        "This content is shown in its original language.",
        "Dieser Inhalt wird in der Originalsprache angezeigt.",
        "Questo contenuto è mostrato nella lingua originale.",
        "Este contenido se muestra en su idioma original.",
        "Ce contenu est affiché dans sa langue d’origine.",
    ),
    "studio.translations.title": row("Cím ezen a nyelven", "Title in this language", "Titel in dieser Sprache", "Titolo in questa lingua", "Título en este idioma", "Titre dans cette langue"),
    "studio.translations.description": row("Leírás ezen a nyelven", "Description in this language", "Beschreibung in dieser Sprache", "Descrizione in questa lingua", "Descripción en este idioma", "Description dans cette langue"),
    "notify.questionRejected": row(
        "Kérdés elutasítva",
        "Question declined",
        "Frage abgelehnt",
        "Domanda rifiutata",
        "Pregunta rechazada",
        "Question refusée",
    ),
};

export function isLocale(value?: string | null): value is Locale {
    return LOCALES.includes(String(value || "").toLowerCase() as Locale);
}

/** Parse RFC 7231 Accept-Language tags, highest q first (stable for ties). */
export function parseAcceptLanguage(header?: string | null): string[] {
    const raw = String(header || "").trim();
    if (!raw) return [];
    return raw
        .split(",")
        .map((part, index) => {
            const [tagPart, ...params] = part.trim().split(";");
            const tag = tagPart.trim().toLowerCase();
            let q = 1;
            for (const param of params) {
                const [key, value] = param.trim().split("=");
                if (key.trim().toLowerCase() === "q") {
                    const n = Number(value);
                    if (Number.isFinite(n)) q = n;
                }
            }
            return { tag, q, index };
        })
        .filter((row) => row.tag)
        .sort((a, b) => b.q - a.q || a.index - b.index)
        .map((row) => row.tag);
}

export function detectLocale(header?: string | null): Locale {
    for (const tag of parseAcceptLanguage(header)) {
        const primary = tag.split("-")[0];
        if (isLocale(primary)) return primary;
        if (isLocale(tag)) return tag;
    }
    return FALLBACK_GUEST_LOCALE;
}

function cell(row: Record<Locale, string> | undefined, loc: Locale) {
    return String(row?.[loc] || "").trim();
}

const reportedMissing = new Set<string>();
type MissingReporter = (key: string, locale: string) => void;
let missingReporter: MissingReporter | null = null;

export function setMissingTranslationReporter(fn: MissingReporter | null) {
    missingReporter = fn;
}

function noteMissing(key: string, locale: string) {
    const id = `${locale}:${key}`;
    if (reportedMissing.has(id)) return;
    reportedMissing.add(id);
    try {
        if (missingReporter) {
            missingReporter(key, locale);
            return;
        }
    } catch {
        return;
    }
    if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing key: ${key} (${locale})`);
    }
}

export function translate(
    key: string,
    locale: string | null | undefined,
    _fallbackLocale: Locale = DEFAULT_LOCALE,
) {
    const requested = isLocale(locale) ? locale : null;
    const row = MESSAGES[key];
    if (!row) {
        noteMissing(key, requested || FALLBACK_GUEST_LOCALE);
        return MISSING_MESSAGE_FALLBACK;
    }
    const picked =
        (requested && cell(row, requested)) || cell(row, FALLBACK_GUEST_LOCALE) || cell(row, DEFAULT_LOCALE);
    if (picked) return picked;
    noteMissing(key, requested || FALLBACK_GUEST_LOCALE);
    return MISSING_MESSAGE_FALLBACK;
}

export function formatMoney(amount: number, locale: string) {
    const loc = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // Currency is HUF until country/currency are stored separately (not inferred from language).
    return new Intl.NumberFormat(LOCALE_META[loc].dateLocale, {
        style: "currency",
        currency: LOCALE_META[loc].currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatNumber(value: number, locale: string) {
    const loc = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return new Intl.NumberFormat(LOCALE_META[loc].dateLocale).format(Number(value) || 0);
}

export function formatDateTime(value: string | Date | null | undefined, locale: string) {
    if (!value) return "";
    const loc = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(LOCALE_META[loc].dateLocale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}
