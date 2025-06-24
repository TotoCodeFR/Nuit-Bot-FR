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
}, 1000)

// example url: http://localhost:37435/dashboard/serverId/general
function getServerIdFromUrl() {
    const parts = window.location.pathname.split('/');
    // Find "dashboard" and get the next part as serverId
    const dashboardIndex = parts.indexOf('dashboard');
    if (dashboardIndex !== -1 && parts.length > dashboardIndex + 1) {
        return parts[dashboardIndex + 1];
    }
    return null;
}

const sauvegarder_salon_log = document.getElementById('save-log-channel');
const salons_dropdown = document.getElementById('log-channel-select');

function récupérerSalons() {
    const serverId = getServerIdFromUrl();
    Promise.all([
        fetch('/api/get-channels?serverId=' + serverId).then(r => r.json()),
        fetch('/api/get-log-channel?serverId=' + serverId).then(r => r.json())
    ])
    .then(([channelsData, logChannelData]) => {
        salons_dropdown.innerHTML = '';
        channelsData.channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = channel.name;
            if (logChannelData.logChannel && channel.id === logChannelData.logChannel) {
                option.selected = true;
            }
            salons_dropdown.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Erreur lors de la récupération des salons :', error);
        alert('Impossible de charger les salons de log.');
    });
    // (Promise.all version with .catch is now above, so remove this unreachable block)
}

récupérerSalons();

sauvegarder_salon_log.addEventListener('click', () => {
    const salonLog = salons_dropdown.value;
    const data = { logChannel: salonLog };

    fetch('/api/save-log-channel?serverId=' + getServerIdFromUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Salon de log sauvegardé avec succès !');
        } else {
            alert('Erreur lors de la sauvegarde du salon de log : ' + data.error);
        }
    })
    .catch(error => {
        console.error('Erreur lors de la requête :', error);
        alert('Une erreur est survenue lors de la sauvegarde du salon de log.');
    });
});