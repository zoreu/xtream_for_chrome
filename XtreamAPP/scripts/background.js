chrome.runtime.onInstalled.addListener(() => {
    console.log('Extensão Xtream Codes instalada.');
});
chrome.action.onClicked.addListener(() => {
    console.log('Ícone da extensão clicado. Abrindo nova aba com index.html');
    const url = chrome.runtime.getURL('index.html');
    console.log('URL da nova aba:', url);
    chrome.tabs.create({ url: url }, (tab) => {
        console.log('Nova aba criada:', tab.url);
    });
});