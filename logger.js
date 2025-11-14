/* ────────────────── Logger utilitaire ────────────────── */

// Stocke les logs localement dans un tableau
const _logs = [];

/**
 * Ajoute un message de log avec horodatage.
 * Exemple d’appel : appendLog("Calibration OK")
 */
export function appendLog(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  _logs.push(line);
  console.log(line); // affichage console aussi
}

/**
 * Retourne tous les logs sous forme de texte
 */
export function getLogsText() {
  return _logs.join("\n");
}

/**
 * Efface tous les logs en mémoire
 */
export function clearLogs() {
  _logs.length = 0;
}

/**
 * Télécharge les logs actuels sous forme de fichier .txt
 * @param {string} filename - nom du fichier (par défaut "logs.txt")
 */
export function saveLogsToFile(filename = "logs.txt") {
  const text = getLogsText();
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
  console.log(`💾 Fichier ${filename} enregistré (${_logs.length} lignes)`);
}
