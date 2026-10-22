/**
 * TRUMDRAMA WEB APP - FULL REPLICA UI & HIGH-SPEED STREAMING ENGINE
 * Giao diện chuẩn 1:1 https://trumdrama.com/
 * Hỗ trợ: Trang Chủ (3D Coverflow Hero), Thể Loại, Khám Phá (Bộ lọc & Tìm kiếm không dấu),
 * Trang Chi Tiết Phim (/phim/<id>), Trang Xem Tập Phim (/phim/<id>/tap-<n>),
 * Đa luồng phát (VIP 1 /stream/, VIP 2 Direct, Google Drive Embed), Tự chuyển tập, Lịch sử & Yêu thích.
 */

const TRUMDRAMA_GENRES = [
  { name: 'Vả Mặt Xấu Xa', slug: 'va-mat-xau-xa' },
  { name: 'Hiện Đại', slug: 'hien-dai' },
  { name: 'Báo Thù', slug: 'bao-thu' },
  { name: 'Tổng Tài', slug: 'tong-tai' },
  { name: 'Trùng Sinh', slug: 'trung-sinh' },
  { name: 'Lồng Tiếng 🎙️', slug: 'long-tieng' },
  { name: 'Tình Yêu Cưỡng Ép', slug: 'tinh-yeu-cuong-ep' },
  { name: 'Ngọt Sủng', slug: 'ngot-sung' },
  { name: 'Cổ Đại', slug: 'co-dai' },
  { name: 'Xuyên Không', slug: 'xuyen-khong' },
  { name: 'Hành Động', slug: 'hanh-dong' },
  { name: 'Xã Hội Đen', slug: 'xa-hoi-den' },
  { name: 'Thân Phận Bí Ẩn', slug: 'than-phan-bi-an' },
  { name: 'Hối Hận', slug: 'hoi-han' },
  { name: 'Gương Vỡ Lại Lành', slug: 'guong-vo-lai-lanh' },
  { name: 'Cưới Trước Yêu Sau', slug: 'cuoi-truoc-yeu-sau' },
  { name: 'Tình Cảm Đô Thị', slug: 'tinh-cam-do-thi' },
  { name: 'Hệ Thống', slug: 'he-thong' },
  { name: 'Kịch Tính', slug: 'kich-tinh' },
  { name: 'Cường Giả Tái Xuất', slug: 'cuong-gia-tai-xuat' },
  { name: 'Gia Đình & Hôn Nhân', slug: 'gia-dinh' },
  { name: 'Giả Tưởng & Kỳ Bí', slug: 'gia-tuong' }
];

const SOURCE_BADGES = ['DramaBox', 'ReelShort', 'NetShort', 'DramaWave', 'VibeShort', 'GoodShort'];

const SVG_PLAY_CARD = `<svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M15.45 7.48C17.07 8.83 17.07 11.17 15.45 12.52C14.56 13.26 13.38 14.14 12.07 14.86C10.78 15.57 9.42 16.11 8.3 16.47C6.24 17.16 4.09 15.93 3.72 13.89C3.52 12.79 3.33 11.4 3.33 10C3.33 8.6 3.52 7.21 3.72 6.11C4.09 4.07 6.24 2.84 8.3 3.53C9.42 3.89 10.78 4.43 12.07 5.13C13.38 5.86 14.56 6.74 15.45 7.48Z" fill="#111218"></path></svg>`;

class TrumDramaApp {
  constructor() {
    this.movies = [];
    this.catalogMap = {};
    this.currentView = 'home'; // 'home' | 'genres' | 'explore' | 'favorites' | 'history' | 'detail' | 'watch'

    // Explore state
    this.exploreSort = 'popular';
    this.exploreGenre = '';
    this.exploreQuery = '';
    this.explorePage = 1;
    this.explorePageSize = 32;

    // Detail & Watch state
    this.detailMovie = null;
    this.currentMovie = null;
    this.currentEpIndex = 0;
    this.currentEpRangeIndex = 0;
    this.epPageSize = 50;

    // Player state
    this.serverMode = 'stream'; // 'stream' | 'direct' | 'embed'
    this.streamProxyAvailable = true;
    this.isDriveMode = false;
    this.autoNextEnabled = localStorage.getItem('dramaplay_autonext') !== 'false';
    this.autoNextTimer = null;
    this.currentSpeed = 1.0;
    this.wakeLock = null;
    this.isScrubbing = false;
    this.controlsTimeout = null;
    this.toastTimeout = null;

    // Touch gestures state
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.longPressTimer = null;
    this.isLongPressSpeed = false;
    this.savedSpeedBeforeHold = 1.0;

    // Hero Coverflow state
    this.heroMovies = [];
    this.heroIndex = 0;
    this.heroTimer = null;

    // User persistent data
    this.watchHistory = this.loadWatchHistory();
    this.favorites = this.loadFavorites();

    this.initElements();
    this.loadSettings();
    this.initEvents();
    this.updateNavBadges();
    this.updateAutoNextUI();
    this.fetchData();
  }

  /* ==================== STRING & METADATA HELPERS ==================== */

