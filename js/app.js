/**
 * DRAMAPLAY PRO - NEXT-GEN MOVIE & SHORT DRAMA STREAMING PLATFORM
 * Hỗ trợ: Giao diện Rạp Phim & Chế độ Vuốt Dọc, Thanh tua thời gian, Đa Server,
 * Tìm kiếm không dấu, Phân loại thể loại tự động, Lịch sử đa phim & Tủ phim yêu thích.
 */

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
  }
];

const CATEGORY_META = {
  'all': { title: 'Kho Phim Đặc Sắc', desc: 'Tất cả các bộ phim ngắn hot nhất' },
  'tong-tai': { title: '💼 Tổng Tài & Ngôn Tình Hào Môn', desc: 'Tình yêu tổng tài, hào môn thế gia, cưới trước yêu sau' },
  'trong-sinh': { title: '🔥 Trọng Sinh & Báo Thù Phản Công', desc: 'Sống lại một đời, xoay chuyển càn khôn, vả mặt kẻ phản bội' },
  'co-trang': { title: '🏮 Cổ Trang & Xuyên Không Cung Đấu', desc: 'Vương phi, thái tử, xuyên không cổ đại đặc sắc' },
  'hanh-dong': { title: '⚡ Kỳ Bí, Hành Động & Đô Thị', desc: 'Đặc vụ, tu tiên, kỳ án dân gian, siêu năng lực' },
  'long-tieng': { title: '🎙️ Phim Bản Lồng Tiếng / Thuyết Minh', desc: 'Xem phim không cần đọc phụ đề, lồng tiếng cảm xúc' },
  'favorites': { title: '❤️ Tủ Phim Yêu Thích Của Bạn', desc: 'Danh sách các bộ phim bạn đã đánh dấu lưu lại' },
  'history': { title: '🕒 Lịch Sử Phim Đã Xem', desc: 'Các bộ phim bạn đang theo dõi gần đây' }
};

class DramaPlayApp {
  constructor() {
    this.movies = [];
    this.filteredMovies = [];
    this.currentCategory = 'all';
    this.currentMovie = null;
    this.currentEpIndex = 0;
    this.currentEpRangeIndex = 0;
    this.epPageSize = 30;
    this.gridPageSize = 48;
    this.renderedCount = 0;

    // Player state
    this.serverMode = 'stream'; // 'stream' (/stream/?id=) | 'direct' (lh3) | 'embed' (drive preview)
    this.streamProxyAvailable = true; // Auto-detects if /stream/ works on current host
    this.isDriveMode = false;
    this.isVerticalMode = window.innerWidth <= 640; // Default vertical on phone, theater on PC
    this.autoNextEnabled = localStorage.getItem('dramaplay_autonext') !== 'false';
    this.autoNextTimer = null;
    this.playbackSpeeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    this.speedIndex = 0;
    this.wakeLock = null;

    // Touch & Gesture state
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.longPressTimer = null;
    this.isLongPressSpeed = false;
    this.savedSpeedBeforeHold = 1.0;
    this.controlsTimeout = null;
    this.singleTapTimeout = null;
    this.toastTimeout = null;
    this.isScrubbing = false;

    // Hero Spotlight state
    this.heroMovies = [];
    this.heroIndex = 0;
    this.heroTimer = null;

    // Persistent User Data (History & Favorites)
    this.watchHistory = this.loadWatchHistory();
    this.favorites = this.loadFavorites();

    this.initElements();
    this.loadSettings();
    this.initEvents();
    this.updateBadges();
    this.updateAutoNextUI();
    this.updateViewModeUI();
    this.fetchData();
  }

  /* ==================== UTILITIES & DATA ENRICHMENT ==================== */

  removeAccents(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  cleanMovieTitle(raw) {
    if (!raw) return 'Phim chưa đặt tên';
    let t = raw.replace(/_/g, ': ').replace(/\s+/g, ' ').trim();
    // Viết hoa chữ cái đầu nếu bị viết thường
    if (t.length > 0 && t[0] === t[0].toLowerCase() && t[0] !== t[0].toUpperCase()) {
      t = t.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
    }
    return t;
  }

  classifyMovie(rawTitle) {
    const lower = (rawTitle || '').toLowerCase();
    const noAcc = this.removeAccents(lower);
    const cats = new Set();
    const tags = [];

    const isDubbed = lower.includes('lồng tiếng') || lower.includes('thuyết minh') || noAcc.includes('long tieng');
    if (isDubbed) {
      cats.add('long-tieng');
      tags.push('🎙️ Lồng Tiếng');
    }

    if (/tái sinh|trọng sinh|cải mệnh|trở lại|báo thù|phản công|hối lỗi|về 1998|từ biệt|cứu vãn|hận thù/.test(lower)) {
      cats.add('trong-sinh');
      tags.push('Trọng Sinh • Báo Thù');
    }

    if (/thái tử|vương phi|y phi|đại đường|tân nương|nữ hoàng|cổ trang|thái bình|y quán|hoàng hậu|cung/.test(lower)) {
      cats.add('co-trang');
      tags.push('Cổ Trang');
    }

    if (/đặc vụ|quái thú|tế sống|kỳ án|thần ẩn|trùm trường|thông thiên|người sói|vua sói|tâm thần|tù long|tu tiên|tà y|vệ sĩ|xác sống|xuất ngũ|tâm lý sư|bóng tối/.test(lower)) {
      cats.add('hanh-dong');
      tags.push('Kỳ Bí • Hành Động');
    }

    if (/tình|yêu|tổng tài|ceo|vợ|tiểu thư|thiên kim|đại gia|hợp đồng|anh trai|bé cưng|trọn đời|mãi là em|vạn vì sao|nhà quê|trang điểm|vũ khúc/.test(lower) || cats.size === 0 || (cats.size === 1 && cats.has('long-tieng'))) {
      cats.add('tong-tai');
      tags.push('Tổng Tài • Ngôn Tình');
    }

    return {
      categories: Array.from(cats),
      primaryGenre: tags.find(t => !t.includes('Lồng Tiếng')) || 'Ngôn Tình • Kịch Tính',
      isDubbed
    };
  }

  enrichMovie(m) {
    const displayTitle = this.cleanMovieTitle(m.title);
    const searchKey = `${m.title.toLowerCase()} ${displayTitle.toLowerCase()} ${this.removeAccents(displayTitle)}`;
    const { categories, primaryGenre, isDubbed } = this.classifyMovie(m.title);
    const totalEps = (m.episodes && m.episodes.length) || m.total_episodes || 0;
    const firstEpId = (m.episodes && m.episodes[0] && (m.episodes[0].id || m.episodes[0])) || '';
    const fallbackPoster = firstEpId && !String(firstEpId).startsWith('e')
      ? `https://drive.google.com/thumbnail?id=${firstEpId}&sz=w400`
      : '';

    return {
      ...m,
      displayTitle,
      searchKey,
      categories,
      primaryGenre,
      isDubbed,
      total_episodes: totalEps,
      fallbackPoster
    };
  }

  formatEpisodeShort(index) {
    const num = index + 1;
    return `Tập ${num < 10 ? '0' + num : num}`;
  }

  formatTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '00:00';
    const total = Math.max(0, Math.floor(sec));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  }

  /* ==================== STORAGE: HISTORY & FAVORITES ==================== */

  loadWatchHistory() {
    let hist = {};
    try {
      const rawV2 = localStorage.getItem('dramaplay_history_v2');
      if (rawV2) {
        hist = JSON.parse(rawV2) || {};
      }
      // Migrate legacy single-movie history if present
      const legacy = localStorage.getItem('dramaplay_last_watch');
      if (legacy) {
        const old = JSON.parse(legacy);
        if (old && old.movieId && !hist[old.movieId]) {
          hist[old.movieId] = {
            movieId: old.movieId,
            movieTitle: old.movieTitle,
            epIndex: old.epIndex || 0,
            time: old.time || 0,
            duration: 120,
            watchedEps: [old.epIndex || 0],
            updatedAt: Date.now()
          };
        }
      }
    } catch (e) {}
    return hist;
  }

