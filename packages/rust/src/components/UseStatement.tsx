import { computed, mapJoin } from "@alloy-js/core";
import { useModule } from "../scopes/module.js";
import { UseRecords } from "../scopes/source-file.js";

export interface UseStatementProps {
  path: string;
}

export interface UseStatementsProps {
  records: UseRecords;
}

export function UseStatements(props: UseStatementsProps) {
  const groups = computed(() => {
    const module = useModule();
    const moduleName = module?.name;
    const std: UseStatementProps[] = [];
    const external: UseStatementProps[] = [];
    const local: UseStatementProps[] = [];

    for (const [crate, _sym] of props.records) {
      const importPath = crate.fullyQualifiedName.replace(/\//g, "::");
      if (crate.builtin) {
        std.push({ path: importPath });
      } else if (moduleName && importPath.startsWith(moduleName.replace(/\//g, "::"))) {
        local.push({ path: "crate::" + importPath.slice(moduleName.length + 1).replace(/\//g, "::") });
      } else {
        external.push({ path: importPath });
      }
    }
    std.sort((a, b) => a.path.localeCompare(b.path));
    external.sort((a, b) => a.path.localeCompare(b.path));
    local.sort((a, b) => a.path.localeCompare(b.path));

    return [std, external, local].filter(g => g.length > 0);
  });

  return mapJoin(
    () => groups.value,
    (group) => mapJoin(
      () => group,
      (imp) => <>use {imp.path};</>,
    ),
    { joiner: "\n\n" },
  );
}
