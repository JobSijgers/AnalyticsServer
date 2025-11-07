// Login.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    if (!form) {
        console.error('Login form not found in the DOM');
        return;
    }

    // Function to hash the password using SHA-256
    async function hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password); // Encode password as UTF-8
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer); // Hash with SHA-256
        const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert buffer to byte array
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert to hex
        return hashHex;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        console.log('Form submitted');

        const loadingOverlay = document.querySelector('.loading-overlay');
        if (!loadingOverlay) {
            console.error('Loading overlay not found');
            return;
        }

        // Show loading overlay
        loadingOverlay.classList.add('active');

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // Hash the password
            const hashedPassword = await hashPassword(password);

            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: hashedPassword }) // Send hashed password
            });

            // Hide loading overlay
            loadingOverlay.classList.remove('active');

            if (response.ok) {
                const data = await response.json();
                const UUID = data.message;

                // Save the token using TokenManager
                if (tokenManager.setToken(UUID)) {
                    toastManager.success('Login successful!');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                } else {
                    toastManager.error('Failed to save login session');
                }
            } else {
                const errorData = await response.json();

                toastManager.error(`Login failed: ${errorData.message || 'Invalid credentials'}`);
            }
        } catch (error) {
            loadingOverlay.classList.remove('active');
            console.error('Login error:', error);
            toastManager.error('An error occurred. Please try again.');
        }
    });
});