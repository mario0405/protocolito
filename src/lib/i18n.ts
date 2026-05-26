export type AppLanguage = 'en' | 'de';

type TranslationKey =
  | 'common.about'
  | 'common.back'
  | 'common.cancel'
  | 'common.close'
  | 'common.copy'
  | 'common.home'
  | 'common.save'
  | 'common.send'
  | 'common.settings'
  | 'common.start'
  | 'common.template'
  | 'home.protocolTemplate'
  | 'home.ready'
  | 'home.readyDescription'
  | 'home.meetingLanguage'
  | 'home.startRecording'
  | 'home.checkingAudioTitle'
  | 'home.checkingAudioDescription'
  | 'sidebar.importAudio'
  | 'sidebar.meetingNotes'
  | 'sidebar.recordingInProgress'
  | 'sidebar.searchPlaceholder'
  | 'settings.title'
  | 'settings.general'
  | 'settings.recordings'
  | 'settings.transcription'
  | 'settings.summary'
  | 'settings.integrations'
  | 'preferences.uiLanguageTitle'
  | 'preferences.uiLanguageDescription'
  | 'preferences.uiLanguageLabel'
  | 'preferences.english'
  | 'preferences.german'
  | 'preferences.switchingLanguage'
  | 'preferences.meetingLanguageTitle'
  | 'preferences.meetingLanguageDescription'
  | 'preferences.meetingLanguageLabel'
  | 'preferences.notificationsTitle'
  | 'preferences.notificationsDescription'
  | 'preferences.storageTitle'
  | 'preferences.storageDescription'
  | 'preferences.meetingRecordings'
  | 'preferences.openFolder'
  | 'preferences.storageNote'
  | 'recording.title'
  | 'recording.description'
  | 'recording.saveAudio'
  | 'recording.saveAudioDescription'
  | 'recording.saveLocation'
  | 'recording.defaultFolder'
  | 'recording.fileFormat'
  | 'recording.fileFormatDescription'
  | 'recording.disabledDescription'
  | 'recording.notification'
  | 'recording.notificationDescription'
  | 'recording.defaultDevices'
  | 'recording.defaultDevicesDescription'
  | 'summary.generate'
  | 'summary.stop'
  | 'summary.aiModel'
  | 'summary.template'
  | 'summary.processing'
  | 'summary.settingsTitle';

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    'common.about': 'About',
    'common.back': 'Back',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.copy': 'Copy',
    'common.home': 'Home',
    'common.save': 'Save',
    'common.send': 'Send',
    'common.settings': 'Settings',
    'common.start': 'Start',
    'common.template': 'Template',
    'home.protocolTemplate': 'Protocol template',
    'home.ready': 'Protocolito is ready',
    'home.readyDescription': 'Choose the language and protocol style before starting the meeting.',
    'home.meetingLanguage': 'Meeting language',
    'home.startRecording': 'Start Recording',
    'home.checkingAudioTitle': 'Checking audio devices...',
    'home.checkingAudioDescription': 'Protocolito is looking for your microphone and system audio devices.',
    'sidebar.importAudio': 'Import Audio',
    'sidebar.meetingNotes': 'Meeting Notes',
    'sidebar.recordingInProgress': 'Recording in progress...',
    'sidebar.searchPlaceholder': 'Search meeting content...',
    'settings.title': 'Protocolito settings',
    'settings.general': 'General',
    'settings.recordings': 'Recordings',
    'settings.transcription': 'Transcription',
    'settings.summary': 'Summary',
    'settings.integrations': 'Integrations',
    'preferences.uiLanguageTitle': 'App Language',
    'preferences.uiLanguageDescription': 'Choose the language used for Protocolito buttons, menus, labels, and settings.',
    'preferences.uiLanguageLabel': 'Interface language',
    'preferences.english': 'English',
    'preferences.german': 'German',
    'preferences.switchingLanguage': 'Updating app language',
    'preferences.meetingLanguageTitle': 'Meeting Language',
    'preferences.meetingLanguageDescription': 'Default language used for recordings, imports, and retranscription.',
    'preferences.meetingLanguageLabel': 'Default meeting language',
    'preferences.notificationsTitle': 'Notifications',
    'preferences.notificationsDescription': 'Enable or disable notifications when meetings start and stop.',
    'preferences.storageTitle': 'Data Storage Locations',
    'preferences.storageDescription': 'View and access where Protocolito stores your data.',
    'preferences.meetingRecordings': 'Meeting Recordings',
    'preferences.openFolder': 'Open Folder',
    'preferences.storageNote': 'Database and models are stored together in your application data directory for unified management.',
    'recording.title': 'Recording Settings',
    'recording.description': 'Configure how your audio recordings are saved during meetings.',
    'recording.saveAudio': 'Save Audio Recordings',
    'recording.saveAudioDescription': 'Automatically save audio files when recording stops.',
    'recording.saveLocation': 'Save Location',
    'recording.defaultFolder': 'Default folder',
    'recording.fileFormat': 'File Format',
    'recording.fileFormatDescription': 'Recordings are saved with timestamp',
    'recording.disabledDescription': 'Audio recording is disabled. Enable "Save Audio Recordings" to automatically save your meeting audio.',
    'recording.notification': 'Recording Start Notification',
    'recording.notificationDescription': 'Show reminder to inform participants when recording starts.',
    'recording.defaultDevices': 'Default Audio Devices',
    'recording.defaultDevicesDescription': 'Set your preferred microphone and system audio devices for recording. These will be automatically selected when starting new recordings.',
    'summary.generate': 'Generate Summary',
    'summary.stop': 'Stop',
    'summary.aiModel': 'AI Model',
    'summary.template': 'Template',
    'summary.processing': 'Processing...',
    'summary.settingsTitle': 'Model Settings',
  },
  de: {
    'common.about': 'Info',
    'common.back': 'Zurück',
    'common.cancel': 'Abbrechen',
    'common.close': 'Schließen',
    'common.copy': 'Kopieren',
    'common.home': 'Startseite',
    'common.save': 'Speichern',
    'common.send': 'Senden',
    'common.settings': 'Einstellungen',
    'common.start': 'Starten',
    'common.template': 'Vorlage',
    'home.protocolTemplate': 'Protokollvorlage',
    'home.ready': 'Protocolito ist bereit',
    'home.readyDescription': 'Wähle Sprache und Protokollstil, bevor du das Meeting startest.',
    'home.meetingLanguage': 'Meeting-Sprache',
    'home.startRecording': 'Aufnahme starten',
    'home.checkingAudioTitle': 'Audiogeräte werden geprüft...',
    'home.checkingAudioDescription': 'Protocolito sucht nach Mikrofon und Systemaudio-Geräten.',
    'sidebar.importAudio': 'Audio importieren',
    'sidebar.meetingNotes': 'Meeting-Notizen',
    'sidebar.recordingInProgress': 'Aufnahme läuft...',
    'sidebar.searchPlaceholder': 'Meeting-Inhalt suchen...',
    'settings.title': 'Protocolito Einstellungen',
    'settings.general': 'Allgemein',
    'settings.recordings': 'Aufnahmen',
    'settings.transcription': 'Transkription',
    'settings.summary': 'Zusammenfassung',
    'settings.integrations': 'Integrationen',
    'preferences.uiLanguageTitle': 'App-Sprache',
    'preferences.uiLanguageDescription': 'Wähle die Sprache für Buttons, Menüs, Beschriftungen und Einstellungen in Protocolito.',
    'preferences.uiLanguageLabel': 'Oberflächensprache',
    'preferences.english': 'Englisch',
    'preferences.german': 'Deutsch',
    'preferences.switchingLanguage': 'App-Sprache wird aktualisiert',
    'preferences.meetingLanguageTitle': 'Meeting-Sprache',
    'preferences.meetingLanguageDescription': 'Standardsprache für Aufnahmen, Importe und erneute Transkription.',
    'preferences.meetingLanguageLabel': 'Standard-Meeting-Sprache',
    'preferences.notificationsTitle': 'Benachrichtigungen',
    'preferences.notificationsDescription': 'Benachrichtigungen beim Starten und Beenden von Meetings aktivieren oder deaktivieren.',
    'preferences.storageTitle': 'Datenspeicherorte',
    'preferences.storageDescription': 'Anzeigen und öffnen, wo Protocolito deine Daten speichert.',
    'preferences.meetingRecordings': 'Meeting-Aufnahmen',
    'preferences.openFolder': 'Ordner öffnen',
    'preferences.storageNote': 'Datenbank und Modelle werden gemeinsam im App-Datenverzeichnis gespeichert.',
    'recording.title': 'Aufnahmeeinstellungen',
    'recording.description': 'Lege fest, wie Audioaufnahmen während Meetings gespeichert werden.',
    'recording.saveAudio': 'Audioaufnahmen speichern',
    'recording.saveAudioDescription': 'Audiodateien automatisch speichern, wenn die Aufnahme stoppt.',
    'recording.saveLocation': 'Speicherort',
    'recording.defaultFolder': 'Standardordner',
    'recording.fileFormat': 'Dateiformat',
    'recording.fileFormatDescription': 'Aufnahmen werden mit Zeitstempel gespeichert',
    'recording.disabledDescription': 'Audioaufnahme ist deaktiviert. Aktiviere "Audioaufnahmen speichern", um Meeting-Audio automatisch zu speichern.',
    'recording.notification': 'Benachrichtigung beim Aufnahmestart',
    'recording.notificationDescription': 'Erinnerung anzeigen, um Teilnehmende beim Aufnahmestart zu informieren.',
    'recording.defaultDevices': 'Standard-Audiogeräte',
    'recording.defaultDevicesDescription': 'Lege bevorzugtes Mikrofon und Systemaudio für neue Aufnahmen fest.',
    'summary.generate': 'Zusammenfassung erstellen',
    'summary.stop': 'Stoppen',
    'summary.aiModel': 'KI-Modell',
    'summary.template': 'Vorlage',
    'summary.processing': 'Verarbeitung...',
    'summary.settingsTitle': 'Modelleinstellungen',
  },
};

export function translate(language: AppLanguage, key: TranslationKey) {
  return translations[language]?.[key] || translations.en[key] || key;
}
