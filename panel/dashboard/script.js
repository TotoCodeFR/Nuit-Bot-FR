fetch('/api/user')
  .then(res => {
    if (res.status === 401) return window.location.href = '/auth/discord';
    return res.json();
  })
  .then(user => {
    document.getElementById('welcome').innerText = `Bienvenue, ${user.username}#${user.discriminator}`;
    document.getElementById('avatar').src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  })
  .catch(err => console.error('Failed to load user:', err));

fetch('/api/mutual-guilds')
  .then(res => {
    if (res.status === 302) return window.location.href = '/auth/discord';
    return res.json();
  })
  .then(servers => {
    document.getElementById('server-grid').innerHTML = '';
    servers.forEach(server => {
      const serverElement = document.createElement('div');
      serverElement.className = 'server-card';

      serverElement.innerHTML = `
        <h3>${server.name}</h3>
        <button data-id="${server.id}">Gérer</button>
      `;

      serverElement.querySelector('button').addEventListener('click', () => {
        window.location.href = `/dashboard/${server.id}/general`;
      });

      document.getElementById('server-grid').appendChild(serverElement);
    });
  })
  .catch(err => console.error('Failed to load servers:', err));
