import type {
  Aggregation,
  ChartType,
  DateGrain,
  FilterOperator,
} from "../../types/chartBuilder";

export const CHART_BUILDER_LABELS = {
  title: "Biểu đồ mới",
  settings: "Cài đặt biểu đồ",
  chartType: "Loại biểu đồ",
  datasets: "Bộ dữ liệu phân tích",
  dimension: "Chiều phân tích (Dimension)",
  metric: "Chỉ số đo lường (Metric)",
  dimensionAxis: "Trục X / Chiều phân tích",
  metricAxis: "Giá trị / Chỉ số",
  series: "Chú giải / Chuỗi dữ liệu",
  filters: "Bộ lọc",
  tooltip: "Chú thích khi di chuột",
  reset: "Đặt lại",
  save: "Lưu biểu đồ",
  searchPlaceholder: "Tìm trường dữ liệu...",
  loadingCatalog: "Đang tải bộ dữ liệu...",
  loadingChart: "Đang tạo biểu đồ...",
  emptyChart: "Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.",
  invalidChart: "Cấu hình biểu đồ chưa hợp lệ.",
  chartError: "Không thể tải dữ liệu biểu đồ.",
} as const;

export const DIMENSION_GUIDANCE =
  "Trường dùng để phân nhóm dữ liệu, chẳng hạn như kênh, trạng thái, ngày hoặc chủ đề.";

export const METRIC_GUIDANCE =
  "Giá trị dùng để tính toán và so sánh, chẳng hạn như số lượng hội thoại, thời gian phản hồi trung bình hoặc tỷ lệ xử lý.";

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Cột đứng",
  line: "Đường",
  area: "Vùng",
  donut: "Hình khuyên",
  pie: "Hình tròn",
  horizontal_bar: "Cột ngang",
  stacked_bar: "Cột chồng",
  scatter: "Phân tán",
  combo: "Kết hợp",
  radar: "Radar",
};

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  count: "Đếm",
  count_distinct: "Đếm không trùng",
  sum: "Tổng",
  avg: "Trung bình",
  min: "Nhỏ nhất",
  max: "Lớn nhất",
};

export const DATE_GRAIN_LABELS: Record<DateGrain, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  quarter: "Quý",
  year: "Năm",
};

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "Bằng",
  neq: "Khác",
  gt: "Lớn hơn",
  gte: "Lớn hơn hoặc bằng",
  lt: "Nhỏ hơn",
  lte: "Nhỏ hơn hoặc bằng",
  before: "Trước",
  after: "Sau",
  between: "Trong khoảng",
  contains: "Có chứa",
  starts_with: "Bắt đầu bằng",
  in: "Nằm trong",
  not_in: "Không nằm trong",
  is_null: "Là giá trị rỗng",
  is_not_null: "Không phải giá trị rỗng",
};
