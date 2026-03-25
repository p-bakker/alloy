import {
  SourceFile as CoreSourceFile,
  computed,
  createScope,
  For,
  List,
  mapJoin,
  Scope,
  Show,
  SourceDirectoryContext,
  useContext,
  type Children,
} from "@alloy-js/core";
import { join } from "pathe";
import { useCrate } from "../scopes/crate.js";
import { useRustFormatOptions } from "../scopes/format-options.js";
import {
  ExtraUseRecords,
  ModuleRecords,
  RustSourceFileScope,
} from "../scopes/source-file.js";
import { InnerDocComment } from "./doc/comment.js";
import { UseStatements } from "./UseStatement.js";
import { Reference } from "./Reference.js";
import { renderVisibility } from "./visibility/visibility.js";

export interface SourceFileProps {
  path: string;
  children?: Children;
  export?: boolean | string;
  header?: Children;
  doc?: Children;
}

export function SourceFile(props: SourceFileProps) {
  const crate = useCrate();
  const directoryContext = useContext(SourceDirectoryContext)!;
  const currentDir = directoryContext.path;
  const path: string = join(currentDir, props.path);
  const scope = createScope(RustSourceFileScope, path, crate);
  const opts = useRustFormatOptions();

  return (
    <CoreSourceFile
      path={props.path}
      filetype="rs"
      reference={Reference}
      {...opts}
    >
      <Show when={Boolean(props.header)}>
        {props.header}
        <hbr />
      </Show>
      <Show when={Boolean(props.doc)}>
        <InnerDocComment>{props.doc}</InnerDocComment>
        <hbr />
      </Show>
      <Show when={scope.uses.size > 0 || scope.extraUses.size > 0}>
        <UseStatements records={scope.uses} />
        <Show when={scope.uses.size > 0 && scope.extraUses.size > 0}>
          <hbr />
        </Show>
        <ExtraUseStatements records={scope.extraUses} />
        <hbr />
        <hbr />
      </Show>
      <Show when={scope.modules.size > 0}>
        <ModStatements records={scope.modules} />
        <hbr />
        <hbr />
      </Show>
      <Scope value={scope}>
        <List doubleHardline>{props.children}</List>
      </Scope>
    </CoreSourceFile>
  );
}

interface ExtraUseStatementsProps {
  records: ExtraUseRecords;
}

function ExtraUseStatements(props: ExtraUseStatementsProps) {
  const entries = computed(() =>
    Array.from(props.records.values()).sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
  );

  return mapJoin(
    () => entries.value,
    (record) => <>use {record.path};</>,
  );
}

interface ModStatementsProps {
  records: ModuleRecords;
}

function ModStatements(props: ModStatementsProps) {
  const entries = () => Array.from(props.records.values());

  return (
    <For each={entries}>
      {(record) => <>{renderVisibility(record.visibility)}mod {record.name};</>}
    </For>
  );
}