  removeAccents(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  makeSlug(str) {
    return this.removeAccents(str)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  cleanMovieTitle(raw) {
    if (!raw) return 'Phim chưa đặt tên';
    let t = String(raw).replace(/_/g, ': ').replace(/\s+/g, ' ').trim();
    if (t.length > 0 && t[0] === t[0].toLowerCase() && t[0] !== t[0].toUpperCase()) {
      t = t.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
    }
    return t;
  }

  hashCode(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  classifyMovie(rawTitle) {
    const lower = String(rawTitle || '').toLowerCase();
    const noAcc = this.removeAccents(lower);
    const slugSet = new Set();
    const genreNames = [];

    const addGenre = (slug, name) => {
      if (!slugSet.has(slug)) {
        slugSet.add(slug);
        genreNames.push({ slug, name });
      }
    };

    const isDubbed = lower.includes('lồng tiếng') || lower.includes('thuyết minh') || noAcc.includes('long tieng');
    if (isDubbed) {
      addGenre('long-tieng', 'Lồng Tiếng');
    }

    if (/tái sinh|trọng sinh|trùng sinh|sống lại|cải mệnh|kiếp trước/.test(lower)) {
      addGenre('trung-sinh', 'Trùng Sinh');
    }
    if (/báo thù|trả thù|phản công|hận thù|đòi lại|vạch trần/.test(lower)) {
      addGenre('bao-thu', 'Báo Thù');
    }
    if (/vả mặt|khinh thường|coi thường|nhục mạ|hối hận|phản bội|bắt quả tang/.test(lower)) {
      addGenre('va-mat-xau-xa', 'Vả Mặt Xấu Xa');
    }
    if (/hối hận|ngược tâm|bi kịch|bỏ rơi|ly hôn|vợ cũ|chồng cũ/.test(lower)) {
      addGenre('hoi-han', 'Hối Hận');
    }
    if (/cổ đại|cổ trang|vương phi|thái tử|hoàng hậu|cung|đại đường|vương gia|tướng quân|trẫm|tiên hiệp/.test(lower)) {
      addGenre('co-dai', 'Cổ Đại');
    }
    if (/xuyên không|xuyên sách|hệ thống/.test(lower)) {
      addGenre('xuyen-khong', 'Xuyên Không');
    }
    if (/hệ thống|thức tỉnh/.test(lower)) {
      addGenre('he-thong', 'Hệ Thống');
    }
    if (/mafia|ông trùm|hắc đạo|xã hội đen|băng đảng|sát thủ/.test(lower)) {
      addGenre('xa-hoi-den', 'Xã Hội Đen');
    }
    if (/đặc vụ|vệ sĩ|chiến thần|long vương|vua sói|cường giả|đế chế|võ/.test(lower)) {
      addGenre('hanh-dong', 'Hành Động');
      addGenre('cuong-gia-tai-xuat', 'Cường Giả Tái Xuất');
    }
    if (/cưỡng ép|cầm tù|chiếm đoạt|thế thân|giao kèo|bóng tối|cấm kỵ|ngoại tình|một đêm/.test(lower)) {
      addGenre('tinh-yeu-cuong-ep', 'Tình Yêu Cưỡng Ép');
    }
    if (/tổng tài|tỷ phú|ceo|hào môn|thừa kế|thiên kim|tiểu thư|chủ tịch|phú hào/.test(lower)) {
      addGenre('tong-tai', 'Tổng Tài');
    }
    if (/cưới|hôn nhân|hôn phu|vợ|chồng|cô dâu|chú rể/.test(lower)) {
      addGenre('cuoi-truoc-yeu-sau', 'Cưới Trước Yêu Sau');
    }
    if (/cưng chiều|ngọt|sủng|bảo mẫu|bé cưng|nhóc tì|mang thai|sinh con/.test(lower)) {
      addGenre('ngot-sung', 'Ngọt Sủng');
    }
    if (/bí ẩn|ẩn danh|thân phận|bí mật/.test(lower)) {
      addGenre('than-phan-bi-an', 'Thân Phận Bí Ẩn');
    }
    if (/gương vỡ|quay lại|tìm lại|năm sau/.test(lower)) {
      addGenre('guong-vo-lai-lanh', 'Gương Vỡ Lại Lành');
    }
    if (/người sói|ma cà rồng|rồng|thần|phép thuật|kỳ án|quái thú/.test(lower)) {
      addGenre('gia-tuong', 'Giả Tưởng & Kỳ Bí');
    }

    if (!slugSet.has('co-dai')) {
      addGenre('hien-dai', 'Hiện Đại');
      addGenre('tinh-cam-do-thi', 'Tình Cảm Đô Thị');
    }
    if (slugSet.size <= 2) {
      addGenre('kich-tinh', 'Kịch Tính');
      addGenre('tong-tai', 'Tổng Tài');
    }

    return {
      genreSlugs: Array.from(slugSet),
      genreObjects: genreNames,
      isDubbed
    };
  }

  buildDefaultDescription(displayTitle, genreObjects, totalEps) {
    const gNames = genreObjects.slice(0, 3).map(g => g.name).join(', ');
    return `${displayTitle} là bộ phim ngắn đặc sắc thuộc thể loại ${gNames || 'Ngôn tình, Kịch tính'}. Trọn bộ ${totalEps} tập với cốt truyện gay cấn, nhịp phim nhanh, những cú xoay chuyển bất ngờ và cảm xúc sâu sắc.`;
  }

  findCatalogEntry(rawTitle, displayTitle, slug, normTitle) {
    if (!this.catalogMap) return null;
    const rawSlug = this.makeSlug(rawTitle);
    const accentedKey = String(displayTitle || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const candidates = [
      slug,
      rawSlug,
      accentedKey,
      normTitle,
      `long-tieng-${slug}`,
      `${slug}-long-tieng`
    ];
    for (const c of candidates) {
      if (c && this.catalogMap[c] && this.catalogMap[c].id) {
        return this.catalogMap[c];
      }
    }
    return null;
  }

  enrichMovie(m, idx = 0) {
    const rawTitle = m.rawTitle || m.title || '';
    const displayTitle = this.cleanMovieTitle(rawTitle);
    const slug = m.slug || this.makeSlug(displayTitle);
    const normTitle = this.removeAccents(displayTitle).replace(/[^a-z0-9]+/g, ' ').trim();
    const searchKey = `${String(rawTitle).toLowerCase()} ${displayTitle.toLowerCase()} ${normTitle} ${slug}`;
    const { genreSlugs, genreObjects, isDubbed } = this.classifyMovie(rawTitle);
    const totalEps = (m.episodes && m.episodes.length) || m.total_episodes || 0;

    const h = this.hashCode(m.id || displayTitle);
    const sourceBadge = m.source || SOURCE_BADGES[h % SOURCE_BADGES.length];
    const viewCount = m.viewCount || (1200 + (h % 48000));
    const rating = m.avgRating || (8.8 + ((h % 12) / 10)).toFixed(1);

    const firstEp = (m.episodes && m.episodes[0]) ? m.episodes[0] : null;
    const firstEpId = firstEp ? (firstEp.id || firstEp) : '';
    const driveThumb = firstEpId && !String(firstEpId).startsWith('e')
      ? `https://drive.google.com/thumbnail?id=${firstEpId}&sz=w400`
      : '';

    const localCover = m.localCover || m.poster_url || `./covers/${m.id}.jpg`;
    const catEntry = this.findCatalogEntry(rawTitle, displayTitle, slug, normTitle);
    const tdPoster = (catEntry && catEntry.id)
      ? `https://trumdrama.com/_next/image?url=%2Fapi%2Fv1%2Fimage%2F${catEntry.id}&w=384&q=75`
      : '';

    // Ưu tiên số 1: Ảnh bìa poster chuẩn từ Trùm Drama (tránh ảnh chụp khung hình tập 1 từ Google Drive)
    const posterUrl = tdPoster || localCover || driveThumb;
    const fallbackPoster = (posterUrl === tdPoster) ? (localCover || driveThumb) : (driveThumb || '');
    const description = m.description || this.buildDefaultDescription(displayTitle, genreObjects, totalEps);

    return {
      ...m,
      rawTitle,
      localCover,
      indexOrder: idx,
      displayTitle,
      slug,
      normTitle,
      searchKey,
      genreSlugs,
      genreObjects,
      isDubbed,
      total_episodes: totalEps,
      sourceBadge,
      viewCount,
      rating,
      poster_url: posterUrl,
      fallbackPoster,
      driveThumb,
      description
    };
  }

  formatViews(n) {
    const num = Number(n) || 0;
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  formatTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const total = Math.max(0, Math.floor(sec));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  }

  formatTimeAgo(ts) {
    if (!ts) return 'Vừa xem';
    const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    return `${Math.floor(diffSec / 86400)} ngày trước`;
  }

  /* ==================== STORAGE: HISTORY & FAVORITES ==================== */

  loadWatchHistory() {
    let hist = {};
    try {
      const rawV2 = localStorage.getItem('dramaplay_history_v2');
      if (rawV2) hist = JSON.parse(rawV2) || {};
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
      this.updateNavBadges();
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
      this.updateNavBadges();
    } catch (e) {}
  }

  updateNavBadges() {
    const favCnt = this.favorites.size;
    const histCnt = Object.keys(this.watchHistory).length;
    if (this.navFavBadge) {
      this.navFavBadge.textContent = favCnt;
      this.navFavBadge.style.display = favCnt > 0 ? 'inline-block' : 'none';
    }
    if (this.navHistBadge) {
      this.navHistBadge.textContent = histCnt;
      this.navHistBadge.style.display = histCnt > 0 ? 'inline-block' : 'none';
    }
  }

  /* ==================== DOM INITIALIZATION ==================== */

  initElements() {
    this.siteHeader = document.getElementById('siteHeader');
    this.siteFooter = document.getElementById('siteFooter');
    this.mobileMenu = document.getElementById('mobileMenu');
    this.globalToast = document.getElementById('globalToast');

    this.headerSearchInput = document.getElementById('headerSearchInput');
    this.headerSearchDropdown = document.getElementById('headerSearchDropdown');
    this.mobileSearchInput = document.getElementById('mobileSearchInput');
    this.navFavBadge = document.getElementById('navFavBadge');
    this.navHistBadge = document.getElementById('navHistBadge');

    // Views
    this.viewHome = document.getElementById('viewHome');
    this.viewGenres = document.getElementById('viewGenres');
    this.viewExplore = document.getElementById('viewExplore');
    this.viewUserList = document.getElementById('viewUserList');
    this.viewDetail = document.getElementById('viewDetail');
    this.viewWatch = document.getElementById('viewWatch');

    // Home elements
    this.heroBannerBg = document.getElementById('heroBannerBg');
    this.heroGenres = document.getElementById('heroGenres');
    this.heroTitle = document.getElementById('heroTitle');
    this.heroDesc = document.getElementById('heroDesc');
    this.heroMeta = document.getElementById('heroMeta');
    this.heroPlayBtn = document.getElementById('heroPlayBtn');
    this.heroPlayText = document.getElementById('heroPlayText');
    this.heroDetailBtn = document.getElementById('heroDetailBtn');
    this.heroCoverflowSlides = document.getElementById('heroCoverflowSlides');
    this.heroDots = document.getElementById('heroDots');

    this.homeContinueSection = document.getElementById('homeContinueSection');
    this.homeContinueGrid = document.getElementById('homeContinueGrid');
    this.homeTrendingGrid = document.getElementById('homeTrendingGrid');
    this.homeGenresGrid = document.getElementById('homeGenresGrid');
    this.homeNewestGrid = document.getElementById('homeNewestGrid');
    this.homeBossGrid = document.getElementById('homeBossGrid');
    this.homeRebirthGrid = document.getElementById('homeRebirthGrid');
    this.homeDubbedSection = document.getElementById('homeDubbedSection');
    this.homeDubbedGrid = document.getElementById('homeDubbedGrid');
    this.vipBannerStatsText = document.getElementById('vipBannerStatsText');

    // Genres & Explore elements
    this.allGenresGrid = document.getElementById('allGenresGrid');
    this.exploreSearchInput = document.getElementById('exploreSearchInput');
    this.exploreGenreTags = document.getElementById('exploreGenreTags');
    this.exploreResultsCount = document.getElementById('exploreResultsCount');
    this.exploreCardsGrid = document.getElementById('exploreCardsGrid');
    this.explorePagination = document.getElementById('explorePagination');

    // User List elements
    this.userListTitle = document.getElementById('userListTitle');
    this.userListCount = document.getElementById('userListCount');
    this.userListClearBtn = document.getElementById('userListClearBtn');
    this.userListGrid = document.getElementById('userListGrid');

    // Detail elements
    this.detailBreadcrumbTitle = document.getElementById('detailBreadcrumbTitle');
    this.detailCoverImg = document.getElementById('detailCoverImg');
    this.detailTitle = document.getElementById('detailTitle');
    this.detailCreator = document.getElementById('detailCreator');
    this.detailTags = document.getElementById('detailTags');
    this.detailDesc = document.getElementById('detailDesc');
    this.detailPlayBtn = document.getElementById('detailPlayBtn');
    this.detailPlayText = document.getElementById('detailPlayText');
    this.detailFavBtn = document.getElementById('detailFavBtn');
    this.detailFavText = document.getElementById('detailFavText');
    this.detailEpCount = document.getElementById('detailEpCount');
    this.detailEpisodesGrid = document.getElementById('detailEpisodesGrid');
    this.detailRecommendedGrid = document.getElementById('detailRecommendedGrid');

    // Watch / Player elements
    this.epVideoArea = document.getElementById('epVideoArea');
    this.vpContainer = document.getElementById('vpContainer');
    this.videoEl = document.getElementById('mainVideo');
    this.driveEmbed = document.getElementById('driveEmbed');
    this.vpTouchLeft = document.getElementById('vpTouchLeft');
    this.vpTouchRight = document.getElementById('vpTouchRight');
    this.vpLoading = document.getElementById('vpLoading');
    this.vpBigPlay = document.getElementById('vpBigPlay');
    this.vpTitleText = document.getElementById('vpTitleText');
    this.autoNextOverlay = document.getElementById('autoNextOverlay');
    this.autoNextEpTitle = document.getElementById('autoNextEpTitle');
    this.autoNextCountdown = document.getElementById('autoNextCountdown');
    this.driveFallbackBar = document.getElementById('driveFallbackBar');
    this.driveEpBtn = document.getElementById('driveEpBtn');

    this.timelineWrapper = document.getElementById('timelineWrapper');
    this.timelineBuffered = document.getElementById('timelineBuffered');
    this.timelineProgress = document.getElementById('timelineProgress');
    this.svgPlayIcon = document.getElementById('svgPlayIcon');
    this.svgVolIcon = document.getElementById('svgVolIcon');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.currentTimeText = document.getElementById('currentTimeText');
    this.durationText = document.getElementById('durationText');
    this.btnAutoNextToggle = document.getElementById('btnAutoNextToggle');
    this.btnSpeed = document.getElementById('btnSpeed');
    this.vpSpeedMenu = document.getElementById('vpSpeedMenu');

    // Mobile & Sidebar watch info
    this.mwFloatPosterImg = document.getElementById('mwFloatPosterImg');
    this.mwFloatFavLabel = document.getElementById('mwFloatFavLabel');
    this.mwInfoTitle = document.getElementById('mwInfoTitle');

    this.epSheetPosterImg = document.getElementById('epSheetPosterImg');
    this.epBreadcrumbMovie = document.getElementById('epBreadcrumbMovie');
    this.epBreadcrumbEp = document.getElementById('epBreadcrumbEp');
    this.epSidebarTitle = document.getElementById('epSidebarTitle');
    this.epPrevBtn = document.getElementById('epPrevBtn');
    this.epNextBtn = document.getElementById('epNextBtn');
    this.epFavIcon = document.getElementById('epFavIcon');
    this.epFavText = document.getElementById('epFavText');
    this.epCurrentBadgeText = document.getElementById('epCurrentBadgeText');
    this.epSidebarDesc = document.getElementById('epSidebarDesc');
    this.epSidebarTags = document.getElementById('epSidebarTags');
    this.epPageTabs = document.getElementById('epPageTabs');
    this.epSidebarGrid = document.getElementById('epSidebarGrid');

    // Mobile Sheet & Popups
    this.mobileEpSheetBackdrop = document.getElementById('mobileEpSheetBackdrop');
    this.mwSheetPoster = document.getElementById('mwSheetPoster');
    this.mwSheetTitle = document.getElementById('mwSheetTitle');
    this.mwSheetSub = document.getElementById('mwSheetSub');
    this.mwSheetGenres = document.getElementById('mwSheetGenres');
    this.mwSheetTabs = document.getElementById('mwSheetTabs');
    this.mwSheetGrid = document.getElementById('mwSheetGrid');

    this.sharePopupBackdrop = document.getElementById('sharePopupBackdrop');
    this.sharePreviewCover = document.getElementById('sharePreviewCover');
    this.sharePreviewTitle = document.getElementById('sharePreviewTitle');
    this.sharePreviewMeta = document.getElementById('sharePreviewMeta');
    this.shareUrlInput = document.getElementById('shareUrlInput');

    this.settingsModalBackdrop = document.getElementById('settingsModalBackdrop');
    this.settingsMovieCount = document.getElementById('settingsMovieCount');
    this.folderIdInput = document.getElementById('folderIdInput');
    this.scriptUrlInput = document.getElementById('scriptUrlInput');
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
    if (this.scriptUrlInput) this.scriptUrl = this.scriptUrlInput.value.trim();
    if (this.folderIdInput) this.folderId = this.folderIdInput.value.trim();
    localStorage.setItem('dramaplay_script_url', this.scriptUrl);
    localStorage.setItem('dramaplay_folder_id', this.folderId);
    this.closeSettings();
    this.showToast('🔄 Đang tải lại danh sách kho phim...');
    this.fetchData(true);
  }

  /* ==================== EVENTS & ROUTING ==================== */

  initEvents() {
    // Header scroll glass transition
    window.addEventListener('scroll', () => {
      if (!this.siteHeader) return;
      if (window.scrollY > 24) {
        this.siteHeader.classList.remove('hdr-transparent');
        this.siteHeader.classList.add('hdr-scrolled');
      } else {
        this.siteHeader.classList.add('hdr-transparent');
        this.siteHeader.classList.remove('hdr-scrolled');
      }
    }, { passive: true });

    // Instant Search Dropdown in Header
    if (this.headerSearchInput) {
      this.headerSearchInput.addEventListener('input', () => {
        this.renderHeaderSearchDropdown(this.headerSearchInput.value);
      });
      this.headerSearchInput.addEventListener('focus', () => {
        if (this.headerSearchInput.value.trim()) {
          this.renderHeaderSearchDropdown(this.headerSearchInput.value);
        }
      });
    }

    // Explore page live search input
    if (this.exploreSearchInput) {
      this.exploreSearchInput.addEventListener('input', () => {
        this.exploreQuery = this.exploreSearchInput.value.trim();
        this.applyExploreFilters(1);
      });
    }

    // Close popups on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#headerSearchForm') && this.headerSearchDropdown) {
        this.headerSearchDropdown.classList.remove('active');
      }
      if (!e.target.closest('.vp-speed-wrap') && this.vpSpeedMenu) {
        this.vpSpeedMenu.style.display = 'none';
      }
    });

    // Hash routing
    window.addEventListener('hashchange', () => this.handleRouteFromHash());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (this.currentView !== 'watch') {
        if (e.key === '/') {
          e.preventDefault();
          if (this.headerSearchInput) this.headerSearchInput.focus();
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
          this.seekRelative(10);
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          this.seekRelative(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.prevEpisode();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.nextEpisode();
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
          if (this.mobileEpSheetBackdrop && this.mobileEpSheetBackdrop.style.display !== 'none') {
            this.closeMobileEpSheet();
          } else {
            this.backFromWatch();
          }
          break;
      }
    });

    this.initPlayerEvents();
  }

  initPlayerEvents() {
    if (!this.videoEl) return;

    this.videoEl.addEventListener('loadstart', () => {
      if (!this.isDriveMode) this.showLoader();
    });
    this.videoEl.addEventListener('waiting', () => {
      if (!this.isDriveMode) this.showLoader();
    });
    this.videoEl.addEventListener('canplay', () => this.hideLoader());
    this.videoEl.addEventListener('playing', () => {
      this.hideLoader();
      this.updatePlayPauseIcons(false);
      this.scheduleControlsHide(2800);
    });
    this.videoEl.addEventListener('play', () => {
      this.updatePlayPauseIcons(false);
    });
    this.videoEl.addEventListener('pause', () => {
      if (!this.isDriveMode && !this.videoEl.ended) {
        this.updatePlayPauseIcons(true);
        this.showControls(false);
      }
    });
    this.videoEl.addEventListener('timeupdate', () => {
      this.updateTimelineUI();
      this.saveCurrentProgress();
    });
    this.videoEl.addEventListener('loadedmetadata', () => this.updateTimelineUI());
    this.videoEl.addEventListener('progress', () => this.updateBufferedUI());
    this.videoEl.addEventListener('ended', () => this.handleVideoEnded());
    this.videoEl.addEventListener('error', () => this.handleVideoError());

    // Timeline Scrubbing
    if (this.timelineWrapper) {
      const scrubToX = (clientX) => {
        if (!this.videoEl || !this.videoEl.duration) return;
        const rect = this.timelineWrapper.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        this.videoEl.currentTime = ratio * this.videoEl.duration;
        this.updateTimelineUI();
      };

      this.timelineWrapper.addEventListener('mousedown', (e) => {
        this.isScrubbing = true;
        scrubToX(e.clientX);
      });
      window.addEventListener('mousemove', (e) => {
        if (this.isScrubbing) scrubToX(e.clientX);
      });
      window.addEventListener('mouseup', () => {
        this.isScrubbing = false;
      });
      this.timelineWrapper.addEventListener('touchstart', (e) => {
        this.isScrubbing = true;
        if (e.touches[0]) scrubToX(e.touches[0].clientX);
      }, { passive: true });
      this.timelineWrapper.addEventListener('touchmove', (e) => {
        if (this.isScrubbing && e.touches[0]) scrubToX(e.touches[0].clientX);
      }, { passive: true });
      this.timelineWrapper.addEventListener('touchend', () => {
        this.isScrubbing = false;
      }, { passive: true });
    }

    // Touch Zones (Single tap toggle play/controls, Double tap seek -10s/+10s, Hold 2x, Vertical Swipe next/prev ep)
    const bindZone = (zoneEl, deltaSec) => {
      if (!zoneEl) return;
      let lastTap = 0;
      let singleTapTimer = null;

      zoneEl.addEventListener('click', (e) => {
        if (this.isLongPressSpeed || this.isDriveMode) return;
        const now = Date.now();
        if (now - lastTap < 280) {
          if (singleTapTimer) clearTimeout(singleTapTimer);
          this.seekRelative(deltaSec);
        } else {
          if (singleTapTimer) clearTimeout(singleTapTimer);
          singleTapTimer = setTimeout(() => {
            this.togglePlay();
            this.showControls(true);
          }, 230);
        }
        lastTap = now;
      });
    };

    bindZone(this.vpTouchLeft, -10);
    bindZone(this.vpTouchRight, 10);

    if (this.vpContainer) {
      this.vpContainer.addEventListener('mousemove', () => {
        this.showControls(true);
      });

      this.vpContainer.addEventListener('touchstart', (e) => {
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

      this.vpContainer.addEventListener('touchmove', (e) => {
        if (!e.changedTouches[0]) return;
        const dy = Math.abs(e.changedTouches[0].screenY - this.touchStartY);
        const dx = Math.abs(e.changedTouches[0].screenX - this.touchStartX);
        if (dy > 18 || dx > 18) {
          if (this.longPressTimer) clearTimeout(this.longPressTimer);
        }
      }, { passive: true });

      this.vpContainer.addEventListener('touchend', (e) => {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
        if (this.isLongPressSpeed) {
          this.videoEl.playbackRate = this.savedSpeedBeforeHold || this.currentSpeed;
          this.hideToast();
          setTimeout(() => { this.isLongPressSpeed = false; }, 100);
          return;
        }
        if (!e.changedTouches[0]) return;
        const diffY = e.changedTouches[0].screenY - this.touchStartY;
        const diffX = Math.abs(e.changedTouches[0].screenX - this.touchStartX);
        if (Math.abs(diffY) > 80 && diffX < 65) {
          if (diffY < -80) this.nextEpisode();
          else if (diffY > 80) this.prevEpisode();
        }
      }, { passive: true });
    }
  }

  /* ==================== DATA FETCHING & CATALOG ENRICHMENT ==================== */

  async fetchData(force = false) {
    // Tải song song cả trumdrama_catalog.json và movies.json để có ngay ảnh poster chuẩn của Trùm Drama
    try {
      const [moviesRes, catRes] = await Promise.all([
        fetch(`./movies.json?t=${force ? Date.now() : 'td2'}`),
        this.catalogMap && Object.keys(this.catalogMap).length > 0
          ? Promise.resolve(null)
          : fetch('./trumdrama_catalog.json').catch(() => null)
      ]);

      if (catRes && catRes.ok) {
        try {
          const catData = await catRes.json();
          if (catData && typeof catData === 'object') {
            this.catalogMap = catData;
          }
        } catch (e) {}
      }

      if (moviesRes && moviesRes.ok) {
        const rawList = await moviesRes.json();
        if (Array.isArray(rawList) && rawList.length > 0) {
          this.setMoviesData(rawList);
          if (!this.catalogMap || Object.keys(this.catalogMap).length === 0) {
            this.loadCatalogInBackground();
          }
          return;
        }
      }
    } catch (e) {
      console.error('Error loading movies.json:', e);
    }

    // Fallback to Apps Script if movies.json is unavailable
    if (this.scriptUrl && this.folderId) {
      try {
        const res = await fetch(`${this.scriptUrl}?folderId=${encodeURIComponent(this.folderId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.movies)) {
          this.setMoviesData(data.movies);
          this.loadCatalogInBackground();
        }
      } catch (e) {}
    }
  }

  async loadCatalogInBackground() {
    try {
      const res = await fetch('./trumdrama_catalog.json');
      if (!res.ok) return;
      const cat = await res.json();
      if (cat && typeof cat === 'object') {
        this.catalogMap = cat;
        // Re-enrich movies so tdPoster becomes the primary poster_url
        this.movies = this.movies.map((m, idx) => this.enrichMovie(m, idx));
        this.initHeroBanner();
        this.renderHomeSections();
        if (this.currentView === 'explore') {
          this.applyExploreFilters(this.explorePage);
        } else if (this.currentView === 'detail' && this.currentMovie) {
          const updated = this.movies.find(mv => mv.id === this.currentMovie.id) || this.currentMovie;
          this.renderMovieDetailPage(updated);
        } else if (this.currentView === 'favorites' || this.currentView === 'history') {
          this.renderUserListPage(this.currentView);
        }
      }
    } catch (e) {}
  }

  setMoviesData(rawList) {
    this.movies = rawList.map((m, idx) => this.enrichMovie(m, idx));

    const totalEpsAll = this.movies.reduce((acc, m) => acc + (m.total_episodes || 0), 0);
    if (this.vipBannerStatsText) {
      this.vipBannerStatsText.textContent = `Mở khóa toàn bộ ${this.movies.length.toLocaleString('vi-VN')} bộ phim với hơn ${totalEpsAll.toLocaleString('vi-VN')} tập phim. Không quảng cáo, chất lượng Full HD mượt mà.`;
    }
    if (this.settingsMovieCount) {
      this.settingsMovieCount.textContent = `Đã đồng bộ ${this.movies.length.toLocaleString('vi-VN')} bộ phim (${totalEpsAll.toLocaleString('vi-VN')} tập)`;
    }

    this.initHeroBanner();
    this.renderHomeSections();
    this.renderGenresPage();
    this.renderExploreGenrePills();
    this.handleRouteFromHash();
  }

  /* ==================== NAVIGATION & ROUTING ==================== */

  navigate(view, event = null) {
    if (event) event.preventDefault();
    if (this.mobileMenu) this.mobileMenu.style.display = 'none';
    location.hash = `#${view}`;
  }

  openExploreWith(sort, genreSlug, event = null) {
    if (event) event.preventDefault();
    this.exploreSort = sort || 'popular';
    this.exploreGenre = genreSlug || '';
    this.explorePage = 1;
    location.hash = `#explore?sort=${encodeURIComponent(this.exploreSort)}&genre=${encodeURIComponent(this.exploreGenre)}`;
  }

  openMovieDetail(movieId, event = null) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    location.hash = `#movie/${encodeURIComponent(movieId)}`;
  }

  openCurrentMovieDetail(event = null) {
    if (event) event.preventDefault();
    if (this.currentMovie) {
      this.openMovieDetail(this.currentMovie.id);
    } else {
      this.navigate('home');
    }
  }

  openWatchEpisode(movieId, epIndex = 0, event = null) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    location.hash = `#watch/${encodeURIComponent(movieId)}/${epIndex}`;
  }

  backFromWatch(event = null) {
    if (event) event.preventDefault();
    if (this.currentMovie) {
      this.openMovieDetail(this.currentMovie.id);
    } else {
      this.navigate('home');
    }
  }

  handleRouteFromHash() {
    const hash = location.hash || '#home';

    // Stop active playback if leaving #watch
    if (!hash.startsWith('#watch/') && this.currentView === 'watch') {
      this.stopPlaybackCleanly();
    }

    if (hash.startsWith('#watch/')) {
      const parts = hash.replace('#watch/', '').split('/');
      const movieId = decodeURIComponent(parts[0] || '');
      const epIdx = parseInt(parts[1] || '0', 10) || 0;
      const found = this.movies.find(m => m.id === movieId || m.slug === movieId);
      if (found) {
        this.showActiveView('watch');
        const hist = this.watchHistory[found.id];
        const resumeSec = (hist && hist.epIndex === epIdx) ? (hist.time || 0) : 0;
        this.startPlayMovie(found, epIdx, resumeSec);
        return;
      }
    }

    if (hash.startsWith('#movie/')) {
      const movieId = decodeURIComponent(hash.replace('#movie/', '').split('/')[0] || '');
      const found = this.movies.find(m => m.id === movieId || m.slug === movieId);
      if (found) {
        this.showActiveView('detail');
        this.renderMovieDetailPage(found);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (hash.startsWith('#genres')) {
      this.showActiveView('genres');
      this.renderGenresPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (hash.startsWith('#explore')) {
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        if (params.has('sort')) this.exploreSort = params.get('sort') || 'popular';
        if (params.has('genre')) this.exploreGenre = params.get('genre') || '';
        if (params.has('q')) {
          this.exploreQuery = params.get('q') || '';
          if (this.exploreSearchInput) this.exploreSearchInput.value = this.exploreQuery;
        }
      }
      this.showActiveView('explore');
      this.applyExploreFilters(this.explorePage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (hash.startsWith('#favorites')) {
      this.showActiveView('favorites');
      this.renderUserListPage('favorites');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (hash.startsWith('#history')) {
      this.showActiveView('history');
      this.renderUserListPage('history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Default: Home
    document.title = 'Drama Film - Nền tảng xem phim ngắn hàng đầu';
    this.showActiveView('home');
    this.renderHomeContinueWatching();
  }

  showActiveView(viewName) {
    this.currentView = viewName;

    const isWatch = (viewName === 'watch');
    if (this.siteHeader) this.siteHeader.style.display = isWatch ? 'none' : '';
    if (this.siteFooter) this.siteFooter.style.display = isWatch ? 'none' : '';
    document.body.style.overflow = isWatch ? 'hidden' : '';

    if (this.viewHome) this.viewHome.style.display = viewName === 'home' ? 'block' : 'none';
    if (this.viewGenres) this.viewGenres.style.display = viewName === 'genres' ? 'block' : 'none';
    if (this.viewExplore) this.viewExplore.style.display = viewName === 'explore' ? 'block' : 'none';
    if (this.viewUserList) this.viewUserList.style.display = (viewName === 'favorites' || viewName === 'history') ? 'block' : 'none';
    if (this.viewDetail) this.viewDetail.style.display = viewName === 'detail' ? 'block' : 'none';
    if (this.viewWatch) this.viewWatch.style.display = isWatch ? 'flex' : 'none';

    // Update active state on header nav
    document.querySelectorAll('#desktopNav a, #mobileMenu .hdr-mobile-link').forEach(a => {
      a.classList.toggle('active', a.dataset.nav === viewName);
    });
  }

  toggleMobileMenu() {
    if (!this.mobileMenu) return;
    const isHidden = this.mobileMenu.style.display === 'none';
    this.mobileMenu.style.display = isHidden ? 'block' : 'none';
  }

  submitHeaderSearch(e) {
    if (e) e.preventDefault();
    const q = this.headerSearchInput ? this.headerSearchInput.value.trim() : '';
    if (this.headerSearchDropdown) this.headerSearchDropdown.classList.remove('active');
    this.exploreQuery = q;
    if (this.exploreSearchInput) this.exploreSearchInput.value = q;
    location.hash = `#explore?q=${encodeURIComponent(q)}`;
  }

  submitMobileSearch(e) {
    if (e) e.preventDefault();
    const q = this.mobileSearchInput ? this.mobileSearchInput.value.trim() : '';
    if (this.mobileMenu) this.mobileMenu.style.display = 'none';
    this.exploreQuery = q;
    if (this.exploreSearchInput) this.exploreSearchInput.value = q;
    location.hash = `#explore?q=${encodeURIComponent(q)}`;
  }

  renderHeaderSearchDropdown(rawQuery) {
    if (!this.headerSearchDropdown) return;
    const q = String(rawQuery || '').trim().toLowerCase();
    const qNoAcc = this.removeAccents(q);
    if (!q) {
      this.headerSearchDropdown.classList.remove('active');
      return;
    }

    const matches = this.movies.filter(m =>
      m.searchKey.includes(q) || m.searchKey.includes(qNoAcc)
    ).slice(0, 8);

    if (matches.length === 0) {
      this.headerSearchDropdown.innerHTML = `
        <div style="padding:16px; text-align:center; color:rgba(255,255,255,0.5); font-size:13px;">
          Không tìm thấy phim khớp với "${rawQuery}"
        </div>
      `;
      this.headerSearchDropdown.classList.add('active');
      return;
    }

    this.headerSearchDropdown.innerHTML = '';
    matches.forEach(m => {
      const div = document.createElement('div');
      div.className = 'td-search-item';
      const gText = m.genreObjects.slice(0, 2).map(g => g.name).join(' · ');
      div.innerHTML = `
        <img src="${m.poster_url}" data-fb="${m.fallbackPoster || ''}" data-dt="${m.driveThumb || ''}" alt="${m.displayTitle}" onerror="appInstance.handleImgError(this)">
        <div class="td-search-item-info">
          <div class="td-search-item-title">${m.displayTitle}</div>
          <div class="td-search-item-meta">${m.total_episodes} tập · ${gText}</div>
        </div>
      `;
      div.addEventListener('click', () => {
        this.headerSearchDropdown.classList.remove('active');
        this.openMovieDetail(m.id);
      });
      this.headerSearchDropdown.appendChild(div);
    });
    this.headerSearchDropdown.classList.add('active');
  }

  handleImgError(imgEl) {
    if (!imgEl) return;
    const fb = imgEl.getAttribute('data-fb');
    const dt = imgEl.getAttribute('data-dt');
    if (fb && imgEl.src !== fb && !imgEl.dataset.triedFb) {
      imgEl.dataset.triedFb = '1';
      imgEl.src = fb;
      return;
    }
    if (dt && imgEl.src !== dt && !imgEl.dataset.triedDt) {
      imgEl.dataset.triedDt = '1';
      imgEl.src = dt;
      return;
    }
    imgEl.style.opacity = '0.15';
  }

  /* ==================== 3D COVERFLOW HERO BANNER ==================== */

  initHeroBanner() {
    if (!this.movies || this.movies.length === 0) return;

    // Pick 5 top featured dramas
    const candidates = [...this.movies]
      .filter(m => m.total_episodes >= 35)
      .sort((a, b) => b.viewCount - a.viewCount);

    this.heroMovies = (candidates.length >= 5 ? candidates : this.movies).slice(0, 5);
    this.heroIndex = 0;

    this.renderHeroBanner();

    if (this.heroTimer) clearInterval(this.heroTimer);
    this.heroTimer = setInterval(() => {
      if (this.currentView === 'home') {
        this.nextHeroSlide();
      }
    }, 6000);
  }

  prevHeroSlide() {
    if (!this.heroMovies.length) return;
    this.heroIndex = (this.heroIndex - 1 + this.heroMovies.length) % this.heroMovies.length;
    this.renderHeroBanner();
  }

  nextHeroSlide() {
    if (!this.heroMovies.length) return;
    this.heroIndex = (this.heroIndex + 1) % this.heroMovies.length;
    this.renderHeroBanner();
  }

  setHeroSlide(idx) {
    this.heroIndex = idx;
    this.renderHeroBanner();
  }

  renderHeroBanner() {
    if (!this.heroMovies || this.heroMovies.length === 0) return;
    const m = this.heroMovies[this.heroIndex];
    if (!m) return;

    // 1. Background blurred images
    if (this.heroBannerBg) {
      this.heroBannerBg.innerHTML = this.heroMovies.map((hm, idx) => `
        <img alt="" class="hero-banner-bg-img" data-fb="${hm.fallbackPoster || ''}" data-dt="${hm.driveThumb || ''}" onerror="appInstance.handleImgError(this)" style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;opacity:${idx === this.heroIndex ? 1 : 0};transition:opacity 0.6s ease;" src="${hm.poster_url}"/>
      `).join('');
    }

    // 2. Left Text Info
    if (this.heroGenres) {
      this.heroGenres.innerHTML = m.genreObjects.slice(0, 3).map(g =>
        `<a href="#explore" class="hero-banner-genre" onclick="appInstance.openExploreWith('popular', '${g.slug}', event)">${g.name}</a>`
      ).join('');
    }
    if (this.heroTitle) this.heroTitle.textContent = m.displayTitle;
    if (this.heroDesc) this.heroDesc.textContent = m.description;
    if (this.heroMeta) {
      this.heroMeta.innerHTML = `<span>${m.total_episodes} tập</span> · <span>👁 ${this.formatViews(m.viewCount)} lượt xem</span>`;
    }

    const hist = this.watchHistory[m.id];
    if (this.heroPlayBtn && this.heroPlayText) {
      const targetEp = hist ? (hist.epIndex || 0) : 0;
      this.heroPlayText.textContent = hist ? `Xem Tiếp Tập ${targetEp + 1}` : 'Xem Ngay';
      this.heroPlayBtn.href = `#watch/${encodeURIComponent(m.id)}/${targetEp}`;
      this.heroPlayBtn.onclick = (e) => this.openWatchEpisode(m.id, targetEp, e);
    }
    if (this.heroDetailBtn) {
      this.heroDetailBtn.href = `#movie/${encodeURIComponent(m.id)}`;
      this.heroDetailBtn.onclick = (e) => this.openMovieDetail(m.id, e);
    }

    // 3. Right 3D Coverflow 5-Slide Stack
    if (this.heroCoverflowSlides) {
      const total = this.heroMovies.length;
      const getPosClass = (idx) => {
        const diff = (idx - this.heroIndex + total) % total;
        if (diff === 0) return 'hero-cf-center';
        if (diff === 1) return 'hero-cf-next';
        if (diff === 2) return 'hero-cf-far-next';
        if (diff === total - 1) return 'hero-cf-prev';
        return 'hero-cf-far-prev';
      };

      this.heroCoverflowSlides.innerHTML = this.heroMovies.map((hm, idx) => {
        const posClass = getPosClass(idx);
        return `
          <div class="hero-cf-slide ${posClass}" onclick="${idx === this.heroIndex ? `appInstance.openMovieDetail('${hm.id}', event)` : `appInstance.setHeroSlide(${idx})`}">
            <img alt="${hm.displayTitle}" width="280" height="373" class="hero-cf-img" src="${hm.poster_url}" data-fb="${hm.fallbackPoster || ''}" data-dt="${hm.driveThumb || ''}" onerror="appInstance.handleImgError(this)"/>
          </div>
        `;
      }).join('');
    }

    // 4. Dots
    if (this.heroDots) {
      this.heroDots.innerHTML = this.heroMovies.map((_, idx) =>
        `<button class="hero-dot ${idx === this.heroIndex ? 'active' : ''}" onclick="appInstance.setHeroSlide(${idx})" aria-label="Slide ${idx + 1}"></button>`
      ).join('');
    }
  }

  /* ==================== DRAMA CARD BUILDER (EXACT TRUMDRAMA) ==================== */

  createDramaCardElement(m, idx = 0) {
    const card = document.createElement('div');
    card.className = 'drama-card animate-fade-in';
    card.style.animationDelay = `${Math.min(idx * 25, 360)}ms`;

    const hist = this.watchHistory[m.id];
    const targetEp = hist ? (hist.epIndex || 0) : 0;
    const playText = hist ? `Tiếp Tập ${targetEp + 1}` : 'Xem Ngay';
    const tagsStr = m.genreObjects.slice(0, 3).map(g => g.name).join(' · ');

    card.innerHTML = `
      <a class="drama-card-image" href="#movie/${encodeURIComponent(m.id)}">
        <img alt="${m.displayTitle}" loading="lazy" decoding="async" class="drama-card-img" style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;" src="${m.poster_url}" data-fb="${m.fallbackPoster || ''}" data-dt="${m.driveThumb || ''}" onerror="appInstance.handleImgError(this)"/>
        <div class="drama-card-blur-zone"></div>
        <div class="drama-card-hover-gradient"></div>
        <span class="drama-card-source-badge">${m.sourceBadge}</span>
        ${m.isDubbed ? `<span class="drama-card-dub-badge">🎙️ Lồng Tiếng</span>` : ''}
        <span class="drama-card-ep-badge">${m.total_episodes} tập</span>
      </a>

      <a class="drama-card-title-layout" href="#movie/${encodeURIComponent(m.id)}">
        <p class="drama-card-title">${m.displayTitle}</p>
      </a>

      <div class="drama-card-overlay">
        <div class="drama-card-overlay-content">
          <a class="drama-card-overlay-title" href="#movie/${encodeURIComponent(m.id)}">${m.displayTitle}</a>
          <div class="drama-card-overlay-tags">
            <span>${tagsStr}</span>
          </div>
          <p class="drama-card-overlay-desc">${m.description}</p>
          <div class="drama-card-overlay-meta">
            <span>${m.total_episodes} tập · 👁 ${this.formatViews(m.viewCount)}</span>
          </div>
          <a class="drama-card-play-btn" href="#watch/${encodeURIComponent(m.id)}/${targetEp}">
            ${SVG_PLAY_CARD}
            <span class="drama-card-play-text">${playText}</span>
          </a>
        </div>
      </div>
    `;

    // Clicking the "Xem Ngay" button jumps straight to episode player
    const playBtn = card.querySelector('.drama-card-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        this.openWatchEpisode(m.id, targetEp, e);
      });
    }

    // Clicking anywhere else on card opens the Movie Detail Page (/phim/<slug>)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.drama-card-play-btn')) return;
      this.openMovieDetail(m.id, e);
    });

    return card;
  }

  renderCardListIntoGrid(gridEl, list) {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach((m, i) => frag.appendChild(this.createDramaCardElement(m, i)));
    gridEl.appendChild(frag);
  }

  /* ==================== HOMEPAGE SECTIONS ==================== */

  renderHomeSections() {
    this.renderHomeContinueWatching();

    // 1. Phim Thịnh Hành (16 cards sorted by viewCount)
    const trending = [...this.movies]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 16);
    this.renderCardListIntoGrid(this.homeTrendingGrid, trending);

    // 2. Thể Loại (8 cards on home)
    if (this.homeGenresGrid) {
      this.homeGenresGrid.innerHTML = TRUMDRAMA_GENRES.slice(0, 8).map(g => {
        const cnt = this.movies.filter(m => m.genreSlugs.includes(g.slug)).length;
        return `
          <a class="home-genre-card" href="#explore" onclick="appInstance.openExploreWith('popular', '${g.slug}', event)">
            <span class="home-genre-name">${g.name}</span>
            <span class="home-genre-count">${cnt} phim →</span>
          </a>
        `;
      }).join('');
    }

    // 3. Mới Cập Nhật (16 cards)
    const newest = [...this.movies]
      .slice(0, 16);
    this.renderCardListIntoGrid(this.homeNewestGrid, newest);

    // 4. Tổng Tài & Ngôn Tình (8 cards)
    const bossList = this.movies
      .filter(m => m.genreSlugs.includes('tong-tai') || m.genreSlugs.includes('cuoi-truoc-yeu-sau'))
      .slice(0, 8);
    this.renderCardListIntoGrid(this.homeBossGrid, bossList);

    // 5. Trọng Sinh & Báo Thù (8 cards)
    const rebirthList = this.movies
      .filter(m => m.genreSlugs.includes('trung-sinh') || m.genreSlugs.includes('bao-thu') || m.genreSlugs.includes('va-mat-xau-xa'))
      .slice(0, 8);
    this.renderCardListIntoGrid(this.homeRebirthGrid, rebirthList);

    // 6. Phim Lồng Tiếng (8 cards)
    const dubbedList = this.movies
      .filter(m => m.isDubbed)
      .slice(0, 8);
    if (this.homeDubbedSection) {
      if (dubbedList.length > 0) {
        this.homeDubbedSection.style.display = 'block';
        this.renderCardListIntoGrid(this.homeDubbedGrid, dubbedList);
      } else {
        this.homeDubbedSection.style.display = 'none';
      }
    }
  }

  renderHomeContinueWatching() {
    if (!this.homeContinueSection || !this.homeContinueGrid) return;
    const entries = Object.values(this.watchHistory)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const valid = [];
    for (const h of entries) {
      const m = this.movies.find(mv => mv.id === h.movieId || mv.title === h.movieTitle);
      if (m) valid.push({ m, h });
    }

    if (valid.length === 0) {
      this.homeContinueSection.style.display = 'none';
      return;
    }

    this.homeContinueSection.style.display = 'block';
    this.homeContinueGrid.innerHTML = '';

    valid.slice(0, 7).forEach(({ m, h }) => {
      const epNum = (h.epIndex || 0) + 1;
      const total = m.total_episodes || 1;
      const pct = Math.min(100, Math.max(5, Math.round((epNum / total) * 100)));

      const card = document.createElement('div');
      card.className = 'user-list-card';
      card.innerHTML = `
        <a class="user-list-card-poster" href="#watch/${encodeURIComponent(m.id)}/${h.epIndex || 0}">
          <img class="user-list-card-img" src="${m.poster_url}" data-fb="${m.fallbackPoster || ''}" data-dt="${m.driveThumb || ''}" alt="${m.displayTitle}" onerror="appInstance.handleImgError(this)"/>
          <span class="user-list-card-ep">Tập ${epNum}/${total}</span>
          <div class="history-progress-bar">
            <div class="history-progress-fill" style="width:${pct}%"></div>
          </div>
        </a>
        <div class="user-list-card-info">
          <div style="flex:1;min-width:0;">
            <a class="user-list-card-title" href="#movie/${encodeURIComponent(m.id)}">${m.displayTitle}</a>
            <div class="history-time-ago">${this.formatTimeAgo(h.updatedAt)}</div>
          </div>
          <button class="user-list-remove-btn" title="Xóa khỏi lịch sử">✕</button>
        </div>
      `;

      card.querySelector('.user-list-card-poster').addEventListener('click', (e) => {
        this.openWatchEpisode(m.id, h.epIndex || 0, e);
      });
      card.querySelector('.user-list-card-title').addEventListener('click', (e) => {
        this.openMovieDetail(m.id, e);
      });
      card.querySelector('.user-list-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeHistoryItem(m.id);
      });

      this.homeContinueGrid.appendChild(card);
    });
  }

  /* ==================== VIEW 2: GENRES PAGE (/the-loai) ==================== */

  renderGenresPage() {
    if (!this.allGenresGrid) return;
    this.allGenresGrid.innerHTML = TRUMDRAMA_GENRES.map((g, idx) => {
      const cnt = this.movies.filter(m => m.genreSlugs.includes(g.slug)).length;
      return `
        <a class="genre-card" style="animation-delay:${idx * 25}ms" href="#explore" onclick="appInstance.openExploreWith('popular', '${g.slug}', event)">
          <h2 class="genre-card-name">${g.name}</h2>
          <p class="genre-card-count">${cnt} bộ phim · Xem phim →</p>
        </a>
      `;
    }).join('');
  }

  /* ==================== VIEW 3: EXPLORE / SEARCH PAGE (/tim-kiem) ==================== */

  renderExploreGenrePills() {
    if (!this.exploreGenreTags) return;
    const allPill = `<a class="search-genre-tag ${!this.exploreGenre ? 'active' : ''}" data-genre="" href="#explore" onclick="appInstance.setExploreGenre('', event)">Tất cả</a>`;
    const pills = TRUMDRAMA_GENRES.map(g =>
      `<a class="search-genre-tag ${this.exploreGenre === g.slug ? 'active' : ''}" data-genre="${g.slug}" href="#explore" onclick="appInstance.setExploreGenre('${g.slug}', event)">${g.name}</a>`
    ).join('');
    this.exploreGenreTags.innerHTML = allPill + pills;
  }

  setExploreSort(sortVal, event = null) {
    if (event) event.preventDefault();
    this.exploreSort = sortVal;
    this.applyExploreFilters(1);
  }

  setExploreGenre(genreSlug, event = null) {
    if (event) event.preventDefault();
    this.exploreGenre = genreSlug;
    this.applyExploreFilters(1);
  }

  applyExploreFilters(page = 1) {
    this.explorePage = Math.max(1, page);

    // Sync active tabs
    document.querySelectorAll('#exploreSortTabs .genre-sort-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.sort === this.exploreSort);
    });
    document.querySelectorAll('#exploreGenreTags .search-genre-tag').forEach(el => {
      el.classList.toggle('active', (el.dataset.genre || '') === this.exploreGenre);
    });

    const q = (this.exploreSearchInput ? this.exploreSearchInput.value : this.exploreQuery).trim().toLowerCase();
    const qNoAcc = this.removeAccents(q);

    let list = [...this.movies];

    if (this.exploreGenre) {
      list = list.filter(m => m.genreSlugs.includes(this.exploreGenre));
    }
    if (q) {
      list = list.filter(m => m.searchKey.includes(q) || m.searchKey.includes(qNoAcc));
    }

    if (this.exploreSort === 'popular') {
      list.sort((a, b) => b.viewCount - a.viewCount);
    } else if (this.exploreSort === 'newest') {
      list.sort((a, b) => a.indexOrder - b.indexOrder);
    } else if (this.exploreSort === 'episodes') {
      list.sort((a, b) => b.total_episodes - a.total_episodes);
    } else if (this.exploreSort === 'rating') {
      list.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    } else if (this.exploreSort === 'title') {
      list.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle, 'vi'));
    }

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / this.explorePageSize));
    if (this.explorePage > totalPages) this.explorePage = totalPages;

    const genreObj = TRUMDRAMA_GENRES.find(g => g.slug === this.exploreGenre);
    const genreLabel = genreObj ? ` · Thể loại: ${genreObj.name}` : '';
    if (this.exploreResultsCount) {
      this.exploreResultsCount.textContent = `Tìm thấy ${total.toLocaleString('vi-VN')} bộ phim${genreLabel} (Trang ${this.explorePage}/${totalPages})`;
    }

    if (total === 0) {
      if (this.exploreCardsGrid) {
        this.exploreCardsGrid.innerHTML = `
          <div class="search-empty" style="grid-column:1/-1;">
            <span>🎬</span>
            <h3 class="search-empty-title">Không tìm thấy bộ phim nào</h3>
            <p class="search-empty-sub">Thử đổi từ khóa hoặc chọn thể loại "Tất cả"</p>
          </div>
        `;
      }
      if (this.explorePagination) this.explorePagination.innerHTML = '';
      return;
    }

    const start = (this.explorePage - 1) * this.explorePageSize;
    const pageItems = list.slice(start, start + this.explorePageSize);
    this.renderCardListIntoGrid(this.exploreCardsGrid, pageItems);
    this.renderExplorePagination(totalPages);
  }