  saveWatchHistoryMap() {
    try {
      localStorage.setItem('dramaplay_history_v2', JSON.stringify(this.watchHistory));
      this.updateBadges();
    } catch (e) {}
  }

  loadFavorites() {
    try {
      const raw = localStorage.getItem('dramaplay_favorites_v2');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch (e) {}
    return new Set();
  }

  saveFavorites() {
    try {
      localStorage.setItem('dramaplay_favorites_v2', JSON.stringify(Array.from(this.favorites)));
      this.updateBadges();
    } catch (e) {}
  }

  /* ==================== INITIALIZATION ==================== */

  initElements() {
    this.movieListEl = document.getElementById('movieGrid');
    this.searchInput = document.getElementById('searchInput');
    this.searchClearBtn = document.getElementById('searchClearBtn');
    this.searchDropdown = document.getElementById('searchDropdown');

    // Hero Elements
    this.heroSection = document.getElementById('heroSection');
    this.heroBackdrop = document.getElementById('heroBackdrop');
    this.heroPoster = document.getElementById('heroPoster');
    this.heroEpTag = document.getElementById('heroEpTag');
    this.heroBadges = document.getElementById('heroBadges');
    this.heroTitle = document.getElementById('heroTitle');
    this.heroDesc = document.getElementById('heroDesc');
    this.heroPlayBtn = document.getElementById('heroPlayBtn');
    this.heroFavBtn = document.getElementById('heroFavBtn');
    this.heroDots = document.getElementById('heroDots');

    // Continue Watching & Catalog
    this.continueSection = document.getElementById('continueSection');
    this.continueCarousel = document.getElementById('continueCarousel');
    this.catalogTitle = document.getElementById('catalogTitle');
    this.movieCountBadge = document.getElementById('movieCountBadge');
    this.lengthFilter = document.getElementById('lengthFilter');
    this.sortSelect = document.getElementById('sortSelect');
    this.historyCountBadge = document.getElementById('historyCountBadge');
    this.favCountBadge = document.getElementById('favCountBadge');
    this.loadMoreContainer = document.getElementById('loadMoreContainer');
    this.btnLoadMore = document.getElementById('btnLoadMore');

    if (this.loadMoreContainer && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          this.renderNextMovieBatch();
        }
      }, { rootMargin: '320px' });
      obs.observe(this.loadMoreContainer);
    }

    // Player Modal Elements
    this.playerModal = document.getElementById('playerModal');
    this.videoStage = document.getElementById('videoStage');
    this.videoCanvas = document.getElementById('videoCanvas');
    this.videoEl = document.getElementById('mainVideo');
    this.driveEmbed = document.getElementById('driveEmbed');
    this.videoLoader = document.getElementById('videoLoader');
    this.videoLoaderText = document.getElementById('videoLoaderText');
    this.gestureToast = document.getElementById('gestureToast');
    this.centerPlayBtn = document.getElementById('centerPlayBtn');
    this.movieNameEl = document.getElementById('currentMovieName');
    this.epNameEl = document.getElementById('currentEpName');
    this.btnViewMode = document.getElementById('btnViewMode');
    this.btnEpList = document.getElementById('btnEpList');
    this.sideFavBtn = document.getElementById('sideFavBtn');
    this.sideEpLabel = document.getElementById('sideEpLabel');

    // Custom Controls
    this.timelineWrapper = document.getElementById('timelineWrapper');
    this.timelineBuffered = document.getElementById('timelineBuffered');
    this.timelineProgress = document.getElementById('timelineProgress');
    this.btnPlayPause = document.getElementById('btnPlayPause');
    this.btnMute = document.getElementById('btnMute');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.currentTimeText = document.getElementById('currentTimeText');
    this.durationText = document.getElementById('durationText');
    this.btnAutoNextToggle = document.getElementById('btnAutoNextToggle');
    this.btnSpeed = document.getElementById('btnSpeed');
    this.driveFallbackBar = document.getElementById('driveFallbackBar');
    this.driveEpBtn = document.getElementById('driveEpBtn');

    // Auto-Next Overlay
    this.autoNextOverlay = document.getElementById('autoNextOverlay');
    this.autoNextEpTitle = document.getElementById('autoNextEpTitle');
    this.autoNextCountdown = document.getElementById('autoNextCountdown');

    // Theater Sidebar
    this.sidebarPoster = document.getElementById('sidebarPoster');
    this.sidebarMovieTitle = document.getElementById('sidebarMovieTitle');
    this.sidebarTags = document.getElementById('sidebarTags');
    this.sidebarProgressText = document.getElementById('sidebarProgressText');
    this.sidebarFavBtn = document.getElementById('sidebarFavBtn');
    this.sidebarEpTotal = document.getElementById('sidebarEpTotal');
    this.epJumpInput = document.getElementById('epJumpInput');
    this.sidebarRangeTabs = document.getElementById('sidebarRangeTabs');
    this.sidebarEpGrid = document.getElementById('sidebarEpGrid');
    this.relatedMoviesList = document.getElementById('relatedMoviesList');

    // Mobile Drawer
    this.drawerBackdrop = document.getElementById('drawerBackdrop');
    this.epDrawer = document.getElementById('episodesDrawer');
    this.drawerMovieTitle = document.getElementById('drawerMovieTitle');
    this.drawerSubtitle = document.getElementById('drawerSubtitle');
    this.drawerRangeTabs = document.getElementById('drawerRangeTabs');
    this.episodesGrid = document.getElementById('episodesGrid');

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

    const savedVol = localStorage.getItem('dramaplay_volume');
    if (savedVol !== null && this.videoEl) {
      const v = parseFloat(savedVol);
      if (!isNaN(v)) {
        this.videoEl.volume = Math.max(0, Math.min(1, v));
        if (this.volumeSlider) this.volumeSlider.value = this.videoEl.volume;
      }
    }
  }

  saveSettings() {
    this.scriptUrl = this.scriptUrlInput.value.trim();
    this.folderId = this.folderIdInput.value.trim();
    localStorage.setItem('dramaplay_script_url', this.scriptUrl);
    localStorage.setItem('dramaplay_folder_id', this.folderId);
    this.closeSettings();
    this.fetchData(true);
  }

  /* ==================== EVENTS & GESTURES ==================== */

  initEvents() {
    // Search input & live dropdown
    this.searchInput.addEventListener('input', () => {
      const val = this.searchInput.value;
      if (this.searchClearBtn) {
        this.searchClearBtn.style.display = val.length > 0 ? 'flex' : 'none';
      }
      this.renderSearchDropdown(val);
      this.applyFilters();
    });

    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.trim().length > 0) {
        this.renderSearchDropdown(this.searchInput.value);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchWrapper')) {
        this.searchDropdown.classList.remove('active');
      }
    });

    // Browser back button closes player cleanly
    window.addEventListener('popstate', () => {
      if (this.playerModal.classList.contains('active') && !location.hash.startsWith('#watch')) {
        this.closePlayer(true);
      }
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (!this.playerModal.classList.contains('active')) {
        if (e.key === '/') {
          e.preventDefault();
          this.searchInput.focus();
        }
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          this.seekRelative(5);
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          this.seekRelative(-5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (this.isVerticalMode) {
            this.prevEpisode();
          } else {
            this.setVolume(Math.min(1, (this.videoEl.volume || 0) + 0.1));
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (this.isVerticalMode) {
            this.nextEpisode();
          } else {
            this.setVolume(Math.max(0, (this.videoEl.volume || 0) - 0.1));
          }
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          this.nextEpisode();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          this.prevEpisode();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          this.toggleMute();
          break;
        case 'Escape':
          if (this.epDrawer.classList.contains('active')) {
            this.closeEpisodesDrawer();
          } else {
            this.closePlayer();
          }
          break;
      }
    });

    // Video Element Events
    this.videoEl.addEventListener('loadstart', () => {
      if (!this.isDriveMode) this.showLoader('Đang kết nối luồng phim...');
    });

    this.videoEl.addEventListener('waiting', () => {
      if (!this.isDriveMode) this.showLoader('Đang tải đệm...');
    });

    this.videoEl.addEventListener('playing', () => {
      this.hideLoader();
      if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';
      if (this.btnPlayPause) this.btnPlayPause.textContent = '⏸';
      this.scheduleControlsHide(2800);
    });

    this.videoEl.addEventListener('canplay', () => {
      this.hideLoader();
    });

    this.videoEl.addEventListener('play', () => {
      if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';
      if (this.btnPlayPause) this.btnPlayPause.textContent = '⏸';
    });

    this.videoEl.addEventListener('pause', () => {
      if (!this.isDriveMode && !this.videoEl.ended) {
        if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'flex';
        if (this.btnPlayPause) this.btnPlayPause.textContent = '▶';
        this.showControls(false);
      }
    });

    this.videoEl.addEventListener('timeupdate', () => {
      this.updateTimelineUI();
      this.saveCurrentProgress();
    });

    this.videoEl.addEventListener('loadedmetadata', () => {
      this.updateTimelineUI();
    });

    this.videoEl.addEventListener('progress', () => {
      this.updateBufferedUI();
    });

    this.videoEl.addEventListener('ended', () => this.handleVideoEnded());
    this.videoEl.addEventListener('error', (e) => this.handleVideoError(e));

    if (this.centerPlayBtn) {
      this.centerPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }

    // Timeline Scrubbing (Mouse + Touch)
    if (this.timelineWrapper) {
      const scrubToEvent = (clientX) => {
        if (!this.videoEl || !this.videoEl.duration) return;
        const rect = this.timelineWrapper.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        this.videoEl.currentTime = ratio * this.videoEl.duration;
        this.updateTimelineUI();
      };

      this.timelineWrapper.addEventListener('mousedown', (e) => {
        this.isScrubbing = true;
        scrubToEvent(e.clientX);
      });

      window.addEventListener('mousemove', (e) => {
        if (this.isScrubbing) scrubToEvent(e.clientX);
      });

      window.addEventListener('mouseup', () => {
        this.isScrubbing = false;
      });

      this.timelineWrapper.addEventListener('touchstart', (e) => {
        this.isScrubbing = true;
        if (e.touches[0]) scrubToEvent(e.touches[0].clientX);
      }, { passive: true });

      this.timelineWrapper.addEventListener('touchmove', (e) => {
        if (this.isScrubbing && e.touches[0]) scrubToEvent(e.touches[0].clientX);
      }, { passive: true });

      this.timelineWrapper.addEventListener('touchend', () => {
        this.isScrubbing = false;
      }, { passive: true });
    }

    // Video Canvas Click / Double-Tap / Long-Press 2x / Vertical Swipe
    let lastTapTime = 0;

    this.videoEl.addEventListener('click', (e) => {
      if (this.isLongPressSpeed) return;
      const now = Date.now();
      const diff = now - lastTapTime;

      if (diff < 280 && diff > 0) {
        // Double tap / double click -> Seek -10s / +10s
        if (this.singleTapTimeout) clearTimeout(this.singleTapTimeout);
        const rect = this.videoEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width / 2) {
          this.seekRelative(10);
        } else {
          this.seekRelative(-10);
        }
      } else {
        // Single tap / click -> Toggle Play/Pause!
        if (this.singleTapTimeout) clearTimeout(this.singleTapTimeout);
        this.singleTapTimeout = setTimeout(() => {
          this.togglePlay();
        }, 240);
      }
      lastTapTime = now;
    });

    // Touch Gestures on Video (Swipe Up/Down + Long Press 2.0x)
    this.videoEl.addEventListener('touchstart', (e) => {
      if (!e.changedTouches[0]) return;
      this.touchStartY = e.changedTouches[0].screenY;
      this.touchStartX = e.changedTouches[0].screenX;
      this.isLongPressSpeed = false;

      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        if (!this.videoEl.paused && !this.isDriveMode) {
          this.isLongPressSpeed = true;
          this.savedSpeedBeforeHold = this.videoEl.playbackRate;
          this.videoEl.playbackRate = 2.0;
          this.showToast('⚡ Đang giữ tua nhanh 2.0x', 15000);
        }
      }, 480);
    }, { passive: true });

    this.videoEl.addEventListener('touchmove', (e) => {
      if (!e.changedTouches[0]) return;
      const dy = Math.abs(e.changedTouches[0].screenY - this.touchStartY);
      const dx = Math.abs(e.changedTouches[0].screenX - this.touchStartX);
      if (dy > 18 || dx > 18) {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
      }
    }, { passive: true });

    this.videoEl.addEventListener('touchend', (e) => {
      if (this.longPressTimer) clearTimeout(this.longPressTimer);

      if (this.isLongPressSpeed) {
        this.videoEl.playbackRate = this.savedSpeedBeforeHold || this.playbackSpeeds[this.speedIndex];
        this.hideToast();
        setTimeout(() => { this.isLongPressSpeed = false; }, 100);
        return;
      }

      if (!e.changedTouches[0]) return;
      const diffY = e.changedTouches[0].screenY - this.touchStartY;
      const diffX = Math.abs(e.changedTouches[0].screenX - this.touchStartX);

      // Vertical swipe to switch episode when in Vertical Mode (or large swipe)
      if (Math.abs(diffY) > 75 && diffX < 65) {
        if (diffY < -75) {
          this.nextEpisode();
        } else if (diffY > 75) {
          this.prevEpisode();
        }
      }
    }, { passive: true });

    // Show controls on mouse move in Video Stage
    this.videoStage.addEventListener('mousemove', () => {
      this.showControls(true);
    });
  }

  /* ==================== DATA LOADING & SYNC ==================== */

  async fetchData(force = false) {
    if (!force) {
      try {
        const res = await fetch(`./movies.json?t=${Date.now()}`);
        if (res.ok) {
          const sMovies = await res.json();
          if (Array.isArray(sMovies) && sMovies.length > 0) {
            this.setMoviesData(sMovies);
            return;
          }
        }
      } catch (e) {}

      const cached = localStorage.getItem('dramaplay_cached_movies');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.setMoviesData(parsed);
            return;
          }
        } catch (e) {}
      }
    }

    if (this.scriptUrl && this.folderId) {
      this.movieListEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 60px 20px; color: var(--text-sub);">
          <div class="spinner-ring" style="margin: 0 auto 14px;"></div>
          <div style="font-weight: 600; color: #fff;">Đang đồng bộ danh sách phim từ Google Drive...</div>
        </div>
      `;
      try {
        const url = `${this.scriptUrl}?folderId=${encodeURIComponent(this.folderId)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && Array.isArray(data.movies) && data.movies.length > 0) {
          // Preserve local poster_url if already mapped
          const enriched = data.movies.map(m => ({
            ...m,
            poster_url: m.poster_url || `./covers/${m.id}.jpg`
          }));
          localStorage.setItem('dramaplay_cached_movies', JSON.stringify(enriched));
          this.setMoviesData(enriched);
          return;
        }
      } catch (err) {
        console.error('Drive fetch error:', err);
      }
    }

    this.setMoviesData(DEMO_MOVIES);
  }

  setMoviesData(rawList) {
    this.movies = rawList.map(m => this.enrichMovie(m));
    this.initHeroSpotlight();
    this.renderContinueWatching();
    this.applyFilters();
    this.checkUrlHash();
  }

  /* ==================== HERO SPOTLIGHT CAROUSEL ==================== */

  initHeroSpotlight() {
    if (!this.movies || this.movies.length === 0) return;

    // Pick 6 featured movies with posters and high episode counts
    const sorted = [...this.movies].sort((a, b) => (b.total_episodes || 0) - (a.total_episodes || 0));
    this.heroMovies = sorted.slice(0, Math.min(6, sorted.length));
    this.heroIndex = 0;

    this.renderHeroSlide();

    if (this.heroTimer) clearInterval(this.heroTimer);
    this.heroTimer = setInterval(() => {
      if (!this.playerModal.classList.contains('active') && this.currentCategory === 'all') {
        this.heroIndex = (this.heroIndex + 1) % this.heroMovies.length;
        this.renderHeroSlide();
      }
    }, 6500);
  }

  renderHeroSlide() {
    const m = this.heroMovies[this.heroIndex];
    if (!m) return;

    const posterUrl = m.poster_url || '';
    if (this.heroBackdrop) {
      this.heroBackdrop.style.backgroundImage = posterUrl ? `url('${posterUrl}')` : 'none';
    }
    if (this.heroPoster) {
      this.heroPoster.src = posterUrl;
      this.heroPoster.alt = m.displayTitle;
    }
    if (this.heroEpTag) {
      this.heroEpTag.textContent = `Full ${m.total_episodes} Tập`;
    }

    const hist = this.watchHistory[m.id];
    const isFav = this.favorites.has(m.id);

    if (this.heroBadges) {
      this.heroBadges.innerHTML = `
        <span class="tag-hot">🔥 TOP #${this.heroIndex + 1} THỊNH HÀNH</span>
        <span class="tag-genre">${m.primaryGenre}</span>
        ${m.isDubbed ? `<span class="tag-genre" style="background: rgba(245,158,11,0.25); color:#fbbf24;">🎙️ Lồng Tiếng</span>` : `<span class="tag-genre">HD Vietsub</span>`}
      `;
    }

    if (this.heroTitle) {
      this.heroTitle.textContent = m.displayTitle;
    }

    if (this.heroDesc) {
      this.heroDesc.textContent = `Trọn bộ ${m.total_episodes} tập • Thể loại: ${m.primaryGenre}. Phát trực tuyến tốc độ cao, tự động chuyển tập mượt mà và lưu lịch sử xem tự động.`;
    }

    if (this.heroPlayBtn) {
      if (hist) {
        this.heroPlayBtn.innerHTML = `<span>▶</span> Xem Tiếp Tập ${hist.epIndex + 1}`;
        this.heroPlayBtn.onclick = () => this.startPlayMovie(m, hist.epIndex, hist.time || 0);
      } else {
        this.heroPlayBtn.innerHTML = `<span>▶</span> Xem Phim Ngay`;
        this.heroPlayBtn.onclick = () => this.startPlayMovie(m, 0, 0);
      }
    }

    if (this.heroFavBtn) {
      this.heroFavBtn.innerHTML = isFav ? `<span>❤️</span> Đã Lưu Tủ Phim` : `<span>🤍</span> Lưu Tủ Phim`;
      this.heroFavBtn.onclick = () => {
        this.toggleFavorite(m.id);
        this.renderHeroSlide();
      };
    }

    if (this.heroDots) {
      this.heroDots.innerHTML = this.heroMovies.map((_, idx) =>
        `<button class="hero-dot ${idx === this.heroIndex ? 'active' : ''}" onclick="appInstance.setHeroIndex(${idx})"></button>`
      ).join('');
    }
  }

  setHeroIndex(idx) {
    this.heroIndex = idx;
    this.renderHeroSlide();
  }

  playRandomMovie() {
    if (!this.movies || this.movies.length === 0) return;
    const rand = this.movies[Math.floor(Math.random() * this.movies.length)];
    this.startPlayMovie(rand, 0, 0);
  }

  /* ==================== CONTINUE WATCHING CAROUSEL ==================== */

  renderContinueWatching() {
    const entries = Object.values(this.watchHistory)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (entries.length === 0 || this.currentCategory !== 'all') {
      this.continueSection.style.display = 'none';
      return;
    }

    const validCards = [];
    for (const h of entries) {
      const movie = this.movies.find(m => m.id === h.movieId || m.title === h.movieTitle);
      if (!movie) continue;
      validCards.push({ movie, h });
    }

    if (validCards.length === 0) {
      this.continueSection.style.display = 'none';
      return;
    }

    this.continueSection.style.display = 'block';
    this.continueCarousel.innerHTML = '';

    validCards.slice(0, 12).forEach(({ movie, h }) => {
      const epNum = (h.epIndex || 0) + 1;
      const total = movie.total_episodes || movie.episodes.length || 1;
      const pct = Math.min(100, Math.max(5, Math.round((epNum / total) * 100)));

      const card = document.createElement('div');
      card.className = 'continue-card';
      card.innerHTML = `
        <img src="${movie.poster_url || ''}" class="continue-thumb" alt="${movie.displayTitle}" onerror="this.style.opacity='0.2'">
        <div class="continue-info">
          <div class="continue-title">${movie.displayTitle}</div>
          <div class="continue-ep">▶ Tập ${epNum}/${total} • ${this.formatTime(h.time || 0)}</div>
          <div class="continue-progress-bar">
            <div class="continue-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>
        <button class="continue-remove" title="Xóa khỏi lịch sử">✕</button>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.continue-remove')) {
          e.stopPropagation();
          this.removeHistoryItem(movie.id);
          return;
        }
        this.startPlayMovie(movie, h.epIndex || 0, h.time || 0);
      });

      this.continueCarousel.appendChild(card);
    });
  }

  removeHistoryItem(movieId) {
    delete this.watchHistory[movieId];
    this.saveWatchHistoryMap();
    this.renderContinueWatching();
    this.applyFilters();
  }

  clearAllHistory() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử đang xem?')) return;
    this.watchHistory = {};
    localStorage.removeItem('dramaplay_last_watch');
    this.saveWatchHistoryMap();
    this.renderContinueWatching();
    this.applyFilters();
  }

  /* ==================== CATEGORIES, FILTERING & SEARCH ==================== */

  navigateHome(e) {
    if (e) e.preventDefault();
    if (this.playerModal.classList.contains('active')) {
      this.closePlayer();
    }
    this.clearSearch();
    this.selectCategory('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectCategory(cat) {
    this.currentCategory = cat;

    // Update top nav, category pills, and mobile bottom nav active states
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    document.querySelectorAll('.mob-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mob === cat);
    });

    // Show Hero & Continue Watching only on 'all' when not searching
    const meta = CATEGORY_META[cat] || CATEGORY_META['all'];
    if (this.catalogTitle) this.catalogTitle.textContent = meta.title;

    this.renderContinueWatching();
    this.applyFilters();
  }

  clearSearch() {
    this.searchInput.value = '';
    if (this.searchClearBtn) this.searchClearBtn.style.display = 'none';
    this.searchDropdown.classList.remove('active');
    this.applyFilters();
  }

  renderSearchDropdown(rawQuery) {
    const q = rawQuery.trim().toLowerCase();
    const qNoAcc = this.removeAccents(q);
    if (!q) {
      this.searchDropdown.classList.remove('active');
      return;
    }

    const matches = this.movies.filter(m =>
      m.searchKey.includes(q) || m.searchKey.includes(qNoAcc)
    ).slice(0, 8);

    if (matches.length === 0) {
      this.searchDropdown.innerHTML = `
        <div style="padding: 14px; text-align: center; color: var(--text-sub); font-size: 0.84rem;">
          Không tìm thấy phim khớp với "${rawQuery}"
        </div>
      `;
      this.searchDropdown.classList.add('active');
      return;
    }

    this.searchDropdown.innerHTML = '';
    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.innerHTML = `
        <img src="${m.poster_url || ''}" alt="${m.displayTitle}" onerror="this.style.opacity='0.2'">
        <div class="search-item-info">
          <div class="search-item-title">${m.displayTitle}</div>
          <div class="search-item-meta">Full ${m.total_episodes} Tập • ${m.primaryGenre}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        this.searchDropdown.classList.remove('active');
        const hist = this.watchHistory[m.id];
        this.startPlayMovie(m, hist ? hist.epIndex : 0, hist ? hist.time : 0);
      });
      this.searchDropdown.appendChild(item);
    });
    this.searchDropdown.classList.add('active');
  }

  applyFilters() {
    const q = this.searchInput.value.trim().toLowerCase();
    const qNoAcc = this.removeAccents(q);
    const lengthVal = this.lengthFilter ? this.lengthFilter.value : 'all';
    const sortVal = this.sortSelect ? this.sortSelect.value : 'default';

    // Hide hero banner when user is searching or viewing a specific tab
    if (this.heroSection) {
      this.heroSection.style.display = (this.currentCategory === 'all' && !q) ? 'block' : 'none';
    }

    let list = [...this.movies];

    // 1. Category Filter
    if (this.currentCategory === 'favorites') {
      list = list.filter(m => this.favorites.has(m.id));
    } else if (this.currentCategory === 'history') {
      list = list.filter(m => Boolean(this.watchHistory[m.id]));
    } else if (this.currentCategory !== 'all') {
      list = list.filter(m => m.categories.includes(this.currentCategory));
    }

    // 2. Search Query Filter (Supports Vietnamese with or without accents)
    if (q) {
      list = list.filter(m => m.searchKey.includes(q) || m.searchKey.includes(qNoAcc));
    }

    // 3. Episode Count / Length Filter
    if (lengthVal === 'short') {
      list = list.filter(m => m.total_episodes < 45);
    } else if (lengthVal === 'medium') {
      list = list.filter(m => m.total_episodes >= 45 && m.total_episodes <= 75);
    } else if (lengthVal === 'long') {
      list = list.filter(m => m.total_episodes > 75);
    }

    // 4. Sorting
    if (sortVal === 'name_asc') {
      list.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle, 'vi'));
    } else if (sortVal === 'ep_desc') {
      list.sort((a, b) => b.total_episodes - a.total_episodes);
    } else if (sortVal === 'ep_asc') {
      list.sort((a, b) => a.total_episodes - b.total_episodes);
    } else if (sortVal === 'recent' || this.currentCategory === 'history') {
      list.sort((a, b) => {
        const ta = this.watchHistory[a.id]?.updatedAt || 0;
        const tb = this.watchHistory[b.id]?.updatedAt || 0;
        return tb - ta;
      });
    }

    this.filteredMovies = list;
    if (this.movieCountBadge) {
      this.movieCountBadge.textContent = `${list.length} bộ phim`;
    }
    this.renderMovies(list);
  }

  renderMovies(list) {
    this.movieListEl.innerHTML = '';
    this.renderedCount = 0;

    if (!list || list.length === 0) {
      if (this.loadMoreContainer) this.loadMoreContainer.style.display = 'none';
      this.movieListEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 56px 20px; background: var(--bg-elevated); border-radius: 14px; border: 1px solid var(--border);">
          <div style="font-size: 2.4rem; margin-bottom: 10px;">🎬</div>
          <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 6px;">Không tìm thấy bộ phim nào</div>
          <div style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 16px;">Thử đổi từ khóa tìm kiếm hoặc chọn danh mục Tất cả phim.</div>
          <button class="btn-hero-play" style="margin: 0 auto;" onclick="appInstance.navigateHome()">Xem Tất Cả Kho Phim</button>
        </div>
      `;
      return;
    }

    this.renderNextMovieBatch();
  }

  renderNextMovieBatch() {
    const list = this.filteredMovies || [];
    if (this.renderedCount >= list.length) {
      if (this.loadMoreContainer) this.loadMoreContainer.style.display = 'none';
      return;
    }

    const batch = list.slice(this.renderedCount, this.renderedCount + this.gridPageSize);
    this.renderedCount += batch.length;

    const frag = document.createDocumentFragment();
    batch.forEach(m => {
      const card = document.createElement('div');
      card.className = 'movie-card';

      const isFav = this.favorites.has(m.id);
      const hist = this.watchHistory[m.id];
      const epWatchedPct = hist
        ? Math.min(100, Math.max(6, Math.round(((hist.epIndex + 1) / (m.total_episodes || 1)) * 100)))
        : 0;

      const primarySrc = m.poster_url || m.fallbackPoster || '';
      const fbSrc = (m.fallbackPoster && m.fallbackPoster !== primarySrc) ? m.fallbackPoster : '';
      const posterHtml = primarySrc
        ? `<img src="${primarySrc}" data-fb="${fbSrc}" class="movie-poster" alt="${m.displayTitle}" loading="lazy" onerror="if(this.dataset.fb && this.src!==this.dataset.fb){this.src=this.dataset.fb;}else{this.style.display='none'; this.nextElementSibling.style.display='flex';}">
           <div class="movie-thumb-fallback" style="display:none;">🎬</div>`
        : `<div class="movie-thumb-fallback">🎬</div>`;

      card.innerHTML = `
        <div class="movie-thumb">
          ${posterHtml}
          <span class="ep-badge">Full ${m.total_episodes} Tập</span>
          ${m.isDubbed ? `<span class="audio-badge">🎙️ Lồng Tiếng</span>` : ''}
          <button class="card-fav-btn" title="Lưu vào Tủ phim">${isFav ? '❤️' : '🤍'}</button>
          <div class="card-hover-overlay">
            <div class="hover-play-circle">▶</div>
          </div>
          ${hist ? `
            <div class="card-watch-bar">
              <div class="card-watch-text">▶ Đang xem Tập ${hist.epIndex + 1}/${m.total_episodes}</div>
              <div class="card-watch-track">
                <div class="card-watch-fill" style="width: ${epWatchedPct}%"></div>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="movie-details">
          <div class="movie-title" title="${m.displayTitle}">${m.displayTitle}</div>
          <div class="movie-meta">
            <span class="genre-chip">${m.primaryGenre.split('•')[0].trim()}</span>
            <span>HD</span>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-fav-btn')) {
          e.stopPropagation();
          this.toggleFavorite(m.id);
          const btn = card.querySelector('.card-fav-btn');
          if (btn) btn.textContent = this.favorites.has(m.id) ? '❤️' : '🤍';
          return;
        }
        const saved = this.watchHistory[m.id];
        this.startPlayMovie(m, saved ? saved.epIndex : 0, saved ? saved.time : 0);
      });

      frag.appendChild(card);
    });

    this.movieListEl.appendChild(frag);

    if (this.loadMoreContainer) {
      if (this.renderedCount < list.length) {
        this.loadMoreContainer.style.display = 'flex';
        if (this.btnLoadMore) {
          this.btnLoadMore.textContent = `⬇ Xem thêm phim (Đang hiện ${this.renderedCount} / ${list.length} bộ)`;
        }
      } else {
        this.loadMoreContainer.style.display = 'none';
      }
    }
  }

  toggleFavorite(movieId) {
    if (this.favorites.has(movieId)) {
      this.favorites.delete(movieId);
      this.showToast('Đã xóa khỏi Tủ phim');
    } else {
      this.favorites.add(movieId);
      this.showToast('❤️ Đã lưu vào Tủ phim yêu thích');
    }
    this.saveFavorites();
    if (this.currentCategory === 'favorites') {
      this.applyFilters();
    }
  }

  toggleCurrentMovieFavorite() {
    if (!this.currentMovie) return;
    this.toggleFavorite(this.currentMovie.id);
    this.updatePlayerFavoriteUI();
  }

  updatePlayerFavoriteUI() {
    if (!this.currentMovie) return;
    const isFav = this.favorites.has(this.currentMovie.id);
    if (this.sidebarFavBtn) {
      this.sidebarFavBtn.innerHTML = isFav ? '❤️ Đã yêu thích' : '🤍 Yêu thích';
    }
    if (this.sideFavBtn) {
      this.sideFavBtn.innerHTML = `
        <span class="side-icon">${isFav ? '❤️' : '🤍'}</span>
        <span class="side-label">${isFav ? 'Đã lưu' : 'Lưu phim'}</span>
      `;
    }
  }

  updateBadges() {
    const histCount = Object.keys(this.watchHistory).length;
    if (this.historyCountBadge) {
      this.historyCountBadge.textContent = histCount;
      this.historyCountBadge.style.display = histCount > 0 ? 'inline-block' : 'none';
    }
    const favCount = this.favorites.size;
    if (this.favCountBadge) {
      this.favCountBadge.textContent = favCount;
      this.favCountBadge.style.display = favCount > 0 ? 'inline-block' : 'none';
    }
  }

  /* ==================== PLAYER & STREAMING ENGINE ==================== */

  checkUrlHash() {
    if (location.hash.startsWith('#watch/')) {
      const parts = location.hash.replace('#watch/', '').split('/');
      const movieId = decodeURIComponent(parts[0] || '');
      const epIdx = parseInt(parts[1] || '0', 10) || 0;
      const found = this.movies.find(m => m.id === movieId);
      if (found) {
        const hist = this.watchHistory[found.id];
        const resumeSec = (hist && hist.epIndex === epIdx) ? (hist.time || 0) : 0;
        this.startPlayMovie(found, epIdx, resumeSec, true);
      }
    }
  }

  startPlayMovie(movie, epIndex = 0, resumeTime = 0, fromHash = false) {
    if (!movie || !movie.episodes || movie.episodes.length === 0) return;
    this.currentMovie = movie;
    this.currentEpIndex = Math.max(0, Math.min(epIndex, movie.episodes.length - 1));
    this.currentEpRangeIndex = Math.floor(this.currentEpIndex / this.epPageSize);

    this.playerModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (!fromHash) {
      try {
        history.pushState({ watch: true }, '', `#watch/${encodeURIComponent(movie.id)}/${this.currentEpIndex}`);
      } catch (e) {}
    }

    this.requestWakeLock();
    this.renderTheaterSidebar();
    this.playCurrentEpisode(resumeTime);
  }

  playCurrentEpisode(startTime = 0) {
    if (!this.currentMovie || !this.currentMovie.episodes[this.currentEpIndex]) return;

    this.cancelAutoNext();
    const ep = this.currentMovie.episodes[this.currentEpIndex];
    const totalEps = this.currentMovie.episodes.length;
    const epLabel = this.formatEpisodeShort(this.currentEpIndex);

    // Update Range Tab if episode jumped across range boundary
    const targetRange = Math.floor(this.currentEpIndex / this.epPageSize);
    if (targetRange !== this.currentEpRangeIndex) {
      this.currentEpRangeIndex = targetRange;
    }

    // Update Titles & Badges
    this.movieNameEl.textContent = this.currentMovie.displayTitle;
    this.epNameEl.textContent = `${epLabel} / ${totalEps} Tập`;
    if (this.btnEpList) this.btnEpList.innerHTML = `📑 ${epLabel}/${totalEps}`;
    if (this.sideEpLabel) this.sideEpLabel.textContent = `${epLabel}`;
    if (this.driveEpBtn) this.driveEpBtn.textContent = `📑 Chọn Tập (${this.currentEpIndex + 1}/${totalEps})`;

    // Mark episode as watched in history immediately
    this.recordEpisodeWatched(this.currentEpIndex, startTime);
    this.updateEpisodeGridsActiveState();

    // Determine effective server mode
    let activeSrv = this.serverMode;
    if (activeSrv === 'stream' && !this.streamProxyAvailable && ep.id && !ep.id.startsWith('e')) {
      activeSrv = 'direct';
    }
    this.updateServerSwitcherUI(activeSrv);

    if (activeSrv === 'embed') {
      this.activateDriveEmbed(ep);
      return;
    }

    // HTML5 Video Stream Mode ('stream' or 'direct')
    this.isDriveMode = false;
    this.playerModal.classList.remove('drive-mode');
    if (this.driveFallbackBar) this.driveFallbackBar.style.display = 'none';
    this.driveEmbed.style.display = 'none';
    this.driveEmbed.src = '';
    this.videoEl.style.display = 'block';

    let srcUrl = '';
    if (activeSrv === 'stream' && ep.id && !ep.id.startsWith('e')) {
      srcUrl = `/stream/?id=${ep.id}`;
    } else {
      srcUrl = ep.stream_url || ep.download_url || (ep.id ? `https://lh3.googleusercontent.com/d/${ep.id}` : '');
    }

    this.triedDirectFallback = (activeSrv === 'direct');
    this.pendingStartTime = startTime;

    this.showLoader(`Đang phát ${epLabel}...`);
    this.videoEl.src = srcUrl;
    this.videoEl.playbackRate = this.playbackSpeeds[this.speedIndex];
    this.videoEl.load();

    const startPlayback = () => {
      if (this.pendingStartTime > 0 && this.videoEl.duration && this.pendingStartTime < this.videoEl.duration - 2) {
        this.videoEl.currentTime = this.pendingStartTime;
        this.pendingStartTime = 0;
      }
      this.videoEl.play().catch(() => {
        this.hideLoader();
        if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'flex';
      });
    };

    this.videoEl.onloadedmetadata = startPlayback;
    this.showControls(true);
  }

  handleVideoError() {
    if (this.isDriveMode || !this.currentMovie) return;
    const ep = this.currentMovie.episodes[this.currentEpIndex];
    if (!ep) return;

    // Step 1: If '/stream/?id=' failed (e.g. local server without proxy), remember and try Direct Google stream
    const directUrl = ep.stream_url || (ep.id ? `https://lh3.googleusercontent.com/d/${ep.id}` : '');
    if (!this.triedDirectFallback && directUrl) {
      console.warn('Luồng /stream/ không phản hồi, tự động chuyển sang VIP 2 (Direct)...');
      this.streamProxyAvailable = false;
      this.triedDirectFallback = true;
      this.updateServerSwitcherUI('direct');
      this.videoEl.src = directUrl;
      this.videoEl.load();
      this.videoEl.play().catch(() => {});
      return;
    }

    // Step 2: Fallback cleanly to Google Drive Preview Iframe
    console.warn('Chuyển sang trình phát dự phòng Google Drive Embed...');
    this.activateDriveEmbed(ep);
  }

  activateDriveEmbed(ep) {
    this.hideLoader();
    this.isDriveMode = true;
    this.playerModal.classList.add('drive-mode');
    this.updateServerSwitcherUI('embed');

    this.videoEl.pause();
    this.videoEl.removeAttribute('src');
    this.videoEl.style.display = 'none';
    if (this.centerPlayBtn) this.centerPlayBtn.style.display = 'none';

    this.driveEmbed.style.display = 'block';
    this.driveEmbed.src = ep.preview_url || `https://drive.google.com/file/d/${ep.id}/preview`;
    if (this.driveFallbackBar) this.driveFallbackBar.style.display = 'flex';
    this.playerModal.classList.remove('controls-hidden');
  }

  switchServer(mode) {
    this.serverMode = mode;
    if (mode === 'stream') this.streamProxyAvailable = true;
    const curTime = (!this.isDriveMode && this.videoEl) ? Math.floor(this.videoEl.currentTime || 0) : 0;
    const labelMap = { stream: '⚡ Server VIP 1', direct: '🌐 Server VIP 2', embed: '☁️ Google Drive' };
    this.showToast(`Đang chuyển sang ${labelMap[mode] || mode}...`);
    this.playCurrentEpisode(curTime);
  }

  updateServerSwitcherUI(activeMode) {
    document.querySelectorAll('.srv-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.srv === activeMode);
    });
  }

  /* ==================== VIDEO CONTROLS & TIMELINE ==================== */

  togglePlay() {
    if (this.isDriveMode || !this.videoEl) return;
    if (this.videoEl.paused) {
      this.videoEl.play().catch(() => {});
    } else {
      this.videoEl.pause();
    }
  }

  seekRelative(deltaSec) {
    if (this.isDriveMode || !this.videoEl || !this.videoEl.duration) return;
    this.videoEl.currentTime = Math.max(0, Math.min(this.videoEl.duration, this.videoEl.currentTime + deltaSec));
    this.updateTimelineUI();
    this.showToast(deltaSec > 0 ? `⏩ +${deltaSec} giây` : `⏪ ${deltaSec} giây`, 900);
  }

  setVolume(val) {
    if (!this.videoEl) return;
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    this.videoEl.volume = v;
    this.videoEl.muted = (v === 0);
    if (this.volumeSlider) this.volumeSlider.value = v;
    if (this.btnMute) this.btnMute.textContent = (v === 0) ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
    localStorage.setItem('dramaplay_volume', String(v));
  }

  toggleMute() {
    if (!this.videoEl) return;
    this.videoEl.muted = !this.videoEl.muted;
    if (this.btnMute) {
      this.btnMute.textContent = this.videoEl.muted ? '🔇' : '🔊';
    }
    this.showToast(this.videoEl.muted ? '🔇 Đã tắt tiếng' : '🔊 Đã bật tiếng', 900);
  }

  cyclePlaybackSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.playbackSpeeds.length;
    const speed = this.playbackSpeeds[this.speedIndex];
    if (this.videoEl) this.videoEl.playbackRate = speed;
    if (this.btnSpeed) this.btnSpeed.textContent = `${speed}x`;
    this.showToast(`⚡ Tốc độ phát: ${speed}x`, 1000);
  }

  toggleAutoNextSetting() {
    this.autoNextEnabled = !this.autoNextEnabled;
    localStorage.setItem('dramaplay_autonext', String(this.autoNextEnabled));
    this.updateAutoNextUI();
    this.showToast(this.autoNextEnabled ? '🔄 Tự động chuyển tập: BẬT' : '⏸ Tự động chuyển tập: TẮT');
  }

  updateAutoNextUI() {
    if (!this.btnAutoNextToggle) return;
    this.btnAutoNextToggle.classList.toggle('active', this.autoNextEnabled);
    this.btnAutoNextToggle.textContent = this.autoNextEnabled ? '🔄 Tự chuyển: BẬT' : '🔄 Tự chuyển: TẮT';
  }

  toggleViewMode() {
    this.isVerticalMode = !this.isVerticalMode;
    this.updateViewModeUI();
    this.showToast(this.isVerticalMode ? '📱 Chế độ Vuốt Dọc Toàn Màn Hình' : '💻 Chế độ Rạp Phim (Hiện Danh Sách Tập)');
  }

  updateViewModeUI() {
    if (!this.playerModal) return;
    this.playerModal.classList.toggle('vertical-mode', this.isVerticalMode);
    if (this.btnViewMode) {
      this.btnViewMode.innerHTML = this.isVerticalMode ? '💻 Rạp Phim' : '📱 Chế độ Dọc';
    }
  }

  toggleFullscreen() {
    const target = this.videoStage || this.playerModal;
    if (!document.fullscreenElement) {
      if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
      else if (this.videoEl && this.videoEl.webkitEnterFullscreen) this.videoEl.webkitEnterFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  updateTimelineUI() {
    if (!this.videoEl) return;
    const cur = this.videoEl.currentTime || 0;
    const dur = this.videoEl.duration || 0;
    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

    if (this.timelineProgress) this.timelineProgress.style.width = `${pct}%`;
    if (this.currentTimeText) this.currentTimeText.textContent = this.formatTime(cur);
    if (this.durationText) this.durationText.textContent = this.formatTime(dur);
  }

  updateBufferedUI() {
    if (!this.videoEl || !this.videoEl.duration || !this.timelineBuffered) return;
    const buf = this.videoEl.buffered;
    if (buf && buf.length > 0) {
      const end = buf.end(buf.length - 1);
      const pct = Math.min(100, (end / this.videoEl.duration) * 100);
      this.timelineBuffered.style.width = `${pct}%`;
    }
  }

  showLoader(msg = 'Đang tải...') {
    if (this.videoLoaderText) this.videoLoaderText.textContent = msg;
    if (this.videoLoader) this.videoLoader.style.display = 'flex';
  }

  hideLoader() {
    if (this.videoLoader) this.videoLoader.style.display = 'none';
  }

  showToast(msg, duration = 1400) {
    if (!this.gestureToast) return;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.gestureToast.textContent = msg;
    this.gestureToast.classList.add('active');
    this.toastTimeout = setTimeout(() => {
      this.gestureToast.classList.remove('active');
    }, duration);
  }

  hideToast() {
    if (!this.gestureToast) return;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.gestureToast.classList.remove('active');
  }

  scheduleControlsHide(delay = 2800) {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (!this.isDriveMode && this.videoEl && !this.videoEl.paused) {
        this.playerModal.classList.add('controls-hidden');
      }
    }, delay);
  }

  showControls(autoHide = true) {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.playerModal.classList.remove('controls-hidden');
    if (autoHide && !this.isDriveMode && this.videoEl && !this.videoEl.paused) {
      this.scheduleControlsHide(2800);
    }
  }

  /* ==================== EPISODE NAVIGATION & SIDEBAR ==================== */

  handleVideoEnded() {
    if (!this.currentMovie) return;
    if (this.currentEpIndex < this.currentMovie.episodes.length - 1) {
      if (this.autoNextEnabled) {
        this.startAutoNextCountdown();
      }
    } else {
      this.showToast('🎉 Bạn đã xem trọn bộ phim này!', 4000);
    }
  }

  startAutoNextCountdown() {
    let timeLeft = 2;
    const nextEpLabel = this.formatEpisodeShort(this.currentEpIndex + 1);
    if (this.autoNextEpTitle) this.autoNextEpTitle.textContent = nextEpLabel;
    this.autoNextCountdown.textContent = timeLeft;
    this.autoNextOverlay.classList.add('active');

    if (this.autoNextTimer) clearInterval(this.autoNextTimer);
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
    if (this.autoNextOverlay) this.autoNextOverlay.classList.remove('active');
  }

  nextEpisode() {
    this.cancelAutoNext();
    if (!this.currentMovie) return;
    if (this.currentEpIndex < this.currentMovie.episodes.length - 1) {
      this.currentEpIndex++;
      this.showToast(`⏭ Chuyển sang ${this.formatEpisodeShort(this.currentEpIndex)}`);
      this.playCurrentEpisode(0);
    } else {
      this.showToast('🎉 Đây là tập cuối của bộ phim!');
    }
  }

  prevEpisode() {
    this.cancelAutoNext();
    if (!this.currentMovie) return;
    if (this.currentEpIndex > 0) {
      this.currentEpIndex--;
      this.showToast(`⏮ Lùi về ${this.formatEpisodeShort(this.currentEpIndex)}`);
      this.playCurrentEpisode(0);
    } else {
      this.showToast('Đang ở Tập 01');
    }
  }

  jumpToEpisodeInput() {
    if (!this.currentMovie || !this.epJumpInput) return;
    const val = parseInt(this.epJumpInput.value, 10);
    if (isNaN(val) || val < 1 || val > this.currentMovie.episodes.length) {
      this.showToast(`Vui lòng nhập số tập từ 1 đến ${this.currentMovie.episodes.length}`);
      return;
    }
    this.epJumpInput.value = '';
    this.currentEpIndex = val - 1;
    this.playCurrentEpisode(0);
  }

  renderTheaterSidebar() {
    if (!this.currentMovie) return;
    const m = this.currentMovie;

    if (this.sidebarPoster) this.sidebarPoster.src = m.poster_url || '';
    if (this.sidebarMovieTitle) this.sidebarMovieTitle.textContent = m.displayTitle;
    if (this.sidebarEpTotal) this.sidebarEpTotal.textContent = `${m.episodes.length} tập`;
    if (this.epJumpInput) this.epJumpInput.max = m.episodes.length;

    if (this.sidebarTags) {
      this.sidebarTags.innerHTML = `
        <span class="genre-chip">${m.primaryGenre}</span>
        ${m.isDubbed ? `<span class="genre-chip" style="color:#fbbf24;">🎙️ Lồng Tiếng</span>` : ''}
      `;
    }

    this.updatePlayerFavoriteUI();
    this.renderEpisodeRangeTabs();
    this.renderEpisodesInContainer(this.sidebarEpGrid, false);
    this.renderRelatedMovies();
  }

  renderEpisodeRangeTabs() {
    if (!this.currentMovie) return;
    const total = this.currentMovie.episodes.length;
    const numRanges = Math.ceil(total / this.epPageSize);

    const buildTabs = (container, isDrawer) => {
      if (!container) return;
      if (numRanges <= 1) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }
      container.style.display = 'flex';
      container.innerHTML = '';
      for (let r = 0; r < numRanges; r++) {
        const start = r * this.epPageSize + 1;
        const end = Math.min(total, (r + 1) * this.epPageSize);
        const btn = document.createElement('button');
        btn.className = `range-tab ${r === this.currentEpRangeIndex ? 'active' : ''}`;
        btn.textContent = `Tập ${start} - ${end}`;
        btn.addEventListener('click', () => {
          this.currentEpRangeIndex = r;
          this.renderEpisodeRangeTabs();
          this.renderEpisodesInContainer(this.sidebarEpGrid, false);
          if (isDrawer || this.epDrawer.classList.contains('active')) {
            this.renderEpisodesInContainer(this.episodesGrid, true);
          }
        });
        container.appendChild(btn);
      }
    };

    buildTabs(this.sidebarRangeTabs, false);
    buildTabs(this.drawerRangeTabs, true);
  }

  renderEpisodesInContainer(container, closeDrawerOnClick = false) {
    if (!container || !this.currentMovie) return;
    container.innerHTML = '';

    const total = this.currentMovie.episodes.length;
    const startIdx = this.currentEpRangeIndex * this.epPageSize;
    const endIdx = Math.min(total, startIdx + this.epPageSize);

    const watchedSet = new Set(this.watchHistory[this.currentMovie.id]?.watchedEps || []);

    for (let idx = startIdx; idx < endIdx; idx++) {
      const btn = document.createElement('div');
      const isCurrent = idx === this.currentEpIndex;
      const isWatched = watchedSet.has(idx);
      btn.className = `ep-item ${isCurrent ? 'current' : (isWatched ? 'watched' : '')}`;
      btn.dataset.epIndex = idx;
      const num = idx + 1;
      btn.textContent = isCurrent ? `▶ ${num}` : (num < 10 ? `0${num}` : `${num}`);

      btn.addEventListener('click', () => {
        this.currentEpIndex = idx;
        this.playCurrentEpisode(0);
        if (closeDrawerOnClick) this.closeEpisodesDrawer();
      });

      container.appendChild(btn);
    }
  }

  updateEpisodeGridsActiveState() {
    if (!this.currentMovie) return;
    this.renderEpisodeRangeTabs();
    this.renderEpisodesInContainer(this.sidebarEpGrid, false);
    if (this.epDrawer.classList.contains('active')) {
      this.renderEpisodesInContainer(this.episodesGrid, true);
    }

    const hist = this.watchHistory[this.currentMovie.id];
    const watchedCount = hist && Array.isArray(hist.watchedEps) ? hist.watchedEps.length : 1;
    if (this.sidebarProgressText) {
      this.sidebarProgressText.textContent = `Đang phát Tập ${this.currentEpIndex + 1} • Đã xem ${watchedCount}/${this.currentMovie.episodes.length} tập`;
    }
  }

  renderRelatedMovies() {
    if (!this.relatedMoviesList || !this.currentMovie) return;
    const curCat = this.currentMovie.categories[0] || 'tong-tai';
    const related = this.movies
      .filter(m => m.id !== this.currentMovie.id && m.categories.includes(curCat))
      .slice(0, 6);

    this.relatedMoviesList.innerHTML = '';
    related.forEach(m => {
      const div = document.createElement('div');
      div.className = 'related-item';
      div.innerHTML = `
        <img src="${m.poster_url || ''}" alt="${m.displayTitle}" onerror="this.style.opacity='0.2'">
        <div class="related-item-info">
          <div class="related-item-title">${m.displayTitle}</div>
          <div class="related-item-sub">Full ${m.total_episodes} Tập • ${m.primaryGenre}</div>
        </div>
      `;
      div.addEventListener('click', () => {
        const saved = this.watchHistory[m.id];
        this.startPlayMovie(m, saved ? saved.epIndex : 0, saved ? saved.time : 0);
      });
      this.relatedMoviesList.appendChild(div);
    });
  }

  openEpisodesDrawer() {
    if (!this.currentMovie) return;
    if (this.drawerMovieTitle) this.drawerMovieTitle.textContent = this.currentMovie.displayTitle;
    if (this.drawerSubtitle) {
      this.drawerSubtitle.textContent = `Đang phát ${this.formatEpisodeShort(this.currentEpIndex)} / ${this.currentMovie.episodes.length} Tập`;
    }
    this.currentEpRangeIndex = Math.floor(this.currentEpIndex / this.epPageSize);
    this.renderEpisodeRangeTabs();
    this.renderEpisodesInContainer(this.episodesGrid, true);
    if (this.drawerBackdrop) this.drawerBackdrop.classList.add('active');
    this.epDrawer.classList.add('active');
  }

  closeEpisodesDrawer() {
    if (this.drawerBackdrop) this.drawerBackdrop.classList.remove('active');
    this.epDrawer.classList.remove('active');
  }

  closePlayer(fromPopState = false) {
    this.cancelAutoNext();
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.hideLoader();
    this.isDriveMode = false;
    this.playerModal.classList.remove('drive-mode');
    this.videoEl.pause();
    this.videoEl.removeAttribute('src');
    this.driveEmbed.src = '';
    this.playerModal.classList.remove('active');
    this.playerModal.classList.remove('controls-hidden');
    this.closeEpisodesDrawer();
    document.body.style.overflow = '';
    this.releaseWakeLock();

    if (!fromPopState && location.hash.startsWith('#watch')) {
      try {
        history.pushState(null, '', '#home');
      } catch (e) {}
    }

    this.renderContinueWatching();
    this.renderHeroSlide();
    this.applyFilters();
  }

  /* ==================== PROGRESS TRACKING ==================== */

  recordEpisodeWatched(epIdx, timeSec = 0) {
    if (!this.currentMovie) return;
    const mid = this.currentMovie.id;
    const existing = this.watchHistory[mid] || {
      movieId: mid,
      movieTitle: this.currentMovie.title,
      epIndex: epIdx,
      time: 0,
      duration: 120,
      watchedEps: []
    };

    const watchedSet = new Set(existing.watchedEps || []);
    watchedSet.add(epIdx);

    this.watchHistory[mid] = {
      ...existing,
      movieId: mid,
      movieTitle: this.currentMovie.title,
      epIndex: epIdx,
      time: Math.floor(timeSec || 0),
      watchedEps: Array.from(watchedSet),
      updatedAt: Date.now()
    };

    this.saveWatchHistoryMap();
  }

  saveCurrentProgress() {
    if (!this.currentMovie || this.isDriveMode || !this.videoEl || !this.videoEl.currentTime) return;
    const cur = Math.floor(this.videoEl.currentTime);
    if (cur % 3 !== 0) return; // Throttle localStorage writes to every 3 seconds

    const mid = this.currentMovie.id;
    const existing = this.watchHistory[mid] || { watchedEps: [this.currentEpIndex] };
    const watchedSet = new Set(existing.watchedEps || []);
    watchedSet.add(this.currentEpIndex);

    const record = {
      movieId: mid,
      movieTitle: this.currentMovie.title,
      epIndex: this.currentEpIndex,
      epName: this.formatEpisodeShort(this.currentEpIndex),
      time: cur,
      duration: Math.floor(this.videoEl.duration || 120),
      watchedEps: Array.from(watchedSet),
      updatedAt: Date.now()
    };

    this.watchHistory[mid] = record;
    localStorage.setItem('dramaplay_last_watch', JSON.stringify(record));
    this.saveWatchHistoryMap();
  }

  /* ==================== SETTINGS & WAKE LOCK ==================== */

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
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}

// Global App Instance
let appInstance = null;
window.addEventListener('DOMContentLoaded', () => {
  appInstance = new DramaPlayApp();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=20261020_pro').catch(e => console.log('SW Error:', e));
  }
});
