// Canvas background animation
const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// Ensure canvas is initialized with proper dimensions
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles(); // Reinitialize particles on resize
});

const particles = [];
const particleCount = 200;
const maxDistance = 200; // Distance for connecting lines

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 4 + 2; // Larger particles (2-6)
        this.speedX = Math.random() * 0.6 - 0.3;
        this.speedY = Math.random() * 0.6 - 0.3;
        this.opacity = Math.random() * 0.4 + 0.4; // More visible (0.4-0.8)
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off walls
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

        // Pulse opacity
        this.opacity = 0.4 + Math.sin(Date.now() * 0.002 + this.x * 0.01) * 0.4;
    }

    draw() {
        ctx.fillStyle = `rgb(218, 135, 39, ${this.opacity})`; // Consistent orange
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles.length = 0; // Clear existing particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

initParticles(); // Initialize particles on load

function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            let dx = particles[i].x - particles[j].x;
            let dy = particles[i].y - particles[j].y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < maxDistance) {
                ctx.strokeStyle = `rgba(218, 135, 39, ${0.3 * (1 - distance / maxDistance)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animate() {
    // Clear canvas with semi-transparent background to create trail effect
    ctx.fillStyle = 'rgba(17, 17, 17, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    // Connect nearby particles
    connectParticles();

    requestAnimationFrame(animate);
}

animate();