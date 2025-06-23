const statut_bot = document.getElementById('statut-bot');

setInterval(() => {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            statut_bot.textContent = data.status;
        })
        .catch(error => {
            console.error('Impossible de charger le statut du bot :', error);
            statut_bot.textContent = '🔴 Hors ligne';
        });
})