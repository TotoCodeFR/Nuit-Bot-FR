const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

const stars = [];

function createStar() {
  return {
    x: Math.random() * canvas.width,
    y: canvas.height + Math.random() * 100,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 0.7 + 0.3,
    opacity: Math.random() * 0.5 + 0.5,
    twinkle: Math.random() * 0.05
  };
}

// Populate with initial stars
for (let i = 0; i < 80; i++) stars.push(createStar());

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let star of stars) {
    // twinkle effect
    star.opacity += (Math.random() - 0.5) * star.twinkle;
    star.opacity = Math.max(0.2, Math.min(star.opacity, 1));

    // draw star
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
    ctx.fill();

    // move star up
    star.y -= star.speed;

    // reset if it goes above
    if (star.y < -star.size) {
      Object.assign(star, createStar());
      star.y = canvas.height + star.size;
    }
  }

  requestAnimationFrame(animate);
}

animate();
