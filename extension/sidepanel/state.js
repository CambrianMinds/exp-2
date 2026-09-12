export const AppState = {
  currentCases: [],
  currentReport: null,
  searchBatches: [],
  petitionerProfile: null,
  backendOnline: true,
  pendingScanResult: null
};

if (typeof window !== 'undefined') {
  window.IndianaExpungement = window.IndianaExpungement || {};
  window.IndianaExpungement.AppState = AppState;
}

