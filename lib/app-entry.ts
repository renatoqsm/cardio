// Installed copies whose original start URL was '/' also open the application.
export const appEntryBootstrap = `(()=>{if(location.pathname==='/'&&(matchMedia('(display-mode: standalone)').matches||navigator.standalone)){document.documentElement.dataset.appEntry='redirect';location.replace('/app'+location.search+location.hash)}})()`
