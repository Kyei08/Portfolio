// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Firebase variables
let app;
let db;
let auth;
let currentUserId = null;
let isAuthReady = false;

// Initialize Firebase and Particles.js on window load
window.onload = async function () {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

    if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. Cannot initialize Firebase.");
        document.getElementById('authStatus').textContent = 'Error: Firebase config missing.';
        return;
    }

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    const authStatusDiv = document.getElementById('authStatus');

    // Listen for authentication state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            authStatusDiv.textContent = `Signed in as: ${currentUserId}`;
            isAuthReady = true;
            console.log("Firebase Auth Ready. User ID:", currentUserId);
            // Once authenticated, load comments
            loadComments();
        } else {
            // Try to sign in anonymously if not already signed in
            try {
                // Ensure signInWithCustomToken is defined or removed if not used
                // Assuming it's for an internal token, if not, simply remove it
                const __initial_auth_token = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;
                if (__initial_auth_token && typeof signInWithCustomToken !== 'undefined') {
                    // This line assumes signInWithCustomToken is available,
                    // which it would be if imported or defined elsewhere.
                    // If not, this block might need adjustment or removal.
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                authStatusDiv.textContent = 'Error signing in. Comments may not be available.';
                isAuthReady = false;
            }
        }
    });

    // Initialize Particles.js
    particlesJS('particles-js', {
        particles: {
            number: {
                value: 100,
                density: {
                    enable: true,
                    value_area: 800
                }
            },
            color: {
                value: "#ffffff"
            },
            shape: {
                type: "circle",
                stroke: {
                    width: 0,
                    color: "#000000"
                }
            },
            opacity: {
                value: 0.5,
                random: true,
                anim: {
                    enable: true,
                    speed: 1,
                    opacity_min: 0.1,
                    sync: false
                }
            },
            size: {
                value: 5,
                random: true,
                anim: {
                    enable: false
                }
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: "#ffffff",
                opacity: 0.4,
                width: 1
            },
            move: {
                enable: true,
                speed: 2,
                direction: "none",
                random: true,
                straight: false,
                out_mode: "out",
                bounce: false
            }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: {
                    enable: true,
                    mode: "repulse"
                },
                onclick: {
                    enable: true,
                    mode: "push"
                }
            }
        },
        retina_detect: true
    });
};

// Smooth scrolling for navigation links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Intersection Observer for section animations
const animatedContentWrappers = document.querySelectorAll('.section-hidden');
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('section-visible');
            entry.target.classList.remove('section-hidden');
        } else {
            // Optional: Re-hide if scrolling out of view
            // entry.target.classList.remove('section-visible');
            // entry.target.classList.add('section-hidden');
        }
    });
}, observerOptions);

animatedContentWrappers.forEach(contentWrapper => {
    observer.observe(contentWrapper);
});

// Function to display messages in the comment message box
function displayCommentMessage(message, type) {
    const messageBox = document.getElementById('commentMessageBox');
    messageBox.classList.remove('hidden', 'bg-red-500', 'text-red-900', 'bg-green-500', 'text-green-900');
    messageBox.textContent = message;
    if (type === 'success') {
        messageBox.classList.add('bg-green-500', 'text-green-900');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-500', 'text-red-900');
    }
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000); // Hide after 5 seconds
}

