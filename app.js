class SimpleMusicPlayer {
    constructor() {
        this.library = [];
        this.playlists = [];
        this.currentPlaylist = [];
        this.currentTrackIndex = -1;
        this.queue = [];
        this.isPlaying = false;
        this.shuffle = false;
        this.repeat = 'none'; // 'none', 'one', 'all'
        this.volume = 0.8;
        this.currentView = 'library';
        this.currentSort = 'added';
        this.searchQuery = '';
        
        this.audio = null;
        this.init();
    }

    async init() {
        console.log('🎵 Simple Music Player Initializing...');
        this.setupEventListeners();
        this.updateUI();
        console.log('✅ Player Ready');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchView(e.currentTarget.dataset.view);
            });
        });

        // Import buttons
        document.getElementById('import-btn').addEventListener('click', () => this.showModal('import-modal'));
        document.getElementById('add-music-btn').addEventListener('click', () => this.showModal('import-modal'));
        document.getElementById('import-first-btn')?.addEventListener('click', () => this.showModal('import-modal'));

        // Import modal buttons
        document.getElementById('import-files-btn').addEventListener('click', () => this.handleImportFiles());
        document.getElementById('import-folder-btn').addEventListener('click', () => this.handleImportFolder());

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('active');
                });
            });
        });

        // Click outside to close modals
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });

        // Player controls
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('prev-btn').addEventListener('click', () => this.previousTrack());
        document.getElementById('next-btn').addEventListener('click', () => this.nextTrack());
        document.getElementById('shuffle-btn').addEventListener('click', () => this.toggleShuffle());
        document.getElementById('repeat-btn').addEventListener('click', () => this.toggleRepeat());

        // Volume control
        const volumeSlider = document.getElementById('volume-slider');
        volumeSlider.addEventListener('input', (e) => {
            this.setVolume(e.target.value / 100);
        });

        // Progress bar
        const progressBar = document.querySelector('.progress-bar');
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.seek(percent);
        });

        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderLibrary();
        });

        // Sort tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentSort = e.currentTarget.dataset.sort;
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.sortLibrary();
                this.renderLibrary();
            });
        });

        // Shuffle all
        document.getElementById('shuffle-all-btn').addEventListener('click', () => this.shuffleAll());

        // New playlist
        document.getElementById('new-playlist-btn').addEventListener('click', () => this.showModal('playlist-modal'));
        document.getElementById('create-playlist-btn').addEventListener('click', () => this.createPlaylist());
        document.getElementById('cancel-playlist-btn').addEventListener('click', () => {
            document.getElementById('playlist-modal').classList.remove('active');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey) this.nextTrack();
                    break;
                case 'ArrowLeft':
                    if (e.ctrlKey) this.previousTrack();
                    break;
                case 'ArrowUp':
                    if (e.ctrlKey) this.setVolume(Math.min(1, this.volume + 0.1));
                    break;
                case 'ArrowDown':
                    if (e.ctrlKey) this.setVolume(Math.max(0, this.volume - 0.1));
                    break;
            }
        });
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    async handleImportFiles() {
        try {
            const files = await window.electronAPI.openFileDialog();
            if (files.length > 0) {
                await this.processFiles(files);
            }
        } catch (error) {
            this.showMessage('Error importing files: ' + error.message);
        }
    }

    async handleImportFolder() {
        try {
            const folder = await window.electronAPI.openFolderDialog();
            if (folder) {
                const audioFiles = await window.electronAPI.scanFolderForAudio(folder);
                if (audioFiles.length > 0) {
                    await this.processFiles(audioFiles);
                } else {
                    this.showMessage('No audio files found in this folder');
                }
            }
        } catch (error) {
            this.showMessage('Error importing folder: ' + error.message);
        }
    }

    async processFiles(filePaths) {
        // Show loading state
        const songsList = document.getElementById('songs-list');
        songsList.innerHTML = '<div class="loading">Loading tracks...</div>';
        
        try {
            const tracks = await window.electronAPI.parseAudioFiles(filePaths);
            
            // Add to library
            this.library.push(...tracks);
            
            // Update UI
            this.sortLibrary();
            this.renderLibrary();
            
            // Hide modal
            document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
            
            // Auto-play first track if nothing is playing
            if (this.currentTrackIndex === -1 && tracks.length > 0) {
                this.playTrack(0);
            }
            
            console.log(`✅ Added ${tracks.length} tracks to library`);
        } catch (error) {
            this.showMessage('Error loading files: ' + error.message);
        }
    }

    sortLibrary() {
        switch(this.currentSort) {
            case 'title':
                this.library.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'artist':
                this.library.sort((a, b) => a.artist.localeCompare(b.artist));
                break;
            case 'album':
                this.library.sort((a, b) => a.album.localeCompare(b.album));
                break;
            case 'added':
            default:
                this.library.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
                break;
        }
    }

    renderLibrary() {
        const songsList = document.getElementById('songs-list');
        
        if (this.library.length === 0) {
            songsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <h3>No music yet</h3>
                    <p>Import your music to get started</p>
                    <button class="btn" id="import-first-btn">
                        <i class="fas fa-folder-plus"></i>
                        Import Music
                    </button>
                </div>
            `;
            
            // Re-attach event listener
            document.getElementById('import-first-btn')?.addEventListener('click', () => {
                this.showModal('import-modal');
            });
            return;
        }

        // Filter based on search
        let filtered = this.library;
        if (this.searchQuery) {
            filtered = this.library.filter(track =>
                track.title.toLowerCase().includes(this.searchQuery) ||
                track.artist.toLowerCase().includes(this.searchQuery) ||
                track.album.toLowerCase().includes(this.searchQuery)
            );
        }

        if (filtered.length === 0) {
            songsList.innerHTML = '<div class="empty-state">No songs match your search</div>';
            return;
        }

        // Render songs
        songsList.innerHTML = filtered.map((track, index) => `
            <div class="song-item ${index === this.currentTrackIndex ? 'active' : ''}" data-index="${index}">
                <div class="song-number">${index + 1}</div>
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(track.title)}</div>
                    <div class="song-artist">${this.escapeHtml(track.artist)}</div>
                </div>
                <div class="song-album">${this.escapeHtml(track.album)}</div>
                <div class="song-duration">${this.formatTime(track.duration)}</div>
                <div class="song-actions">
                    <button class="song-action-btn" data-action="queue" title="Add to queue">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="song-action-btn" data-action="favorite" title="Add to favorites">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Add click listeners
        document.querySelectorAll('.song-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.song-actions')) {
                    const index = parseInt(item.dataset.index);
                    this.playTrack(index);
                }
            });
        });

        // Add action button listeners
        document.querySelectorAll('[data-action="queue"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.closest('.song-item').dataset.index);
                this.addToQueue(this.library[index]);
            });
        });

        document.querySelectorAll('[data-action="favorite"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.closest('.song-item').dataset.index);
                this.toggleFavorite(this.library[index]);
            });
        });
    }

    playTrack(index) {
        if (index < 0 || index >= this.library.length) return;
        
        this.currentTrackIndex = index;
        const track = this.library[index];
        
        // Update UI
        this.updateNowPlaying(track);
        this.renderLibrary();
        
        // Play audio
        this.playAudio(track.path);
    }

    playAudio(path) {
        // Stop current audio
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        
        // Create new audio element
        this.audio = new Audio(path);
        this.audio.volume = this.volume;
        
        // Setup event listeners
        this.audio.onplay = () => {
            this.isPlaying = true;
            this.updatePlayPauseButton(true);
            this.startProgressUpdate();
        };
        
        this.audio.onpause = () => {
            this.isPlaying = false;
            this.updatePlayPauseButton(false);
        };
        
        this.audio.onended = () => {
            this.nextTrack();
        };
        
        this.audio.onerror = (e) => {
            console.error('Audio error:', e);
            this.showMessage('Error playing audio');
        };
        
        // Play
        this.audio.play().catch(e => {
            console.error('Play error:', e);
            this.showMessage('Cannot play audio');
        });
    }

    togglePlayPause() {
        if (!this.audio) {
            if (this.library.length > 0) {
                this.playTrack(0);
            }
            return;
        }
        
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play();
        }
    }

    previousTrack() {
        if (this.library.length === 0) return;
        
        let prevIndex = this.currentTrackIndex - 1;
        if (prevIndex < 0) prevIndex = this.library.length - 1;
        
        this.playTrack(prevIndex);
    }

    nextTrack() {
        if (this.library.length === 0) return;
        
        let nextIndex;
        
        if (this.repeat === 'one') {
            nextIndex = this.currentTrackIndex;
        } else if (this.shuffle) {
            nextIndex = Math.floor(Math.random() * this.library.length);
        } else {
            nextIndex = (this.currentTrackIndex + 1) % this.library.length;
        }
        
        this.playTrack(nextIndex);
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        const shuffleBtn = document.getElementById('shuffle-btn');
        shuffleBtn.classList.toggle('active', this.shuffle);
        shuffleBtn.title = this.shuffle ? 'Shuffle On' : 'Shuffle Off';
    }

    toggleRepeat() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.repeat);
        this.repeat = modes[(currentIndex + 1) % modes.length];
        
        const repeatBtn = document.getElementById('repeat-btn');
        repeatBtn.classList.toggle('active', this.repeat !== 'none');
        repeatBtn.title = `Repeat: ${this.repeat}`;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        
        // Update volume icon
        const volumeIcon = document.getElementById('volume-icon');
        if (volumeIcon) {
            if (this.volume === 0) {
                volumeIcon.className = 'fas fa-volume-mute';
            } else if (this.volume < 0.5) {
                volumeIcon.className = 'fas fa-volume-down';
            } else {
                volumeIcon.className = 'fas fa-volume-up';
            }
        }
        
        // Update slider
        document.getElementById('volume-slider').value = this.volume * 100;
    }

    seek(percent) {
        if (this.audio && this.audio.duration) {
            this.audio.currentTime = this.audio.duration * percent;
        }
    }

    updateNowPlaying(track) {
        // Update main display
        document.getElementById('now-playing-title').textContent = track.title;
        document.getElementById('now-playing-artist').textContent = track.artist;
        document.getElementById('now-playing-album').textContent = track.album;
        
        // Update mini player
        document.getElementById('current-track-title').textContent = track.title;
        document.getElementById('current-track-artist').textContent = track.artist;
        
        // Update duration
        document.getElementById('total-time').textContent = this.formatTime(track.duration);
    }

    updatePlayPauseButton(isPlaying) {
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');
        
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    startProgressUpdate() {
        if (this.progressInterval) clearInterval(this.progressInterval);
        
        this.progressInterval = setInterval(() => {
            if (this.audio && !this.audio.paused && !this.audio.ended) {
                const currentTime = this.audio.currentTime;
                const duration = this.audio.duration || 0;
                
                document.getElementById('current-time').textContent = this.formatTime(currentTime);
                
                if (duration > 0) {
                    const progress = (currentTime / duration) * 100;
                    document.getElementById('progress').style.width = `${progress}%`;
                }
            }
        }, 100);
    }

    switchView(view) {
        this.currentView = view;
        
        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        // Show/hide views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');
    }

    shuffleAll() {
        if (this.library.length === 0) return;
        
        // Create shuffled copy
        const shuffled = [...this.library];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Play first track
        this.playTrack(0);
        this.toggleShuffle();
    }

    addToQueue(track) {
        this.queue.push(track);
        this.showNotification('Added to queue', `${track.title} added to queue`);
    }

    toggleFavorite(track) {
        track.favorite = !track.favorite;
        const icon = track.favorite ? 'fas' : 'far';
        this.showNotification(
            track.favorite ? 'Added to favorites' : 'Removed from favorites',
            track.title
        );
    }

    createPlaylist() {
        const nameInput = document.getElementById('playlist-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            this.showMessage('Please enter a playlist name');
            return;
        }
        
        const playlist = {
            id: Date.now(),
            name: name,
            tracks: [],
            createdAt: new Date().toISOString()
        };
        
        this.playlists.push(playlist);
        this.renderPlaylists();
        
        // Clear and close
        nameInput.value = '';
        document.getElementById('playlist-modal').classList.remove('active');
        
        this.showNotification('Playlist created', `${name} has been created`);
    }

    renderPlaylists() {
        const playlistsList = document.getElementById('playlists-list');
        
        if (this.playlists.length === 0) {
            playlistsList.innerHTML = '<div class="empty-playlists">No playlists yet</div>';
            return;
        }
        
        playlistsList.innerHTML = this.playlists.map(playlist => `
            <button class="playlist-item">
                <i class="fas fa-list"></i>
                <span>${this.escapeHtml(playlist.name)}</span>
                <span class="badge">${playlist.tracks.length}</span>
            </button>
        `).join('');
    }

    showNotification(title, message) {
        // Simple notification - you could make this fancier
        console.log(`📢 ${title}: ${message}`);
        alert(`${title}: ${message}`);
    }

    showMessage(message) {
        const songsList = document.getElementById('songs-list');
        songsList.innerHTML = `<div class="empty-state">${message}</div>`;
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateUI() {
        this.renderLibrary();
        this.renderPlaylists();
        this.setVolume(this.volume);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 Starting Simple Music Player...');
    
    if (!window.electronAPI) {
        console.error('⚠️ Electron API not available');
        alert('This app requires Electron to run properly.');
    }
    
    window.player = new SimpleMusicPlayer();
});