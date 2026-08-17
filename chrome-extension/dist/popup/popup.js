// src/popup/popup.ts
var clientNameElem = document.getElementById("popup-client-name");
var btnQuickFill = document.getElementById("btn-quick-fill");
var btnOpenSidepanel = document.getElementById("btn-open-sidepanel");
var popupStatus = document.getElementById("popup-status");
var quoteData = null;
document.addEventListener("DOMContentLoaded", async () => {
  chrome.runtime.sendMessage({ type: "GET_QUOTE_DATA" }, (response) => {
    if (response?.data) {
      quoteData = response.data;
      const client = quoteData?.client;
      clientNameElem.textContent = client ? `${client.firstName} ${client.lastName}`.trim() : "Client actif";
    }
  });
  btnQuickFill.addEventListener("click", handleQuickFill);
  btnOpenSidepanel.addEventListener("click", handleOpenSidepanel);
});
async function handleQuickFill() {
  btnQuickFill.disabled = true;
  showStatus("Analyse et remplissage...", "info");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (tabId === void 0) throw new Error("Aucun onglet actif");
    chrome.tabs.sendMessage(
      tabId,
      { type: "DETECT_FIELDS", quoteData: quoteData || void 0 },
      (detectResponse) => {
        btnQuickFill.disabled = false;
        if (chrome.runtime.lastError || !detectResponse?.success) {
          showStatus("Impossible d'acc\xE9der \xE0 la page.", "error");
          return;
        }
        chrome.tabs.sendMessage(
          tabId,
          { type: "EXECUTE_FILL", mappings: detectResponse.run.mappings },
          (fillResponse) => {
            if (fillResponse?.success) {
              const count = fillResponse.run.totalFilled || 0;
              showStatus(`\u2705 ${count} champ(s) rempli(s) !`, "success");
            } else {
              showStatus("Erreur de remplissage", "error");
            }
          }
        );
      }
    );
  } catch (err) {
    btnQuickFill.disabled = false;
    showStatus(err.message || "Erreur", "error");
  }
}
async function handleOpenSidepanel() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  } catch (err) {
    console.warn("Impossible d'ouvrir le side panel :", err);
  }
}
function showStatus(text, type) {
  popupStatus.textContent = text;
  popupStatus.className = `popup-status ${type}`;
  popupStatus.classList.remove("hidden");
}
//# sourceMappingURL=popup.js.map
