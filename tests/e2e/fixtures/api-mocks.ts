/**
 * API mock helpers for Playwright route interception.
 * Each helper intercepts the matching API route and returns
 * a deterministic response without hitting the real SQL Server.
 */
import { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock catalog payload – stable subset of the real catalog
// ---------------------------------------------------------------------------
export const MOCK_CATALOG = {
  success: true,
  message: 'Lấy danh mục dữ liệu biểu đồ thành công.',
  data: {
    version: 2,
    cachedAt: new Date().toISOString(),
    defaultLimit: 500,
    maxLimit: 5000,
    aggregations: ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'],
    dateGrains: ['day', 'week', 'month', 'quarter', 'year'],
    filterOperators: ['eq', 'neq', 'contains', 'between', 'is_null', 'is_not_null'],
    datasets: [
      {
        id: 'conversations',
        label: 'Hội thoại',
        description: 'Dữ liệu hội thoại từ SQL Server.',
        available: true,
        unavailableReason: null,
        defaultDateField: 'created_at',
        defaultDimension: 'channel',
        defaultMetric: 'conversation_id',
        defaultLimit: 500,
        maxLimit: 5000,
        fields: [
          {
            id: 'channel',
            label: 'Kênh',
            dataType: 'string',
            semanticType: 'channel',
            roles: ['dimension', 'filter'],
            aggregations: [],
            filterOperators: ['eq', 'neq', 'in', 'not_in', 'contains', 'is_null', 'is_not_null'],
            dateGrains: [],
            defaultAggregation: null,
            nullable: true,
            available: true,
          },
          {
            id: 'conversation_id',
            label: 'Số lượng hội thoại',
            dataType: 'string',
            semanticType: 'id',
            roles: ['metric'],
            aggregations: ['count', 'count_distinct'],
            filterOperators: [],
            dateGrains: [],
            defaultAggregation: 'count_distinct',
            nullable: false,
            available: true,
          },
          {
            id: 'response_minutes',
            label: 'Thời gian phản hồi (phút)',
            dataType: 'number',
            semanticType: 'duration_minutes',
            roles: ['metric', 'filter'],
            aggregations: ['avg', 'min', 'max'],
            filterOperators: ['gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
            dateGrains: [],
            defaultAggregation: 'avg',
            nullable: true,
            available: true,
          },
          {
            id: 'created_at',
            label: 'Ngày tạo',
            dataType: 'date',
            semanticType: 'datetime',
            roles: ['dimension', 'filter'],
            aggregations: [],
            filterOperators: ['eq', 'before', 'after', 'between', 'is_null', 'is_not_null'],
            dateGrains: ['day', 'week', 'month', 'quarter', 'year'],
            defaultAggregation: null,
            nullable: true,
            available: true,
          },
          {
            id: 'need_staff_review',
            label: 'Cần xem lại',
            dataType: 'boolean',
            semanticType: 'flag',
            roles: ['dimension', 'series', 'filter'],
            aggregations: ['count'],
            filterOperators: ['eq', 'neq', 'is_null', 'is_not_null'],
            dateGrains: [],
            defaultAggregation: 'count',
            nullable: true,
            available: true,
          },
          {
            id: 'topic',
            label: 'Chủ đề',
            dataType: 'string',
            semanticType: 'topic',
            roles: ['dimension', 'filter', 'series'],
            aggregations: [],
            filterOperators: [],
            dateGrains: [],
            defaultAggregation: null,
            nullable: true,
            available: false,
            unavailableReason: 'Trường này chưa được hỗ trợ trong Trình tạo biểu đồ.',
          },
          {
            id: 'keyword',
            label: 'Từ khóa',
            dataType: 'string',
            semanticType: 'keyword',
            roles: ['dimension', 'filter', 'series'],
            aggregations: [],
            filterOperators: [],
            dateGrains: [],
            defaultAggregation: null,
            nullable: true,
            available: false,
            unavailableReason: 'Trường này chưa được hỗ trợ trong Trình tạo biểu đồ.',
          },
        ],
        relations: [],
      },
      {
        id: 'message_analytics',
        label: 'Tin nhắn',
        description: 'Dữ liệu phân tích tin nhắn.',
        available: true,
        unavailableReason: null,
        defaultDateField: 'message_at',
        defaultDimension: 'message_at',
        defaultMetric: 'record_id',
        defaultLimit: 500,
        maxLimit: 5000,
        fields: [
          {
            id: 'message_at',
            label: 'Thời gian tin nhắn',
            dataType: 'date',
            semanticType: 'datetime',
            roles: ['dimension', 'filter'],
            aggregations: [],
            filterOperators: ['eq', 'before', 'after', 'between', 'is_null', 'is_not_null'],
            dateGrains: ['day', 'week', 'month', 'quarter', 'year'],
            defaultAggregation: null,
            nullable: true,
            available: true,
          },
          {
            id: 'record_id',
            label: 'Số lượng',
            dataType: 'string',
            semanticType: 'id',
            roles: ['metric'],
            aggregations: ['count', 'count_distinct'],
            filterOperators: [],
            dateGrains: [],
            defaultAggregation: 'count',
            nullable: false,
            available: true,
          },
          {
            id: 'sentiment_score',
            label: 'Điểm cảm xúc',
            dataType: 'number',
            semanticType: 'score',
            roles: ['metric'],
            aggregations: ['avg', 'min', 'max'],
            filterOperators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
            dateGrains: [],
            defaultAggregation: 'avg',
            nullable: true,
            available: true,
          },
          {
            id: 'channel',
            label: 'Kênh',
            dataType: 'string',
            semanticType: 'channel',
            roles: ['dimension', 'filter'],
            aggregations: [],
            filterOperators: ['eq', 'neq', 'in', 'contains', 'is_null', 'is_not_null'],
            dateGrains: [],
            defaultAggregation: null,
            nullable: true,
            available: true,
          },
        ],
        relations: [],
      },
      {
        id: 'agent_performance',
        label: 'Hiệu suất Agent',
        description: 'Dữ liệu hiệu suất nhân viên.',
        available: true,
        unavailableReason: null,
        defaultDateField: null,
        defaultDimension: 'agent_name',
        defaultMetric: 'response_minutes',
        defaultLimit: 50,
        maxLimit: 500,
        fields: [
          {
            id: 'agent_name',
            label: 'Tên nhân viên',
            dataType: 'string',
            semanticType: 'agent',
            roles: ['dimension', 'filter'],
            aggregations: [],
            filterOperators: ['eq', 'neq', 'contains', 'in', 'is_null', 'is_not_null'],
            dateGrains: [],
            defaultAggregation: null,
            nullable: true,
            available: true,
          },
          {
            id: 'response_minutes',
            label: 'Thời gian phản hồi (phút)',
            dataType: 'number',
            semanticType: 'duration_minutes',
            roles: ['metric'],
            aggregations: ['avg', 'min', 'max'],
            filterOperators: ['gt', 'gte', 'lt', 'lte', 'between'],
            dateGrains: [],
            defaultAggregation: 'avg',
            nullable: true,
            available: true,
          },
        ],
        relations: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Mock preview responses
// ---------------------------------------------------------------------------
export const MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL = {
  success: true,
  message: 'Tạo bản xem trước biểu đồ thành công.',
  data: {
    mode: 'custom',
    datasetId: 'conversations',
    rows: [
      { channel: 'Facebook', metric_conversation_id_1: 142 },
      { channel: 'Zalo', metric_conversation_id_1: 87 },
      { channel: 'Webchat', metric_conversation_id_1: 54 },
      { channel: 'Email', metric_conversation_id_1: 23 },
    ],
    series: [
      {
        key: 'metric_conversation_id_1',
        label: 'Số lượng hội thoại',
        color: '#ED5206',
        axisGroup: 'left',
        seriesType: null,
        numberFormat: 'number',
      },
    ],
    dimensionKeys: ['channel'],
    generatedAt: new Date().toISOString(),
    execution: {
      rowCount: 4,
      executionTimeMs: 45,
      limit: 500,
      truncated: false,
    },
  },
};

export const MOCK_PREVIEW_CONVERSATIONS_TWO_METRICS = {
  ...MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL,
  data: {
    ...MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL.data,
    rows: [
      { channel: 'Facebook', metric_conversation_id_1: 142, metric_response_minutes_2: 3.4 },
      { channel: 'Zalo', metric_conversation_id_1: 87, metric_response_minutes_2: 4.2 },
      { channel: 'Webchat', metric_conversation_id_1: 54, metric_response_minutes_2: 2.8 },
      { channel: 'Email', metric_conversation_id_1: 23, metric_response_minutes_2: 6.1 },
    ],
    series: [
      ...MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL.data.series,
      {
        key: 'metric_response_minutes_2',
        label: 'Thời gian phản hồi (phút)',
        color: '#003865',
        axisGroup: 'right',
        seriesType: 'line',
        numberFormat: 'minutes',
      },
    ],
  },
};

export const MOCK_PREVIEW_MESSAGES_BY_MONTH = {
  success: true,
  message: 'Tạo bản xem trước biểu đồ thành công.',
  data: {
    mode: 'custom',
    datasetId: 'message_analytics',
    rows: [
      { message_at: '2026-01-01', metric_record_id_1: 320 },
      { message_at: '2026-02-01', metric_record_id_1: 410 },
      { message_at: '2026-03-01', metric_record_id_1: 285 },
    ],
    series: [
      {
        key: 'metric_record_id_1',
        label: 'Số lượng',
        color: '#003865',
        axisGroup: 'left',
        seriesType: null,
        numberFormat: 'number',
      },
    ],
    dimensionKeys: ['message_at'],
    generatedAt: new Date().toISOString(),
    execution: { rowCount: 3, executionTimeMs: 60, limit: 500, truncated: false },
  },
};

export const MOCK_PREVIEW_AGENT_NO_AI = {
  success: true,
  message: 'Tạo bản xem trước biểu đồ thành công.',
  data: {
    mode: 'custom',
    datasetId: 'agent_performance',
    rows: [
      { agent_name: 'Nguyễn Thị Thu Hương', metric_response_minutes_1: 3.2 },
      { agent_name: 'Trần Văn Nam', metric_response_minutes_1: 5.1 },
      { agent_name: 'Lê Thị Mai', metric_response_minutes_1: 4.7 },
    ],
    series: [
      {
        key: 'metric_response_minutes_1',
        label: 'Thời gian phản hồi (phút)',
        color: '#ED5206',
        axisGroup: 'left',
        seriesType: null,
        numberFormat: 'minutes',
      },
    ],
    dimensionKeys: ['agent_name'],
    generatedAt: new Date().toISOString(),
    execution: { rowCount: 3, executionTimeMs: 38, limit: 50, truncated: false },
  },
};

export const MOCK_PREVIEW_EMPTY = {
  success: true,
  message: 'Tạo bản xem trước biểu đồ thành công.',
  data: {
    mode: 'custom',
    datasetId: 'conversations',
    rows: [],
    series: [],
    dimensionKeys: [],
    generatedAt: new Date().toISOString(),
    execution: { rowCount: 0, executionTimeMs: 12, limit: 500, truncated: false },
  },
};

// ---------------------------------------------------------------------------
// Saved configs mock
// ---------------------------------------------------------------------------
export const MOCK_CONFIGS_V1 = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Config v1 (Legacy)',
    description: 'Cấu hình predefined v1',
    config: {
      version: 1,
      mode: 'predefined',
      sourceId: 'sentiment_by_date',
      chartType: 'line',
      groupBy: 'date',
      yAxes: [{ column: 'positive_count', label: 'Tích cực', color: '#ED5206', axisGroup: 'left' }],
      title: 'Cảm xúc theo ngày',
      filters: {},
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    isActive: true,
  },
];

export const MOCK_CONFIGS_V2 = [
  {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    name: 'Config v2 (Custom)',
    description: 'Cấu hình custom v2',
    config: {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel', dateGrain: null, nullHandling: 'label' }],
      metrics: [
        {
          fieldId: 'conversation_id',
          aggregation: 'count_distinct',
          alias: 'metric_conversation_id_1',
          label: 'Số lượng hội thoại',
          color: '#ED5206',
          axisGroup: 'right',
          seriesType: 'bar',
          numberFormat: 'number',
        },
      ],
      series: null,
      tooltipFields: [],
      filters: [{ fieldId: 'channel', operator: 'eq', value: 'Facebook', values: [], valueTo: null }],
      sort: [{ fieldId: 'metric_conversation_id_1', direction: 'desc' }],
      topN: 10,
      limit: 200,
      title: 'Hội thoại theo kênh v2',
      chartSettings: { showLegend: true, showDataLabels: false, showGrid: true, showTooltip: true, theme: 'flic' },
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Route intercept helpers
// ---------------------------------------------------------------------------

export async function withCatalogMock(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) }),
  );
}

export async function withPreviewMock(
  page: Page,
  body: object = MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL,
): Promise<void> {
  await page.route('**/api/chart-builder/preview', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

export async function withPreview400(page: Page, message = 'Aggregation not supported'): Promise<void> {
  await page.route('**/api/chart-builder/preview', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message, data: null }),
    }),
  );
}

export async function withPreview500(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/preview', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Internal server error while processing the request.', data: null }),
    }),
  );
}

export async function withCatalog500(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/catalog', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Internal server error while processing the request.', data: null }),
    }),
  );
}

export async function withPreviewTimeout(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/preview', (route) =>
    // Delay longer than typical UI timeout so AbortController fires first
    new Promise((resolve) => setTimeout(() => resolve(route.abort('timedout')), 35_000)),
  );
}

export async function withNoNetwork(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/**', (route) => route.abort('failed'));
}

export async function withEmptyPreview(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/preview', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PREVIEW_EMPTY) }),
  );
}

export async function withConfigsMock(page: Page, configs: object[] = []): Promise<void> {
  await page.route('**/api/chart-builder/configs', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'ok', data: configs }),
      });
    }
    return route.continue();
  });
}

export async function withSave500(page: Page): Promise<void> {
  await page.route('**/api/chart-builder/configs', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Lỗi server khi lưu cấu hình.', data: null }),
      });
    }
    return route.continue();
  });
}
