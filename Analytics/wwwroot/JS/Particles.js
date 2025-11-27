// Canvas background animation
const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// Ensure canvas is initialized with proper dimensions
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Store particle state in sessionStorage to persist across page navigation
const STORAGE_KEY = 'particleState';
let particles = [];

class Particle {
    constructor(x, y, speedX, speedY, size, opacity) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.size = size || Math.random() * 4 + 2;
        this.speedX = speedX || Math.random() * 0.2 - 0.1;
        this.speedY = speedY || Math.random() * 0.2 - 0.1;
        this.opacity = opacity || Math.random() * 0.4 + 0.4;
        this.baseOpacity = this.opacity;
        this.phase = Math.random() * Math.PI * 2; // Unique phase for each particle
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off walls
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

        // Pulse opacity with continuous phase
        this.opacity = this.baseOpacity + Math.sin(Date.now() * 0.001 + this.phase) * 0.4;
    }

    draw() {
        ctx.fillStyle = `rgb(218, 135, 39, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Serialize for storage
    serialize() {
        return {
            x: this.x,
            y: this.y,
            speedX: this.speedX,
            speedY: this.speedY,
            size: this.size,
            opacity: this.baseOpacity,
            phase: this.phase
        };
    }
}

// Save particle state before page unload
function saveParticleState() {
    const particleData = particles.map(particle => particle.serialize());
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(particleData));
}

// Load particle state from storage
function loadParticleState() {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
            const particleData = JSON.parse(saved);
            particles = particleData.map(data => new Particle(
                data.x, data.y, data.speedX, data.speedY, data.size, data.opacity
            ));
            // Restore phases
            particleData.forEach((data, index) => {
                if (data.phase !== undefined) {
                    particles[index].phase = data.phase;
                }
            });
            return true;
        }
    } catch (e) {
        console.warn('Failed to load particle state:', e);
    }
    return false;
}

function initParticles() {
    // Try to load existing state, otherwise create new particles
    if (!loadParticleState()) {
        particles = [];
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
}

function handleResize() {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Scale particle positions to new canvas size
    const scaleX = canvas.width / oldWidth;
    const scaleY = canvas.height / oldHeight;
    
    particles.forEach(particle => {
        particle.x *= scaleX;
        particle.y *= scaleY;
        
        // Ensure particles stay within bounds
        particle.x = Math.max(0, Math.min(particle.x, canvas.width));
        particle.y = Math.max(0, Math.min(particle.y, canvas.height));
    });
}

window.addEventListener('resize', handleResize);
window.addEventListener('beforeunload', saveParticleState);
window.addEventListener('pagehide', saveParticleState); // For mobile browsers

// Also save state periodically in case of unexpected navigation
setInterval(saveParticleState, 1000);

const maxDistance = 200;

function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            let dx = particles[i].x - particles[j].x;
            let dy = particles[i].y - particles[j].y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < maxDistance) {
                ctx.strokeStyle = `rgba(218, 135, 39, ${0.2 * (1 - distance / maxDistance)})`;
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

// Initialize and start animation
initParticles();
animate();