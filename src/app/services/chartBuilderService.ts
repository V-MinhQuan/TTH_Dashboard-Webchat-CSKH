import { APIResponse } from "../types/dashboard";
import {
  ChartCatalogResponse,
  ChartDataRequest,
  ChartDataResponse,
  CustomChartRequest,
  DataSourceInfo,
  SavedChartConfig,
  SavedChartConfigCreate,
} from "../types/chartBuilder";
import { buildApiUrl, fetchApiJson } from "./dashboardApi";

export async function getCatalog(): Promise<ChartCatalogResponse> {
  const response = await fetchApiJson<APIResponse<ChartCatalogResponse>>(
    buildApiUrl("/api/chart-builder/catalog"),
    { cache: false, timeoutMs: 15000 },
  );
  return response.data;
}

export async function getSources(): Promise<DataSourceInfo[]> {
  const response = await fetchApiJson<APIResponse<DataSourceInfo[]>>(
    buildApiUrl("/api/chart-builder/sources"),
    { cache: false },
  );
  return response.data;
}

export async function fetchPreview(
  request: CustomChartRequest,
  signal?: AbortSignal,
): Promise<ChartDataResponse> {
  const response = await fetchApiJson<APIResponse<ChartDataResponse>>(
    buildApiUrl("/api/chart-builder/preview"),
    {
      method: "POST",
      body: JSON.stringify(request),
      cache: false,
      signal,
      timeoutMs: 20000,
    },
  );
  return response.data;
}

export async function fetchData(
  request: ChartDataRequest | CustomChartRequest,
  signal?: AbortSignal,
): Promise<ChartDataResponse> {
  const response = await fetchApiJson<APIResponse<ChartDataResponse>>(
    buildApiUrl("/api/chart-builder/data"),
    {
      method: "POST",
      body: JSON.stringify(request),
      cache: false,
      signal,
      timeoutMs: 20000,
    },
  );
  return response.data;
}

export async function getConfigs(): Promise<SavedChartConfig[]> {
  const response = await fetchApiJson<APIResponse<SavedChartConfig[]>>(
    buildApiUrl("/api/chart-builder/configs"),
    { cache: false },
  );
  return response.data;
}

export async function saveConfig(
  config: SavedChartConfigCreate,
): Promise<SavedChartConfig> {
  const response = await fetchApiJson<APIResponse<SavedChartConfig>>(
    buildApiUrl("/api/chart-builder/configs"),
    {
      method: "POST",
      body: JSON.stringify(config),
      cache: false,
    },
  );
  return response.data;
}

export async function deleteConfig(id: string): Promise<void> {
  await fetchApiJson<APIResponse<{ id: string }>>(
    buildApiUrl(`/api/chart-builder/configs/${encodeURIComponent(id)}`),
    { method: "DELETE", cache: false },
  );
}