  renderExplorePagination(totalPages) {
    if (!this.explorePagination) return;
    if (totalPages <= 1) {
      this.explorePagination.innerHTML = '';
      return;
    }

    let html = '';
    if (this.explorePage > 1) {
      html += `<a class="genre-page-btn" href="#explore" onclick="event.preventDefault(); appInstance.applyExploreFilters(${this.explorePage - 1}); window.scrollTo({top:0,behavior:'smooth'});">← Trước</a>`;
    }

    const startP = Math.max(1, this.explorePage - 3);
    const endP = Math.min(totalPages, startP + 6);
    for (let p = startP; p <= endP; p++) {
      html += `<a class="genre-page-num ${p === this.explorePage ? 'active' : ''}" href="#explore" onclick="event.preventDefault(); appInstance.applyExploreFilters(${p}); window.scrollTo({top:0,behavior:'smooth'});">${p}</a>`;
    }

    if (this.explorePage < totalPages) {
      html += `<a class="genre-page-btn" href="#explore" onclick="event.preventDefault(); appInstance.applyExploreFilters(${this.explorePage + 1}); window.scrollTo({top:0,behavior:'smooth'});">Tiếp →</a>`;
    }

    this.explorePagination.innerHTML = html;
  }

  /* ==================== VIEW 4: FAVORITES & HISTORY PAGE ==================== */

