/**
 * DRAMAPLAY - GOOGLE APPS SCRIPT BACKEND
 * Quét toàn bộ thư mục phim và tập phim trên Google Drive, trả về dữ liệu cho App xem phim.
 * 
 * HƯỚNG DẪN CÀI ĐẶT 1 PHÚT (HOÀN TOÀN MIỄN PHÍ):
 * 1. Truy cập https://script.google.com/ -> Bấm "+ Dự án mới" (New project)
 * 2. Xóa code cũ, dán toàn bộ đoạn code này vào.
 * 3. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
 * 4. Bấm vào biểu tượng bánh răng bên trái -> Chọn "Ứng dụng web" (Web app)
 * 5. Cấu hình:
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 6. Bấm "Triển khai" (Deploy) -> Cấp quyền truy cập Google Drive của bạn.
 * 7. Copy đường link "URL của ứng dụng web" (có đuôi /exec) dán vào App DramaPlay là xong!
 */

function doGet(e) {
  var folderId = e && e.parameter ? e.parameter.folderId : null;
  
  if (!folderId) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Vui lòng truyền tham số folderId (ID thư mục Google Drive chứa các phim)"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var rootFolder = DriveApp.getFolderById(folderId);
    var subFolders = rootFolder.getFolders();
    var movies = [];
    
    // 1. Quét từng thư mục con (mỗi thư mục con là 1 bộ phim)
    while (subFolders.hasNext()) {
      var folder = subFolders.next();
      var movieTitle = folder.getName();
      var files = folder.getFiles();
      var episodes = [];
      
      while (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType();
        var name = file.getName();
        
        if (mime.indexOf("video") !== -1 || name.match(/\.(mp4|mkv|mov|webm|avi)$/i)) {
          var fileId = file.getId();
          episodes.push({
            id: fileId,
            name: name,
            size: file.getSize(),
            stream_url: "https://lh3.googleusercontent.com/d/" + fileId,
            download_url: "https://drive.google.com/uc?export=download&id=" + fileId,
            preview_url: "https://drive.google.com/file/d/" + fileId + "/preview"
          });
        }
      }
      
      episodes.sort(function(a, b) {
        return a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'});
      });
      
      if (episodes.length > 0) {
        movies.push({
          id: folder.getId(),
          title: movieTitle,
          total_episodes: episodes.length,
          episodes: episodes
        });
      }
    }
    
    // 2. Quét cả thư mục gốc nếu người dùng để file tập trực tiếp trong thư mục gốc
    var rootFiles = rootFolder.getFiles();
    var rootEpisodes = [];
    while (rootFiles.hasNext()) {
      var rf = rootFiles.next();
      var rname = rf.getName();
      if (rf.getMimeType().indexOf("video") !== -1 || rname.match(/\.(mp4|mkv|mov|webm|avi)$/i)) {
        rootEpisodes.push({
          id: rf.getId(),
          name: rname,
          size: rf.getSize(),
          stream_url: "https://lh3.googleusercontent.com/d/" + rf.getId(),
          download_url: "https://drive.google.com/uc?export=download&id=" + rf.getId(),
          preview_url: "https://drive.google.com/file/d/" + rf.getId() + "/preview"
        });
      }
    }
    
    if (rootEpisodes.length > 0) {
      rootEpisodes.sort(function(a, b) {
        return a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'});
      });
      movies.unshift({
        id: rootFolder.getId(),
        title: rootFolder.getName(),
        total_episodes: rootEpisodes.length,
        episodes: rootEpisodes
      });
    }
    
    movies.sort(function(a, b) {
      return a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'});
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      folder_name: rootFolder.getName(),
      total_movies: movies.length,
      movies: movies
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
