import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  GlobalFilterProvider,
  useGlobalFilters,
} from "../../src/app/context/GlobalFilterContext";

describe("GlobalFilterContext", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps draft and applied filters separate and persists them for a reload", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );
    const { result, unmount } = renderHook(() => useGlobalFilters(), { wrapper });

    act(() => result.current.updateDraft({ channel: "Facebook" }));
    expect(result.current.draftFilters.channel).toBe("Facebook");
    expect(result.current.appliedFilters.channel).toBe("Tất cả");

    act(() => result.current.applyDraft());
    expect(result.current.appliedFilters.channel).toBe("Facebook");
    unmount();

    const restored = renderHook(() => useGlobalFilters(), { wrapper });
    expect(restored.result.current.draftFilters.channel).toBe("Facebook");
    expect(restored.result.current.appliedFilters.channel).toBe("Facebook");
  });

  it("resets only when explicitly requested", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );
    const { result } = renderHook(() => useGlobalFilters(), { wrapper });

    act(() => result.current.applyFilters({ ...result.current.appliedFilters, topic: "TOEIC" }));
    expect(result.current.appliedFilters.topic).toBe("TOEIC");

    act(() => result.current.resetFilters());
    expect(result.current.appliedFilters.topic).toBe("Tất cả");
    expect(result.current.draftFilters.topic).toBe("Tất cả");
  });
});