  renderUserListPage(mode) {
    if (!this.userListGrid) return;
    const isFav = (mode === 'favorites');
    if (this.userListTitle) {
      this.userListTitle.textContent = isFav ? '❤️ Tủ Phim Yêu Thích' : '🕒 Lịch Sử Xem Phim';
    }
    if (this.userListClearBtn) {
      this.userListClearBtn.style.display = (!isFav && Object.keys(this.watchHistory).length > 0) ? 'inline-block' : 'none';
    }

    let items = [];
    if (isFav) {
      items = this.movies.filter(m => this.favorites.has(m.id)).map(m => ({ m, h: this.watchHistory[m.id] }));
    } else {
      const sortedHist = Object.values(this.watchHistory).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      for (const h of sortedHist) {
        const m = this.movies.find(mv => mv.id === h.movieId || mv.title === h.movieTitle);
        if (m) items.push({ m, h });
      }
    }

    if (this.userListCount) {
      this.userListCount.textContent = `${items.length} bộ phim`;
    }

    if (items.length === 0) {
      this.userListGrid.innerHTML = `
        <div class="user-list-empty" style="grid-column:1/-1;">
          <p>${isFav ? 'Bạn chưa lưu bộ phim nào vào danh sách yêu thích.' : 'Bạn chưa có lịch sử xem phim nào.'}</p>
          <a class="user-list-empty-btn" href="#explore" onclick="appInstance.navigate('explore', event)">Khám Phá Kho Phim Ngay</a>
        </div>
      `;
      return;
    }

    this.userListGrid.innerHTML = '';
    items.forEach(({ m, h }) => {
      const epNum = h ? (h.epIndex || 0) + 1 : 1;
      const total = m.total_episodes || 1;
      const pct = h ? Math.min(100, Math.max(5, Math.round((epNum / total) * 100))) : 0;

      const card = document.createElement('div');
      card.className = 'user-list-card';
      card.innerHTML = `
        <a class="user-list-card-poster" href="#movie/${encodeURIComponent(m.id)}">
          <img class="user-list-card-img" src="${m.poster_url}" data-fb="${m.fallbackPoster || ''}" data-dt="${m.driveThumb || ''}" alt="${m.displayTitle}" onerror="appInstance.handleImgError(this)"/>
          <span class="user-list-card-ep">${h ? `Đang xem Tập ${epNum}/${total}` : `${total} tập`}</span>
          ${h ? `<div class="history-progress-bar"><div class="history-progress-fill" style="width:${pct}%"></div></div>` : ''}
        </a>
        <div class="user-list-card-info">
          <div style="flex:1;min-width:0;">
            <a class="user-list-card-title" href="#movie/${encodeURIComponent(m.id)}">${m.displayTitle}</a>
            ${h ? `<div class="history-time-ago">${this.formatTimeAgo(h.updatedAt)}</div>` : ''}
          </div>
          <button class="user-list-remove-btn" title="Xóa">✕</button>
        </div>
      `;

      card.querySelector('.user-list-card-poster').addEventListener('click', (e) => {
        if (h) this.openWatchEpisode(m.id, h.epIndex || 0, e);
        else this.openMovieDetail(m.id, e);
      });
      card.querySelector('.user-list-card-title').addEventListener('click', (e) => {
        this.openMovieDetail(m.id, e);
      });
      card.querySelector('.user-list-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (isFav) {
          this.toggleFavorite(m.id);
          this.renderUserListPage('favorites');
        } else {
          this.removeHistoryItem(m.id);
          this.renderUserListPage('history');
        }
      });

      this.userListGrid.appendChild(card);
    });
  }

  removeHistoryItem(movieId) {
    delete this.watchHistory[movieId];
    this.saveWatchHistoryMap();
    this.renderHomeContinueWatching();
  }

  clearAllHistory() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử xem phim?')) return;
    this.watchHistory = {};
    localStorage.removeItem('dramaplay_last_watch');
    this.saveWatchHistoryMap();
    this.renderHomeContinueWatching();
    if (this.currentView === 'history') this.renderUserListPage('history');
    this.showToast('🗑️ Đã xóa lịch sử xem phim');
  }

  /* ==================== VIEW 5: MOVIE DETAIL PAGE (/phim/<slug>) ==================== */

  renderMovieDetailPage(m) {
    this.detailMovie = m;
    document.title = `${m.displayTitle} - Drama Film`;

    if (this.detailBreadcrumbTitle) this.detailBreadcrumbTitle.textContent = m.displayTitle;
    if (this.detailCoverImg) {
      this.detailCoverImg.src = m.poster_url;
      this.detailCoverImg.setAttribute('data-fb', m.fallbackPoster || '');
      this.detailCoverImg.setAttribute('data-dt', m.driveThumb || '');
      this.detailCoverImg.onerror = () => this.handleImgError(this.detailCoverImg);
      this.detailCoverImg.alt = m.displayTitle;
    }
    if (this.detailTitle) this.detailTitle.textContent = m.displayTitle;
    if (this.detailCreator) {
      this.detailCreator.innerHTML = `
        <span>${m.total_episodes} tập</span>
        <span>·</span>
        <span>${this.formatViews(m.viewCount)} lượt xem</span>
        <span>·</span>
        <span>★ ${m.rating}</span>
      `;
    }
    if (this.detailTags) {
      this.detailTags.innerHTML = m.genreObjects.map(g =>
        `<a class="detail-tag" href="#explore" onclick="appInstance.openExploreWith('popular', '${g.slug}', event)">${g.name}</a>`
      ).join('');
    }
    if (this.detailDesc) this.detailDesc.textContent = m.description;

    const hist = this.watchHistory[m.id];
    const targetEp = hist ? (hist.epIndex || 0) : 0;
    if (this.detailPlayBtn && this.detailPlayText) {
      this.detailPlayText.textContent = hist ? `Xem Tiếp Tập ${targetEp + 1}` : 'Xem Ngay';
      this.detailPlayBtn.href = `#watch/${encodeURIComponent(m.id)}/${targetEp}`;
      this.detailPlayBtn.onclick = (e) => this.openWatchEpisode(m.id, targetEp, e);
    }

    this.updateDetailFavoriteUI();

    // Render Full Episode Grid
    const totalEps = (m.episodes && m.episodes.length) || 0;
    if (this.detailEpCount) {
      this.detailEpCount.textContent = `Tổng ${totalEps} tập`;
    }
    if (this.detailEpisodesGrid) {
      const watchedSet = new Set(hist?.watchedEps || []);
      this.detailEpisodesGrid.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < totalEps; i++) {
        const a = document.createElement('a');
        const isCurrent = hist && hist.epIndex === i;
        const isWatched = watchedSet.has(i);
        a.className = `detail-episode-item ${isCurrent ? 'current' : (isWatched ? 'watched' : '')}`;
        a.href = `#watch/${encodeURIComponent(m.id)}/${i}`;
        a.innerHTML = `<span class="detail-episode-number">${i + 1}</span>`;
        a.addEventListener('click', (e) => this.openWatchEpisode(m.id, i, e));
        frag.appendChild(a);
      }
      this.detailEpisodesGrid.appendChild(frag);
    }

    // Render Recommended Dramas
    if (this.detailRecommendedGrid) {
      const primarySlug = m.genreSlugs[0] || 'tong-tai';
      const related = this.movies
        .filter(x => x.id !== m.id && x.genreSlugs.includes(primarySlug))
        .slice(0, 8);
      this.renderCardListIntoGrid(this.detailRecommendedGrid, related);
    }
  }

  toggleDetailFavorite() {
    if (!this.detailMovie) return;
    this.toggleFavorite(this.detailMovie.id);
    this.updateDetailFavoriteUI();
  }

  updateDetailFavoriteUI() {
    if (!this.detailMovie || !this.detailFavBtn || !this.detailFavText) return;
    const isFav = this.favorites.has(this.detailMovie.id);
    this.detailFavBtn.classList.toggle('detail-stat-active', isFav);
    this.detailFavText.textContent = isFav ? 'Đã yêu thích' : 'Yêu thích';
  }

  /* ==================== VIEW 6: EPISODE WATCH PAGE (.episode-page) ==================== */

  startPlayMovie(movie, epIndex = 0, resumeTime = 0) {
    if (!movie || !movie.episodes || movie.episodes.length === 0) return;
    this.currentMovie = movie;
    this.currentEpIndex = Math.max(0, Math.min(epIndex, movie.episodes.length - 1));
    this.currentEpRangeIndex = Math.floor(this.currentEpIndex / this.epPageSize);

    document.title = `${movie.displayTitle} - Tập ${this.currentEpIndex + 1} | Drama Film`;
    this.requestWakeLock();
    this.renderWatchSidebarInfo();
    this.playCurrentEpisode(resumeTime);
  }

  renderWatchSidebarInfo() {
    const m = this.currentMovie;
    if (!m) return;

    if (this.epSheetPosterImg) this.epSheetPosterImg.src = m.poster_url;
    if (this.mwFloatPosterImg) this.mwFloatPosterImg.src = m.poster_url;
    if (this.epBreadcrumbMovie) this.epBreadcrumbMovie.textContent = m.displayTitle;
    if (this.epSidebarTitle) this.epSidebarTitle.textContent = m.displayTitle;
    if (this.epSidebarDesc) this.epSidebarDesc.textContent = m.description;
    if (this.epSidebarTags) {
      this.epSidebarTags.innerHTML = m.genreObjects.map(g =>
        `<a href="#explore" class="ep-tag" onclick="appInstance.openExploreWith('popular', '${g.slug}', event)">${g.name}</a>`
      ).join('');
    }
    this.updatePlayerFavoriteUI();
  }

  playCurrentEpisode(startTime = 0) {
    if (!this.currentMovie || !this.currentMovie.episodes[this.currentEpIndex]) return;

    this.cancelAutoNext();
    const m = this.currentMovie;
    const ep = m.episodes[this.currentEpIndex];
    const epNum = this.currentEpIndex + 1;
    const totalEps = m.episodes.length;

    // Update URL hash silently if switching episode inside watch view
    const targetHash = `#watch/${encodeURIComponent(m.id)}/${this.currentEpIndex}`;
    if (location.hash !== targetHash) {
      try {
        history.replaceState(null, '', targetHash);
      } catch (e) {}
    }

    document.title = `${m.displayTitle} - Tập ${epNum} | Drama Film`;

    // Sync range tab
    this.currentEpRangeIndex = Math.floor(this.currentEpIndex / this.epPageSize);

    // Update UI titles & badges
    if (this.vpTitleText) this.vpTitleText.textContent = `${m.displayTitle} — Tập ${epNum}`;
    if (this.mwInfoTitle) this.mwInfoTitle.textContent = `${m.displayTitle} - Tập ${epNum}`;
    if (this.epBreadcrumbEp) this.epBreadcrumbEp.textContent = `Tập ${epNum}`;
    if (this.epCurrentBadgeText) this.epCurrentBadgeText.textContent = `Đang xem: Tập ${epNum}`;
    if (this.driveEpBtn) this.driveEpBtn.textContent = `📑 Chọn tập (${epNum}/${totalEps})`;

    if (this.epPrevBtn) this.epPrevBtn.classList.toggle('ep-action-disabled', this.currentEpIndex <= 0);
    if (this.epNextBtn) this.epNextBtn.classList.toggle('ep-action-disabled', this.currentEpIndex >= totalEps - 1);

    this.recordEpisodeWatched(this.currentEpIndex, startTime);
    this.renderWatchEpisodesGrid();

    // Determine effective server
    let activeSrv = this.serverMode;
    if (activeSrv === 'stream' && !this.streamProxyAvailable && ep.id && !String(ep.id).startsWith('e')) {
      activeSrv = 'direct';
    }
    this.updateServerSwitcherUI(activeSrv);

    if (activeSrv === 'embed') {
      this.activateDriveEmbed(ep);
      return;
    }

    // HTML5 Video Playback
    this.isDriveMode = false;
    if (this.driveFallbackBar) this.driveFallbackBar.style.display = 'none';
    if (this.driveEmbed) {
      this.driveEmbed.style.display = 'none';
      this.driveEmbed.src = '';
    }
    if (this.videoEl) this.videoEl.style.display = 'block';
    if (this.vpControls) this.vpControls.style.display = '';

    let srcUrl = '';
    if (activeSrv === 'stream' && ep.id && !String(ep.id).startsWith('e')) {
      srcUrl = `/stream/?id=${ep.id}`;
    } else {
      srcUrl = ep.stream_url || ep.download_url || (ep.id ? `https://lh3.googleusercontent.com/d/${ep.id}` : '');
    }

    this.triedDirectFallback = (activeSrv === 'direct');
    this.pendingStartTime = startTime;

    this.showLoader();
    this.videoEl.src = srcUrl;
    this.videoEl.playbackRate = this.currentSpeed;
    this.videoEl.load();

    this.videoEl.onloadedmetadata = () => {
      if (this.pendingStartTime > 0 && this.videoEl.duration && this.pendingStartTime < this.videoEl.duration - 2) {
        this.videoEl.currentTime = this.pendingStartTime;
        this.pendingStartTime = 0;
      }
      this.videoEl.play().catch(() => {
        this.hideLoader();
        this.updatePlayPauseIcons(true);
      });
    };

    this.showControls(true);
  }

  handleVideoError() {
    if (this.isDriveMode || !this.currentMovie) return;
    const ep = this.currentMovie.episodes[this.currentEpIndex];
    if (!ep) return;

    const directUrl = ep.stream_url || (ep.id ? `https://lh3.googleusercontent.com/d/${ep.id}` : '');
    if (!this.triedDirectFallback && directUrl) {
      this.streamProxyAvailable = false;
      this.triedDirectFallback = true;
      this.updateServerSwitcherUI('direct');
      this.videoEl.src = directUrl;
      this.videoEl.load();
      this.videoEl.play().catch(() => {});
      return;
    }

    this.activateDriveEmbed(ep);
  }

  activateDriveEmbed(ep) {
    this.hideLoader();
    this.isDriveMode = true;
    this.updateServerSwitcherUI('embed');

    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.style.display = 'none';
    }
    if (this.vpBigPlay) this.vpBigPlay.style.display = 'none';
    if (this.driveEmbed) {
      this.driveEmbed.style.display = 'block';
      this.driveEmbed.src = ep.preview_url || `https://drive.google.com/file/d/${ep.id}/preview`;
    }
    if (this.driveFallbackBar) this.driveFallbackBar.style.display = 'flex';
  }

  switchServer(mode) {
    this.serverMode = mode;
    if (mode === 'stream') this.streamProxyAvailable = true;
    const curTime = (!this.isDriveMode && this.videoEl) ? Math.floor(this.videoEl.currentTime || 0) : 0;
    const labels = { stream: '⚡ VIP 1', direct: '🌐 VIP 2', embed: '☁️ Google Drive' };
    this.showToast(`Đang chuyển luồng ${labels[mode] || mode}...`);
    this.playCurrentEpisode(curTime);
  }

  updateServerSwitcherUI(activeMode) {
    document.querySelectorAll('.vp-srv-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.srv === activeMode);
    });
  }

  stopPlaybackCleanly() {
    this.cancelAutoNext();
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.hideLoader();
    this.isDriveMode = false;
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
    }
    if (this.driveEmbed) {
      this.driveEmbed.src = '';
      this.driveEmbed.style.display = 'none';
    }
    this.closeMobileEpSheet();
    this.releaseWakeLock();
  }

  /* ==================== WATCH EPISODE GRIDS & MOBILE SHEET ==================== */

  renderWatchEpisodesGrid() {
    if (!this.currentMovie) return;
    const total = this.currentMovie.episodes.length;
    const numRanges = Math.ceil(total / this.epPageSize);
    const watchedSet = new Set(this.watchHistory[this.currentMovie.id]?.watchedEps || []);

    // Desktop sidebar range tabs
    if (this.epPageTabs) {
      if (numRanges <= 1) {
        this.epPageTabs.innerHTML = '';
      } else {
        let tabsHtml = '';
        for (let r = 0; r < numRanges; r++) {
          const s = r * this.epPageSize + 1;
          const e = Math.min(total, (r + 1) * this.epPageSize);
          tabsHtml += `<span class="ep-page-tab ${r === this.currentEpRangeIndex ? 'active' : ''}" onclick="appInstance.setWatchEpRange(${r})">${s}-${e}</span>`;
        }
        this.epPageTabs.innerHTML = tabsHtml;
      }
    }

    // Mobile sheet range tabs
    if (this.mwSheetTabs) {
      if (numRanges <= 1) {
        this.mwSheetTabs.innerHTML = `<button class="mw-sheet-tab active">1-${total}</button>`;
      } else {
        let mTabs = '';
        for (let r = 0; r < numRanges; r++) {
          const s = r * this.epPageSize + 1;
          const e = Math.min(total, (r + 1) * this.epPageSize);
          mTabs += `<button class="mw-sheet-tab ${r === this.currentEpRangeIndex ? 'active' : ''}" onclick="appInstance.setWatchEpRange(${r})">${s}-${e}</button>`;
        }
        this.mwSheetTabs.innerHTML = mTabs;
      }
    }

    const startIdx = this.currentEpRangeIndex * this.epPageSize;
    const endIdx = Math.min(total, startIdx + this.epPageSize);

    const populateGrid = (gridEl, itemClass, closeSheetOnClick) => {
      if (!gridEl) return;
      gridEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let idx = startIdx; idx < endIdx; idx++) {
        const a = document.createElement('a');
        const isCurrent = idx === this.currentEpIndex;
        const isWatched = watchedSet.has(idx);
        a.className = `${itemClass} ${isCurrent ? 'current' : (isWatched ? 'watched' : '')}`;
        a.href = `#watch/${encodeURIComponent(this.currentMovie.id)}/${idx}`;
        a.textContent = idx + 1;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this.currentEpIndex = idx;
          this.playCurrentEpisode(0);
          if (closeSheetOnClick) this.closeMobileEpSheet();
        });
        frag.appendChild(a);
      }
      gridEl.appendChild(frag);
    };

    populateGrid(this.epSidebarGrid, 'ep-episode-item', false);
    populateGrid(this.mwSheetGrid, 'mw-sheet-ep', true);
  }

  setWatchEpRange(r) {
    this.currentEpRangeIndex = r;
    this.renderWatchEpisodesGrid();
  }

  openMobileEpSheet() {
    if (!this.currentMovie || !this.mobileEpSheetBackdrop) return;
    const m = this.currentMovie;
    if (this.mwSheetPoster) this.mwSheetPoster.src = m.poster_url;
    if (this.mwSheetTitle) this.mwSheetTitle.textContent = m.displayTitle;
    if (this.mwSheetSub) this.mwSheetSub.textContent = `Tổng ${m.episodes.length} tập • Đang phát Tập ${this.currentEpIndex + 1}`;
    if (this.mwSheetGenres) {
      this.mwSheetGenres.innerHTML = m.genreObjects.slice(0, 3).map(g => `<span>${g.name}</span>`).join('');
    }
    this.renderWatchEpisodesGrid();
    this.mobileEpSheetBackdrop.style.display = 'flex';
  }

  closeMobileEpSheet() {
    if (this.mobileEpSheetBackdrop) this.mobileEpSheetBackdrop.style.display = 'none';
  }

  /* ==================== VIDEO CONTROLS & AUTO-NEXT ==================== */

  togglePlay() {
    if (this.isDriveMode || !this.videoEl) return;
    if (this.videoEl.paused) {
      this.videoEl.play().catch(() => {});
    } else {
      this.videoEl.pause();
    }
  }

  updatePlayPauseIcons(isPaused) {
    if (this.vpBigPlay) {
      this.vpBigPlay.style.display = (!this.isDriveMode && isPaused) ? 'flex' : 'none';
    }
    if (this.svgPlayIcon) {
      this.svgPlayIcon.innerHTML = isPaused
        ? `<path d="M8 5v14l11-7z"></path>`
        : `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>`;
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
    this.updateVolumeIcon();
    localStorage.setItem('dramaplay_volume', String(v));
  }

  toggleMute() {
    if (!this.videoEl) return;
    this.videoEl.muted = !this.videoEl.muted;
    this.updateVolumeIcon();
    this.showToast(this.videoEl.muted ? '🔇 Đã tắt tiếng' : '🔊 Đã bật tiếng', 900);
  }

  updateVolumeIcon() {
    if (!this.svgVolIcon || !this.videoEl) return;
    if (this.videoEl.muted || this.videoEl.volume === 0) {
      this.svgVolIcon.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path>`;
    } else {
      this.svgVolIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path>`;
    }
  }

  toggleSpeedMenu(e) {
    if (e) e.stopPropagation();
    if (!this.vpSpeedMenu) return;
    const isHidden = this.vpSpeedMenu.style.display === 'none';
    this.vpSpeedMenu.style.display = isHidden ? 'flex' : 'none';
  }

  setPlaybackSpeed(spd) {
    this.currentSpeed = spd;
    if (this.videoEl) this.videoEl.playbackRate = spd;
    if (this.btnSpeed) this.btnSpeed.textContent = `${spd}x`;
    if (this.vpSpeedMenu) {
      this.vpSpeedMenu.querySelectorAll('.vp-speed-item').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.spd) === spd);
      });
      this.vpSpeedMenu.style.display = 'none';
    }
    this.showToast(`⚡ Tốc độ phát: ${spd}x`, 900);
  }

  toggleAutoNextSetting() {
    this.autoNextEnabled = !this.autoNextEnabled;
    localStorage.setItem('dramaplay_autonext', String(this.autoNextEnabled));
    this.updateAutoNextUI();
    this.showToast(this.autoNextEnabled ? '🔄 Tự động chuyển tập: BẬT' : '⏸ Tự động chuyển tập: TẮT');
  }

  updateAutoNextUI() {
    if (!this.btnAutoNextToggle) return;
    this.btnAutoNextToggle.classList.toggle('vp-btn-active', this.autoNextEnabled);
    this.btnAutoNextToggle.textContent = this.autoNextEnabled ? 'Auto: Bật' : 'Auto: Tắt';
  }

  toggleFullscreen() {
    const target = this.epVideoWrapper || this.epVideoArea || document.documentElement;
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

  showLoader() {
    if (this.vpLoading) this.vpLoading.style.display = 'flex';
  }

  hideLoader() {
    if (this.vpLoading) this.vpLoading.style.display = 'none';
  }

  scheduleControlsHide(delay = 2800) {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (!this.isDriveMode && this.videoEl && !this.videoEl.paused && this.vpContainer) {
        this.vpContainer.classList.remove('vp-show-controls');
      }
    }, delay);
  }

  showControls(autoHide = true) {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    if (this.vpContainer) this.vpContainer.classList.add('vp-show-controls');
    if (autoHide && !this.isDriveMode && this.videoEl && !this.videoEl.paused) {
      this.scheduleControlsHide(2800);
    }
  }

  handleVideoEnded() {
    if (!this.currentMovie) return;
    if (this.currentEpIndex < this.currentMovie.episodes.length - 1) {
      if (this.autoNextEnabled) {
        this.startAutoNextCountdown();
      }
    } else {
      this.showToast('🎉 Bạn đã xem trọn bộ phim này!', 3500);
    }
  }

  startAutoNextCountdown() {
    let timeLeft = 2;
    if (this.autoNextEpTitle) this.autoNextEpTitle.textContent = `Tập ${this.currentEpIndex + 2}`;
    if (this.autoNextCountdown) this.autoNextCountdown.textContent = timeLeft;
    if (this.autoNextOverlay) this.autoNextOverlay.classList.add('active');

    if (this.autoNextTimer) clearInterval(this.autoNextTimer);
    this.autoNextTimer = setInterval(() => {
      timeLeft -= 1;
      if (this.autoNextCountdown) this.autoNextCountdown.textContent = timeLeft;
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
      this.showToast(`⏭ Tập ${this.currentEpIndex + 1}`);
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
      this.showToast(`⏮ Tập ${this.currentEpIndex + 1}`);
      this.playCurrentEpisode(0);
    } else {
      this.showToast('Đang ở Tập 1');
    }
  }

  /* ==================== FAVORITES, SHARE & PROGRESS ==================== */

  toggleFavorite(movieId) {
    if (this.favorites.has(movieId)) {
      this.favorites.delete(movieId);
      this.showToast('Đã xóa khỏi Yêu thích');
    } else {
      this.favorites.add(movieId);
      this.showToast('❤️ Đã thêm vào Yêu thích');
    }
    this.saveFavorites();
  }

  toggleCurrentMovieFavorite() {
    if (!this.currentMovie) return;
    this.toggleFavorite(this.currentMovie.id);
    this.updatePlayerFavoriteUI();
  }

  updatePlayerFavoriteUI() {
    if (!this.currentMovie) return;
    const isFav = this.favorites.has(this.currentMovie.id);
    if (this.epFavIcon) this.epFavIcon.textContent = isFav ? '❤️' : '🤍';
    if (this.epFavText) this.epFavText.textContent = isFav ? 'Đã lưu' : 'Lưu';
    if (this.mwFloatFavLabel) this.mwFloatFavLabel.textContent = isFav ? 'Đã thích' : 'Yêu thích';
  }

  openSharePopup() {
    const m = (this.currentView === 'watch' ? this.currentMovie : this.detailMovie) || this.currentMovie || this.detailMovie;
    if (!m || !this.sharePopupBackdrop) return;
    if (this.sharePreviewCover) this.sharePreviewCover.src = m.poster_url;
    if (this.sharePreviewTitle) this.sharePreviewTitle.textContent = m.displayTitle;
    if (this.sharePreviewMeta) this.sharePreviewMeta.textContent = `Trọn bộ ${m.total_episodes} tập • Full HD`;
    if (this.shareUrlInput) this.shareUrlInput.value = window.location.href;
    this.sharePopupBackdrop.style.display = 'flex';
  }

  closeSharePopup() {
    if (this.sharePopupBackdrop) this.sharePopupBackdrop.style.display = 'none';
  }

  copyShareUrl() {
    if (!this.shareUrlInput) return;
    this.shareUrlInput.select();
    navigator.clipboard?.writeText(this.shareUrlInput.value).catch(() => {
      document.execCommand('copy');
    });
    this.showToast('✅ Đã sao chép đường dẫn chia sẻ!');
    this.closeSharePopup();
  }

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
    if (cur % 3 !== 0) return;

    const mid = this.currentMovie.id;
    const existing = this.watchHistory[mid] || { watchedEps: [this.currentEpIndex] };
    const watchedSet = new Set(existing.watchedEps || []);
    watchedSet.add(this.currentEpIndex);

    const record = {
      movieId: mid,
      movieTitle: this.currentMovie.title,
      epIndex: this.currentEpIndex,
      epName: `Tập ${this.currentEpIndex + 1}`,
      time: cur,
      duration: Math.floor(this.videoEl.duration || 120),
      watchedEps: Array.from(watchedSet),
      updatedAt: Date.now()
    };

    this.watchHistory[mid] = record;
    localStorage.setItem('dramaplay_last_watch', JSON.stringify(record));
    this.saveWatchHistoryMap();
  }

  /* ==================== SETTINGS & TOAST & WAKE LOCK ==================== */

  openSettings() {
    if (this.settingsModalBackdrop) this.settingsModalBackdrop.style.display = 'flex';
  }

  closeSettings() {
    if (this.settingsModalBackdrop) this.settingsModalBackdrop.style.display = 'none';
  }

  showToast(msg, duration = 1600) {
    if (!this.globalToast) return;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.globalToast.textContent = msg;
    this.globalToast.classList.add('active');
    this.toastTimeout = setTimeout(() => {
      this.globalToast.classList.remove('active');
    }, duration);
  }

  hideToast() {
    if (!this.globalToast) return;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.globalToast.classList.remove('active');
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}

let appInstance = null;
window.addEventListener('DOMContentLoaded', () => {
  appInstance = new TrumDramaApp();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=20261022_df').catch(() => {});
  }
});
