const general = document.getElementById('btn__general')
const moderation = document.getElementById('btn__moderation')

general.addEventListener('click', () => {
  window.location.href = './general';
});

moderation.addEventListener('click', () => {
  window.location.href = './moderation';
});