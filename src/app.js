// Đối tượng dùng chung giữa các màn hình (tránh import vòng). main.js gán các hàm vào đây khi khởi động.
export const app = {
  stage: null,                 // Stage3D (null nếu máy không có WebGL)
  tab: 'call',
  setTab: () => {},            // đổi tab
  goToRow: () => {},           // nhảy tới 1 hàng trong tab Vé
  goToColor: () => {},         // nhảy tới 1 màu trong tab Vé
  renderActive: () => {},      // vẽ lại tab đang mở
};
