import { code, refkey, type Children } from "@alloy-js/core";
import {
  createTypeRef,
  DocComment,
  EnumDeclaration,
  EnumVariant,
  FunctionDeclaration,
  ImplBlock,
  MacroCall,
  MatchArm,
  MatchExpression,
  prelude,
  SourceFile,
  std,
  TypeAlias,
} from "@alloy-js/rust";

const { Result } = prelude;
const { Display, Formatter, Result: FmtResult } = std.fmt;

export const StoreError = createTypeRef();
export const storeErrorNotFoundKey = refkey();
export const storeErrorStorageFullKey = refkey();
export const storeErrorSerializationKey = refkey();
export const storeErrorLockKey = refkey();
export const ResultAlias = createTypeRef();

export interface ErrorModuleProps {
  children?: Children;
}

export function ErrorModule(props: ErrorModuleProps) {
  return (
    <SourceFile path="error.rs" pub>
      <DocComment>Error types for the key-value store.</DocComment>
      <EnumDeclaration
        name="StoreError"
        refkey={StoreError}
        pub
        derives={[std.fmt.Debug, prelude.Clone]}
      >
        <EnumVariant
          name="NotFound"
          refkey={storeErrorNotFoundKey}
          doc="The requested key was not found."
        />
        <EnumVariant
          name="StorageFull"
          refkey={storeErrorStorageFullKey}
          doc="The store has reached its maximum capacity."
        />
        <EnumVariant
          name="SerializationError"
          refkey={storeErrorSerializationKey}
          doc="Failed to serialize or deserialize a value."
          kind="tuple"
          fields={["String"]}
        />
        <EnumVariant
          name="LockError"
          refkey={storeErrorLockKey}
          doc="Failed to acquire a lock on the store."
          kind="tuple"
          fields={["String"]}
        />
      </EnumDeclaration>

      <hbr />

      <ImplBlock type={StoreError} trait={Display}>
        <FunctionDeclaration
          name="fmt"
          receiver="&self"
          parameters={[{ name: "f", type: code`&mut ${Formatter}<'_>` }]}
          returnType={FmtResult}
        >
          <MatchExpression expression="self">
            <MatchArm pattern="Self::NotFound">
              <MacroCall name="write" args={["f", '"key not found"']} />
            </MatchArm>
            <MatchArm pattern="Self::StorageFull">
              <MacroCall name="write" args={["f", '"storage is full"']} />
            </MatchArm>
            <MatchArm pattern="Self::SerializationError(msg)">
              <MacroCall
                name="write"
                args={["f", '"serialization error: {}"', "msg"]}
              />
            </MatchArm>
            <MatchArm pattern="Self::LockError(msg)">
              <MacroCall name="write" args={["f", '"lock error: {}"', "msg"]} />
            </MatchArm>
          </MatchExpression>
        </FunctionDeclaration>
      </ImplBlock>

      <hbr />

      <DocComment>A specialized Result type for store operations.</DocComment>
      <TypeAlias
        name="Result"
        refkey={ResultAlias}
        pub
        typeParameters={[{ name: "T" }]}
      >
        <Result>T, {StoreError}</Result>
      </TypeAlias>
    </SourceFile>
  );
}
