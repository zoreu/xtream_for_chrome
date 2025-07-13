console.log('login.js carregado.');

chrome.storage.local.get(['host', 'username', 'password'], (result) => {
    console.log('Verificando credenciais no storage:', result);
    if (result.host && result.username && result.password) {
        console.log('Credenciais encontradas, redirecionando para main.html');
        window.location.href = chrome.runtime.getURL('main.html');
        window.location.hash = '';
    }
});

// Attach event listener to the login button
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, anexando event listener ao botão de login.');
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', login);
        console.log('Event listener anexado ao botão de login.');
    } else {
        console.error('Botão de login não encontrado.');
    }
});

function login() {
    const host = document.getElementById('host').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    // const keepLoggedIn = document.getElementById('keepLoggedIn').checked;

    if (!host || !username || !password) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    if (!host.startsWith('http://') && !host.startsWith('https://')) {
        alert('O host deve começar com http:// ou https://');
        return;
    }

    console.log('Tentando login com:', { host, username });
    chrome.storage.local.set({ host, username, password }, () => {
        fetch(`${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
            .then(response => {
                console.log('Resposta da API:', response.status, response.statusText);
                return response.json();
            })
            .then(data => {
                if (data.user_info && data.user_info.auth === 1) {
                    console.log('Login bem-sucedido, redirecionando para main.html');
                    window.location.href = chrome.runtime.getURL('main.html');
                    window.location.hash = '';
                } else {
                    console.error('Credenciais inválidas:', data);
                    alert('Credenciais inválidas.');
                    chrome.storage.local.remove(['host', 'username', 'password']);
                }
            })
            .catch(error => {
                console.error('Erro na solicitação à API:', error);
                alert('Erro ao conectar com o servidor.');
                chrome.storage.local.remove(['host', 'username', 'password']);
            });
    });
}