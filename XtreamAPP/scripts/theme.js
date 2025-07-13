// Apply saved theme on login page
chrome.storage.local.get(['theme'], (result) => {
  const savedTheme = result.theme || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  console.log('Tema carregado (index.html):', savedTheme);
});