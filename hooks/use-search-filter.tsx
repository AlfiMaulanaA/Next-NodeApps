import { useMemo, useState } from "react";

function getValueByKeyPath(obj: any, keyPath: string): string {
  const keys = keyPath.split(".");
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === "object") {
      value = value[key as keyof typeof value];
    } else {
      return "";
    }
  }
  return String(value ?? "");
}

export function useSearchFilter<T>(
  data: T[],
  keys: string[]
) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const lowerQuery = searchQuery.toLowerCase();

    return data.filter((item) =>
      keys.some((key) =>
        getValueByKeyPath(item, key).toLowerCase().includes(lowerQuery)
      )
    );
  }, [searchQuery, data, keys]);

  return {
    searchQuery,
    setSearchQuery,
    filteredData,
  };
}