// Function to load comments from Firestore
async function loadComments() {
    if (!isAuthReady || !db) {
        console.warn("Firestore not ready to load comments.");
        return;
    }

    const commentsListDiv = document.getElementById('commentsList');
    const commentsLoading = document.getElementById('commentsLoading');
    commentsLoading.style.display = 'block'; // Show loading message

    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const commentsCollectionRef = collection(db, `/artifacts/${appId}/public/data/comments`);
        const q = query(commentsCollectionRef);

        onSnapshot(q, (snapshot) => {
            commentsListDiv.innerHTML = ''; // Clear existing comments
            commentsLoading.style.display = 'none'; // Hide loading message

            if (snapshot.empty) {
                commentsListDiv.innerHTML = '<p class="text-center text-gray-500">No comments yet. Be the first to leave one!</p>';
                return;
            }

            const comments = [];
            snapshot.forEach((doc) => {
                comments.push({ id: doc.id, ...doc.data() });
            });

            // Sort comments by timestamp in descending order (newest first)
            comments.sort((a, b) => {
                if (a.timestamp && b.timestamp) {
                    return b.timestamp.toDate() - a.timestamp.toDate();
                }
                return 0; // Maintain original order if timestamps are missing
            });

            comments.forEach((comment) => {
                const commentDiv = document.createElement('div');
                commentDiv.className = 'bg-dark-bg p-4 rounded-md shadow-md glowing-border';
                const timestamp = comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleString() : 'Just now';

                commentDiv.innerHTML = `
                    <p class="text-sm text-gray-400 mb-1">
                        <span class="font-bold text-primary-blue">${comment.userName || 'Anonymous'}</span>
                        <span class="text-gray-500"> (User ID: ${comment.userId})</span>
                        <span class="float-right text-xs">${timestamp}</span>
                    </p>
                    <p class="text-text-light">${comment.commentText}</p>
                `;
                commentsListDiv.appendChild(commentDiv);
            });
        });
    } catch (error) {
        console.error("Error loading comments:", error);
        commentsLoading.style.display = 'none';
        commentsListDiv.innerHTML = '<p class="text-center text-red-400">Failed to load comments. Please try again later.</p>';
    }
}

// Handle comment form submission
document.getElementById('commentForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!isAuthReady || !db || !currentUserId) {
        displayCommentMessage('Authentication not ready. Please wait a moment.', 'error');
        return;
    }

    const userName = document.getElementById('userName').value.trim();
    const commentText = document.getElementById('commentText').value.trim();

    if (!commentText) {
        displayCommentMessage('Comment cannot be empty.', 'error');
        return;
    }

    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const commentsCollectionRef = collection(db, `/artifacts/${appId}/public/data/comments`);

        await addDoc(commentsCollectionRef, {
            userId: currentUserId,
            userName: userName || 'Anonymous', // Use 'Anonymous' if name is empty
            commentText: commentText,
            timestamp: serverTimestamp() // Firestore server timestamp
        });

        displayCommentMessage('Comment posted successfully!', 'success');
        this.reset(); // Clear the form
    } catch (error) {
        console.error("Error adding comment:", error);
        displayCommentMessage('Failed to post comment. Please try again.', 'error');
    }
});

// Music Player Logic
const audioPlayer = document.getElementById('audioPlayer');
const playPauseButton = document.getElementById('playPauseButton');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const progressBar = document.getElementById('progressBar');
const volumeSlider = document.getElementById('volumeSlider');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');
const currentSongTitle = document.getElementById('currentSongTitle');

// Placeholder for your music files. Replace with actual URLs.
// For Hostinger, you might upload these to your file manager and link them.
const playlist = [
    { title: "FIFA Menu Theme 1 (Placeholder)", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { title: "FIFA Menu Theme 2 (Placeholder)", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { title: "FIFA Menu Theme 3 (Placeholder)", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];
let currentSongIndex = 0;

function loadSong(index) {
    const song = playlist[index];
    audioPlayer.src = song.src;
    currentSongTitle.textContent = song.title;
    audioPlayer.load(); // Load the new song
}

function playSong() {
    audioPlayer.play();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
}

function pauseSong() {
    audioPlayer.pause();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
}

function togglePlayPause() {
    if (audioPlayer.paused) {
        playSong();
    } else {
        pauseSong();
    }
}

function nextSong() {
    currentSongIndex = (currentSongIndex + 1) % playlist.length;
    loadSong(currentSongIndex);
    playSong();
}

function prevSong() {
    currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    loadSong(currentSongIndex);
    playSong();
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Event Listeners for Music Player
playPauseButton.addEventListener('click', togglePlayPause);
nextButton.addEventListener('click', nextSong);
prevButton.addEventListener('click', prevSong);

audioPlayer.addEventListener('timeupdate', () => {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = progress || 0; // Handle NaN if duration is not available yet
    currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
});

audioPlayer.addEventListener('loadedmetadata', () => {
    durationSpan.textContent = formatTime(audioPlayer.duration);
    // Set initial volume
    audioPlayer.volume = volumeSlider.value / 100;
});

audioPlayer.addEventListener('ended', nextSong); // Play next song when current ends

progressBar.addEventListener('input', () => {
    const seekTime = (progressBar.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
});

volumeSlider.addEventListener('input', () => {
    audioPlayer.volume = volumeSlider.value / 100;
});

// Initialize the first song
loadSong(currentSongIndex);