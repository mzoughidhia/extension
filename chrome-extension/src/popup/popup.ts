import { CanonicalQuoteRequest } from '../models/canonical-data.model';

const clientNameElem = document.getElementById('popup-client-name') as HTMLElement;
const btnQuickFill = document.getElementById('btn-quick-fill') as HTMLButtonElement;
const btnOpenSidepanel = document.getElementById('btn-open-sidepanel') as HTMLButtonElement;
const popupStatus = document.getElementById('popup-status') as HTMLElement;

let quoteData: CanonicalQuoteRequest | null = null;

document.addEventListener('DOMContentLoaded', async () => {
  chrome.runtime.sendMessage({ type: 'GET_QUOTE_DATA' }, (response) => {
    if (response?.data) {
      quoteData = response.data;
      const client = quoteData?.client;
      clientNameElem.textContent = client ? `${client.firstName} ${client.lastName}`.trim() : 'Client actif';
    }
  });

  btnQuickFill.addEventListener('click', handleQuickFill);
  btnOpenSidepanel.addEventListener('click', handleOpenSidepanel);
});

async function handleQuickFill(): Promise<void> {
  btnQuickFill.disabled = true;
  showStatus('Analyse et remplissage...', 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (tabId === undefined) throw new Error('Aucun onglet actif');

    // 1. Détection
    chrome.tabs.sendMessage(
      tabId,
      { type: 'DETECT_FIELDS', quoteData: quoteData || undefined },
      (detectResponse) => {
        btnQuickFill.disabled = false;
        if (chrome.runtime.lastError || !detectResponse?.success) {
          showStatus('Impossible d\'accéder à la page.', 'error');
          return;
        }

        // 2. Remplissage automatique des champs validés
        chrome.tabs.sendMessage(
          tabId,
          { type: 'EXECUTE_FILL', mappings: detectResponse.run.mappings },
          (fillResponse) => {
            if (fillResponse?.success) {
              const count = fillResponse.run.totalFilled || 0;
              showStatus(`✅ ${count} champ(s) rempli(s) !`, 'success');
            } else {
              showStatus('Erreur de remplissage', 'error');
            }
          }
        );
      }
    );
  } catch (err: any) {
    btnQuickFill.disabled = false;
    showStatus(err.message || 'Erreur', 'error');
  }
}

async function handleOpenSidepanel(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  } catch (err) {
    console.warn('Impossible d\'ouvrir le side panel :', err);
  }
}

function showStatus(text: string, type: 'info' | 'success' | 'error'): void {
  popupStatus.textContent = text;
  popupStatus.className = `popup-status ${type}`;
  popupStatus.classList.remove('hidden');
}
