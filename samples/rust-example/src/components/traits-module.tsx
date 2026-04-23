import { code, type Children } from "@alloy-js/core";
import {
  createTypeRef,
  DocComment,
  FunctionDeclaration,
  prelude,
  SourceFile,
  TraitDeclaration,
} from "@alloy-js/rust";

import { ResultAlias } from "./error-module.js";

const { Clone, Option, Send, Sync, Vec } = prelude;

export const Serializable = createTypeRef();
export const Cacheable = createTypeRef();

export interface TraitsModuleProps {
  children?: Children;
}

export function TraitsModule(props: TraitsModuleProps) {
  return (
    <SourceFile path="traits.rs" pub>
      <DocComment>
        Traits defining serialization and caching behavior.
      </DocComment>

      <TraitDeclaration
        name="Serializable"
        refkey={Serializable}
        pub
        doc="A trait for types that can be serialized to and deserialized from bytes."
      >
        <FunctionDeclaration
          name="to_bytes"
          receiver="&self"
          returnType={
            <ResultAlias>
              <Vec>u8</Vec>
            </ResultAlias>
          }
        />

        <hbr />

        <FunctionDeclaration
          name="from_bytes"
          receiver="none"
          parameters={[{ name: "bytes", type: "&[u8]" }]}
          returnType={<ResultAlias>Self</ResultAlias>}
          whereClause="Self: Sized"
        />
      </TraitDeclaration>

      <hbr />

      <DocComment>
        A trait for types that support caching with expiration.
      </DocComment>
      <TraitDeclaration
        name="Cacheable"
        refkey={Cacheable}
        pub
        typeParameters={[
          {
            name: "V",
            constraints: [Clone, Send, Sync],
          },
        ]}
      >
        <FunctionDeclaration
          name="cache_key"
          receiver="&self"
          returnType="String"
        />

        <hbr />

        <FunctionDeclaration
          name="is_expired"
          receiver="&self"
          returnType="bool"
        />

        <hbr />

        <FunctionDeclaration
          name="cached_value"
          receiver="&self"
          returnType={<Option>&amp;V</Option>}
        />
      </TraitDeclaration>
    </SourceFile>
  );
}
