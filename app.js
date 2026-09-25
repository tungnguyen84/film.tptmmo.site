/**
 * DRAMAPLAY - CLIENT APP CONTROLLER
 * Tự động chuyển tập, vuốt màn hình chuyển tập, kết nối Google Drive
 */

// Sample Demo Data (Hiển thị mẫu khi chưa kết nối Google Drive)
const DEMO_MOVIES = [
  {
    id: "demo_1",
    title: "Tuột Mất Luna, Gặp Lại Nữ Hoàng",
    total_episodes: 5,
    episodes: [
      { id: "e1", name: "Tập 01", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
      { id: "e2", name: "Tập 02", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
      { id: "e3", name: "Tập 03", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" },
      { id: "e4", name: "Tập 04", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4" },
      { id: "e5", name: "Tập 05", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4" }
    ]
  },
  {
    id: "demo_2",
    title: "Tình Yêu Giữa Hai Thế Giới",
    total_episodes: 3,
    episodes: [
      { id: "e2_1", name: "Tập 01", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
      { id: "e2_2", name: "Tập 02", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4" },
      { id: "e2_3", name: "Tập 03", stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" }
    ]
  }
];

class DramaPlayApp {
  constructor() {
    this.movies = [];
    this.currentMovie = null;
    this.currentEpIndex = 0;
    this.autoNextTimer = null;
    this.touchStartY = 0;
    this.playbackSpeeds = [1.0, 1.25, 1.5, 2.0];
    this.speedIndex = 0;
    this.wakeLock = null;

    this.initElements();
    this.loadSettings();
    this.initEvents();
    this.fetchData();
    this.checkResume();
  }

  initElements() {
    this.movieListEl = document.getElementById('movieGrid');
    this.searchInput = document.getElementById('searchInput');
    this.resumeBanner = document.getElementById('resumeBanner');
    this.resumeTitle = document.getElementById('resumeTitle');

    // Player Elements
    this.playerModal = document.getElementById('playerModal');
    this.videoEl = document.getElementById('mainVideo');
    this.driveEmbed = document.getElementById('driveEmbed');
    this.centerPlayBtn = document.getElementById('centerPlayBtn');
    this.movieNameEl = document.getElementById('currentMovieName');
    this.epNameEl = document.getElementById('currentEpName');
    this.btnSpeed = document.getElementById('btnSpeed');
    this.btnEpList = document.getElementById('btnEpList');
    this.autoNextOverlay = document.getElementById('autoNextOverlay');
    this.autoNextCountdown = document.getElementById('autoNextCountdown');
    this.epDrawer = document.getElementById('episodesDrawer');
    this.episodesGrid = document.getElementById('episodesGrid');
    this.controlsTimeout = null;
    this.singleTapTimeout = null;

    // Settings Modal
    this.settingsModal = document.getElementById('settingsModal');
    this.scriptUrlInput = document.getElementById('scriptUrlInput');
    this.folderIdInput = document.getElementById('folderIdInput');
  }

  loadSettings() {
    this.scriptUrl = localStorage.getItem('dramaplay_script_url') || 'https://script.google.com/macros/s/AKfycbxQlJD1OfbIGa_csySw1JjGPvuTyW8Air-DLvAF2RXSTRuC8a2SCBdVh_0DPLDpwqrtFQ/exec';
    this.folderId = localStorage.getItem('dramaplay_folder_id') || '1TvAthXpZpP1vv1Lv9wYp8lZrvMo3FWB7';
    if (this.scriptUrlInput) this.scriptUrlInput.value = this.scriptUrl;
    if (this.folderIdInput) this.folderIdInput.value = this.folderId;
  }

  saveSettings() {
    this.scriptUrl = this.scriptUrlInput.value.trim();
    this.folderId = this.folderIdInput.value.trim();
    localStorage.setItem('dramaplay_script_url', this.scriptUrl);
    localStorage.setItem('dramaplay_folder_id', this.folderId);
    this.closeSettings();
    this.fetchData(true);
  }

  scheduleControlsHide(delay = 2500) {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (this.isDriveMode || (this.videoEl && !this.videoEl.paused)) {
        this.playerModal.classList.add('controls-hidden');
      }
    }, delay);
  }

  showControls(autoHide = true) {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.playerModal.classList.remove('controls-hidden');
    if (autoHide && (this.isDriveMode || (this.videoEl && !this.videoEl.paused))) {
      this.scheduleControlsHide(2500);
    }
  }

  toggleControls() {
    if (this.playerModal.classList.contains('controls-hidden')) {
      this.showControls(true);
    } else {
      this.playerModal.classList.add('controls-hidden');
    }
  }

  togglePlay() {
    if (this.isDriveMode) return;
    if (!this.videoEl) return;
    if (this.videoEl.paused) {
      this.videoEl.play();
    } else {
      this.videoEl.pause();
    }
  }

  initEvents() {
    // Search
    this.searchInput.addEventListener('input', () => this.filterMovies());

    // Reveal top bar only when mouse moves near the top edge
    this.playerModal.addEventListener('mousemove', (e) => {
      if (e.clientY < 70) {
        this.showControls(true);
      }
    });

    // Video Events
    this.videoEl.addEventListener('ended', () => this.handleVideoEnded());
    this.videoEl.addEventListener('timeupdate', () => this.saveCurrentProgress());
    this.videoEl.addEventListener('error', (e) => this.handleVideoError(e));

    this.videoEl.addEventListener('play', () => {
      if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';
      this.scheduleControlsHide(2000);
    });

    this.videoEl.addEventListener('pause', () => {
      if (!this.isDriveMode && this.centerPlayBtn && !this.videoEl.ended) {
        this.centerPlayBtn.style.display = 'flex';
        this.showControls(false);
      }
    });

    if (this.centerPlayBtn) {
      this.centerPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isDriveMode) {
          this.videoEl.play();
        }
      });
    }

    // Swipe Touch Gestures on Video
    this.videoEl.addEventListener('touchstart', (e) => {
      this.touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    this.videoEl.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].screenY;
      const diffY = touchEndY - this.touchStartY;
      // Vuốt lên (Swipe Up) -> Tập tiếp theo
      if (diffY < -70) {
        this.nextEpisode();
      } 
      // Vuốt xuống (Swipe Down) -> Tập trước
      else if (diffY > 70) {
        this.prevEpisode();
      }
    }, { passive: true });

    // Click / Double tap on video
    let lastTap = 0;
    this.videoEl.addEventListener('click', (e) => {
      const now = new Date().getTime();
      const timesince = now - lastTap;
      if (timesince < 300 && timesince > 0) {
        // Double tap seek
        if (this.singleTapTimeout) clearTimeout(this.singleTapTimeout);
        const rect = this.videoEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width / 2) {
          this.videoEl.currentTime = Math.min(this.videoEl.duration, this.videoEl.currentTime + 10);
        } else {
          this.videoEl.currentTime = Math.max(0, this.videoEl.currentTime - 10);
        }
      } else {
        // Single tap: toggle controls hide/show (allows reading subtitles without bars)
        if (this.singleTapTimeout) clearTimeout(this.singleTapTimeout);
        this.singleTapTimeout = setTimeout(() => {
          this.toggleControls();
        }, 280);
      }
      lastTap = now;
    });

    // Speed Cycle
    if (this.btnSpeed) {
      this.btnSpeed.addEventListener('click', () => this.cyclePlaybackSpeed());
    }

    // Drawer Open/Close
    this.btnEpList.addEventListener('click', () => this.openEpisodesDrawer());
  }

  async fetchData(force = false) {
    if (!force) {
      // 1. Load instantly from Server movies.json (0.01s load)
      try {
        const res = await fetch(`./movies.json?t=${Date.now()}`);
        if (res.ok) {
          const sMovies = await res.json();
          if (Array.isArray(sMovies) && sMovies.length > 0) {
            this.movies = sMovies;
            this.renderMovies(this.movies);
            return;
          }
        }
      } catch (e) {}

      // 2. Load instantly from Cache if available
      const cached = localStorage.getItem('dramaplay_cached_movies');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.movies = parsed;
            this.renderMovies(this.movies);
            return;
          }
        } catch (e) {}
      }
    }

    if (this.scriptUrl && this.folderId) {
      this.movieListEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 40px 10px; color: #aaa;">
          <div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>
          Đang kết nối Google Drive và quét danh sách phim...
        </div>
      `;
      try {
        const url = `${this.scriptUrl}?folderId=${encodeURIComponent(this.folderId)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && data.movies && data.movies.length > 0) {
          this.movies = data.movies;
          localStorage.setItem('dramaplay_cached_movies', JSON.stringify(data.movies));
          this.renderMovies(this.movies);
          return;
        } else {
          alert("Lỗi từ Google Drive: " + (data.error || "Không tìm thấy phim"));
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    }

    // Default to sample demo movies if not configured
    this.movies = DEMO_MOVIES;
    this.renderMovies(this.movies);
  }

  async syncDriveInBackground() {
    if (!this.scriptUrl || !this.folderId) return;
    try {
      const url = `${this.scriptUrl}?folderId=${encodeURIComponent(this.folderId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.movies && data.movies.length > 0) {
        this.movies = data.movies;
        localStorage.setItem('dramaplay_cached_movies', JSON.stringify(data.movies));
        this.renderMovies(this.movies);
      }
    } catch (e) {
      console.log("Background sync error (safe to ignore):", e);
    }
  }

  renderMovies(list) {
    this.movieListEl.innerHTML = '';
    if (!list || list.length === 0) {
      this.movieListEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 40px 10px; color: #777;">
          Không tìm thấy bộ phim nào phù hợp.
        </div>
      `;
      return;
    }

    list.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = 'movie-card';
      
      const posterHtml = m.poster_url 
        ? `<img src="${m.poster_url}" class="movie-poster" alt="${m.title}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="movie-thumb-fallback" style="display:none;">🎬</div>`
        : `<div class="movie-thumb-fallback">🎬</div>`;

      card.innerHTML = `
        <div class="movie-thumb">
          ${posterHtml}
          <span class="ep-badge">${m.total_episodes} Tập</span>
        </div>
        <div class="movie-details">
          <div class="movie-title">${m.title}</div>
          <div class="movie-meta">${m.total_episodes} Tập • Drive</div>
        </div>
      `;
      card.addEventListener('click', () => this.startPlayMovie(m, 0));
      this.movieListEl.appendChild(card);
    });
  }

  filterMovies() {
    const q = this.searchInput.value.trim().toLowerCase();
    if (!q) {
      this.renderMovies(this.movies);
      return;
    }
    const filtered = this.movies.filter(m => m.title.toLowerCase().includes(q));
    this.renderMovies(filtered);
  }

  startPlayMovie(movie, epIndex = 0, resumeTime = 0) {
    this.currentMovie = movie;
    this.currentEpIndex = Math.max(0, Math.min(epIndex, movie.episodes.length - 1));
    this.playerModal.classList.add('active');
    this.requestWakeLock();
    this.playCurrentEpisode(resumeTime);
  }

  playCurrentEpisode(startTime = 0) {
    if (!this.currentMovie || !this.currentMovie.episodes[this.currentEpIndex]) return;

    this.cancelAutoNext();

    const ep = this.currentMovie.episodes[this.currentEpIndex];
    this.movieNameEl.textContent = this.currentMovie.title;
    this.epNameEl.textContent = `${ep.name} (${this.currentEpIndex + 1}/${this.currentMovie.episodes.length})`;
    this.btnEpList.innerHTML = `📑 Tập ${this.currentEpIndex + 1}/${this.currentMovie.episodes.length}`;

    // Ưu tiên phát video qua luồng trực tiếp Nginx /stream/?id= (xem mượt từ đầu đến cuối, không dừng 7s, không che phụ đề)
    const streamUrl = ep.id ? `/stream/?id=${ep.id}` : (ep.stream_url || ep.download_url);
    
    this.driveEmbed.style.display = 'none';
    this.driveEmbed.src = '';
    this.videoEl.style.display = 'block';
    if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';

    this.videoEl.src = streamUrl;
    this.videoEl.load();

    const doPlay = () => {
      if (startTime > 0 && startTime < this.videoEl.duration) {
        this.videoEl.currentTime = startTime;
      }
      this.videoEl.play().catch(err => {
        console.log("Chờ người dùng tương tác để phát:", err);
      });
    };

    doPlay();
    this.videoEl.onloadedmetadata = () => { doPlay(); };
    this.videoEl.oncanplay = () => { doPlay(); };

    // Nếu Nginx chưa reload cấu hình stream, tự động fallback sang Google iframe
    this.videoEl.onerror = () => {
      console.warn("Chưa cấu hình /stream/, chuyển sang Google iframe dự phòng...");
      this.videoEl.style.display = 'none';
      this.driveEmbed.style.display = 'block';
      this.driveEmbed.src = ep.preview_url || `https://drive.google.com/file/d/${ep.id}/preview`;
    };

    this.videoEl.playbackRate = this.playbackSpeeds[this.speedIndex];
    this.showControls(true);
    this.scheduleControlsHide(2500);

    this.updateDrawerActiveState();
  }

  handleVideoError(e) {
    console.warn("Direct video stream failed, switching to Drive preview embed fallback...");
    const ep = this.currentMovie ? this.currentMovie.episodes[this.currentEpIndex] : null;
    if (ep && (ep.preview_url || ep.id)) {
      this.isDriveMode = true;
      this.videoEl.pause();
      this.videoEl.src = '';
      this.videoEl.style.display = 'none';
      if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';
      this.driveEmbed.style.display = 'block';
      this.driveEmbed.src = ep.preview_url || `https://drive.google.com/file/d/${ep.id}/preview`;
      this.scheduleControlsHide(3000);
    }
  }

  handleVideoEnded() {
    if (this.currentEpIndex < this.currentMovie.episodes.length - 1) {
      this.startAutoNextCountdown();
    } else {
      alert("🎉 Bạn đã xem hết trọn bộ phim này!");
    }
  }

  startAutoNextCountdown() {
    let timeLeft = 2; // 2 seconds countdown
    this.autoNextCountdown.textContent = timeLeft;
    this.autoNextOverlay.classList.add('active');

    this.autoNextTimer = setInterval(() => {
      timeLeft -= 1;
      this.autoNextCountdown.textContent = timeLeft;
      if (timeLeft <= 0) {
        this.cancelAutoNext();
        this.nextEpisode();
      }
    }, 1000);
  }

  cancelAutoNext() {
    if (this.autoNextTimer) {
      clearInterval(this.autoNextTimer);
      this.autoNextTimer = null;
    }
    this.autoNextOverlay.classList.remove('active');
  }

  nextEpisode() {
    this.cancelAutoNext();
    if (!this.currentMovie) return;
    if (this.currentEpIndex < this.currentMovie.episodes.length - 1) {
      this.currentEpIndex++;
      this.playCurrentEpisode();
    } else {
      alert("Đã đến tập cuối của bộ phim!");
    }
  }

  prevEpisode() {
    this.cancelAutoNext();
    if (!this.currentMovie) return;
    if (this.currentEpIndex > 0) {
      this.currentEpIndex--;
      this.playCurrentEpisode();
    }
  }

  cyclePlaybackSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.playbackSpeeds.length;
    const speed = this.playbackSpeeds[this.speedIndex];
    this.videoEl.playbackRate = speed;
    this.btnSpeed.textContent = `${speed}x`;
  }

  openEpisodesDrawer() {
    if (!this.currentMovie) return;
    this.episodesGrid.innerHTML = '';
    this.currentMovie.episodes.forEach((ep, idx) => {
      const btn = document.createElement('div');
      btn.className = `ep-item ${idx === this.currentEpIndex ? 'current' : ''}`;
      btn.textContent = `Tập ${idx + 1}`;
      btn.addEventListener('click', () => {
        this.currentEpIndex = idx;
        this.playCurrentEpisode();
        this.closeEpisodesDrawer();
      });
      this.episodesGrid.appendChild(btn);
    });
    this.epDrawer.classList.add('active');
  }

  updateDrawerActiveState() {
    const items = this.episodesGrid.querySelectorAll('.ep-item');
    items.forEach((item, idx) => {
      if (idx === this.currentEpIndex) {
        item.classList.add('current');
      } else {
        item.classList.remove('current');
      }
    });
  }

  closeEpisodesDrawer() {
    this.epDrawer.classList.remove('active');
  }

  closePlayer() {
    this.cancelAutoNext();
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.isDriveMode = false;
    this.playerModal.classList.remove('drive-mode');
    this.videoEl.pause();
    this.videoEl.src = '';
    this.driveEmbed.src = '';
    this.playerModal.classList.remove('active');
    this.playerModal.classList.remove('controls-hidden');
    if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';
    this.releaseWakeLock();
    this.checkResume();
  }

  saveCurrentProgress() {
    if (!this.currentMovie || !this.videoEl.currentTime) return;
    const history = {
      movieId: this.currentMovie.id,
      movieTitle: this.currentMovie.title,
      epIndex: this.currentEpIndex,
      epName: this.currentMovie.episodes[this.currentEpIndex].name,
      time: Math.floor(this.videoEl.currentTime)
    };
    localStorage.setItem('dramaplay_last_watch', JSON.stringify(history));
  }

  checkResume() {
    const raw = localStorage.getItem('dramaplay_last_watch');
    if (!raw) {
      this.resumeBanner.style.display = 'none';
      return;
    }
    try {
      const hist = JSON.parse(raw);
      this.resumeTitle.textContent = `${hist.movieTitle} - ${hist.epName}`;
      this.resumeBanner.style.display = 'flex';
      this.resumeBanner.onclick = () => {
        const found = this.movies.find(m => m.id === hist.movieId || m.title === hist.movieTitle);
        if (found) {
          this.startPlayMovie(found, hist.epIndex, hist.time);
        } else {
          alert("Không tìm thấy bộ phim trong danh sách hiện tại!");
        }
      };
    } catch (e) {
      this.resumeBanner.style.display = 'none';
    }
  }

  openSettings() {
    this.settingsModal.classList.add('active');
  }

  closeSettings() {
    this.settingsModal.classList.remove('active');
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {}
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}

// Global Launcher
let appInstance = null;
window.addEventListener('DOMContentLoaded', () => {
  appInstance = new DramaPlayApp();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.log("SW Error:", e));
  }
});
